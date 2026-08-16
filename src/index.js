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
let quotaMemo = { value: null, expiresAt: 0 };
const inFlight = new Map();

function cors(origin, { echo = false } = {}) {
  // Public GET API, but only the RaidRU site is allowed to consume WCL quota.
  // For a denied origin we can still echo it on the 403 response so the browser
  // exposes the useful JSON error instead of collapsing it into TypeError: Failed to fetch.
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : (echo && origin ? origin : 'https://natalikh.github.io');
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Accept,Content-Type',
    'Access-Control-Expose-Headers': 'X-RaidRU-WCL-Safe,X-RaidRU-Origin',
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
      'User-Agent': 'RaidRU/2.0.8 WCL Workspace'
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
      'User-Agent': 'RaidRU/2.0.8 WCL Workspace'
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

function eventsQuery(fightId, mode = 'casts') {
  const filter = mode === 'casts' ? 'dataType: Casts,' : '';
  return `
query RaidRUEvents($code: String!, $start: Float!, $end: Float!, $limit: Int!) {
  rateLimitData { limitPerHour pointsSpentThisHour pointsResetIn }
  reportData {
    report(code: $code) {
      events(${filter} fightIDs: [${fightId}], startTime: $start, endTime: $end, limit: $limit, includeResources: true) {
        data
        nextPageTimestamp
      }
    }
  }
}`;
}

// 2.0.5 fast path: a normal URL containing an explicit numeric fight ID is
// intentionally resolved with ONE WCL GraphQL request per user action. The same
// query returns report metadata, actors, the selected fight and one page of casts
// with resource coordinates. This removes the old report + quota + events triple
// request that could burn a small hourly budget before Replay was even usable.
function oneShotReplayQuery(fightId, mode = 'casts', hasStart = false) {
  const filter = mode === 'casts' ? 'dataType: Casts,' : '';
  const startArg = hasStart ? 'startTime: $start,' : '';
  return `
query RaidRUOneShot($code: String!, $limit: Int!${hasStart ? ', $start: Float!' : ''}) {
  rateLimitData { limitPerHour pointsSpentThisHour pointsResetIn }
  reportData {
    report(code: $code) {
      code title startTime endTime
      fights {
        id encounterID originalEncounterID name difficulty kill startTime endTime inProgress size
        maps { id }
      }
      masterData { actors { id name type subType } }
      events(${filter} fightIDs: [${fightId}], ${startArg} limit: $limit, includeResources: true) {
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
  // Crossing the soft limit no longer disables RaidRU. It only forces the
  // low-cost casts sampler. The hard guard below is what can actually pause WCL.
  const n = Number(env?.WCL_SOFT_LIMIT);
  return Number.isFinite(n) && n >= 0.5 && n <= 0.95 ? n : 0.85;
}

function hardLimit(env) {
  // 2.0.4 does not turn a still-usable WCL budget into an artificial 20-40 minute lock.
  // The hard threshold only means "there is effectively no budget left".
  const n = Number(env?.WCL_HARD_LIMIT);
  return Number.isFinite(n) && n >= 0.98 && n <= 0.9999 ? n : 0.999;
}

function minReserve(env, limit) {
  // Keep only a tiny safety margin. Page size is reduced dynamically as quota gets tight.
  const configured = Number(env?.WCL_MIN_RESERVE);
  const base = Number.isFinite(configured) && configured >= 1 ? configured : 2;
  return Math.max(base, Math.ceil((limit || 0) * 0.002));
}

function maxPages(env) {
  const n = Number(env?.WCL_MAX_PAGES_PER_REQUEST);
  return Number.isInteger(n) && n >= 2 && n <= 25 ? n : 16;
}

function eventPageLimit(env, mode = 'casts') {
  const n = Number(env?.WCL_EVENT_PAGE_LIMIT);
  // WCL explicitly allows up to 10k events. Fast mode uses that maximum so a
  // normal fight is usually only one or a few GraphQL event requests.
  const fallback = mode === 'casts' ? 10000 : 5000;
  return Number.isInteger(n) && n >= 500 && n <= 10000 ? n : fallback;
}

function quotaUnsafe(q, env, estimatedNext = 0) {
  q = normalizeQuota(q);
  if (!q || !q.limitPerHour) return false;
  const reserve = minReserve(env, q.limitPerHour);
  const predicted = Math.max(0, Number(estimatedNext) || 0);
  // Only stop when the real remaining budget cannot plausibly fit another request.
  // At 90-98% usage we downshift the event page instead of disabling the feature.
  return q.usedRatio >= hardLimit(env) || q.remaining <= Math.max(reserve, predicted);
}

function adaptiveEventLimit(q, lastCost, env, mode = 'casts') {
  const base = eventPageLimit(env, mode);
  q = normalizeQuota(q);
  if (!q || !q.limitPerHour) return base;
  const remaining = Math.max(0, q.remaining);
  const reserve = minReserve(env, q.limitPerHour);
  if (remaining <= reserve) return 0;

  // Quota-based ceiling: as the budget gets tight the worker can only shrink,
  // never accidentally grow the next page after measuring a cheap request.
  let quotaCeiling = base;
  if (q.usedRatio >= 0.99) quotaCeiling = Math.min(base, 500);
  else if (q.usedRatio >= 0.97) quotaCeiling = Math.min(base, 1000);
  else if (q.usedRatio >= 0.94) quotaCeiling = Math.min(base, 2000);
  else if (q.usedRatio >= 0.90) quotaCeiling = Math.min(base, 5000);
  if (!(Number(lastCost) > 0)) return quotaCeiling;

  // Once we know the actual WCL point cost of a page, scale the next page to the
  // available budget instead of waiting for the hourly reset.
  const available = Math.max(1, remaining - reserve);
  const measured = Math.max(1, Number(lastCost) || 1);
  const ratio = Math.min(1, available / (measured * 1.35));
  if (ratio >= 0.9) return quotaCeiling;
  const stepped = Math.floor((base * Math.max(0.05, ratio)) / 100) * 100;
  return Math.max(500, Math.min(quotaCeiling, stepped || 500));
}

function chooseFetchMode(q, env, requested = 'smart') {
  if (requested === 'full') return 'all';
  if (requested === 'fast') return 'casts';
  q = normalizeQuota(q);
  // Smart is intentionally fast-first. For raid planning we need a usable
  // movement sample, not every combat event in the log.
  if (!q || !q.limitPerHour) return 'casts';
  return q.usedRatio >= softLimit(env) ? 'casts' : 'casts';
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
  rememberQuota(data.rateLimitData);
  const out = publicReport(report, data.rateLimitData, 'miss');
  const recent = Date.now() - (out.endTime || 0) < 2 * 60 * 60 * 1000;
  await cachePut(cacheName, out, recent ? REPORT_TTL : COMPLETE_FIGHT_TTL);
  return out;
}

function rememberQuota(q, ttlMs = 15000) {
  q = normalizeQuota(q);
  if (q) quotaMemo = { value: q, expiresAt: Date.now() + Math.max(1000, ttlMs) };
  return q;
}

async function getQuota(env, { force = false } = {}) {
  if (!force && quotaMemo.value && quotaMemo.expiresAt > Date.now()) return quotaMemo.value;
  const data = await wclGraphql(env, QUOTA_QUERY, {});
  return rememberQuota(data?.rateLimitData);
}

function pageCacheName(code, fightId, start, mode = 'casts') {
  return `wcl/page-v203/${mode}/${code}/${fightId}/${Math.round(start)}`;
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

async function fetchCompactPage(env, meta, fight, start, previousQuota, mode = 'casts', limitOverride = null) {
  const cacheName = pageCacheName(meta.code, fight.id, start, mode);
  const cached = await cacheGet(cacheName);
  if (cached) return { page: cached, quota: previousQuota, cache: 'hit', cost: 0, mode };

  const before = normalizeQuota(previousQuota) || await getQuota(env);
  const pageLimit = Number(limitOverride) > 0 ? Math.max(500, Math.min(10000, Math.floor(Number(limitOverride)))) : eventPageLimit(env, mode);
  if (quotaUnsafe(before, env, 0)) {
    const e = new Error('WCL_QUOTA_EMPTY'); e.code = 'wcl_quota_empty'; e.quota = before; throw e;
  }

  let data;
  try {
    data = await wclGraphql(env, eventsQuery(fight.id, mode), { code: meta.code, start, end: fight.endTime, limit: pageLimit });
  } catch (e) {
    // If a future WCL schema ever rejects Casts, fall back once to the generic
    // event stream instead of making direct-link import unusable.
    if (mode === 'casts' && e?.code === 'wcl_graphql_error') {
      data = await wclGraphql(env, eventsQuery(fight.id, 'all'), { code: meta.code, start, end: fight.endTime, limit: Math.min(pageLimit, eventPageLimit(env, 'all')) });
      mode = 'all';
    } else throw e;
  }
  const after = rememberQuota(data?.rateLimitData) || before;
  const raw = data?.reportData?.report?.events;
  if (!raw || !Array.isArray(raw.data)) { const e = new Error('WCL_EVENTS_EMPTY'); e.code = 'wcl_events_unavailable'; throw e; }
  const compact = compactWclPage(raw.data, meta, fight);
  const page = { ...compact, start, nextPageTimestamp: numeric(raw.nextPageTimestamp), fetchedAt: Date.now(), mode, eventLimit: pageLimit };
  const ttl = fight.inProgress ? LIVE_FIGHT_TTL : COMPLETE_FIGHT_TTL;
  await cachePut(pageCacheName(meta.code, fight.id, start, mode), page, ttl);
  const cost = before && after && after.pointsSpentThisHour >= before.pointsSpentThisHour ? after.pointsSpentThisHour - before.pointsSpentThisHour : 0;
  return { page, quota: after, cache: 'miss', cost, mode, eventLimit: pageLimit };
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

function replayBodyFromProgress(meta, fight, progress, quota, { partial = false, fetchMode = 'casts', resumeAfter = 0, cache = 'miss' } = {}) {
  const positions = Array.isArray(progress?.positions) ? progress.positions : [];
  const casts = Array.isArray(progress?.casts) ? progress.casts : [];
  const thin = thinPositions(positions), timeline = dedupeCasts(casts);
  const actors = (meta.actors || []).filter(a => String(a.type).toLowerCase() === 'player').map(a => ({ id: a.id, name: a.name, type: 'Player', subType: a.subType || '' }));
  const mapIDs = {};
  for (const p of thin) if (p.mapID) mapIDs[p.mapID] = (mapIDs[p.mapID] || 0) + 1;
  if (!Object.keys(mapIDs).length) for (const id of fight.mapIDs || []) mapIDs[id] = 1;
  const covered = new Set(thin.map(p => String(p.actorId))).size;
  const coverage = actors.length ? Math.min(1, covered / actors.length) : 0;
  const quality = partial ? 'partial' : (fetchMode === 'casts' ? 'fast' : 'full');
  return {
    format: 'raidru-wcl-safe-replay', version: 3, createdAt: new Date().toISOString(), cache,
    partial, quality, resumeAfter: partial ? Math.max(0, Number(resumeAfter) || 0) : 0,
    source: {
      pageUrl: `https://www.warcraftlogs.com/reports/${meta.code}?fight=${fight.id}&view=replay`,
      reportCode: meta.code, fight: String(fight.id),
      bossId: fight.encounterID || fight.originalEncounterID || 0,
      safeImport: true, fetchMode
    },
    report: { code: meta.code, title: meta.title || '' },
    fight: {
      id: fight.id, name: fight.name,
      bossId: fight.encounterID || fight.originalEncounterID || 0,
      startTime: fight.startTime, endTime: fight.endTime,
      duration: Math.max(1, fight.endTime - fight.startTime),
      difficulty: fight.difficulty, kill: fight.kill, inProgress: fight.inProgress
    },
    actors, positions: thin, events: timeline,
    duration: Math.max(1, fight.endTime - fight.startTime), mapIDs,
    stats: {
      rawEvents: Number(progress?.rawEvents) || 0,
      compactPositionPoints: thin.length,
      timelineEvents: timeline.length,
      pages: Number(progress?.pages) || 0,
      fetchedPages: Number(progress?.fetchedPages) || 0,
      cachedPages: Number(progress?.cachedPages) || 0,
      eventPageLimit: eventPageLimit(null, fetchMode),
      fetchMode,
      actorCoverage: coverage
    },
    quota: normalizeQuota(quota)
  };
}


function replayPositionsByActor(points) {
  const out = {};
  for (const p of Array.isArray(points) ? points : []) {
    const k = String(p.actorId);
    if (!out[k]) out[k] = [];
    out[k].push(p);
  }
  for (const arr of Object.values(out)) arr.sort((a, b) => (Number(a.t) || 0) - (Number(b.t) || 0));
  return out;
}

// 2.0.8 canonical transport: direct WCL URL import and Browser Exporter share
// the same public Replay v2 envelope. Extra API metadata is additive only.
function toBrowserReplayV2(body) {
  if (!body || typeof body !== 'object') return body;
  if (body.format === 'raidru-wcl-replay-browser' && Number(body.version) === 2) return body;
  const positions = Array.isArray(body.positions) ? body.positions : [];
  const timeline = Array.isArray(body.timeline) ? body.timeline : (Array.isArray(body.events) ? body.events : []);
  const actors = Array.isArray(body.actors) ? body.actors : [];
  const fight = body.fight || {};
  const duration = Math.max(1, Number(body.duration) || Number(fight.duration) || ((Number(fight.endTime) || 0) - (Number(fight.startTime) || 0)) || 1);
  const start = Number(fight.startTime) || 0;
  const end = Number(fight.endTime) || (start + duration);
  const mapIDs = body.mapIDs && typeof body.mapIDs === 'object' ? body.mapIDs : {};
  const stats = body.stats || {};
  const eventPos = positions.filter(p => p?.source === 'event').length;
  const nextPos = positions.filter(p => p?.source === 'next').length;
  return {
    format: 'raidru-wcl-replay-browser', version: 2,
    createdAt: body.createdAt || new Date().toISOString(),
    source: {
      pageUrl: body.source?.pageUrl || '', reportCode: body.source?.reportCode || body.report?.code || '',
      fight: String(body.source?.fight || fight.id || ''), bossId: Number(body.source?.bossId || fight.bossId || 0) || 0,
      segmentCount: Number(stats.pages) || 1, segments: [], rawEvents: Number(stats.rawEvents) || timeline.length,
      deduplicatedEvents: Number(stats.rawEvents) || timeline.length, capture: 'raidru-worker',
      fetchMode: body.source?.fetchMode || stats.fetchMode || 'casts', partial: !!body.partial, quality: body.quality || 'fast'
    },
    time: { absoluteStart: start, absoluteEnd: end, duration },
    coordinateSemantics: { resourceActor1: 'sourceID', resourceActor2: 'targetID', nextXY: 'same actor at nextTimestamp' },
    bounds: replayBounds(positions), mapIDs,
    actorIds: actors.map(a => safeInt(a?.id) || a?.id).filter(x => x != null),
    stats: {
      positionEvents: Number(stats.positionEvents) || eventPos, nextPositionEvents: Number(stats.nextPositionEvents) || nextPos,
      compactPositionPoints: positions.length, timelineEvents: timeline.length, rawEvents: Number(stats.rawEvents) || timeline.length,
      pages: Number(stats.pages) || 0, fetchedPages: Number(stats.fetchedPages) || 0, cachedPages: Number(stats.cachedPages) || 0,
      actorCoverage: Number(stats.actorCoverage) || 0, oneShot: !!stats.oneShot, fetchMode: stats.fetchMode || body.source?.fetchMode || 'casts'
    },
    positions, positionsByActor: replayPositionsByActor(positions), timeline,
    actors, report: body.report || null, fight, partial: !!body.partial, quality: body.quality || 'fast',
    resumeAfter: Number(body.resumeAfter) || 0, pauseReason: body.pauseReason || '', message: body.message || '', quota: body.quota || null, cache: body.cache || 'miss'
  };
}

function partialOrPause(meta, fight, progress, quota, { reason = 'wcl_quota_empty', retryAfter = BACKOFF_TTL_FALLBACK, fetchMode = 'casts', message = '' } = {}) {
  const hasUsefulData = (progress?.positions?.length || 0) >= 2 || (progress?.casts?.length || 0) >= 1;
  if (hasUsefulData) {
    const body = replayBodyFromProgress(meta, fight, progress, quota, { partial: true, fetchMode, resumeAfter: retryAfter });
    body.pauseReason = reason;
    body.message = message || 'RaidRU открыл уже полученную часть боя. Позже её можно догрузить без потери прогресса.';
    return { status: 206, body };
  }
  return {
    status: 202,
    body: {
      error: reason, retryAfter, fightId: fight.id,
      pages: Number(progress?.pages) || 0,
      fetchedPages: Number(progress?.fetchedPages) || 0,
      cachedPages: Number(progress?.cachedPages) || 0,
      nextStart: progress?.cursor ?? fight.startTime,
      quota: normalizeQuota(quota), cachedProgress: true,
      message: message || 'Загрузка сохранена и продолжится с контрольной точки.'
    }
  };
}


async function buildReplayOneShot(env, code, fightId, requestedMode = 'smart') {
  const finalName = `wcl/replay-v205/fast/${code}/${fightId}`;
  const finalHit = await cacheGet(finalName);
  if (finalHit) return { status: 200, body: { ...finalHit, cache: 'hit' } };

  // Reuse any already-completed replay from older builds before touching WCL.
  for (const legacyName of [
    `wcl/replay-v203/fast/${code}/${fightId}`,
    `wcl/replay/${code}/${fightId}`
  ]) {
    const legacy = await cacheGet(legacyName);
    if (legacy && !legacy.partial) return { status: 200, body: { ...legacy, cache: 'legacy-hit', quality: legacy.quality || 'fast' } };
  }

  // Read the checkpoint directly. New 2.0.5 checkpoints carry metadata snapshots,
  // so continuation never needs a separate report/quota preflight request.
  let progress = null;
  const rawProgress = await cacheGet(progressCacheName(code, fightId));
  if (rawProgress) progress = rawProgress;

  let cachedMeta = await cacheGet(`wcl/report/${code}`);
  let cachedFight = cachedMeta ? selectFight(cachedMeta, String(fightId)) : null;
  if (!cachedMeta && progress?.reportSnapshot) cachedMeta = progress.reportSnapshot;
  if (!cachedFight && progress?.fightSnapshot) cachedFight = progress.fightSnapshot;

  const backoff = await backoffState(code, fightId);
  if (backoff?.until > Date.now() && backoff.reason === 'wcl_rate_limited') {
    const retryAfter = Math.ceil((backoff.until - Date.now()) / 1000);
    if (cachedMeta && cachedFight && progress) {
      return partialOrPause(cachedMeta, cachedFight, progress, backoff.quota || null, {
        reason: 'wcl_rate_limited', retryAfter, fetchMode: 'casts',
        message: 'Warcraft Logs сам вернул 429. До Retry-After RaidRU не делает ни одного нового WCL-запроса; сохранённая часть боя остаётся доступна.'
      });
    }
    return { status: 202, body: { error: 'wcl_rate_limited', retryAfter, quota: backoff.quota || null, cachedProgress: !!progress } };
  }

  const cursor = numeric(progress?.cursor);
  const hasStart = cursor != null;
  const limit = eventPageLimit(env, 'casts');
  let data;
  try {
    const variables = { code, limit };
    if (hasStart) variables.start = cursor;
    data = await wclGraphql(env, oneShotReplayQuery(fightId, 'casts', hasStart), variables);
  } catch (e) {
    if (e instanceof WclRateError || e?.code === 'wcl_rate_limited') {
      const b = await setBackoff(code, fightId, e.retryAfter, 'wcl_rate_limited', null);
      if (cachedMeta && cachedFight && progress) {
        return partialOrPause(cachedMeta, cachedFight, progress, null, {
          reason: 'wcl_rate_limited', retryAfter: b.retryAfter, fetchMode: 'casts',
          message: 'WCL вернул настоящий 429. RaidRU остановился после одной попытки и сохранил уже полученный Replay.'
        });
      }
      return { status: 202, body: { error: 'wcl_rate_limited', retryAfter: b.retryAfter, cachedProgress: !!progress } };
    }
    throw e;
  }

  const quota = rememberQuota(data?.rateLimitData);
  const reportRaw = data?.reportData?.report;
  if (!reportRaw) { const e = new Error('WCL_REPORT_NOT_FOUND'); e.code = 'wcl_report_not_found'; throw e; }
  const meta = publicReport(reportRaw, data.rateLimitData, 'miss');
  const fight = selectFight(meta, String(fightId));
  if (!fight) return { status: 404, body: { error: 'fight_not_found', fights: meta.fights } };
  await cachePut(`wcl/report/${code}`, meta, fight.inProgress ? REPORT_TTL : COMPLETE_FIGHT_TTL);

  const raw = reportRaw.events;
  if (!raw || !Array.isArray(raw.data)) { const e = new Error('WCL_EVENTS_EMPTY'); e.code = 'wcl_events_unavailable'; throw e; }
  const compact = compactWclPage(raw.data, meta, fight);
  const positions = Array.isArray(progress?.positions) ? [...progress.positions] : [];
  const casts = Array.isArray(progress?.casts) ? [...progress.casts] : [];
  positions.push(...compact.positions);
  casts.push(...compact.casts);
  const pages = (Number(progress?.pages) || 0) + 1;
  const fetchedPages = (Number(progress?.fetchedPages) || 0) + 1;
  const cachedPages = Number(progress?.cachedPages) || 0;
  const rawEvents = (Number(progress?.rawEvents) || 0) + (compact.scanned || 0);
  const next = numeric(raw.nextPageTimestamp);
  const complete = next == null || (hasStart && next <= cursor) || next > fight.endTime;
  const nextProgress = {
    cursor: complete ? null : next,
    positions, casts, rawEvents, pages, fetchedPages, cachedPages,
    lastCost: 0, fetchMode: 'casts',
    fightStart: fight.startTime, fightEnd: fight.endTime,
    reportSnapshot: meta, fightSnapshot: fight
  };

  if (!complete) {
    await saveProgress(code, fight, nextProgress);
    const body = replayBodyFromProgress(meta, fight, nextProgress, quota, { partial: true, fetchMode: 'casts', resumeAfter: 0, cache: 'miss' });
    body.pauseReason = 'one_shot_page';
    body.message = 'Быстрая часть Replay готова. RaidRU сделал ровно один WCL-запрос. Если нужен хвост боя, нажми «Продолжить» — это будет ещё один запрос, а не автоматический цикл.';
    body.stats.oneShot = true;
    return { status: 206, body };
  }

  const body = replayBodyFromProgress(meta, fight, nextProgress, quota, { partial: false, fetchMode: 'casts', cache: 'miss' });
  body.message = 'Replay получен одним WCL GraphQL-запросом и закэширован.';
  body.stats.oneShot = true;
  body.stats.eventPageLimit = limit;
  const ttl = fight.inProgress ? LIVE_FIGHT_TTL : COMPLETE_FIGHT_TTL;
  await cachePut(finalName, body, ttl);
  await cachePut(`wcl/replay-v203/fast/${code}/${fightId}`, body, ttl);
  await cacheDelete(progressCacheName(code, fightId));
  return { status: 200, body };
}

async function buildReplay(env, code, fightParam, requestedMode = 'smart') {
  const directFightId = safeInt(fightParam);
  if (directFightId && requestedMode !== 'full') {
    return buildReplayOneShot(env, code, directFightId, requestedMode);
  }
  const modeKey = requestedMode === 'full' ? 'full' : 'fast';
  const finalName = `wcl/replay-v203/${modeKey}/${code}/${fightParam}`;
  const cachedFinal = await cacheGet(finalName);
  if (cachedFinal) return { status: 200, body: { ...cachedFinal, cache: 'hit' } };

  // Reuse a completed 2.0.2 replay if it already exists. This costs zero WCL points.
  const legacyFinal = await cacheGet(`wcl/replay/${code}/${fightParam}`);
  if (legacyFinal && !legacyFinal.partial) {
    return { status: 200, body: { ...legacyFinal, cache: 'legacy-hit', quality: legacyFinal.quality || 'full' } };
  }

  const meta = await getReport(env, code);
  const fight = selectFight(meta, fightParam);
  if (!fight) return { status: 404, body: { error: 'fight_not_found', fights: meta.fights } };

  const actualFinalName = `wcl/replay-v203/${modeKey}/${code}/${fight.id}`;
  if (actualFinalName !== finalName) {
    const hit = await cacheGet(actualFinalName);
    if (hit) return { status: 200, body: { ...hit, cache: 'hit' } };
    const legacyHit = await cacheGet(`wcl/replay/${code}/${fight.id}`);
    if (legacyHit && !legacyHit.partial) return { status: 200, body: { ...legacyHit, cache: 'legacy-hit', quality: legacyHit.quality || 'full' } };
  }

  let progress = await loadProgress(code, fight);
  if (!progress) {
    progress = {
      cursor: fight.startTime,
      positions: [], casts: [], rawEvents: 0,
      pages: 0, fetchedPages: 0, cachedPages: 0, lastCost: 0,
      fetchMode: null
    };
  }

  // Get a fresh-ish snapshot. The memo prevents the browser's one-second batch
  // continuation from spending another quota query every time.
  let quota = await getQuota(env);
  let fetchMode = requestedMode === 'full' ? 'all' : chooseFetchMode(quota, env, requestedMode);
  if (progress.fetchMode === 'casts' || progress.fetchMode === 'all') {
    // Old 2.0.2 checkpoints had no mode. Smart mode may safely switch their
    // remaining tail to casts without discarding already collected coordinates.
    if (requestedMode === 'full') fetchMode = 'all';
    else if (progress.fetchMode === 'casts') fetchMode = 'casts';
  }

  // Strict time locks are reserved for a real upstream WCL 429 only.
  // Synthetic budget locks from 2.0.2/2.0.3 are deleted unconditionally so an old
  // "wait 27 minutes" cache entry can never make the new importer unusable.
  const backoff = await backoffState(code, fight.id);
  if (backoff?.until > Date.now() && backoff.reason === 'wcl_rate_limited') {
    const retryAfter = Math.ceil((backoff.until - Date.now()) / 1000);
    return partialOrPause(meta, fight, progress, backoff.quota || quota, {
      reason: 'wcl_rate_limited', retryAfter, fetchMode,
      message: 'Warcraft Logs сам вернул 429. RaidRU не повторяет запрос до Retry-After, но уже полученная часть боя доступна.'
    });
  }
  if (backoff && backoff.reason !== 'wcl_rate_limited') {
    await cacheDelete(`wcl/backoff/${code}/${fight.id}`);
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

    // 2.0.4 continuously shrinks the next WCL page as the hourly budget gets low.
    // We only stop pre-emptively when there are effectively no points left.
    const nextEventLimit = adaptiveEventLimit(quota, lastCost, env, fetchMode);
    if (nextEventLimit <= 0 || quotaUnsafe(quota, env, 0)) {
      progress = { cursor, positions, casts, rawEvents, pages, fetchedPages, cachedPages, lastCost, fetchMode };
      await saveProgress(code, fight, progress);
      return partialOrPause(meta, fight, progress, quota, {
        reason: 'wcl_quota_empty', retryAfter: quota?.pointsResetIn || BACKOFF_TTL_FALLBACK, fetchMode,
        message: 'У WCL почти не осталось реальных API points. Искусственной блокировки RaidRU нет: продолжение станет доступно сразу после появления бюджета.'
      });
    }

    let got;
    try {
      got = await fetchCompactPage(env, meta, fight, cursor, quota, fetchMode, nextEventLimit);
    } catch (e) {
      progress = { cursor, positions, casts, rawEvents, pages, fetchedPages, cachedPages, lastCost, fetchMode };
      await saveProgress(code, fight, progress);
      if (e instanceof WclRateError || e?.code === 'wcl_rate_limited') {
        const b = await setBackoff(code, fight.id, e.retryAfter, 'wcl_rate_limited', quota);
        return partialOrPause(meta, fight, progress, quota, {
          reason: 'wcl_rate_limited', retryAfter: b.retryAfter, fetchMode,
          message: 'WCL вернул 429. RaidRU не повторяет запросы; уже полученная часть боя доступна.'
        });
      }
      if (e?.code === 'wcl_quota_empty') {
        const q = normalizeQuota(e.quota) || normalizeQuota(quota);
        return partialOrPause(meta, fight, progress, q, {
          reason: 'wcl_quota_empty', retryAfter: q?.pointsResetIn || BACKOFF_TTL_FALLBACK, fetchMode,
          message: 'WCL API points практически закончились. RaidRU не создаёт искусственный backoff и не теряет уже загруженные данные.'
        });
      }
      throw e;
    }

    pages++;
    if (got.cache === 'hit') cachedPages++;
    else { fetchedPages++; fetchedThisRequest++; }
    quota = got.quota || quota;
    fetchMode = got.mode || fetchMode;
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

    progress = { cursor, positions, casts, rawEvents, pages, fetchedPages, cachedPages, lastCost, fetchMode };
    await saveProgress(code, fight, progress);

    if (!complete && fetchedThisRequest >= maxPages(env)) {
      return {
        status: 202,
        body: {
          error: 'batch_yield', retryAfter: 1, fightId: fight.id,
          pages, fetchedPages, cachedPages, fetchedThisRequest,
          nextStart: cursor, quota: normalizeQuota(quota),
          cachedProgress: true, fetchMode
        }
      };
    }
  }

  if (!complete) {
    return {
      status: 202,
      body: {
        error: 'batch_yield', retryAfter: 1, fightId: fight.id,
        pages, fetchedPages, cachedPages, nextStart: cursor,
        quota: normalizeQuota(quota), cachedProgress: true, fetchMode
      }
    };
  }

  progress = { cursor: null, positions, casts, rawEvents, pages, fetchedPages, cachedPages, lastCost, fetchMode };
  const body = replayBodyFromProgress(meta, fight, progress, quota, { partial: false, fetchMode, cache: 'miss' });
  body.stats.eventPageLimit = eventPageLimit(env, fetchMode);
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
    if (origin && !ALLOWED_ORIGINS.has(origin)) return new Response(JSON.stringify({ error: 'origin_not_allowed', origin, allowed: [...ALLOWED_ORIGINS] }), { status: 403, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(origin, { echo: true }), 'X-RaidRU-Origin': origin } });

    if (url.pathname === '/wcl/ping') {
      return json({ ok: true, service: 'raidru-edge', version: '2.0.8-wcl-workspace', origin: origin || null, wclConfigured: wclConfigured(env) }, 200, origin, { 'X-RaidRU-WCL-Safe': '1' });
    }

    if (url.pathname === '/health') {
      return json({ ok: true, service: 'raidru-edge', version: '2.0.8-wcl-workspace', wclConfigured: wclConfigured(env), features: ['raidplan', 'wcl-report', 'wcl-one-shot-replay', 'wcl-browser-v2-envelope', 'single-query-fast-path', 'fast-casts-sampler', 'partial-replay', '429-lock-only', 'resume-cache'] }, 200, origin);
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
          if (backoff?.until > Date.now() && backoff.reason === 'wcl_rate_limited') {
            return { status: 202, body: { error: backoff.reason, retryAfter: Math.ceil((backoff.until - Date.now()) / 1000), quota: backoff.quota } };
          }
          if (backoff && backoff.reason !== 'wcl_rate_limited') await cacheDelete(`wcl/backoff/${code}/report`);
          try { return { status: 200, body: await getReport(env, code) }; }
          catch (e) {
            if (e instanceof WclRateError) { const b = await setBackoff(code, null, e.retryAfter, 'wcl_rate_limited', null); return { status: 202, body: { error: 'wcl_rate_limited', retryAfter: b.retryAfter } }; }
            throw e;
          }
        });
        return json(result.body, result.status, origin, { 'X-RaidRU-WCL-Safe': '1' });
      } catch (e) { return json(wclErrorBody(e), e?.code === 'wcl_report_not_found' ? 404 : e?.code === 'wcl_not_configured' ? 503 : 502, origin); }
    }

    if (url.pathname === '/wcl/exact-replay' && request.method === 'GET') {
      const code = (url.searchParams.get('code') || '').trim(), fight = (url.searchParams.get('fight') || '').trim().toLowerCase();
      const requestedMode = (url.searchParams.get('mode') || 'smart').trim().toLowerCase();
      if (!validCode(code)) return json({ error: 'invalid_report_code' }, 400, origin);
      if (!(fight === 'last' || safeInt(fight))) return json({ error: 'invalid_fight' }, 400, origin);
      if (!['smart','fast','full'].includes(requestedMode)) return json({ error: 'invalid_mode' }, 400, origin);
      const key = `exact-replay:${requestedMode}:${code}:${fight}`;
      try {
        const result = await withInflight(key, () => buildReplay(env, code, fight, requestedMode));
        const body = (result.status === 200 || result.status === 206) ? toBrowserReplayV2(result.body) : result.body;
        return json(body, result.status, origin, { 'X-RaidRU-WCL-Safe': '1', 'X-RaidRU-Replay-Format': 'raidru-wcl-replay-browser-v2' });
      } catch (e) {
        if (e instanceof WclRateError || e?.code === 'wcl_rate_limited') {
          const b = await setBackoff(code, safeInt(fight), e.retryAfter, 'wcl_rate_limited', null);
          return json({ error: 'wcl_rate_limited', retryAfter: b.retryAfter, cachedProgress: true }, 202, origin);
        }
        return json(wclErrorBody(e), e?.code === 'wcl_not_configured' ? 503 : 502, origin);
      }
    }

    if (url.pathname === '/wcl/replay' && request.method === 'GET') {
      const code = (url.searchParams.get('code') || '').trim(), fight = (url.searchParams.get('fight') || '').trim().toLowerCase();
      const requestedMode = (url.searchParams.get('mode') || 'smart').trim().toLowerCase();
      if (!validCode(code)) return json({ error: 'invalid_report_code' }, 400, origin);
      if (!(fight === 'last' || safeInt(fight))) return json({ error: 'invalid_fight' }, 400, origin);
      if (!['smart','fast','full'].includes(requestedMode)) return json({ error: 'invalid_mode' }, 400, origin);
      const key = `replay:${requestedMode}:${code}:${fight}`;
      try {
        const result = await withInflight(key, () => buildReplay(env, code, fight, requestedMode));
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
