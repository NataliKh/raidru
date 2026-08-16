import fs from 'node:fs/promises';
function ok(name,v){if(!v)throw new Error(`FAIL ${name}`);console.log(`OK ${name}`)}
class MemoryCache{constructor(){this.m=new Map()}key(r){return typeof r==='string'?r:r.url}async match(r){const h=this.m.get(this.key(r));return h?h.clone():undefined}async put(r,res){this.m.set(this.key(r),res.clone())}async delete(r){return this.m.delete(this.key(r))}}
globalThis.caches={default:new MemoryCache()};
let gql=0, mech=0, rate=false;
const report=(vars,continued=false)=>({
 code:vars.code,title:'Mechanics test',startTime:100000,endTime:200000,
 fights:[{id:10,encounterID:53420,originalEncounterID:53420,name:'Sszorak',difficulty:4,kill:true,startTime:1000,endTime:90000,inProgress:false,size:20,maps:[{id:2609}]}],
 masterData:{actors:[{id:1,name:'Priest',type:'Player',subType:'Priest'},{id:99,name:'Boss',type:'NPC',subType:'Boss'}],abilities:[{gameID:1277002,name:'Ravage'},{gameID:1287083,name:'Tempest'},{gameID:555,name:'Spawn'}]},
 casts:{data:continued?[{timestamp:21000,type:'cast',sourceID:99,targetID:1,abilityGameID:1277002}]:[{timestamp:5000,type:'begincast',sourceID:99,targetID:1,abilityGameID:1277002}],nextPageTimestamp:continued?null:20000},
 debuffs:{data:[{timestamp:7000,type:'applydebuff',sourceID:99,targetID:1,abilityGameID:1287083}],nextPageTimestamp:null},
 summons:{data:[{timestamp:8000,type:'summon',sourceID:99,targetID:101,abilityGameID:555}],nextPageTimestamp:null},
 deaths:{data:[{timestamp:12000,type:'death',targetID:1}],nextPageTimestamp:null}
});
globalThis.fetch=async(url,opts={})=>{url=String(url);if(url.includes('/oauth/token'))return new Response(JSON.stringify({access_token:'x',expires_in:3600}),{status:200,headers:{'Content-Type':'application/json'}});if(url.includes('/api/v2/client')){gql++;if(rate)return new Response('rate',{status:429,headers:{'Retry-After':'90'}});const b=JSON.parse(opts.body||'{}'),q=String(b.query||''),vars=b.variables||{};if(q.includes('RaidRUMechanics')){mech++;const continued=vars.castsStart!=null;const r=report(vars,continued);if(vars.needDebuffs===false)delete r.debuffs;if(vars.needSummons===false)delete r.summons;if(vars.needDeaths===false)delete r.deaths;return new Response(JSON.stringify({data:{rateLimitData:{limitPerHour:1000,pointsSpentThisHour:120,pointsResetIn:900},reportData:{report:r}}}),{status:200,headers:{'Content-Type':'application/json'}})}throw new Error('unexpected query')}throw new Error('unexpected fetch')};
const src=await fs.readFile(new URL('./src/index.js',import.meta.url),'utf8');const mod=await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`),worker=mod.default,env={WCL_CLIENT_ID:'id',WCL_CLIENT_SECRET:'secret'};
const req=(code='MechAA99')=>new Request(`https://worker.test/wcl/mechanics?code=${code}&fight=10`,{headers:{Origin:'https://natalikh.github.io'}});
let before=gql,r=await worker.fetch(req(),env,{}),b=await r.json();
ok('first mechanics click is one GraphQL request',gql-before===1&&mech===1);
ok('first pack is usable partial',r.status===206&&b.format==='raidru-wcl-mechanics'&&b.partial===true);
ok('ability names resolve from report master data',b.timeline.some(e=>e.abilityID===1277002&&e.abilityName==='Ravage'));
ok('mechanics contains selective families',b.stats.casts>=1&&b.stats.debuffs>=1&&b.stats.summons>=1&&b.stats.deaths>=1);
before=gql;r=await worker.fetch(req(),env,{});b=await r.json();
ok('second click resumes only remaining category',gql-before===1&&r.status===200&&b.partial===false);
const cachedCalls=gql;r=await worker.fetch(req(),env,{});b=await r.json();ok('completed mechanics pack is cache-only',r.status===200&&b.cache==='hit'&&gql===cachedCalls);
rate=true;before=gql;r=await worker.fetch(req('RateMech99'),env,{});b=await r.json();ok('real 429 stops after one mechanics request',r.status===202&&b.error==='wcl_rate_limited'&&gql===before+1);
console.log('WCL Mechanics Worker 2.0.9 mock tests: OK');
