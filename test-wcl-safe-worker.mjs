import fs from 'node:fs/promises';

function ok(name, value){ if(!value) throw new Error(`FAIL ${name}`); console.log(`OK ${name}`); }

class MemoryCache {
  constructor(){ this.m=new Map(); }
  key(req){ return typeof req==='string'?req:req.url; }
  async match(req){ const hit=this.m.get(this.key(req)); return hit ? hit.clone() : undefined; }
  async put(req,res){ this.m.set(this.key(req),res.clone()); }
  async delete(req){ return this.m.delete(this.key(req)); }
}
globalThis.caches={default:new MemoryCache()};

let mode='normal', eventCalls=0, gqlCalls=0, quotaSpent=100, sawCasts=false, sawLimit=0;
const fightFor=code=>({
  code,title:`Report ${code}`,startTime:1700000000000,endTime:1700000010000,
  fights:[{id:10,encounterID:3420,originalEncounterID:3420,name:'Sszorak',difficulty:4,kill:true,startTime:0,endTime:900,inProgress:false,size:20,maps:[{id:2609}]}],
  masterData:{actors:[{id:1,name:'Player One',type:'Player',subType:'Priest'},{id:99,name:'Boss',type:'NPC',subType:'Boss'}]}
});
const quota=()=>({
  limitPerHour:1000,
  pointsSpentThisHour:mode==='high'?750:mode==='critical'?985:quotaSpent,
  pointsResetIn:1800
});

globalThis.fetch=async (url,opts={})=>{
  url=String(url);
  if(url.includes('/oauth/token')) return new Response(JSON.stringify({access_token:'test-token',expires_in:3600}),{status:200,headers:{'Content-Type':'application/json'}});
  if(url.includes('/api/v2/client')){
    gqlCalls++;
    const body=JSON.parse(opts.body||'{}'), q=String(body.query||''), vars=body.variables||{};
    if(q.includes('RaidRUReport')){
      return new Response(JSON.stringify({data:{rateLimitData:quota(),reportData:{report:fightFor(vars.code)}}}),{status:200,headers:{'Content-Type':'application/json'}});
    }
    if(q.includes('RaidRUQuota')){
      return new Response(JSON.stringify({data:{rateLimitData:quota()}}),{status:200,headers:{'Content-Type':'application/json'}});
    }
    if(q.includes('RaidRUEvents')){
      eventCalls++;
      sawCasts ||= q.includes('dataType: Casts');
      sawLimit=Math.max(sawLimit,Number(vars.limit)||0);
      if(mode==='rate') return new Response('rate limited',{status:429,headers:{'Retry-After':'120'}});
      if(mode==='partial') quotaSpent=985;
      else quotaSpent+=10;
      const st=Number(vars.start)||0;
      const next=st<600?st+300:null;
      const data=[
        {timestamp:st+50,type:'cast',sourceID:1,resourceActor1:1,x:100+st,y:200+st,nextX:110+st,nextY:210+st,nextTimestamp:st+120,mapID:2609,abilityGameID:111},
        {timestamp:st+160,type:'begincast',sourceID:99,targetID:1,abilityGameID:1287072,abilityName:'Буря',mapID:2609}
      ];
      return new Response(JSON.stringify({data:{rateLimitData:quota(),reportData:{report:{events:{data,nextPageTimestamp:next}}}}}),{status:200,headers:{'Content-Type':'application/json'}});
    }
  }
  throw new Error(`Unexpected fetch ${url}`);
};

const source=await fs.readFile(new URL('./src/index.js',import.meta.url),'utf8');
const mod=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const worker=mod.default;
const env={
  WCL_CLIENT_ID:'id',WCL_CLIENT_SECRET:'secret',
  WCL_SOFT_LIMIT:'0.85',WCL_HARD_LIMIT:'0.97',WCL_MIN_RESERVE:'50',
  WCL_MAX_PAGES_PER_REQUEST:'2',WCL_EVENT_PAGE_LIMIT:'10000'
};
const req=(code='g2TestAA',extra='')=>new Request(`https://worker.test/wcl/replay?code=${code}&fight=10&mode=smart${extra}`,{headers:{Origin:'https://natalikh.github.io'}});

// A 3-page fight is split into two Worker batches, checkpointing between requests.
let r=await worker.fetch(req(),env,{}), b=await r.json();
ok('first batch yields safely',r.status===202&&b.error==='batch_yield'&&b.fetchedPages===2);
ok('two WCL event pages only',eventCalls===2);
r=await worker.fetch(req(),env,{}); b=await r.json();
ok('second batch completes replay',r.status===200&&Array.isArray(b.positions)&&b.positions.length>=3);
ok('checkpoint resumes without refetching old pages',eventCalls===3);
ok('boss cast compacted',b.events.some(e=>e.abilityID===1287072));
ok('fast sampler uses Casts',sawCasts);
ok('fast sampler uses 10k page limit',sawLimit===10000&&b.stats?.eventPageLimit===10000);
const beforeFinal=eventCalls;
r=await worker.fetch(req(),env,{}); b=await r.json();
ok('completed fight comes from cache',r.status===200&&b.cache==='hit'&&eventCalls===beforeFinal);

// 75% used is no longer a blanket stop. Smart mode should still produce a fast replay.
mode='high';
const beforeHigh=eventCalls;
r=await worker.fetch(req('HighTestAA'),env,{}); b=await r.json();
if(r.status===202&&b.error==='batch_yield'){ r=await worker.fetch(req('HighTestAA'),env,{}); b=await r.json(); }
ok('75 percent quota remains usable',r.status===200&&eventCalls>beforeHigh&&b.quality==='fast');

// Near the real ceiling, the hard reserve still protects the account before an event request.
mode='critical';
const beforeCritical=eventCalls;
r=await worker.fetch(req('CriticalAA'),env,{}); b=await r.json();
ok('hard guard returns pause near ceiling',r.status===202&&b.error==='wcl_budget_guard');
ok('hard guard makes no event request',eventCalls===beforeCritical);

// If quota becomes critical after at least one page, RaidRU returns a usable partial replay (206), not an empty wall.
mode='partial'; quotaSpent=900;
const beforePartial=eventCalls;
r=await worker.fetch(req('PartialAA'),env,{}); b=await r.json();
ok('partial replay returned instead of useless pause',r.status===206&&b.partial===true&&Array.isArray(b.positions)&&b.positions.length>=1);
ok('partial replay used exactly one new page before guard',eventCalls===beforePartial+1);

// A real 429 is never retried by RaidRU.
mode='rate'; quotaSpent=100;
const beforeRate=eventCalls;
r=await worker.fetch(req('RateTestAA'),env,{}); b=await r.json();
ok('429 becomes protective pause',r.status===202&&b.error==='wcl_rate_limited'&&b.retryAfter>=120);
ok('429 is not retried',eventCalls===beforeRate+1);

ok('GraphQL was exercised',gqlCalls>0);
console.log('WCL Adaptive Worker mock tests: OK');
