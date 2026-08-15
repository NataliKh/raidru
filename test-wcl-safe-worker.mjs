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

let mode='normal', gqlCalls=0, oneShotCalls=0, quotaCalls=0, reportCalls=0, eventCalls=0, quotaSpent=100;
const fightFor=code=>({
  code,title:`Report ${code}`,startTime:1700000000000,endTime:1700000010000,
  fights:[{id:10,encounterID:3420,originalEncounterID:3420,name:'Sszorak',difficulty:4,kill:true,startTime:0,endTime:900,inProgress:false,size:20,maps:[{id:2609}]}],
  masterData:{actors:[{id:1,name:'Player One',type:'Player',subType:'Priest'},{id:99,name:'Boss',type:'NPC',subType:'Boss'}]}
});
const quota=()=>({limitPerHour:1000,pointsSpentThisHour:quotaSpent,pointsResetIn:1800});
function page(start=0){
  const next=start<300?300:null;
  return {
    data:[
      {timestamp:start+50,type:'cast',sourceID:1,resourceActor1:1,x:100+start,y:200+start,nextX:110+start,nextY:210+start,nextTimestamp:start+120,mapID:2609,abilityGameID:111},
      {timestamp:start+160,type:'begincast',sourceID:99,targetID:1,abilityGameID:1287072,abilityName:'Буря',mapID:2609}
    ],
    nextPageTimestamp:next
  };
}

globalThis.fetch=async (url,opts={})=>{
  url=String(url);
  if(url.includes('/oauth/token')) return new Response(JSON.stringify({access_token:'test-token',expires_in:3600}),{status:200,headers:{'Content-Type':'application/json'}});
  if(url.includes('/api/v2/client')){
    gqlCalls++;
    const body=JSON.parse(opts.body||'{}'), q=String(body.query||''), vars=body.variables||{};
    if(q.includes('RaidRUOneShot')){
      oneShotCalls++;
      if(mode==='rate') return new Response('rate limited',{status:429,headers:{'Retry-After':'120'}});
      quotaSpent+=10;
      const report=fightFor(vars.code);
      report.events=page(Number(vars.start)||0);
      return new Response(JSON.stringify({data:{rateLimitData:quota(),reportData:{report}}}),{status:200,headers:{'Content-Type':'application/json'}});
    }
    if(q.includes('RaidRUReport')){
      reportCalls++;
      return new Response(JSON.stringify({data:{rateLimitData:quota(),reportData:{report:fightFor(vars.code)}}}),{status:200,headers:{'Content-Type':'application/json'}});
    }
    if(q.includes('RaidRUQuota')){
      quotaCalls++;
      return new Response(JSON.stringify({data:{rateLimitData:quota()}}),{status:200,headers:{'Content-Type':'application/json'}});
    }
    if(q.includes('RaidRUEvents')){
      eventCalls++;
      quotaSpent+=10;
      return new Response(JSON.stringify({data:{rateLimitData:quota(),reportData:{report:{events:page(Number(vars.start)||0)}}}}),{status:200,headers:{'Content-Type':'application/json'}});
    }
  }
  throw new Error(`Unexpected fetch ${url}`);
};

const source=await fs.readFile(new URL('./src/index.js',import.meta.url),'utf8');
const mod=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const worker=mod.default;
const env={WCL_CLIENT_ID:'id',WCL_CLIENT_SECRET:'secret',WCL_EVENT_PAGE_LIMIT:'10000'};
const req=(code='g2TestAA',fight='10',modeArg='smart')=>new Request(`https://worker.test/wcl/replay?code=${code}&fight=${fight}&mode=${modeArg}`,{headers:{Origin:'https://natalikh.github.io'}});

// Numeric fight fast path: exactly one WCL GraphQL call per button press, with no report/quota preflight.
let before=gqlCalls;
let r=await worker.fetch(req(),env,{}), b=await r.json();
ok('first press returns usable partial replay',r.status===206&&b.partial===true&&b.stats?.oneShot===true&&b.positions.length>=1);
ok('first press makes exactly one GraphQL request',gqlCalls-before===1&&oneShotCalls===1);
ok('numeric fast path has no report preflight',reportCalls===0);
ok('numeric fast path has no quota preflight',quotaCalls===0);
ok('boss cast compacted',b.events.some(e=>e.abilityID===1287072));
ok('map id survives one-shot import',String(Object.keys(b.mapIDs||{})).includes('2609'));

before=gqlCalls;
r=await worker.fetch(req(),env,{}); b=await r.json();
ok('second press resumes and completes',r.status===200&&b.partial===false&&b.stats?.oneShot===true);
ok('resume costs one additional GraphQL request only',gqlCalls-before===1&&oneShotCalls===2);
const beforeCache=gqlCalls;
r=await worker.fetch(req(),env,{}); b=await r.json();
ok('completed replay is cache-only',r.status===200&&b.cache==='hit'&&gqlCalls===beforeCache);

// A real 429 is one attempt, then cached Retry-After blocks later clicks without touching WCL.
mode='rate';
const beforeRate=gqlCalls;
r=await worker.fetch(req('RateTestAA'),env,{}); b=await r.json();
ok('real 429 becomes pause',r.status===202&&b.error==='wcl_rate_limited'&&b.retryAfter>=120);
ok('429 used one WCL request',gqlCalls===beforeRate+1);
const beforeLocked=gqlCalls;
r=await worker.fetch(req('RateTestAA'),env,{}); b=await r.json();
ok('click during Retry-After does not call WCL',r.status===202&&b.error==='wcl_rate_limited'&&gqlCalls===beforeLocked);

// Full mode keeps the older richer multi-page pipeline as an explicit opt-in.
mode='normal';
const beforeFull=gqlCalls;
r=await worker.fetch(req('FullTestAA','10','full'),env,{}); b=await r.json();
ok('full mode still uses legacy pipeline',gqlCalls>beforeFull&&(reportCalls>0||eventCalls>0));

console.log('WCL One-Shot Worker mock tests: OK');
