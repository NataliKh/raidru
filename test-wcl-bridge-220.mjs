import fs from 'node:fs/promises';
import vm from 'node:vm';
function ok(name,value){if(!value)throw new Error(`FAIL ${name}`);console.log(`OK ${name}`)}

const listeners=new Map(),posted=[],fetches=[];
const window={
  addEventListener(type,fn){(listeners.get(type)||listeners.set(type,[]).get(type)).push(fn)},
  postMessage(data,_target){posted.push(data)}
};
const location={href:'https://www.warcraftlogs.com/reports/v3Qdp9M24hxy1bRg?fight=10&view=replay',origin:'https://www.warcraftlogs.com'};
const starts=[10013898,10253898,10493898];
const rowsByStart=new Map([
  [starts[0],[
    {timestamp:10013908,sourceID:318,targetID:503,resourceActor:1,x:35428,y:67917,facing:-692,mapID:2608,nextX:35440,nextY:67930,nextTimestamp:10013958},
    {timestamp:10014070,sourceID:99,targetID:292,resourceActor:2,x:33070,y:69061,facing:-566,mapID:2608},
    {timestamp:10014100,sourceID:318,targetID:503,resourceActor:2,x:99999,y:99999,mapID:2608}
  ]],
  [starts[1],[{timestamp:10253950,sourceID:318,targetID:503,resourceActor:1,x:36500,y:70000,facing:-500,mapID:2608}]],
  [starts[2],[{timestamp:10493950,sourceID:99,targetID:292,resourceActor:2,x:38000,y:73000,facing:-450,mapID:2608}]]
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
const payload={code:'v3Qdp9M24hxy1bRg',fight:'10',startTime:10013898,endTime:10537539,replayBossId:53445,friendlyPlayerIds:[318,292]};
handler({source:window,data:{type:'RAIDRU_WCL_PAGE_CAPTURE_REQUEST',requestId:'t1',payload}});
for(let i=0;i<100&&!posted.length;i++)await new Promise(r=>setTimeout(r,5));
const response=posted.find(x=>x.type==='RAIDRU_WCL_PAGE_CAPTURE_RESPONSE')?.response;
ok('bridge capture succeeds',response?.ok===true&&response.result?.format==='raidru-wcl-bridge-points');
ok('uses real 240-second ReplaySegment windows',fetches.length===3&&fetches[0].endsWith('/53445/10013898/10253897/')&&fetches[1].endsWith('/53445/10253898/10493897/')&&fetches[2].endsWith('/53445/10493898/10537539/'));
ok('resourceActor source and target ownership both work',new Set(response.result.positions.map(p=>String(p[0]))).has('318')&&new Set(response.result.positions.map(p=>String(p[0]))).has('292'));
ok('hostile target coordinates are never assigned to friendly source',!response.result.positions.some(p=>p[2]===99999||p[3]===99999));
ok('nextX nextY become same actor next point',response.result.positions.some(p=>p[0]===318&&p[1]===60&&p[2]===35440&&p[6]===1));
ok('mapID and bounds survive compaction',response.result.mapIDs['2608']>=4&&response.result.bounds.minX===33070&&response.result.bounds.maxY===73000);
ok('segments retain real request metadata',response.result.source.segments.length===3&&response.result.stats.segmentCount===3);

const manifest=JSON.parse(await fs.readFile(new URL('./wcl-bridge-extension/manifest.json',import.meta.url),'utf8'));
ok('extension is Manifest V3 and narrowly scoped',manifest.manifest_version===3&&manifest.content_scripts.some(x=>x.world==='MAIN'&&x.matches.includes('https://*.warcraftlogs.com/reports/*'))&&manifest.content_scripts.some(x=>x.matches.includes('https://natalikh.github.io/raidru/*')));
const client=await fs.readFile(new URL('./wcl-safe-200.js',import.meta.url),'utf8');
ok('normal client path uses Browser Bridge, not exact-replay GraphQL',/captureWclReplayBridge220/.test(client)&&!/apiJson\(`\/wcl\/exact-replay\?/.test(client));
const mechanics=await fs.readFile(new URL('./wcl-mechanics-209.js',import.meta.url),'utf8');
ok('mechanics source can use selected fight without Replay',/__raidruWclSelection220/.test(mechanics)&&/не зависит от координат/.test(mechanics));
console.log('WCL Browser Bridge 2.2.0 regression: OK');
