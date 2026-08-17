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
const eventQueries=[];
const fightFor=code=>({
  code,title:`Report ${code}`,startTime:1700000000000,endTime:1700000010000,
  fights:[{id:10,encounterID:53445,originalEncounterID:53445,name:"Blood of Ula'tek / Breath of Ula'tek",difficulty:4,kill:true,startTime:0,endTime:900,inProgress:false,size:18,friendlyPlayers:[9001],maps:[{id:2608}]}],
  // Regression: report-wide masterData may contain hundreds of players from other fights.
  // Replay must use this fight's friendlyPlayers, not the full 500-entry actor table.
  masterData:{actors:[...Array.from({length:500},(_,i)=>({id:1000+i,name:`Other ${i+1}`,type:'Player',subType:'Mage'})),{id:99,name:'Boss',type:'NPC',subType:'Boss'}]}
});
const quota=()=>({limitPerHour:1000,pointsSpentThisHour:quotaSpent,pointsResetIn:1800});

// This intentionally models the production failure from 2.1.4:
// Casts-only pages contain valid casts but no resource x/y samples. Generic event
// pages contain the resource snapshots needed for movement plus hostile casts.
function page(start=0,{castsOnly=false}={}){
  const next=start<300?300:null;
  const data=[];
  if(!castsOnly){
    data.push({timestamp:start+50,type:'applybuff',sourceID:9001,resourceActor1:9001,x:100+start,y:200+start,nextX:110+start,nextY:210+start,nextTimestamp:start+120,mapID:2608,abilityGameID:777});
  }
  data.push({timestamp:start+160,type:'begincast',sourceID:99,targetID:9001,resourceActor2:9001,abilityGameID:1287072,abilityName:'Буря',mapID:2608});
  return {data,nextPageTimestamp:next};
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
      report.events=page(Number(vars.start)||0,{castsOnly:true});
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
      eventCalls++; eventQueries.push(q);
      if(mode==='rate') return new Response('rate limited',{status:429,headers:{'Retry-After':'120'}});
      quotaSpent+=10;
      const castsOnly=q.includes('dataType: Casts');
      return new Response(JSON.stringify({data:{rateLimitData:quota(),reportData:{report:{events:page(Number(vars.start)||0,{castsOnly})}}}}),{status:200,headers:{'Content-Type':'application/json'}});
    }
  }
  throw new Error(`Unexpected fetch ${url}`);
};

const source=await fs.readFile(new URL('./src/index.js',import.meta.url),'utf8');
const mod=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const worker=mod.default;
const env={WCL_CLIENT_ID:'id',WCL_CLIENT_SECRET:'secret',WCL_EVENT_PAGE_LIMIT:'10000',WCL_MAX_PAGES_PER_REQUEST:'16'};
const req=(code='g2TestAA',fight='10',modeArg='smart')=>new Request(`https://worker.test/wcl/replay?code=${code}&fight=${fight}&mode=${modeArg}`,{headers:{Origin:'https://natalikh.github.io'}});

// 2.1.5 regression: normal/smart numeric import must NOT use the Casts-only one-shot.
let before=gqlCalls, beforeEvents=eventCalls, beforeOneShot=oneShotCalls;
let r=await worker.fetch(req(),env,{}), b=await r.json();
ok('smart replay completes',r.status===200&&b.partial===false);
ok('smart replay uses generic event pages',eventCalls-beforeEvents===2&&oneShotCalls===beforeOneShot&&eventQueries.slice(-2).every(q=>!q.includes('dataType: Casts')));
ok('fight-scoped roster survives 500 report actors',Array.isArray(b.actors)&&b.actors.length===1&&b.actors[0].id===9001);
ok('full event stream produces coordinates',b.positions.length>=2&&b.stats?.compactPositionPoints>=2&&b.stats?.actorCoverage===1);
ok('boss cast compacted into timeline',b.events.some(e=>e.abilityID===1287072));
ok('map id survives full-event import',String(Object.keys(b.mapIDs||{})).includes('2608'));
ok('smart fetch mode is full',b.stats?.fetchMode==='all'&&b.quality==='full');
ok('smart path used report metadata plus event pages',gqlCalls-before>=3&&reportCalls>=1);

const beforeCache=gqlCalls;
r=await worker.fetch(req(),env,{}); b=await r.json();
ok('completed smart replay is cache-only',r.status===200&&b.cache==='hit'&&gqlCalls===beforeCache);

// Canonical endpoint must expose the same non-empty Browser Replay v2 envelope.
const reqExact=(code='ExactTestAA',fight='10',modeArg='smart')=>new Request(`https://worker.test/wcl/exact-replay?code=${code}&fight=${fight}&mode=${modeArg}`,{headers:{Origin:'https://natalikh.github.io'}});
r=await worker.fetch(reqExact(),env,{}); b=await r.json();
ok('exact endpoint returns Browser Replay v2 envelope',r.status===200&&b.format==='raidru-wcl-replay-browser'&&b.version===2&&Array.isArray(b.timeline)&&b.positionsByActor);
ok('exact endpoint scopes actors to fight friendlyPlayers',Array.isArray(b.actors)&&b.actors.length===1&&b.actors[0].id===9001&&b.actors[0].name==='Игрок 9001');
ok('exact endpoint has non-zero coordinates',b.positions.length>=2&&b.stats?.compactPositionPoints>=2);
ok('exact endpoint has boss timeline',b.timeline.some(e=>e.abilityID===1287072));
ok('exact endpoint reports full event source',b.source?.fetchMode==='all'&&b.quality==='full');

// Casts-only remains available only when explicitly requested as mode=fast.
const beforeFastOneShot=oneShotCalls, beforeFast=gqlCalls;
r=await worker.fetch(req('FastDiagnosticAA','10','fast'),env,{}); b=await r.json();
ok('explicit fast mode keeps legacy one-shot diagnostic',oneShotCalls===beforeFastOneShot+1&&gqlCalls===beforeFast+1);
ok('fast diagnostic may be coordinate-empty without affecting smart mode',Array.isArray(b.positions)&&b.positions.length===0);

// A real 429 on the full event page is cached and blocks later clicks without hammering WCL.
mode='rate';
const beforeRate=gqlCalls;
r=await worker.fetch(req('RateTestAA'),env,{}); b=await r.json();
ok('real 429 becomes pause',r.status===202&&b.error==='wcl_rate_limited'&&b.retryAfter>=120);
ok('429 happens after metadata plus one event attempt',gqlCalls===beforeRate+2);
const beforeLocked=gqlCalls;
r=await worker.fetch(req('RateTestAA'),env,{}); b=await r.json();
ok('click during Retry-After does not call WCL again',r.status===202&&b.error==='wcl_rate_limited'&&gqlCalls===beforeLocked);

mode='normal';
console.log('WCL Full Event Replay 2.1.5 Worker mock tests: OK');
