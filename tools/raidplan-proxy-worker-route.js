/* RaidRU v0.8.15 — Cloudflare Worker route for RaidPlan URL import.
 *
 * Add the handleRaidPlan() function to the existing RaidRU Worker and route
 * /raidplan requests to it BEFORE the WCL handlers:
 *
 *   const url = new URL(request.url);
 *   if (url.pathname === '/raidplan') return handleRaidPlan(request, url);
 *
 * This route stores nothing and explicitly disables caching.
 */

const RAIDRU_SITE_ORIGIN = 'https://natalikh.github.io';

async function handleRaidPlan(request, url = new URL(request.url)) {
  const origin = request.headers.get('Origin') || '';
  const cors = {
    'Access-Control-Allow-Origin': RAIDRU_SITE_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept, Content-Type',
    'Vary': 'Origin',
    'Cache-Control': 'private, no-store, max-age=0',
    'Pragma': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };

  if (request.method === 'OPTIONS') {
    if (origin && origin !== RAIDRU_SITE_ORIGIN) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: cors });
  if (origin && origin !== RAIDRU_SITE_ORIGIN) return new Response('Forbidden origin', { status: 403, headers: cors });

  const code = (url.searchParams.get('code') || '').trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(code)) {
    return Response.json({ error: 'invalid_plan_code' }, { status: 400, headers: cors });
  }

  // Prefer the exact userdata URL referenced by the RaidPlan page (including revision
  // query when present). If it is not present in server HTML, fall back to the stable
  // code-based JSON path observed in RaidPlan's network traffic.
  let upstreamUrl = `https://userdata.raidplan.io/${encodeURIComponent(code)}.json`;
  try {
    const page = await fetch(`https://raidplan.io/plan/${encodeURIComponent(code)}`, {
      method: 'GET', headers: { 'Accept': 'text/html' }, cf: { cacheEverything: false, cacheTtl: 0 },
    });
    if (page.ok) {
      const html = await page.text();
      const re = new RegExp(`https://userdata\\.raidplan\\.io/${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.json(?:\\?v=\\d+)?`, 'i');
      const hit = html.match(re)?.[0];
      if (hit) upstreamUrl = hit.replaceAll('&amp;', '&');
    }
  } catch (_) {}

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cf: { cacheEverything: false, cacheTtl: 0 },
    });
  } catch (_) {
    return Response.json({ error: 'raidplan_fetch_failed' }, { status: 502, headers: cors });
  }

  if (!upstream.ok) {
    return Response.json({ error: 'raidplan_http_error', status: upstream.status }, { status: upstream.status, headers: cors });
  }

  const contentType = upstream.headers.get('content-type') || '';
  if (!contentType.includes('json')) {
    return Response.json({ error: 'raidplan_not_json' }, { status: 502, headers: cors });
  }

  // Buffering avoids forwarding any upstream cache headers and lets us validate JSON.
  const text = await upstream.text();
  let parsed;
  try { parsed = JSON.parse(text); }
  catch (_) { return Response.json({ error: 'raidplan_invalid_json' }, { status: 502, headers: cors }); }

  if (!parsed || !Array.isArray(parsed.nodes) || !Number.isFinite(Number(parsed.steps))) {
    return Response.json({ error: 'unsupported_raidplan_schema' }, { status: 422, headers: cors });
  }

  return new Response(JSON.stringify(parsed), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
