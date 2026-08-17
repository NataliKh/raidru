const fs=require('fs'),assert=require('assert');
const worker=fs.readFileSync('src/index.js','utf8'),client=fs.readFileSync('wcl-safe-200.js','utf8'),wrangler=fs.readFileSync('wrangler.toml','utf8');
assert(worker.includes("'/wcl/report'"),'worker must expose /wcl/report');
assert(worker.includes("'/wcl/replay'"),'worker must expose /wcl/replay');
assert(worker.includes('rateLimitData'),'worker must inspect WCL rateLimitData');
assert(worker.includes('wcl_quota_empty'),'worker must distinguish truly exhausted quota');
assert(worker.includes('wcl/backoff/'),'worker must persist backoff state');
assert(worker.includes('wcl/page-v214/'),'worker must cache resumable event pages in the fight-scope namespace');
assert(worker.includes("status: 202"),'worker must pause instead of hammering WCL');
assert(!worker.includes('setTimeout('),'worker must not retry 429 in a loop');
assert(client.includes('Warcraft Logs → Replay'),'client must expose URL-first import');
assert(client.includes("b.error==='batch_yield'"),'client may continue safe batches');
assert(client.includes("res.status===202"),'client must respect worker pause responses');
assert(wrangler.includes('WCL_SOFT_LIMIT = "0.85"'),'adaptive soft threshold must be configured');

assert(worker.includes('includeResources: true'),'resource snapshots must be requested for replay coordinates');
assert(worker.includes('WCL_EVENT_PAGE_LIMIT'),'event page size must be bounded');
assert(worker.includes('progressCacheName'),'worker must checkpoint partial replay progress');
assert(worker.includes('RaidRUOneShot'),'numeric fight fast path must combine metadata and events in one query');
assert(worker.includes('buildReplayOneShot'),'one-shot replay builder missing');
assert(worker.includes("if (directFightId && requestedMode !== 'full')"),'numeric fight must route to one-shot fast path');
assert(worker.includes('dataType: Casts'),'fast sampler must use casts-only event stream');
assert(worker.includes('status: 206'),'worker must be able to return a usable partial replay');
assert(wrangler.includes('WCL_HARD_LIMIT = "0.999"'),'hard limit must only stop at effectively empty budget');
assert(worker.includes('adaptiveEventLimit'),'worker must downshift page size instead of creating an artificial timer');
assert(!worker.includes("setBackoff(code, fight.id, retry, 'wcl_budget_guard'"),'synthetic budget guard must not create backoff');
assert(!worker.includes('setTimeout')&&!worker.includes('retryWcl'),'worker must not automatically retry WCL 429');

console.log('WCL Safe Import 2.1.4 static checks: OK');
