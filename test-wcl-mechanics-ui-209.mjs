import fs from 'node:fs/promises';import vm from 'node:vm';
const raw={format:'raidru-wcl-replay-browser',version:2,source:{reportCode:'TestCode99',fight:'10',bossId:53420},time:{duration:60000},timeline:[
 {t:5000,type:'begincast',sourceID:99,targetID:1,sourceIsFriendly:false,targetIsFriendly:true,abilityID:1277002,abilityName:'Ravage'},
 {t:7000,type:'applydebuff',sourceID:99,targetID:1,sourceIsFriendly:false,targetIsFriendly:true,abilityID:1287083,abilityName:'Tempest'},
 {t:7050,type:'applydebuff',sourceID:99,targetID:2,sourceIsFriendly:false,targetIsFriendly:true,abilityID:1287083,abilityName:'Tempest'},
 {t:9000,type:'summon',sourceID:99,targetID:110,sourceIsFriendly:false,targetIsFriendly:false,abilityID:555,abilityName:'Living Venom'},
 {t:20000,type:'death',sourceID:null,targetID:1,sourceIsFriendly:false,targetIsFriendly:true,abilityID:0,abilityName:'Unknown Ability'}
]};
const d={duration:60000,actors:[{id:1,name:'A',type:'Player'},{id:2,name:'B',type:'Player'}],positions:[{actorId:1,t:0,x:0,y:0},{actorId:1,t:60000,x:10,y:10},{actorId:2,t:0,x:2,y:2},{actorId:2,t:60000,x:12,y:12}],events:[],fight:{duration:60000},source:{reportCode:'TestCode99',fight:'10'}};
const ctx={console,window:null,document:{},location:{origin:'https://natalikh.github.io'},NSRT_VOICE_PROFILES:{},current:'sszorak',render(){},replayState(){return {data:d}},replayActors(x){return x.actors},replayBounds(){return {minX:0,maxX:12,minY:0,maxY:12}},positionAt(x,id,t){const a=x.positions.filter(p=>p.actorId===id);return t<30000?a[0]:a[1]},fmtTime(sec){const s=Math.floor(sec);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`},esc(s){return String(s)},scenarioState(){return {scenes:[],timelineV3:[]}},save(){},setView(){},toast(){},createPlanFromReplay(){},uid(){return Math.random().toString(36)},__raidruExactReplay208:raw};ctx.window=ctx;vm.createContext(ctx);const src=await fs.readFile(new URL('./wcl-mechanics-209.js',import.meta.url),'utf8');vm.runInContext(src,ctx);const html=ctx.wclMechanicsAnalysis209(d);
if(!html.includes('Ravage')||!html.includes('Tempest')||!html.includes('Living Venom'))throw new Error('browser JSON mechanics names missing');
if(!html.includes('Механики + движение рейда'))throw new Error('mechanics timeline missing');
if(!html.includes('BROWSER JSON'))throw new Error('browser JSON local mode missing');
console.log('WCL Mechanics 2.0.9 browser JSON UI fixture: OK');
