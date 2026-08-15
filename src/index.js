const ALLOWED_ORIGINS = new Set([
  'https://natalikh.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
]);

const WCL_TOKEN_URL = 'https://www.warcraftlogs.com/oauth/token';
const WCL_API_URL = 'https://www.warcraftlogs.com/api/v2/client';
const WCL_CACHE_PREFIX = 'https://raidru-cache.invalid/v2/';
const COMPLETE_FIGHT_TTL = 60 * 60 * 24 * 30;
const LIVE_FIGHT_TTL = 60 * 5;
const REPORT_TTL = 60 * 10;
const BACKOFF_TTL_FALLBACK = 60 * 60;

let tokenMemo = { token: '', expiresAt: 0 };
const inFlight = new Map();

function cors(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://natalikh.github.io';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Accept,Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(data, status = 200, origin = '', extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      ...cors(origin),
      ...extra
    }
  });
}

function validCode(code) {
  return /^[a-zA-Z0-9_-]{6,64}$/.test(code || '');
}

function numeric(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function safeInt(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function cacheRequest(name) {
  return new Request(`${WCL_CACHE_PREFIX}${name}`, { method: 'GET' });
}

async function cacheGet(name) {
  try {
    if (typeof caches === 'undefined' || !caches.default) return null;
    const hit = await caches.default.match(cacheRequest(name));
    if (!hit) return null;
    return await hit.json();
  } catch (_) {
    return null;
  }
}

async function cachePut(name, value, ttl) {
  try {
    if (typeof caches === 'undefined' || !caches.default) return;
    const response = new Response(JSON.stringify(value), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': `public, max-age=${Math.max(1, Math.floor(ttl || 60))}`
      }
    });
    await caches.default.put(cacheRequest(name), response);
  } catch (_) {}
}

async function cacheDelete(name) {
  try {
    if (typeof caches === 'undefined' || !caches.default) return false;
    return await caches.default.delete(cacheRequest(name));
  } catch (_) { return false; }
}

async function withInflight(key, fn) {
  if (inFlight.has(key)) return inFlight.get(key);
  const p = Promise.resolve().then(fn).finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

async function fetchPlanJson(code) {
  const candidates = [
    `https://userdata.raidplan.io/${encodeURIComponent(code)}.json`,
    `https://userdata.raidplan.io/${encodeURIComponent(code)}.json?v=${Date.now()}`
  ];
  let lastStatus = 502;
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json,text/plain;q=0.9,*/*;q=0.1', 'User-Agent': 'RaidRU/0.8.18 RaidPlan Import' },
        redirect: 'follow',
        cf: { cacheTtl: 0, cacheEverything: false }
      });
      lastStatus = res.status;
      if (!res.ok) continue;
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { continue; }
      if (data && typeof data === 'object') return data;
    } catch (_) {}
  }
  const page = await fetch(`https://raidplan.io/plan/${encodeURIComponent(code)}`, {
    method: 'GET', headers: { 'Accept': 'text/html,*/*;q=0.8', 'User-Agent': 'RaidRU/0.8.18 RaidPlan Import' }, redirect: 'follow',
    cf: { cacheTtl: 0, cacheEverything: false }
  }).catch(() => null);
  if (page?.status === 404) { const e = new Error('NOT_FOUND'); e.status = 404; throw e; }
  const e = new Error('UPSTREAM'); e.status = lastStatus === 404 ? 404 : 502; throw e;
}

function wclConfigured(env) {
  return !!(env?.WCL_CLIENT_ID && env?.WCL_CLIENT_SECRET);
}

async function wclToken(env) {
  if (!wclConfigured(env)) {
    const e = new Error('WCL_NOT_CONFIGURED'); e.code = 'wcl_not_configured'; throw e;
  }
  if (tokenMemo.token && tokenMemo.expiresAt - Date.now() > 60000) return tokenMemo.token;
  const basic = btoa(`${env.WCL_CLIENT_ID}:${env.WCL_CLIENT_SECRET}`);
  const res = await fetch(WCL_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'RaidRU/2.0 WCL Safe Import'
    },
    body: 'grant_type=client_credentials'
  });
  if (!res.ok) {
    const e = new Error(`WCL_TOKEN_${res.status}`); e.code = 'wcl_auth_failed'; e.status = res.status; throw e;
  }
  const body = await res.json();
  if (!body?.access_token) { const e = new Error('WCL_TOKEN_EMPTY'); e.code = 'wcl_auth_failed'; throw e; }
  tokenMemo = { token: body.access_token, expiresAt: Date.now() + Math.max(60, Number(body.expires_in) || 3600) * 1000 };
  return tokenMemo.token;
}

class WclRateError extends Error {
  constructor(retryAfter = BACKOFF_TTL_FALLBACK) {
    super('WCL_RATE_LIMIT'); this.code = 'wcl_rate_limited'; this.retryAfter = Math.max(30, Number(retryAfter) || BACKOFF_TTL_FALLBACK);
  }
}

async function wclGraphql(env, query, variables = {}) {
  const token = await wclToken(env);
  const res = await fetch(WCL_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'RaidRU/2.0 WCL Safe Import'
    },
    body: JSON.stringify({ query, variables })
  });
  if (res.status === 429) {
    const ra = Number(res.headers.get('Retry-After')) || BACKOFF_TTL_FALLBACK;
    throw new WclRateError(ra);
  }
  if (res.status === 401 || res.status === 403) {
    tokenMemo = { token: '', expiresAt: 0 };
  }
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch (_) {}
  if (!res.ok) {
    const e = new Error(`WCL_HTTP_${res.status}`); e.code = res.status === 401 || res.status === 403 ? 'wcl_auth_failed' : 'wcl_http_error'; e.status = res.status; e.detail = text.slice(0, 500); throw e;
  }
  if (body?.errors?.length) {
    const e = new Error(body.errors.map(x => x.message || 'GraphQL error').join('; ')); e.code = 'wcl_graphql_error'; e.graphql = body.errors; throw e;
  }
  return body?.data || {};
}

const REPORT_QUERY = `
query RaidRUReport($code: String!) {
  rateLimitData { limitPerHour pointsSpentThisHour pointsResetIn }
  reportData {
    report(code: $code) {
      code title startTime endTime
      fights {
        id encounterID originalEncounterID name difficulty kill startTime endTime inProgress size
        maps { id }
      }
      masterData {
        actors { id name type subType }
      }
    }
  }
}`;

const QUOTA_QUERY = `query RaidRUQuota { rateLimitData { limitPerHour pointsSpentThisHour pointsResetIn } }`;

function eventsQuery(fightId) {
  return `
query RaidRUEvents($code: String!, $start: Float!, $end: Float!, $limit: Int!) {
  rateLimitData { limitPerHour pointsSpentThisHour pointsResetIn }
  reportData {
    report(code: $code) {
      events(fightIDs: [${fightId}], startTime: $start, endTime: $end, limit: $limit, includeResources: true) {
        data
        nextPageTimestamp
      }
    }
  }
}`;
}

function normalizeQuota(q) {
  if (!q) return null;
  const limit = Number(q.limitPerHour) || 0, spent = Number(q.pointsSpentThisHour) || 0, reset = Number(q.pointsResetIn) || 0;
  return { limitPerHour: limit, pointsSpentThisHour: spent, pointsResetIn: reset, remaining: Math.max(0, limit - spent), usedRatio: limit > 0 ? spent / limit : 0 };
}

function softLimit(env) {
  const n = Number(env?.WCL_SOFT_LIMIT);
  return Number.isFinite(n) && n >= 0.5 && n <= 0.9 ? n : 0.70;
}

function minReserve(env, limit) {
  const configured = Number(env?.WCL_MIN_RESERVE);
  const base = Number.isFinite(configured) && configured >= 100 ? configured : 500;
  return Math.max(base, Math.ceil((limit || 0) * 0.20));
}

function maxPages(env) {
  const n = Number(env?.WCL_MAX_PAGES_PER_REQUEST);
  return Number.isInteger(n) && n >= 2 && n <= 20 ? n : 8;
}

function eventPageLimit(env) {
  const n = Number(env?.WCL_EVENT_PAGE_LIMIT);
  // Deliberately below WCL's 10k maximum: one expensive page must never be able
  // to consume most of the hourly budget before we can inspect rateLimitData again.
  return Number.isInteger(n) && n >= 500 && n <= 5000 ? n : 2500;
}

function quotaUnsafe(q, env, estimatedNext = 0) {
  q = normalizeQuota(q);
  if (!q || !q.limitPerHour) return false;
  const reserve = minReserve(env, q.limitPerHour);
  return q.usedRatio >= softLimit(env) || q.remaining <= reserve + Math.max(0, estimatedNext || 0);
}

function publicReport(report, quota = null, cache = 'miss') {
  return {
    code: report.code,
    title: report.title || '',
    startTime: numeric(report.startTime) || 0,
    endTime: numeric(report.endTime) || 0,
    fights: (report.fights || []).map(f => ({
      id: safeInt(f.id), encounterID: safeInt(f.encounterID) || 0, originalEncounterID: safeInt(f.originalEncounterID) || 0,
      name: f.name || `Бой #${f.id}`, difficulty: f.difficulty ?? null, kill: !!f.kill,
      startTime: numeric(f.startTime) || 0, endTime: numeric(f.endTime) || 0, inProgress: !!f.inProgress,
      size: safeInt(f.size) || null, mapIDs: (f.maps || []).map(m => safeInt(m?.id)).filter(Boolean)
    })).filter(f => f.id),
    actors: (report.masterData?.actors || []).map(a => ({ id: a.id, name: a.name || `Actor ${a.id}`, type: a.type || '', subType: a.subType || '' })),
    quota: normalizeQuota(quota), cache
  };
}

async function getReport(env, code, { forceQuota = false } = {}) {
  const cacheName = `wcl/report/${code}`;
  const cached = await cacheGet(cacheName);
  if (cached && !forceQuota) return { ...cached, cache: 'hit' };
  const data = await wclGraphql(env, REPORT_QUERY, { code });
  const report = data?.reportData?.report;
  if (!report) { const e = new Error('WCL_REPORT_NOT_FOUND'); e.code = 'wcl_report_not_found'; throw e; }
  const out = publicReport(report, data.rateLimitData, 'miss');
  const recent = Date.now() - (out.endTime || 0) < 2 * 60 * 60 * 1000;
  await cachePut(cacheName, out, recent ? REPORT_TTL : COMPLETE_FIGHT_TTL);
  return out;
}

async function getQuota(env) {
  const data = await wclGraphql(env, QUOTA_QUERY, {});
  return normalizeQuota(data?.rateLimitData);
}

function pageCacheName(code, fightId, start) {
  return `wcl/page/${code}/${fightId}/${Math.round(start)}`;
}

function positionCandidate(e, fightStart, playerIds, defaultMapID) {
  const out = [];
  const timestamp = numeric(e.timestamp) ?? numeric(e.t);
  if (timestamp == null) return out;
  const t = Math.max(0, timestamp - fightStart);
  const sourceID = e.resourceActor1 ?? e.sourceID ?? e.actorID ?? e.source?.id;
  const targetID = e.resourceActor2 ?? e.targetID ?? e.target?.id;
  const mapID = safeInt(e.mapID) || defaultMapID || null;
  const add = (actorId, tt, x, y, facing, source) => {
    if (actorId == null || !playerIds.has(String(actorId))) return;
    x = numeric(x); y = numeric(y); tt = numeric(tt);
    if (x == null || y == null || tt == null) return;
    out.push({ actorId: safeInt(actorId) || actorId, t: Math.max(0, tt - fightStart), x, y, facing: numeric(facing), mapID, source });
  };
  add(sourceID, timestamp, e.x ?? e.sourceX, e.y ?? e.sourceY, e.facing ?? e.sourceFacing, 'event');
  if (numeric(e.nextX) != null && numeric(e.nextY) != null) add(sourceID, e.nextTimestamp ?? timestamp, e.nextX, e.nextY, e.nextFacing ?? e.facing, 'next');
  if (numeric(e.targetX) != null && numeric(e.targetY) != null) add(targetID, timestamp, e.targetX, e.targetY, e.targetFacing, 'target');
  return out;
}

function compactWclPage(events, meta, fight) {
  const playerIds = new Set((meta.actors || []).filter(a => String(a.type).toLowerCase() === 'player').map(a => String(a.id)));
  const fightStart = Number(fight.startTime) || 0, defaultMapID = fight.mapIDs?.[0] || null;
  const positions = [], casts = [];
  let scanned = 0;
  for (const e of Array.isArray(events) ? events : []) {
    scanned++;
    positions.push(...positionCandidate(e, fightStart, playerIds, defaultMapID));
    const type = String(e.type || '').toLowerCase();
    if (type !== 'cast' && type !== 'begincast') continue;
    const sourceID = e.sourceID ?? e.resourceActor1 ?? e.source?.id ?? null;
    if (sourceID != null && playerIds.has(String(sourceID))) continue;
    const abilityID = safeInt(e.abilityGameID ?? e.abilityID ?? e.ability?.gameID ?? e.ability?.id) || null;
    const abilityName = e.abilityName || e.ability?.name || e.name || (abilityID ? `Способность ${abilityID}` : 'Способность босса');
    const timestamp = numeric(e.timestamp) ?? numeric(e.t);
    if (timestamp == null) continue;
    casts.push({
      t: Math.max(0, timestamp - fightStart), type, sourceID: safeInt(sourceID) || sourceID,
      targetID: safeInt(e.targetID ?? e.resourceActor2 ?? e.target?.id) || e.targetID || null,
      sourceIsFriendly: false, targetIsFriendly: playerIds.has(String(e.targetID ?? e.resourceActor2 ?? '')),
      abilityID, abilityName
    });
  }
  return { positions, casts, scanned };
}

function thinPositions(points) {
  const byActor = new Map();
  for (const p of points) {
    const k = String(p.actorId); if (!byActor.has(k)) byActor.set(k, []); byActor.get(k).push(p);
  }
  const out = [];
  for (const arr of byActor.values()) {
    arr.sort((a, b) => a.t - b.t);
    let last = null;
    for (const p of arr) {
      if (!last) { out.push(p); last = p; continue; }
      const dt = p.t - last.t, dx = p.x - last.x, dy = p.y - last.y, dist2 = dx * dx + dy * dy;
      if (dt >= 180 || dist2 >= 100 || (p.mapID && p.mapID !== last.mapID)) { out.push(p); last = p; }
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

function dedupeCasts(casts) {
  casts.sort((a, b) => a.t - b.t);
  const out = [], last = new Map();
  for (const e of casts) {
    const key = `${e.sourceID || 0}:${e.abilityID || e.abilityName}`;
    const prev = last.get(key);
    if (prev != null && e.t - prev < 900) continue;
    last.set(key, e.t); out.push(e);
  }
  return out;
}

function replayBounds(points) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  return Number.isFinite(minX) ? { minX, maxX, minY, maxY } : null;
}

async function fetchCompactPage(env, meta, fight, start, previousQuota) {
  const cacheName = pageCacheName(meta.code, fight.id, start);
  const cached = await cacheGet(cacheName);
  if (cached) return { page: cached, quota: previousQuota, cache: 'hit', cost: 0 };

  const before = normalizeQuota(previousQuota) || await getQuota(env);
  if (quotaUnsafe(before, env, 0)) {
    const e = new Error('WCL_BUDGET_GUARD'); e.code = 'wcl_budget_guard'; e.quota = before; throw e;
  }

  const data = await wclGraphql(env, eventsQuery(fight.id), { code: meta.code, start, end: fight.endTime, limit: eventPageLimit(env) });
  const after = normalizeQuota(data?.rateLimitData) || before;
  const raw = data?.reportData?.report?.events;
  if (!raw || !Array.isArray(raw.data)) { const e = new Error('WCL_EVENTS_EMPTY'); e.code = 'wcl_events_unavailable'; throw e; }
  const compact = compactWclPage(raw.data, meta, fight);
  const page = { ...compact, start, nextPageTimestamp: numeric(raw.nextPageTimestamp), fetchedAt: Date.now() };
  const ttl = fight.inProgress ? LIVE_FIGHT_TTL : COMPLETE_FIGHT_TTL;
  await cachePut(cacheName, page, ttl);
  const cost = before && after && after.pointsSpentThisHour >= before.pointsSpentThisHour ? after.pointsSpentThisHour - before.pointsSpentThisHour : 0;
  return { page, quota: after, cache: 'miss', cost };
}

async function backoffState(code, fightId) {
  return cacheGet(`wcl/backoff/${code}/${fightId || 'report'}`);
}

async function setBackoff(code, fightId, retryAfter, reason, quota) {
  const sec = Math.max(30, Number(retryAfter) || BACKOFF_TTL_FALLBACK);
  const value = { reason, retryAfter: sec, until: Date.now() + sec * 1000, quota: normalizeQuota(quota) };
  await cachePut(`wcl/backoff/${code}/${fightId || 'report'}`, value, sec);
  return value;
}

function progressCacheName(code, fightId) { return `wcl/progress/${code}/${fightId}`; }

async function loadProgress(code, fight) {
  const p = await cacheGet(progressCacheName(code, fight.id));
  if (!p || Number(p.fightStart) !== Number(fight.startTime) || Number(p.fightEnd) !== Number(fight.endTime)) return null;
  return p;
}

async function saveProgress(code, fight, progress) {
  const ttl = fight.inProgress ? LIVE_FIGHT_TTL : COMPLETE_FIGHT_TTL;
  await cachePut(progressCacheName(code, fight.id), { ...progress, fightStart: fight.startTime, fightEnd: fight.endTime, savedAt: Date.now() }, ttl);
}

function selectFight(meta, requested) {
  const fights = (meta.fights || []).filter(f => f.id);
  if (!fights.length) return null;
  if (requested === 'last') return fights.slice().sort((a, b) => b.id - a.id)[0];
  const id = safeInt(requested); return fights.find(f => f.id === id) || null;
}

async function buildReplay(env, code, fightParam) {
  const finalName = `wcl/replay/${code}/${fightParam}`;
  const cachedFinal = await cacheGet(finalName);
  if (cachedFinal) return { status: 200, body: { ...cachedFinal, cache: 'hit' } };

  const meta = await getReport(env, code);
  const fight = selectFight(meta, fightParam);
  if (!fight) return { status: 404, body: { error: 'fight_not_found', fights: meta.fights } };
  const actualFinalName = `wcl/replay/${code}/${fight.id}`;
  if (actualFinalName !== finalName) {
    const hit = await cacheGet(actualFinalName);
    if (hit) return { status: 200, body: { ...hit, cache: 'hit' } };
  }

  const backoff = await backoffState(code, fight.id);
  if (backoff?.until > Date.now()) {
    return { status: 202, body: { error: backoff.reason || 'wcl_budget_guard', retryAfter: Math.ceil((backoff.until - Date.now()) / 1000), quota: backoff.quota, cachedProgress: true } };
  }

  // Always take a current quota snapshot before an uncached replay batch. Report
  // metadata itself may have been served from a long-lived cache and its quota value
  // must never be trusted as a current guard.
  let quota = await getQuota(env);
  let progress = await loadProgress(code, fight);
  if (!progress) {
    progress = {
      cursor: fight.startTime,
      positions: [], casts: [], rawEvents: 0,
      pages: 0, fetchedPages: 0, cachedPages: 0, lastCost: 0
    };
  }

  let cursor = numeric(progress.cursor);
  if (cursor == null) cursor = fight.startTime;
  const positions = Array.isArray(progress.positions) ? progress.positions : [];
  const casts = Array.isArray(progress.casts) ? progress.casts : [];
  let rawEvents = Number(progress.rawEvents) || 0;
  let pages = Number(progress.pages) || 0;
  let fetchedPages = Number(progress.fetchedPages) || 0;
  let cachedPages = Number(progress.cachedPages) || 0;
  let lastCost = Number(progress.lastCost) || 0;
  let fetchedThisRequest = 0;
  const seenCursor = new Set();
  let complete = false;

  while (cursor != null && cursor <= fight.endTime) {
    if (seenCursor.has(String(cursor))) { complete = true; break; }
    seenCursor.add(String(cursor));

    let got;
    try {
      got = await fetchCompactPage(env, meta, fight, cursor, quota);
    } catch (e) {
      progress = { cursor, positions, casts, rawEvents, pages, fetchedPages, cachedPages, lastCost };
      await saveProgress(code, fight, progress);
      if (e instanceof WclRateError || e?.code === 'wcl_rate_limited') {
        const b = await setBackoff(code, fight.id, e.retryAfter, 'wcl_rate_limited', quota);
        return { status: 202, body: { error: 'wcl_rate_limited', retryAfter: b.retryAfter, fightId: fight.id, pages, fetchedPages, cachedPages, nextStart: cursor, quota: normalizeQuota(quota), cachedProgress: true } };
      }
      if (e?.code === 'wcl_budget_guard') {
        const q = normalizeQuota(e.quota) || normalizeQuota(quota);
        const b = await setBackoff(code, fight.id, q?.pointsResetIn || BACKOFF_TTL_FALLBACK, 'wcl_budget_guard', q);
        return { status: 202, body: { error: 'wcl_budget_guard', retryAfter: b.retryAfter, fightId: fight.id, pages, fetchedPages, cachedPages, nextStart: cursor, quota: q, cachedProgress: true, message: 'Страницы уже сохранены. После сброса квоты загрузка продолжится с контрольной точки.' } };
      }
      throw e;
    }

    pages++;
    if (got.cache === 'hit') cachedPages++;
    else { fetchedPages++; fetchedThisRequest++; }
    quota = got.quota || quota;
    lastCost = got.cost || lastCost;
    rawEvents += got.page.scanned || 0;
    positions.push(...(got.page.positions || []));
    casts.push(...(got.page.casts || []));

    const next = numeric(got.page.nextPageTimestamp);
    if (next == null || next <= cursor || next > fight.endTime) {
      complete = true;
      cursor = null;
    } else {
      cursor = next;
    }

    progress = { cursor, positions, casts, rawEvents, pages, fetchedPages, cachedPages, lastCost };
    await saveProgress(code, fight, progress);

    if (!complete && fetchedThisRequest >= maxPages(env)) {
      return { status: 202, body: { error: 'batch_yield', retryAfter: 1, fightId: fight.id, pages, fetchedPages, cachedPages, fetchedThisRequest, nextStart: cursor, quota: normalizeQuota(quota), cachedProgress: true } };
    }
    // Predict the cost of the next page from the page we just paid for. A 1.5x
    // margin means a sudden denser page still has to fit inside the protected reserve.
    if (!complete && quotaUnsafe(quota, env, Math.ceil(lastCost * 1.5))) {
      const b = await setBackoff(code, fight.id, quota?.pointsResetIn || BACKOFF_TTL_FALLBACK, 'wcl_budget_guard', quota);
      return { status: 202, body: { error: 'wcl_budget_guard', retryAfter: b.retryAfter, fightId: fight.id, pages, fetchedPages, cachedPages, nextStart: cursor, quota: normalizeQuota(quota), cachedProgress: true, message: 'RaidRU остановил WCL заранее. Уже полученные страницы сохранены.' } };
    }
  }

  if (!complete) {
    return { status: 202, body: { error: 'batch_yield', retryAfter: 1, fightId: fight.id, pages, fetchedPages, cachedPages, nextStart: cursor, quota: normalizeQuota(quota), cachedProgress: true } };
  }

  const thin = thinPositions(positions), timeline = dedupeCasts(casts);
  const actors = (meta.actors || []).filter(a => String(a.type).toLowerCase() === 'player').map(a => ({ id: a.id, name: a.name, type: 'Player', subType: a.subType || '' }));
  const mapIDs = {};
  for (const p of thin) if (p.mapID) mapIDs[p.mapID] = (mapIDs[p.mapID] || 0) + 1;
  if (!Object.keys(mapIDs).length) for (const id of fight.mapIDs || []) mapIDs[id] = 1;
  const body = {
    format: 'raidru-wcl-safe-replay', version: 2, createdAt: new Date().toISOString(), cache: 'miss',
    source: { pageUrl: `https://www.warcraftlogs.com/reports/${code}?fight=${fight.id}&view=replay`, reportCode: code, fight: String(fight.id), bossId: fight.encounterID || fight.originalEncounterID || 0, safeImport: true },
    report: { code, title: meta.title || '' },
    fight: { id: fight.id, name: fight.name, bossId: fight.encounterID || fight.originalEncounterID || 0, startTime: fight.startTime, endTime: fight.endTime, duration: Math.max(1, fight.endTime - fight.startTime), difficulty: fight.difficulty, kill: fight.kill, inProgress: fight.inProgress },
    actors, positions: thin, events: timeline, duration: Math.max(1, fight.endTime - fight.startTime), mapIDs,
    stats: { rawEvents, compactPositionPoints: thin.length, timelineEvents: timeline.length, pages, fetchedPages, cachedPages, eventPageLimit: eventPageLimit(env) },
    quota: normalizeQuota(quota)
  };
  const ttl = fight.inProgress ? LIVE_FIGHT_TTL : COMPLETE_FIGHT_TTL;
  await cachePut(actualFinalName, body, ttl);
  if (actualFinalName !== finalName) await cachePut(finalName, body, ttl);
  await cacheDelete(progressCacheName(code, fight.id));
  return { status: 200, body };
}

function wclErrorBody(e) {
  return { error: e?.code || 'wcl_unavailable', message: e?.message || 'Warcraft Logs unavailable', status: e?.status || null };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url), origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: 'origin_not_allowed' }, 403, origin);

    if (url.pathname === '/health') {
      return json({ ok: true, service: 'raidru-edge', version: '2.0.0-wcl-safe', wclConfigured: wclConfigured(env), features: ['raidplan', 'wcl-report', 'wcl-safe-replay', 'quota-guard', 'resume-cache'] }, 200, origin);
    }

    if (url.pathname === '/raidplan' && request.method === 'GET') {
      const code = (url.searchParams.get('code') || '').trim();
      if (!validCode(code)) return json({ error: 'invalid_code' }, 400, origin);
      try { return json(await fetchPlanJson(code), 200, origin); }
      catch (e) { return json({ error: e?.status === 404 ? 'plan_not_found' : 'raidplan_unavailable' }, e?.status === 404 ? 404 : 502, origin); }
    }

    if (url.pathname === '/wcl/report' && request.method === 'GET') {
      const code = (url.searchParams.get('code') || '').trim();
      if (!validCode(code)) return json({ error: 'invalid_report_code' }, 400, origin);
      const key = `report:${code}`;
      try {
        const result = await withInflight(key, async () => {
          const backoff = await backoffState(code, null);
          if (backoff?.until > Date.now()) return { status: 202, body: { error: backoff.reason, retryAfter: Math.ceil((backoff.until - Date.now()) / 1000), quota: backoff.quota } };
          try { return { status: 200, body: await getReport(env, code) }; }
          catch (e) {
            if (e instanceof WclRateError) { const b = await setBackoff(code, null, e.retryAfter, 'wcl_rate_limited', null); return { status: 202, body: { error: 'wcl_rate_limited', retryAfter: b.retryAfter } }; }
            throw e;
          }
        });
        return json(result.body, result.status, origin, { 'X-RaidRU-WCL-Safe': '1' });
      } catch (e) { return json(wclErrorBody(e), e?.code === 'wcl_report_not_found' ? 404 : e?.code === 'wcl_not_configured' ? 503 : 502, origin); }
    }

    if (url.pathname === '/wcl/replay' && request.method === 'GET') {
      const code = (url.searchParams.get('code') || '').trim(), fight = (url.searchParams.get('fight') || '').trim().toLowerCase();
      if (!validCode(code)) return json({ error: 'invalid_report_code' }, 400, origin);
      if (!(fight === 'last' || safeInt(fight))) return json({ error: 'invalid_fight' }, 400, origin);
      const key = `replay:${code}:${fight}`;
      try {
        const result = await withInflight(key, () => buildReplay(env, code, fight));
        return json(result.body, result.status, origin, { 'X-RaidRU-WCL-Safe': '1' });
      } catch (e) {
        if (e instanceof WclRateError || e?.code === 'wcl_rate_limited') {
          const b = await setBackoff(code, safeInt(fight), e.retryAfter, 'wcl_rate_limited', null);
          return json({ error: 'wcl_rate_limited', retryAfter: b.retryAfter, cachedProgress: true }, 202, origin);
        }
        return json(wclErrorBody(e), e?.code === 'wcl_not_configured' ? 503 : 502, origin);
      }
    }

    return json({ error: 'not_found' }, 404, origin);
  }
};
