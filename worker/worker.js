let tokenCache = { token: null, expiresAt: 0 };

const WCL_TOKEN = 'https://www.warcraftlogs.com/oauth/token';
const WCL_GRAPHQL = 'https://www.warcraftlogs.com/api/v2/client';

function cors(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Content-Type': 'application/json;charset=utf-8',
  };
}

function json(body, status, env, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(env.ALLOWED_ORIGIN || '*'), ...extraHeaders },
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function token(env) {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const basic = btoa(`${env.WCL_CLIENT_ID}:${env.WCL_CLIENT_SECRET}`);
  const r = await fetch(WCL_TOKEN, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!r.ok) {
    const err = new Error(`OAuth ${r.status}: ${await r.text()}`);
    err.status = r.status;
    throw err;
  }

  const j = await r.json();
  tokenCache = {
    token: j.access_token,
    expiresAt: Date.now() + (j.expires_in || 3600) * 1000,
  };
  return j.access_token;
}

async function gql(env, query, variables) {
  const t = await token(env);
  const r = await fetch(WCL_GRAPHQL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  const text = await r.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }

  if (!r.ok || payload?.errors) {
    const err = new Error(JSON.stringify(payload?.errors || payload));
    err.status = r.status || 500;
    err.retryAfter = r.headers.get('Retry-After');
    throw err;
  }

  return payload.data;
}

const META = `query($code:String!,$fightIDs:[Int]){
  reportData{
    report(code:$code){
      title
      startTime
      masterData{actors{id name type subType}}
      fights(fightIDs:$fightIDs){
        id name startTime endTime encounterID difficulty kill friendlyPlayers
      }
    }
  }
}`;

// IMPORTANT: includeResources:true is required for positional x/y data.
// We intentionally fetch one page at a time and cap the number of pages below.
const EVENTS = `query($code:String!,$fightIDs:[Int],$startTime:Float,$limit:Int!){
  reportData{
    report(code:$code){
      events(
        fightIDs:$fightIDs,
        startTime:$startTime,
        limit:$limit,
        includeResources:true
      ){
        data
        nextPageTimestamp
      }
    }
  }
}`;

function readResource(res) {
  if (!res || typeof res !== 'object') return null;
  const x = Number(res.x);
  const y = Number(res.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function resourceSample(e) {
  const candidates = [
    ['sourceResources', e.sourceResources, e.sourceID],
    ['targetResources', e.targetResources, e.targetID],
    ['resources', e.resources, null],
  ];

  for (const [field, value, actorId] of candidates) {
    const xy = readResource(value);
    if (xy) {
      return {
        timestamp: e.timestamp,
        type: e.type,
        sourceID: e.sourceID ?? null,
        targetID: e.targetID ?? null,
        abilityID: e.abilityGameID ?? e.ability?.guid ?? null,
        resourceField: field,
        actorId,
        x: xy.x,
        y: xy.y,
      };
    }
  }

  return null;
}

function eventResourceActor(e) {
  if (readResource(e.sourceResources) && e.sourceID) {
    return { actorId: e.sourceID, resource: e.sourceResources };
  }
  if (readResource(e.targetResources) && e.targetID) {
    return { actorId: e.targetID, resource: e.targetResources };
  }

  const generic = readResource(e.resources);
  if (!generic) return null;

  // Warcraft Logs exposes generic `resources` for one actor per event.
  // Cast-like events generally describe the source; damage/heal-like events
  // generally describe the target. /probe returns raw samples so this mapping
  // can be tightened against the user's real report before production use.
  const sourceTypes = new Set(['cast', 'begincast', 'summon', 'extraattack']);
  const targetTypes = new Set([
    'damage', 'heal', 'absorbed', 'applybuff', 'applydebuff',
    'refreshbuff', 'refreshdebuff', 'removebuff', 'removedebuff', 'death',
  ]);

  if (sourceTypes.has(e.type) && e.sourceID) {
    return { actorId: e.sourceID, resource: e.resources };
  }
  if (targetTypes.has(e.type) && e.targetID) {
    return { actorId: e.targetID, resource: e.resources };
  }

  const fallback = e.targetID || e.sourceID;
  return fallback ? { actorId: fallback, resource: e.resources } : null;
}

function normalize(meta, rawEvents, reportCode, fightId) {
  const report = meta.reportData?.report;
  if (!report) throw new Error('Report not found');

  const fight = (report.fights || []).find((f) => +f.id === +fightId) || report.fights?.[0];
  if (!fight) throw new Error('Fight not found');

  const friendly = new Set(fight.friendlyPlayers || []);
  const positions = [];
  const events = [];

  for (const e of rawEvents) {
    const ts = (Number(e.timestamp) || 0) - Number(fight.startTime || 0);
    if (ts < 0) continue;

    const owner = eventResourceActor(e);
    const xy = owner ? readResource(owner.resource) : null;
    if (xy && friendly.has(owner.actorId)) {
      positions.push({ actorId: owner.actorId, t: ts, x: xy.x, y: xy.y });
    }

    if (
      Number.isFinite(+e.x) && Number.isFinite(+e.y) &&
      e.sourceID && friendly.has(e.sourceID)
    ) {
      positions.push({ actorId: e.sourceID, t: ts, x: +e.x, y: +e.y });
    }

    if (['cast', 'begincast', 'death', 'applydebuff', 'removebuff', 'summon'].includes(e.type)) {
      events.push({
        t: ts,
        type: e.type,
        label: e.ability?.name || e.abilityName || e.type,
        abilityID: e.abilityGameID || e.ability?.guid || null,
        sourceID: e.sourceID,
        targetID: e.targetID,
      });
    }
  }

  positions.sort((a, b) => a.t - b.t);
  const compact = [];
  const last = new Map();
  for (const p of positions) {
    const prev = last.get(p.actorId);
    if (!prev || p.t - prev.t >= 250 || Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y) > 20) {
      compact.push(p);
      last.set(p.actorId, p);
    }
  }

  return {
    source: 'warcraftlogs',
    report: { code: reportCode, title: report.title },
    fight: {
      id: fight.id,
      name: fight.name,
      startTime: fight.startTime,
      endTime: fight.endTime,
      duration: fight.endTime - fight.startTime,
      encounterID: fight.encounterID,
      difficulty: fight.difficulty,
      kill: fight.kill,
    },
    actors: (report.masterData?.actors || []).filter((a) => friendly.has(a.id)),
    positions: compact,
    events,
    duration: fight.endTime - fight.startTime,
  };
}

function parseFight(u) {
  const report = u.searchParams.get('report');
  const fight = Number(u.searchParams.get('fight'));
  if (!report || !Number.isInteger(fight) || fight <= 0) {
    throw new Error('report and numeric fight are required');
  }
  return { report, fight };
}

async function probe(env, report, fight) {
  // Exactly two GraphQL calls: metadata + one small event page.
  const meta = await gql(env, META, { code: report, fightIDs: [fight] });
  const page = await gql(env, EVENTS, {
    code: report,
    fightIDs: [fight],
    startTime: null,
    limit: 1000,
  });

  const ev = page.reportData?.report?.events;
  const raw = ev?.data || [];
  const samples = raw.map(resourceSample).filter(Boolean).slice(0, 25);
  const typeCounts = {};
  for (const e of raw) typeCounts[e.type || 'unknown'] = (typeCounts[e.type || 'unknown'] || 0) + 1;

  const normalized = normalize(meta, raw, report, fight);
  return {
    ok: true,
    mode: 'probe',
    fight: normalized.fight,
    actors: normalized.actors.length,
    rawEvents: raw.length,
    positionsFound: normalized.positions.length,
    nextPageTimestamp: ev?.nextPageTimestamp ?? null,
    eventTypeCounts: typeCounts,
    resourceSamples: samples,
    positionSamples: normalized.positions.slice(0, 50),
  };
}

async function replay(env, u, report, fight) {
  const meta = await gql(env, META, { code: report, fightIDs: [fight] });

  // Safety defaults: no more 30-request bursts.
  const requestedPages = Number(u.searchParams.get('pages') || 4);
  const maxPages = Math.min(Math.max(Number.isFinite(requestedPages) ? requestedPages : 4, 1), 6);
  const requestedLimit = Number(u.searchParams.get('limit') || 10000);
  const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 10000, 100), 10000);

  let start = null;
  let all = [];
  let pagesFetched = 0;
  let nextPageTimestamp = null;

  while (pagesFetched < maxPages) {
    const page = await gql(env, EVENTS, {
      code: report,
      fightIDs: [fight],
      startTime: start,
      limit,
    });

    const ev = page.reportData?.report?.events;
    if (!ev) break;

    all.push(...(ev.data || []));
    pagesFetched += 1;
    nextPageTimestamp = ev.nextPageTimestamp ?? null;

    if (!nextPageTimestamp || nextPageTimestamp === start) break;
    start = nextPageTimestamp;

    // Avoid hammering WCL from one Cloudflare egress IP.
    await sleep(1000);
  }

  const result = normalize(meta, all, report, fight);
  result.pagesFetched = pagesFetched;
  result.partial = Boolean(nextPageTimestamp);
  result.nextPageTimestamp = nextPageTimestamp;
  result.rawEvents = all.length;
  return result;
}

export default {
  async fetch(request, env) {
    const u = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response('', { headers: cors(env.ALLOWED_ORIGIN || '*') });
    }

    if (u.pathname === '/health') {
      return json({ ok: true, version: '0.8.1-probe' }, 200, env);
    }

    try {
      const { report, fight } = parseFight(u);

      if (u.pathname === '/probe') {
        return json(await probe(env, report, fight), 200, env);
      }

      if (u.pathname === '/replay') {
        return json(await replay(env, u, report, fight), 200, env);
      }

      return json({ error: 'Use /probe?report=CODE&fight=ID or /replay?report=CODE&fight=ID' }, 404, env);
    } catch (e) {
      const status = e.status === 429 ? 429 : 500;
      const body = {
        error: String(e.message || e),
        ...(e.status === 429 ? {
          code: 'WCL_RATE_LIMIT',
          retryAfter: e.retryAfter || null,
          hint: 'Do not immediately retry. Use /probe after the WCL limit clears.',
        } : {}),
      };
      return json(body, status, env, e.retryAfter ? { 'Retry-After': e.retryAfter } : {});
    }
  },
};
