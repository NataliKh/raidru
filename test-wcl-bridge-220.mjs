import fs from 'node:fs/promises';
import vm from 'node:vm';
function ok(name,value){if(!value)throw new Error(`FAIL ${name}`);console.log(`OK ${name}`)}

const listeners=new Map(),posted=[],fetches=[];
const window={addEventListener(type,fn){(listeners.get(type)||listeners.set(type,[]).get(type)).push(fn)},postMessage(data,_target){posted.push(data)}};
const location={href:'https://www.warcraftlogs.com/reports/v3Qdp9M24hxy1bRg?fight=34&view=replay',origin:'https://www.warcraftlogs.com'};
const starts=[10013898,10253898,10493898];
const rowsByStart=new Map([
  [starts[0],[
    // Production regression: GraphQL friendlyPlayers ids intentionally do NOT overlap Replay actor ids.
    {timestamp:10013908,type:'heal',sourceID:318,sourceIsFriendly:true,targetID:318,targetIsFriendly:true,resourceActor:1,x:35428,y:67917,facing:-692,mapID:2608,nextX:35440,nextY:67930,nextTimestamp:10013958},
    {timestamp:10014070,type:'heal',sourceID:318,targetID:292,resourceActor:2,x:33070,y:69061,facing:-566,mapID:2608},
    // Friendly pet track must survive page capture but later be rejected by masterData player resolver.
    {timestamp:10014090,type:'heal',sourceID:777,sourceIsFriendly:true,targetID:777,targetIsFriendly:true,resourceActor:1,x:34000,y:70000,mapID:2608},
    // Hostile boss coordinates must never be assigned to the friendly source.
    {timestamp:10014100,type:'damage',sourceID:318,sourceIsFriendly:true,targetID:503,targetIsFriendly:false,resourceActor:2,x:99999,y:99999,mapID:2608},
    {timestamp:10014200,type:'begincast',sourceID:503,sourceIsFriendly:false,targetID:318,targetIsFriendly:true,ability:{guid:12345,name:'Тестовый каст'}},
    {timestamp:10014300,type:'applydebuff',sourceID:503,sourceIsFriendly:false,targetID:292,targetIsFriendly:true,ability:{guid:23456,name:'Тестовый дебафф'}}
  ]],
  [starts[1],[{timestamp:10253950,type:'heal',sourceID:318,sourceIsFriendly:true,targetID:318,targetIsFriendly:true,resourceActor:1,x:36500,y:70000,facing:-500,mapID:2608}]],
  [starts[2],[{timestamp:10493950,type:'heal',sourceID:292,sourceIsFriendly:true,targetID:292,targetIsFriendly:true,resourceActor:1,x:38000,y:73000,facing:-450,mapID:2608}]]
]);
async function fetch(path){
  fetches.push(String(path));
  const m=String(path).match(/\/53445\/(\d+)\/(\d+)\/$/);if(!m)return new Response('bad',{status:404});
  const rows=rowsByStart.get(+m[1])||[];
  return new Response(JSON.stringify({events:rows}),{status:200,headers:{'Content-Type':'application/json'}});
}
const context=vm.createContext({window,location,fetch,Response,console,Number,Math,Date,Set,Map,String,JSON,Array,encodeURIComponent,Promise});
const source=await fs.readFile(new URL('./wcl-bridge-extension/wcl-page-probe.js',import.meta.url),'utf8');
vm.runInContext(source,context);
const handler=(listeners.get('message')||[])[0];
ok('page probe installs one message listener',typeof handler==='function');
const payload={code:'v3Qdp9M24hxy1bRg',fight:'34',startTime:10013898,endTime:10537539,replayBossId:53445,friendlyPlayerIds:[9001,9002],playerActorIds:[318,292,1000]};
handler({source:window,data:{type:'RAIDRU_WCL_PAGE_CAPTURE_REQUEST',requestId:'t1',payload}});
for(let i=0;i<100&&!posted.length;i++)await new Promise(r=>setTimeout(r,5));
const response=posted.find(x=>x.type==='RAIDRU_WCL_PAGE_CAPTURE_RESPONSE')?.response;
ok('bridge capture succeeds even when GraphQL roster ids do not overlap Replay ids',response?.ok===true&&response.result?.source?.rosterFallback===true);
ok('uses real 240-second ReplaySegment windows',fetches.length===3&&fetches[0].endsWith('/53445/10013898/10253897/')&&fetches[1].endsWith('/53445/10253898/10493897/')&&fetches[2].endsWith('/53445/10493898/10537539/'));
const rawIds=new Set(response.result.positions.map(p=>String(p[0])));
ok('friendliness/masterData fallback captures real Replay actor tracks',rawIds.has('318')&&rawIds.has('292')&&response.result.stats.ownerWays['resourceActor:2']>=1);
ok('hostile target coordinates are never assigned to friendly source',!response.result.positions.some(p=>p[2]===99999||p[3]===99999));
ok('nextX nextY become same actor next point',response.result.positions.some(p=>p[0]===318&&p[1]===60&&p[2]===35440&&p[6]===1));
ok('bridge also returns tactical mechanics from same ReplaySegment',response.result.timeline.some(e=>e.family==='casts'&&e.abilityID===12345)&&response.result.timeline.some(e=>e.family==='debuffs'&&e.abilityID===23456));
ok('diagnostics expose candidate/match counts',response.result.stats.coordinateCandidates>=5&&response.result.stats.matchedExpectedActorCount===0&&response.result.stats.rosterFallback===true);

// Evaluate browser-side resolver independently: report-wide actor table may be huge, but only coordinate-bearing Player actors survive.
const clientWindow={addEventListener(){},postMessage(){}};
const clientCtx=vm.createContext({window:clientWindow,location:{origin:'https://natalikh.github.io'},console,Number,Math,Date,Set,Map,String,JSON,Array,Promise});
vm.runInContext(await fs.readFile(new URL('./wcl-bridge-220.js',import.meta.url),'utf8'),clientCtx);
const resolve=clientWindow.selectPlayerTracks220;
const report={actors:[{id:318,name:'Player A',type:'Player',subType:'Priest'},{id:292,name:'Player B',type:'Player',subType:'Warrior'},{id:777,name:'Pet',type:'Pet'},{id:1000,name:'Other report player',type:'Player'}]};
const fight={friendlyPlayers:[9001,9002],size:2};
const unpacked=response.result.positions.map(p=>({actorId:p[0],t:p[1],x:p[2],y:p[3],mapID:p[5]}));
const selected=resolve(report,fight,unpacked);
ok('masterData fallback keeps only actual Player coordinate tracks',selected.mode==='masterData-player-fallback'&&selected.actors.length===2&&selected.actors.some(a=>a.id===318)&&selected.actors.some(a=>a.id===292)&&!selected.actors.some(a=>a.id===777));

const manifest=JSON.parse(await fs.readFile(new URL('./wcl-bridge-extension/manifest.json',import.meta.url),'utf8'));
ok('extension bumped to 2.2.1 and remains narrowly scoped',manifest.version==='2.2.1'&&manifest.manifest_version===3&&manifest.content_scripts.some(x=>x.world==='MAIN'&&x.matches.includes('https://*.warcraftlogs.com/reports/*')));
const safeClient=await fs.readFile(new URL('./wcl-safe-200.js',import.meta.url),'utf8');
ok('normal client path uses Browser Bridge, not exact-replay GraphQL',/captureWclReplayBridge220/.test(safeClient)&&!/apiJson\(`\/wcl\/exact-replay\?/.test(safeClient));
const mechanics=await fs.readFile(new URL('./wcl-mechanics-209.js',import.meta.url),'utf8');
ok('mechanics can use selected fight and auto-continue partial pages',/__raidruWclSelection220/.test(mechanics)&&/maxAutoPages=6/.test(mechanics)&&/localPack209\(\)/.test(mechanics));
const worker=await fs.readFile(new URL('./src/index.js',import.meta.url),'utf8');
ok('mechanics GraphQL no longer relies on HostilityType filtering',!/events\(dataType: Casts, hostilityType:/.test(worker)&&!/events\(dataType: Debuffs, hostilityType:/.test(worker));
const viewer=await fs.readFile(new URL('./viewer-212.js',import.meta.url),'utf8');
ok('footer no longer lies about 2.1.8',/RaidRU 2\.2\.1 · WCL Bridge Final Audit/.test(viewer)&&!/RaidRU 2\.1\.8/.test(viewer));
console.log('WCL Browser Bridge 2.2.1 final-audit regression: OK');
