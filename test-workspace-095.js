const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

const store=new Map();
const noop=()=>{};
const classList={add:noop,remove:noop,toggle:noop,contains:()=>false};
const appNode={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null};
const fakeNode=()=>({innerHTML:'',textContent:'',value:'',style:{},dataset:{},classList,appendChild:noop,remove:noop,addEventListener:noop,querySelector:()=>null,querySelectorAll:()=>[],insertAdjacentHTML:noop,setAttribute:noop,getAttribute:()=>null,focus:noop,click:noop});
const document={
  body:{appendChild:noop,classList},documentElement:{requestFullscreen:()=>Promise.resolve()},fullscreenElement:null,
  querySelector:(s)=>s==='#app'?appNode:(s==='#toast'?fakeNode():null),querySelectorAll:()=>[],getElementById:()=>null,
  createElement:fakeNode,addEventListener:noop
};
const context={
  console,JSON,Math,Date,Intl,Map,Set,WeakMap,Array,Object,String,Number,Boolean,RegExp,Error,Promise,
  parseInt,parseFloat,isFinite,encodeURIComponent,decodeURIComponent,escape,unescape,
  btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),
  localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
  sessionStorage:{getItem:()=>null,setItem:noop},
  document,navigator:{clipboard:{writeText:noop}},location:{origin:'http://test',pathname:'/',hash:''},
  history:{},performance:{now:()=>0},crypto:require('crypto').webcrypto,
  requestAnimationFrame:()=>0,cancelAnimationFrame:noop,setTimeout:(fn)=>{ /* importer refresh is intentionally not run */ return 1;},clearTimeout:noop,
  confirm:()=>true,prompt:(_q,v)=>v||'test',alert:noop,fetch:async()=>{throw new Error('network disabled in smoke test')},
  Blob:class Blob{},URL:{createObjectURL:()=>'',revokeObjectURL:noop},FileReader:class{},
  addEventListener:noop,removeEventListener:noop,
};
context.window=context;
vm.createContext(context);
for(const file of ['app.js','raidplan-importer.js','workspace-095.js']){
  vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
}

assert.strictEqual(vm.runInContext("state._workspace095.version",context),'0.9.5');
assert.strictEqual(vm.runInContext("state._workspace095.plans.length",context),8,'0.8 data should migrate to 8 Heroic projects');
assert.strictEqual(typeof context.workspaceNewFromCurrent,'function');
assert.strictEqual(typeof context.addAssignment,'function');
assert.strictEqual(typeof context.timelineJump095,'function');
assert.ok(appNode.innerHTML.includes('RaidRU'),'core UI should render');

// Browser Replay smoke: 10 sustained player tracks + 2 short pet/summon tracks.
const timeline=[];
for(let i=1;i<=12;i++) timeline.push({t:1,type:'removebuff',sourceID:i,targetID:i,sourceIsFriendly:true,targetIsFriendly:true,abilityID:100+i,abilityName:'buff'});
timeline.push({t:10000,type:'cast',sourceID:99,targetID:1,sourceIsFriendly:false,targetIsFriendly:true,abilityID:1287072,abilityName:'Tempest'});
const positions=[];
for(let id=1;id<=10;id++) for(let n=0;n<100;n++) positions.push({actorId:id,t:n*100,x:id*10+n,y:id*5+n,mapID:2609});
for(let id=11;id<=12;id++) for(let n=0;n<25;n++) positions.push({actorId:id,t:n*100,x:id*10+n,y:id*5+n,mapID:2609});
context.__sample={format:'raidru-wcl-replay-browser',time:{duration:10000},actorIds:[1,2,3,4,5,6,7,8,9,10,11,12],positions,timeline,mapIDs:[2609],source:{bossId:53420}};
vm.runInContext("replayState().data=normalizeReplayPayload(__sample)",context);
assert.strictEqual(vm.runInContext("replayState().data.actors.length",context),10,'pet/summon tracks must be filtered');
assert.strictEqual(vm.runInContext("replayState().data.events[0].label",context),'Буря','known WCL spell should use Russian NSRT label');
for(const samplePath of process.argv.slice(2)){
  const raw=JSON.parse(fs.readFileSync(samplePath,'utf8'));
  context.__realSample=raw;
  vm.runInContext("{const w=+(__realSample.source?.bossId||0);const hit=Object.entries(NSRT_VOICE_PROFILES).find(([,p])=>+p.encounterId===w||+p.encounterId+50000===w);if(hit)current=hit[0];replayState().data=normalizeReplayPayload(__realSample);replayState().source='json'}",context);
  const info=vm.runInContext("({boss:current,actors:replayState().data.actors.length,positions:replayState().data.positions.length,events:replayState().data.events.length,major:replayState().data.events.filter(e=>e.major).length,duration:replayState().data.duration})",context);
  assert.ok(info.actors>0&&info.actors<=30,'real Browser Replay should resolve a plausible raid-size actor set');
  assert.ok(info.positions>0,'real Browser Replay should keep player positions');
  assert.ok(info.events>0&&info.major>0,'real Browser Replay should detect hostile major mechanics');
  const before=vm.runInContext("state._workspace095.plans.length",context);
  vm.runInContext("createPlanFromReplay()",context);
  const draft=vm.runInContext("(()=>{const p=state._workspace095.plans.find(x=>x.id===state._workspace095.activeId);return {plans:state._workspace095.plans.length,name:p.name,scenes:p.data.scenes.length,timeline:p.data.timelineV3.length}})()",context);
  assert.strictEqual(draft.plans,before+1,'WCL draft must create a separate Workspace plan');
  assert.ok(draft.scenes>=3&&draft.scenes<=12,'WCL draft should be compact');
  assert.ok(draft.timeline>0,'WCL draft should keep a mechanics timeline');
  console.log(`WCL sample ${samplePath}: ${info.boss}, ${info.actors} players, ${info.positions} positions, ${info.major}/${info.events} major mechanics, ${draft.scenes} draft scenes, ${Math.round(info.duration/1000)}s`);
}
console.log('RaidRU 0.9.5 workspace smoke: PASS');
