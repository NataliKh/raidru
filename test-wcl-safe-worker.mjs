import fs from 'node:fs/promises';
function ok(name,value){if(!value)throw new Error(`FAIL ${name}`);console.log(`OK ${name}`)}
class MemoryCache{constructor(){this.m=new Map()}key(req){return typeof req==='string'?req:req.url}async match(req){const h=this.m.get(this.key(req));return h?h.clone():undefined}async put(req,res){this.m.set(this.key(req),res.clone())}async delete(req){return this.m.delete(this.key(req))}}
globalThis.caches={default:new MemoryCache()};

let gqlCalls=0,reportCalls=0,oneShotCalls=0,mechanicsGqlCalls=0,segmentCalls=0;
const fightFor=code=>({
  code,title:`Report ${code}`,startTime:1700000000000,endTime:1700000600000,
  fights:[{id:10,encounterID:0,originalEncounterID:0,name:"Blood of Ula'tek / Breath of Ula'tek",difficulty:4,kill:true,startTime:100,endTime:65100,inProgress:false,size:2,friendlyPlayers:[9001,9002],maps:[{id:2608}]}],
  masterData:{actors:[...Array.from({length:500},(_,i)=>({id:1000+i,name:`Other ${i+1}`,type:'Player',subType:'Mage'})),{id:9001,name:'Alpha',type:'Player',subType:'Priest'},{id:9002,name:'Beta',type:'Player',subType:'Paladin'},{id:99,name:'Boss',type:'NPC',subType:'Boss'}],abilities:[{gameID:1287072,name:'Буря'},{gameID:1288297,name:'Clinging Murk'}]}
});
const quota=()=>({limitPerHour:1000,pointsSpentThisHour:100,pointsResetIn:1800});

globalThis.fetch=async(url,opts={})=>{
  url=String(url);
  if(url.includes('/oauth/token'))return new Response(JSON.stringify({access_token:'test-token',expires_in:3600}),{status:200,headers:{'Content-Type':'application/json'}});
  if(url.includes('/reports/replaysegment/')){segmentCalls++;throw new Error('Worker must not touch ReplaySegment in 2.2.0');}
  if(url.includes('/api/v2/client')){
    gqlCalls++;const body=JSON.parse(opts.body||'{}'),q=String(body.query||''),vars=body.variables||{};
    if(q.includes('RaidRUReport')){reportCalls++;return new Response(JSON.stringify({data:{rateLimitData:quota(),reportData:{report:fightFor(vars.code)}}}),{status:200,headers:{'Content-Type':'application/json'}})}
    if(q.includes('RaidRUQuota'))return new Response(JSON.stringify({data:{rateLimitData:quota()}}),{status:200,headers:{'Content-Type':'application/json'}});
    if(q.includes('RaidRUOneShot')){oneShotCalls++;const report=fightFor(vars.code);report.events={data:[{timestamp:150,type:'begincast',sourceID:99,targetID:9001,abilityGameID:1287072,abilityName:'Буря'}],nextPageTimestamp:null};return new Response(JSON.stringify({data:{rateLimitData:quota(),reportData:{report}}}),{status:200,headers:{'Content-Type':'application/json'}})}
    if(q.includes('RaidRUMechanics')){
      mechanicsGqlCalls++;const report=fightFor(vars.code);
      report.casts={data:[{timestamp:1000,type:'begincast',sourceID:99,targetID:9001,abilityGameID:1287072}],nextPageTimestamp:null};
      report.debuffs={data:[{timestamp:1200,type:'applydebuff',sourceID:99,targetID:9002,abilityGameID:1288297}],nextPageTimestamp:null};
      report.summons={data:[{timestamp:1500,type:'summon',sourceID:99,targetID:77,abilityGameID:1290001,abilityName:'Add'}],nextPageTimestamp:null};
      report.deaths={data:[{timestamp:2200,type:'death',sourceID:99,targetID:9002}],nextPageTimestamp:null};
      return new Response(JSON.stringify({data:{rateLimitData:quota(),reportData:{report}}}),{status:200,headers:{'Content-Type':'application/json'}});
    }
  }
  throw new Error(`Unexpected fetch ${url}`);
};

const source=await fs.readFile(new URL('./src/index.js',import.meta.url),'utf8');
const mod=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`),worker=mod.default;
const env={WCL_CLIENT_ID:'id',WCL_CLIENT_SECRET:'secret'};
const request=path=>new Request(`https://worker.test${path}`,{headers:{Origin:'https://natalikh.github.io'}});

let r=await worker.fetch(request('/wcl/report?code=HybridTestAA'),env,{}),b=await r.json();
ok('report metadata loads from official GraphQL',r.status===200&&reportCalls===1&&b.fights?.length===1);
ok('fight roster remains scoped to friendlyPlayers',b.fights[0].friendlyPlayers.length===2);
ok('Replay boss id is resolved in metadata',b.fights[0].replayBossId===53445);

const before=gqlCalls;
r=await worker.fetch(request('/wcl/exact-replay?code=HybridTestAA&fight=10&mode=smart'),env,{});b=await r.json();
ok('smart exact replay refuses speculative GraphQL coordinates',r.status===409&&b.error==='wcl_browser_bridge_required');
ok('bridge-required response spends no GraphQL points',gqlCalls===before);
ok('Worker never touches private ReplaySegment',segmentCalls===0);

r=await worker.fetch(request('/wcl/mechanics?code=HybridTestAA&fight=10'),env,{});b=await r.json();
ok('mechanics are independent of Replay coordinates',r.status===200&&mechanicsGqlCalls===1&&b.timeline.length===4);
ok('mechanics include hostile cast/debuff/summon/death',b.timeline.some(e=>e.family==='casts'&&e.abilityID===1287072)&&b.timeline.some(e=>e.family==='debuffs'&&e.abilityID===1288297)&&b.timeline.some(e=>e.family==='summons')&&b.timeline.some(e=>e.family==='deaths'));
ok('mechanics use Replay boss namespace',b.source.bossId===53445&&b.fight.bossId===53445);
const beforeMech=mechanicsGqlCalls;
r=await worker.fetch(request('/wcl/mechanics?code=HybridTestAA&fight=10'),env,{});b=await r.json();
ok('completed mechanics pack is cache-only',r.status===200&&b.cache==='hit'&&mechanicsGqlCalls===beforeMech);

const beforeFast=oneShotCalls;
r=await worker.fetch(request('/wcl/exact-replay?code=FastTestAA&fight=10&mode=fast'),env,{});b=await r.json();
ok('explicit fast diagnostic remains available',oneShotCalls===beforeFast+1&&r.status===200);

console.log('WCL Hybrid Bridge 2.2.1 Worker mock tests: OK');
