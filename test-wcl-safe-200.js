const fs=require('fs'),assert=require('assert');
const worker=fs.readFileSync('src/index.js','utf8'),client=fs.readFileSync('wcl-safe-200.js','utf8'),wrangler=fs.readFileSync('wrangler.toml','utf8');
assert(worker.includes("'/wcl/report'"),'worker must expose /wcl/report');
assert(worker.includes("'/wcl/replay'"),'worker must expose /wcl/replay');
assert(worker.includes('rateLimitData'),'worker must inspect WCL rateLimitData');
assert(worker.includes('wcl_budget_guard'),'worker must have a quota guard');
assert(worker.includes('wcl/backoff/'),'worker must persist backoff state');
assert(worker.includes('wcl/page/'),'worker must cache resumable event pages');
assert(worker.includes("status: 202"),'worker must pause instead of hammering WCL');
assert(!worker.includes('setTimeout('),'worker must not retry 429 in a loop');
assert(client.includes('Просто вставь ссылку на лог'),'client must expose URL-first import');
assert(client.includes("b.error==='batch_yield'"),'client may continue safe batches');
assert(client.includes("res.status===202"),'client must respect worker pause responses');
assert(wrangler.includes('WCL_SOFT_LIMIT = "0.70"'),'safe default must be 70%');

assert(worker.includes('includeResources: true'),'resource snapshots must be requested for replay coordinates');
assert(worker.includes('WCL_EVENT_PAGE_LIMIT'),'event page size must be bounded');
assert(worker.includes('progressCacheName'),'worker must checkpoint partial replay progress');
assert(worker.includes('await getQuota(env)'),'worker must refresh quota before replay batch');
assert(!worker.includes('setTimeout')&&!worker.includes('retryWcl'),'worker must not automatically retry WCL 429');

console.log('WCL Safe Import 2.0 static checks: OK');
