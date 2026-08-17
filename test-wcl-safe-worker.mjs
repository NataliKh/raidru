import fs from 'node:fs/promises';
function ok(name,value){if(!value)throw new Error(`FAIL ${name}`);console.log(`OK ${name}`)}
class MemoryCache{constructor(){this.m=new Map()}key(req){return typeof req==='string'?req:req.url}async match(req){const h=this.m.get(this.key(req));return h?h.clone():undefined}async put(req,res){this.m.set(this.key(req),res.clone())}async delete(req){return this.m.delete(this.key(req))}}
globalThis.caches={default:new MemoryCache()};

let mode='normal',gqlCalls=0,reportCalls=0,eventCalls=0,oneShotCalls=0,segmentCalls=0,mechanicsGqlCalls=0;
const fightFor=code=>({
  code,title:`Report ${code}`,startTime:1700000000000,endTime:1700000600000,
  fights:[{id:10,encounterID:0,originalEncounterID:0,name:"Blood of Ula'tek / Breath of Ula'tek",difficulty:4,kill:true,startTime:100,endTime:65100,inProgress:false,size:2,friendlyPlayers:[9001,9002],maps:[{id:2608}]}],
  masterData:{actors:[...Array.from({length:500},(_,i)=>({id:1000+i,name:`Other ${i+1}`,type:'Player',subType:'Mage'})),{id:9001,name:'Alpha',type:'Player',subType:'Priest'},{id:9002,name:'Beta',type:'Player',subType:'Paladin'},{id:99,name:'Boss',type:'NPC',subType:'Boss'}],abilities:[]}
});
const quota=()=>({limitPerHour:1000,pointsSpentThisHour:100,pointsResetIn:1800});
function resourceEvents(base){
  base=Number(base);
  return [
    {timestamp:base+10,type:'heal',sourceID:9001,sourceIsFriendly:true,targetID:9001,targetIsFriendly:true,resourceActor:1,x:100+base,y:200+base,facing:-200,mapID:2608,nextX:110+base,nextY:210+base,nextTimestamp:base+50,nextFacing:-201,ability:{guid:123,name:'Heal'}},
    {timestamp:base+20,type:'damage',sourceID:99,sourceIsFriendly:false,targetID:9002,targetIsFriendly:true,resourceActor:2,x:300+base,y:400+base,facing:-300,mapID:2608,nextX:310+base,nextY:410+base,nextTimestamp:base+60,ability:{guid:777,name:'Boss hit'}},
    // Critical regression: x/y belong to the hostile target, not the friendly source.
    {timestamp:base+25,type:'damage',sourceID:9001,sourceIsFriendly:true,targetID:99,targetIsFriendly:false,resourceActor:2,x:99999,y:99999,mapID:2608,ability:{guid:888,name:'Player hit'}},
    {timestamp:base+80,type:'begincast',sourceID:99,sourceIsFriendly:false,targetID:9002,targetIsFriendly:true,ability:{guid:1287072,name:'Буря'}},
    {timestamp:base+90,type:'applydebuff',sourceID:99,sourceIsFriendly:false,targetID:9002,targetIsFriendly:true,ability:{guid:1288297,name:'Clinging Murk'}},
    {timestamp:base+100,type:'summon',sourceID:99,sourceIsFriendly:false,targetID:77,targetIsFriendly:false,ability:{guid:1290001,name:'Add'}},
    {timestamp:base+110,type:'death',sourceID:99,sourceIsFriendly:false,targetID:9002,targetIsFriendly:true}
  ];
}

globalThis.fetch=async(url,opts={})=>{
  url=String(url);
  if(url.includes('/oauth/token'))return new Response(JSON.stringify({access_token:'test-token',expires_in:3600}),{status:200,headers:{'Content-Type':'application/json'}});
  if(url.includes('/reports/replaysegment/')){
    segmentCalls++;
    // Production regression: this private web route may reply 200 HTML. Smart import
    // must never depend on it in 2.1.8.
    return new Response('<!doctype html><html>challenge</html>',{status:200,headers:{'Content-Type':'text/html'}});
  }
  if(url.includes('/api/v2/client')){
    gqlCalls++;const body=JSON.parse(opts.body||'{}'),q=String(body.query||''),vars=body.variables||{};
    if(q.includes('RaidRUReport')){reportCalls++;return new Response(JSON.stringify({data:{rateLimitData:quota(),reportData:{report:fightFor(vars.code)}}}),{status:200,headers:{'Content-Type':'application/json'}})}
    if(q.includes('RaidRUQuota'))return new Response(JSON.stringify({data:{rateLimitData:quota()}}),{status:200,headers:{'Content-Type':'application/json'}});
    if(q.includes('RaidRUEvents')){
      eventCalls++;
      if(mode==='rate')return new Response('rate limited',{status:429,headers:{'Retry-After':'120'}});
      const start=Number(vars.start||100);
      const next=start<30100?30100:(start<60100?60100:null);
      return new Response(JSON.stringify({data:{rateLimitData:quota(),reportData:{report:{events:{data:resourceEvents(start),nextPageTimestamp:next}}}}}),{status:200,headers:{'Content-Type':'application/json'}});
    }
    if(q.includes('RaidRUOneShot')){oneShotCalls++;const report=fightFor(vars.code);report.events={data:[{timestamp:150,type:'begincast',sourceID:99,targetID:9001,abilityGameID:1287072,abilityName:'Буря'}],nextPageTimestamp:null};return new Response(JSON.stringify({data:{rateLimitData:quota(),reportData:{report}}}),{status:200,headers:{'Content-Type':'application/json'}})}
    if(q.includes('RaidRUMechanics')){mechanicsGqlCalls++;return new Response(JSON.stringify({errors:[{message:'mechanics graphql should not be needed after full replay'}]}),{status:200,headers:{'Content-Type':'application/json'}})}
  }
  throw new Error(`Unexpected fetch ${url}`);
};

const source=await fs.readFile(new URL('./src/index.js',import.meta.url),'utf8');
const mod=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`),worker=mod.default;
const env={WCL_CLIENT_ID:'id',WCL_CLIENT_SECRET:'secret'};
const request=(path)=>new Request(`https://worker.test${path}`,{headers:{Origin:'https://natalikh.github.io'}});

let r=await worker.fetch(request('/wcl/exact-replay?code=GraphQLTestAA&fight=10&mode=smart'),env,{}),b=await r.json();
ok('smart replay returns Browser Replay v2 envelope',r.status===200&&b.format==='raidru-wcl-replay-browser'&&b.version===2);
ok('fight roster scoped to friendlyPlayers, not 500 report actors',b.actors.length===2&&b.actorIds.length===2);
ok('smart import uses official GraphQL resource stream',b.source?.fetchMode==='all'&&b.quality==='full'&&eventCalls===3);
ok('private ReplaySegment route is not touched',segmentCalls===0);
ok('resourceActor yields real player coordinates',b.positions.length>=8&&b.stats.compactPositionPoints>=8&&b.stats.actorCoverage===1);
ok('resourceActor=2 does not assign hostile target coordinates to friendly source',!b.positions.some(p=>p.x===99999||p.y===99999));
ok('mapID survives GraphQL resource import',String(Object.keys(b.mapIDs||{})).includes('2608'));
ok('mechanics timeline is embedded in same GraphQL pass',b.timeline.some(e=>e.type==='begincast'&&e.abilityID===1287072)&&b.timeline.some(e=>e.type==='applydebuff'&&e.abilityID===1288297)&&b.timeline.some(e=>e.type==='summon')&&b.timeline.some(e=>e.type==='death'));
ok('ability.guid is accepted as spell id',b.timeline.some(e=>e.abilityID===1287072&&e.abilityName==='Буря'));

const beforeCacheEvents=eventCalls,beforeCacheGql=gqlCalls;
r=await worker.fetch(request('/wcl/exact-replay?code=GraphQLTestAA&fight=10&mode=smart'),env,{});b=await r.json();
ok('completed replay is cache-only',r.status===200&&b.cache==='hit'&&eventCalls===beforeCacheEvents&&gqlCalls===beforeCacheGql);

const beforeMechGql=mechanicsGqlCalls,beforeMechAll=gqlCalls;
r=await worker.fetch(request('/wcl/mechanics?code=GraphQLTestAA&fight=10'),env,{});b=await r.json();
ok('mechanics served from full GraphQL replay cache',r.status===200&&b.cache==='graphql-replay'&&b.timeline.length>0);
ok('mechanics does not make a second GraphQL pass',mechanicsGqlCalls===beforeMechGql&&gqlCalls===beforeMechAll);

const beforeFast=oneShotCalls;
r=await worker.fetch(request('/wcl/exact-replay?code=FastTestAA&fight=10&mode=fast'),env,{});b=await r.json();
ok('explicit fast mode remains one-shot diagnostic',oneShotCalls===beforeFast+1&&r.status===200);

console.log('WCL GraphQL Resource Replay 2.1.8 Worker mock tests: OK');
