import fs from 'node:fs/promises';
function ok(name,value){if(!value)throw new Error(`FAIL ${name}`);console.log(`OK ${name}`)}
class MemoryCache{constructor(){this.m=new Map()}key(req){return typeof req==='string'?req:req.url}async match(req){const h=this.m.get(this.key(req));return h?h.clone():undefined}async put(req,res){this.m.set(this.key(req),res.clone())}async delete(req){return this.m.delete(this.key(req))}}
globalThis.caches={default:new MemoryCache()};

let mode='normal',gqlCalls=0,reportCalls=0,oneShotCalls=0,segmentCalls=0,mechanicsGqlCalls=0;const segmentBossIds=[];
const fightFor=code=>({
  code,title:`Report ${code}`,startTime:1700000000000,endTime:1700000600000,
  fights:[{id:10,encounterID:code.includes('EncounterId')?3420:0,originalEncounterID:0,name:code.includes('EncounterId')?'Sszorak':"Blood of Ula'tek / Breath of Ula'tek",difficulty:4,kill:true,startTime:100,endTime:65100,inProgress:false,size:2,friendlyPlayers:[9001,9002],maps:[{id:2608}]}],
  masterData:{actors:[...Array.from({length:500},(_,i)=>({id:1000+i,name:`Other ${i+1}`,type:'Player',subType:'Mage'})),{id:9001,name:'Alpha',type:'Player',subType:'Priest'},{id:9002,name:'Beta',type:'Player',subType:'Paladin'},{id:99,name:'Boss',type:'NPC',subType:'Boss'}],abilities:[]}
});
const quota=()=>({limitPerHour:1000,pointsSpentThisHour:100,pointsResetIn:1800});
function segmentPayload(start,end){
  const base=Number(start);
  return {events:[
    // resourceActor=1 => x/y belongs to source 9001
    {timestamp:base+10,type:'heal',sourceID:9001,sourceIsFriendly:true,targetID:9001,targetIsFriendly:true,resourceActor:1,x:100+base,y:200+base,facing:-200,mapID:2608,nextX:110+base,nextY:210+base,nextTimestamp:base+50,nextFacing:-201,ability:{guid:123,name:'Heal'}},
    // resourceActor=2 => x/y belongs to target 9002
    {timestamp:base+20,type:'damage',sourceID:99,sourceIsFriendly:false,targetID:9002,targetIsFriendly:true,resourceActor:2,x:300+base,y:400+base,facing:-300,mapID:2608,nextX:310+base,nextY:410+base,nextTimestamp:base+60,ability:{guid:777,name:'Boss hit'}},
    // Critical regression: source is a player but resourceActor=2 points at the BOSS.
    // 2.1.5 would treat x/y as source coordinates; 2.1.6 must ignore it for player tracks.
    {timestamp:base+25,type:'damage',sourceID:9001,sourceIsFriendly:true,targetID:99,targetIsFriendly:false,resourceActor:2,x:99999,y:99999,mapID:2608,ability:{guid:888,name:'Player hit'}},
    {timestamp:base+80,type:'begincast',sourceID:99,sourceIsFriendly:false,targetID:9002,targetIsFriendly:true,ability:{guid:1287072,name:'Буря'}},
    {timestamp:base+90,type:'applydebuff',sourceID:99,sourceIsFriendly:false,targetID:9002,targetIsFriendly:true,ability:{guid:1288297,name:'Clinging Murk'}},
    {timestamp:base+100,type:'summon',sourceID:99,sourceIsFriendly:false,targetID:77,targetIsFriendly:false,ability:{guid:1290001,name:'Add'}},
    {timestamp:base+110,type:'death',sourceID:99,sourceIsFriendly:false,targetID:9002,targetIsFriendly:true}
  ]};
}

globalThis.fetch=async(url,opts={})=>{
  url=String(url);
  if(url.includes('/oauth/token'))return new Response(JSON.stringify({access_token:'test-token',expires_in:3600}),{status:200,headers:{'Content-Type':'application/json'}});
  if(url.includes('/reports/replaysegment/')){
    segmentCalls++;
    if(mode==='rate')return new Response('rate limited',{status:429,headers:{'Retry-After':'120'}});
    const m=url.match(/\/reports\/replaysegment\/[^/]+\/(\d+)\/(\d+)\/(\d+)\/?$/);if(!m)throw new Error(`Bad segment URL ${url}`);
    segmentBossIds.push(+m[1]);
    return new Response(JSON.stringify(segmentPayload(+m[2],+m[3])),{status:200,headers:{'Content-Type':'application/json'}});
  }
  if(url.includes('/api/v2/client')){
    gqlCalls++;const body=JSON.parse(opts.body||'{}'),q=String(body.query||''),vars=body.variables||{};
    if(q.includes('RaidRUReport')){reportCalls++;return new Response(JSON.stringify({data:{rateLimitData:quota(),reportData:{report:fightFor(vars.code)}}}),{status:200,headers:{'Content-Type':'application/json'}})}
    if(q.includes('RaidRUOneShot')){oneShotCalls++;const report=fightFor(vars.code);report.events={data:[{timestamp:150,type:'begincast',sourceID:99,targetID:9001,abilityGameID:1287072,abilityName:'Буря'}],nextPageTimestamp:null};return new Response(JSON.stringify({data:{rateLimitData:quota(),reportData:{report}}}),{status:200,headers:{'Content-Type':'application/json'}})}
    if(q.includes('RaidRUMechanics')){mechanicsGqlCalls++;return new Response(JSON.stringify({errors:[{message:'mechanics graphql should not be needed after replaysegment'}]}),{status:200,headers:{'Content-Type':'application/json'}})}
    if(q.includes('RaidRUQuota'))return new Response(JSON.stringify({data:{rateLimitData:quota()}}),{status:200,headers:{'Content-Type':'application/json'}});
  }
  throw new Error(`Unexpected fetch ${url}`);
};

const source=await fs.readFile(new URL('./src/index.js',import.meta.url),'utf8');
const mod=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`),worker=mod.default;
const env={WCL_CLIENT_ID:'id',WCL_CLIENT_SECRET:'secret'};
const request=(path)=>new Request(`https://worker.test${path}`,{headers:{Origin:'https://natalikh.github.io'}});

async function collect(code='SegmentTestAA'){
  let r,b;for(let i=0;i<8;i++){r=await worker.fetch(request(`/wcl/exact-replay?code=${code}&fight=10&mode=smart`),env,{});b=await r.json();if(r.status===200)return {r,b};ok(`segment batch ${i+1} yields`,r.status===202&&b.error==='batch_yield');}throw new Error('too many batches')
}

let beforeGql=gqlCalls,beforeSeg=segmentCalls;
let {r,b}=await collect();
ok('exact replay is Browser Replay v2',r.status===200&&b.format==='raidru-wcl-replay-browser'&&b.version===2);
ok('fight roster scoped to friendlyPlayers, not 500 report actors',b.actors.length===2&&b.actorIds.length===2);
ok('uses WCL replaysegment source',b.source?.fetchMode==='replaysegment'&&b.quality==='full'&&b.source.segmentCount===3);
ok('missing GraphQL encounterID resolves Entombed Sentinels replay boss id 53445',segmentBossIds.slice(-3).every(x=>x===53445)&&b.source?.bossId===53445&&b.fight?.encounterID===0);
ok('three 30s replay slices fetched',segmentCalls-beforeSeg===3&&b.source.segments.length===3&&b.source.segments[0].start===100&&b.source.segments[0].end===30099&&b.source.segments[1].start===30100&&b.source.segments[2].start===60100&&b.source.segments[2].end===65100);
ok('GraphQL used only for report metadata',gqlCalls-beforeGql===1&&reportCalls>=1);
ok('real replay resourceActor yields player coordinates',b.positions.length>=8&&b.stats.compactPositionPoints>=8&&b.stats.actorCoverage===1);
ok('resourceActor=2 does not assign boss x/y to player source',!b.positions.some(p=>p.x===99999||p.y===99999));
ok('mapID survives replaysegment import',String(Object.keys(b.mapIDs||{})).includes('2608'));
ok('rich mechanics timeline is embedded',b.timeline.some(e=>e.type==='begincast'&&e.abilityID===1287072)&&b.timeline.some(e=>e.type==='applydebuff'&&e.abilityID===1288297)&&b.timeline.some(e=>e.type==='summon')&&b.timeline.some(e=>e.type==='death'));
ok('ability guid is used as spell id',b.timeline.some(e=>e.abilityID===1287072&&e.abilityName==='Буря'));

const beforeCacheSeg=segmentCalls,beforeCacheGql=gqlCalls;
r=await worker.fetch(request('/wcl/exact-replay?code=SegmentTestAA&fight=10&mode=smart'),env,{});b=await r.json();
ok('completed replay is cache-only',r.status===200&&b.cache==='hit'&&segmentCalls===beforeCacheSeg&&gqlCalls===beforeCacheGql);

const beforeMechGql=mechanicsGqlCalls,beforeMechAll=gqlCalls;
r=await worker.fetch(request('/wcl/mechanics?code=SegmentTestAA&fight=10'),env,{});b=await r.json();
ok('mechanics served from replaysegment cache',r.status===200&&b.cache==='replaysegment'&&b.timeline.length>0);
ok('mechanics does not make second GraphQL request',mechanicsGqlCalls===beforeMechGql&&gqlCalls===beforeMechAll);


// Standard GraphQL encounter IDs are converted to the Replay namespace (+50000).
const bossIdsBefore=segmentBossIds.length;
({r,b}=await collect('EncounterIdTestAA'));
ok('GraphQL encounterID 3420 converts to replay boss id 53420',r.status===200&&segmentBossIds.slice(bossIdsBefore).every(x=>x===53420)&&b.source?.bossId===53420&&b.fight?.encounterID===3420);

// Legacy fast mode remains an explicit diagnostic only.
const beforeFast=oneShotCalls;
r=await worker.fetch(request('/wcl/exact-replay?code=FastTestAA&fight=10&mode=fast'),env,{});b=await r.json();
ok('explicit fast mode still uses one-shot GraphQL',oneShotCalls===beforeFast+1&&r.status===200);

// A real replaysegment 429 is respected without hammering the site.
mode='rate';const beforeRateSeg=segmentCalls;
r=await worker.fetch(request('/wcl/exact-replay?code=RateTestAA&fight=10&mode=smart'),env,{});b=await r.json();
ok('replaysegment 429 becomes pause',r.status===202&&b.error==='wcl_rate_limited'&&b.retryAfter>=120&&segmentCalls===beforeRateSeg+1);
const lockedSeg=segmentCalls,lockedGql=gqlCalls;
r=await worker.fetch(request('/wcl/exact-replay?code=RateTestAA&fight=10&mode=smart'),env,{});b=await r.json();
ok('Retry-After prevents another replaysegment fetch',r.status===202&&b.error==='wcl_rate_limited'&&segmentCalls===lockedSeg);
ok('cached report prevents extra GraphQL while locked',gqlCalls===lockedGql);

mode='normal';
console.log('WCL Replay Boss Resolver 2.1.7 Worker mock tests: OK');
