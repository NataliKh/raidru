const ALLOWED_ORIGINS = new Set([
  'https://natalikh.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
]);

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

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      ...cors(origin)
    }
  });
}

function validCode(code) {
  return /^[a-zA-Z0-9_-]{6,64}$/.test(code || '');
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
        headers: {
          'Accept': 'application/json,text/plain;q=0.9,*/*;q=0.1',
          'User-Agent': 'RaidRU/0.8.18 RaidPlan Import'
        },
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
    method: 'GET',
    headers: { 'Accept': 'text/html,*/*;q=0.8', 'User-Agent': 'RaidRU/0.8.18 RaidPlan Import' },
    redirect: 'follow',
    cf: { cacheTtl: 0, cacheEverything: false }
  }).catch(() => null);

  if (page?.status === 404) {
    const e = new Error('NOT_FOUND'); e.status = 404; throw e;
  }
  const e = new Error('UPSTREAM'); e.status = lastStatus === 404 ? 404 : 502; throw e;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    if (url.pathname === '/health') {
      return json({ ok: true, service: 'raidru-raidplan', version: '0.8.18' }, 200, origin);
    }

    if (url.pathname !== '/raidplan' || request.method !== 'GET') {
      return json({ error: 'not_found' }, 404, origin);
    }

    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return json({ error: 'origin_not_allowed' }, 403, origin);
    }

    const code = (url.searchParams.get('code') || '').trim();
    if (!validCode(code)) return json({ error: 'invalid_code' }, 400, origin);

    try {
      const data = await fetchPlanJson(code);
      return json(data, 200, origin);
    } catch (e) {
      if (e?.status === 404) return json({ error: 'plan_not_found' }, 404, origin);
      return json({ error: 'raidplan_unavailable' }, 502, origin);
    }
  }
};
