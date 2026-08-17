import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const errors=[];
const require=createRequire(import.meta.url);
let ts;
try { ts=require('typescript'); }
catch { ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js'); }
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const json=rel=>JSON.parse(read(rel));
const assert=(condition,message)=>{ if(!condition)errors.push(message); };

const content=json('apps/web/src/data/legacy-content.json');
assert(content.raid.length===8,`expected 8 bosses, got ${content.raid.length}`);
for(const boss of content.raid){
  const scenes=content.presetScenes[boss.id]||[];
  const timeline=content.presetTimelines[boss.id]||[];
  assert(scenes.length>0,`${boss.id}: no scenes`);
  assert(timeline.length>0,`${boss.id}: no timeline`);
  assert(fs.existsSync(path.join(root,'apps/web/public/assets/maps',`${boss.id}.webp`)),`${boss.id}: map asset missing`);
}

const versionSource=read('apps/web/src/app/version.ts');
const store=read('apps/web/src/app/store.ts');
const planner=read('apps/web/src/features/planner/PlannerWorkspace.tsx');
const arena=read('apps/web/src/features/planner/Arena.tsx');
const importDialog=read('apps/web/src/features/raidplan-import/RaidPlanImportDialog.tsx');
const client=read('apps/web/src/features/raidplan-import/RaidPlanClient.ts');
const raidplanCore=read('packages/raidplan-core/src/index.ts');
const nativeTokenStyleSource=read('apps/web/src/features/planner/nativeTokenStyle.ts');
const worker=read('workers/wcl/src/index.js');
assert(versionSource.includes("3.0.0-alpha.3.3"),'central version mismatch');
assert(versionSource.includes("Planner UX Cleanup"),'central channel mismatch');
assert(store.includes('applyExternalPlan'),'Store has no external plan transaction');
assert(store.includes('rekeyExternalPlan'),'external import IDs are not re-keyed');
assert(planner.includes('RaidPlanImportDialog'),'Planner has no RaidPlan import entry point');
assert(importDialog.includes("applyExternalPlan"),'RaidPlan UI bypasses or misses Store transaction');
assert(client.includes('/raidplan'),'RaidPlan transport endpoint missing');
assert(arena.includes('scene.map.backgroundUrl'),'Arena does not honor imported background');
assert(arena.includes('effect.points'),'Arena does not render native vector points');
assert(arena.includes("token.type === 'text'"),'Arena does not render imported text separately');
assert(arena.includes('publicAsset'),'Arena does not resolve public assets against Vite base');
assert(arena.includes('nativeTokenStyle'),'Arena does not use null-safe native token styling');
assert(nativeTokenStyleSource.includes('value === null || value === undefined'),'native token optional metadata is not null-safe');
assert(!/const\s+opacity\s*=\s*Number\(token\.meta\?\.opacity\)/.test(nativeTokenStyleSource),'native token opacity still uses Number(null) => 0');
assert(!arena.includes('presentationMode'),'removed RaidPlan presentation mode leaked back into Arena');
assert(!planner.includes('raidPlanViewToggle') && !planner.includes('>Оригинал<'),'removed Original/RaidRU toggle leaked back into Planner');
assert(planner.includes('raidPlanFidelityStrip'),'per-scene visual fidelity diagnostics missing');
const publicAssetSource=read('apps/web/src/shared/publicAsset.ts');
const paletteSource=read('apps/web/src/features/planner/palette.ts');
assert(publicAssetSource.includes('import.meta.env.BASE_URL'),'public asset resolver does not use Vite BASE_URL');
assert(!paletteSource.includes('./assets/palette/'),'palette still contains pathname-relative assets');
for(const role of ['tank','healer','melee','ranged']) assert(fs.existsSync(path.join(root,'apps/web/public/assets/palette/roles',`${role}.png`)),`palette role asset missing: ${role}`);
assert(raidplanCore.includes('fontFamily') && raidplanCore.includes('lineHeight') && raidplanCore.includes('charSpacing'),'RaidPlan typography metadata incomplete');
assert(raidplanCore.includes('sourceZ'),'explicit RaidPlan z-order support missing');
assert(raidplanCore.includes('helperTextNode'),'helper text filtering missing');
assert(worker.includes("http://localhost:5173"),'Worker does not allow Vite dev origin');
assert(worker.includes('/raidplan'),'RaidPlan Worker route missing');
assert(worker.includes('exactUrl') && worker.includes('new RegExp(`https://userdata'),'Worker does not prefer exact revisioned userdata URL');
assert(!/\bdocument\b|\bwindow\b|\bReact\b/.test(raidplanCore),'raidplan-core must not depend on DOM/React');
assert(raidplanCore.includes('strictNodeAllowed'),'strict visible whitelist missing');
assert(raidplanCore.includes('absoluteFabricLinePoints'),'Fabric off-canvas line detection missing');
assert(raidplanCore.includes('raidplan-v2-canvas'),'fixed RaidPlan v2 canvas mode missing');

const allTs=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else if(/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts'))allTs.push(p);}}
walk(path.join(root,'apps/web/src')); walk(path.join(root,'packages'));
let transpileDiagnostics=0;
for(const file of allTs){
  const source=fs.readFileSync(file,'utf8');
  const out=ts.transpileModule(source,{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}});
  for(const diagnostic of out.diagnostics||[]){
    if(diagnostic.category===ts.DiagnosticCategory.Error){
      transpileDiagnostics++;
      errors.push(`${path.relative(root,file)}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText,' ')}`);
    }
  }
}

// Execute the pure TypeScript adapter independently. Type-only shared imports disappear after transpile.
const transpiled=ts.transpileModule(raidplanCore,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const tempFile=path.join(os.tmpdir(),`raidru-raidplan-core-${process.pid}.mjs`);
fs.writeFileSync(tempFile,transpiled);
const core=await import(`${pathToFileURL(tempFile).href}?v=${Date.now()}`);

const nativeStyleTranspiled=ts.transpileModule(nativeTokenStyleSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const nativeStyleTemp=path.join(os.tmpdir(),`raidru-native-token-style-${process.pid}.mjs`);
fs.writeFileSync(nativeStyleTemp,nativeStyleTranspiled);
const nativeStyle=await import(`${pathToFileURL(nativeStyleTemp).href}?v=${Date.now()}`);
const missingOpacityStyle=nativeStyle.nativeTokenStyle({id:'rp-test',label:'Tank',type:'tank',x:20,y:30,meta:{source:'RaidPlan',w:6.75,h:12,opacity:null,angle:null,sourceOrder:3,z:3}});
assert(!Object.prototype.hasOwnProperty.call(missingOpacityStyle,'opacity'),'RaidPlan token with missing opacity became transparent');
const explicitZeroStyle=nativeStyle.nativeTokenStyle({id:'rp-hidden',label:'Tank',type:'tank',x:20,y:30,meta:{source:'RaidPlan',opacity:0}});
assert(explicitZeroStyle.opacity===0,'explicit opacity=0 must remain hidden');

const arenaNode=(step)=>({type:'arena',attr:{nid:`arena-${step}`,bgColor:'#2b2b2b',gridColor:'#7b7b7b',strokeWidth:1,shape:'circle',imageAlign:'center-center',imageUrl:'',raid:'wow.midnight.venomabyss',boss:'01.nakzali',map:'new',arenaWidth:600,arenaHeight:600},meta:{step,pos:{x:600,y:337.5},scale:{x:1,y:1},size:{h:675,w:1200},origin:{x:'center',y:'center'},angle:0,lock:1,hidden:0}});

const scene1Fixture=json('tests/fixtures/raidplan/scene1-visual.json');
const scene1Raw={code:'9v3wssyjja56rttz',version:2,revision:8,steps:1,nodes:scene1Fixture.nodes};
const scene1Result=core.convertRaidPlan(scene1Raw,{currentBoss:'nekzali',sourceUrl:'https://raidplan.io/plan/9v3wssyjja56rttz'});
assert(scene1Result.ok,'scene1 visual fixture failed to convert');
if(scene1Result.ok){
  const scene=scene1Result.plan.scenes[0];
  const texts=scene.tokens.filter(token=>token.type==='text');
  const title=texts.find(token=>token.label.startsWith('1 Фаза'));
  const body=texts.find(token=>token.label.startsWith('В каждом секторе'));
  const tank=scene.tokens.find(token=>token.type==='tank');
  const star=scene.tokens.find(token=>token.type==='marker');
  assert(texts.length===2,`scene1 expected 2 visible text blocks after helper filtering, got ${texts.length}`);
  assert(!!title&&Math.abs(Number(title.meta?.fontSizePct)-2.833)<.01,`scene1 title font scale wrong: ${title?.meta?.fontSizePct}`);
  assert(!!body&&Math.abs(Number(body.meta?.fontSizePct)-1.75)<.01,`scene1 body font scale wrong: ${body?.meta?.fontSizePct}`);
  assert(title?.meta?.fontFamily==='Inter'&&title?.meta?.fontWeight===700,'scene1 typography family/weight lost');
  assert(Number(title?.meta?.lineHeight)===1.16,'scene1 lineHeight lost');
  assert(String(tank?.meta?.asset).includes('cdn.raidplan.io/game/wow/role/tank.svg'),'scene1 role does not prefer original RaidPlan asset');
  assert(tank?.meta?.fallbackAsset==='assets/palette/roles/tank.png','scene1 role local fallback missing');
  assert(String(star?.meta?.asset).includes('cdn.raidplan.io/game/wow/raid/star.png'),'scene1 marker does not preserve original RaidPlan asset');
  assert(tank?.meta?.opacity===null,'scene1 missing RaidPlan opacity should stay null in domain model');
  assert(scene.map.raidPlan?.sourceCode==='9v3wssyjja56rttz'&&scene.map.raidPlan?.sceneIndex===1,'scene1 RaidPlan provenance missing');
}

const scene3Fixture=json('tests/fixtures/raidplan/scene3-paths.json');
const scene3Raw={code:'9v3wssyjja56rttz',version:2,revision:8,steps:3,nodes:[arenaNode(2),...scene3Fixture.paths]};
const scene3Result=core.convertRaidPlan(scene3Raw,{currentBoss:'nekzali'});
assert(scene3Result.ok,'scene3 fixture failed to convert');
if(scene3Result.ok){
  const scene=scene3Result.plan.scenes[2];
  const paths=scene.effects.filter(effect=>effect.type==='path');
  assert(scene.map.sourceWidth===1200&&scene.map.sourceHeight===675,'scene3 fixed 1200x675 canvas lost');
  assert(paths.length===4,`scene3 expected 4 non-degenerate path pieces, got ${paths.length}`);
  assert(scene3Result.report.degeneratePaths===1,`scene3 expected 1 degenerate path, got ${scene3Result.report.degeneratePaths}`);
  assert(paths.every(effect=>effect.style?.fill==='none'),'scene3 freehand path must remain stroke-only');
  assert(paths.every(effect=>(effect.points?.length||0)>1),'scene3 path geometry lost');
  assert(scene3Result.report.coordinateModes['raidplan-v2-canvas']===3,'scene3 must use fixed v2 canvas on all virtual scenes');
  assert(scene3Result.report.suppressedArenaVisuals===1,'map-backed arena should be background-only');
}

const scene4Fixture=json('tests/fixtures/raidplan/scene4-lines.json');
const bossMob={type:'mob',attr:{nid:'boss',lname:"Nek'zali",displayId:'142077',ringColor:'#d7180b'},meta:{step:3,pos:{x:599.886,y:344.487},scale:{x:.6,y:.6},size:{h:118,w:118},origin:{x:'center',y:'center'},angle:0,hidden:0}};
const scene4Raw={code:'9v3wssyjja56rttz',version:2,revision:8,steps:4,nodes:[arenaNode(3),bossMob,...scene4Fixture.lines]};
const scene4Result=core.convertRaidPlan(scene4Raw,{currentBoss:'nekzali'});
assert(scene4Result.ok,'scene4 fixture failed to convert');
if(scene4Result.ok){
  const scene=scene4Result.plan.scenes[3];
  const boss=scene.tokens.find(token=>token.type==='boss');
  const arrows=scene.effects.filter(effect=>effect.type==='arrow'||effect.type==='line');
  assert(!!boss,'scene4 boss token missing');
  if(boss){ assert(Math.abs(boss.x-50)<.2&&Math.abs(boss.y-51)<.25,`scene4 boss shifted to ${boss.x},${boss.y}`); }
  assert(arrows.length===3,`scene4 expected 3 drawn lines, got ${arrows.length}`);
  assert(arrows.every(effect=>effect.meta?.absoluteFabricPoints===true),'scene4 Fabric endpoint signature not recognized');
  assert(arrows.some(effect=>effect.points?.some(point=>point.x<0||point.y<0)),'scene4 off-canvas vector was clamped into board');
  assert(scene4Result.report.offCanvasVectors===3,`scene4 expected 3 off-canvas vectors, got ${scene4Result.report.offCanvasVectors}`);
}

const strictRaw={code:'strict-test-01',version:2,revision:1,steps:1,nodes:[
  arenaNode(0),
  {type:'circle',attr:{fill:'#ffffff',opacity:0},meta:{step:0,pos:{x:600,y:337},scale:{x:1,y:1},size:{w:500,h:500}}},
  {type:'mystery_internal_shape',attr:{fill:'#ffffff'},meta:{step:0,pos:{x:600,y:337},scale:{x:1,y:1},size:{w:900,h:600}}}
]};
const strictResult=core.convertRaidPlan(strictRaw,{currentBoss:'nekzali'});
assert(strictResult.ok,'strict visibility fixture failed');
if(strictResult.ok){
  assert(strictResult.plan.scenes[0].effects.length===0,'hidden/unknown fixture leaked a visible effect');
  assert(strictResult.report.hidden>=1,'opacity=0 node was not filtered');
  assert(strictResult.report.skipped>=1&&strictResult.report.unsupported.includes('mystery_internal_shape'),'unknown v2 node was not strict-skipped');
  assert(strictResult.report.suppressedArenaVisuals===1,'map-backed arena leaked into effects');
}

try{fs.unlinkSync(tempFile)}catch{}
try{fs.unlinkSync(nativeStyleTemp)}catch{}

console.log(`Bosses: ${content.raid.length}`);
console.log(`Scenes: ${Object.values(content.presetScenes).reduce((sum,list)=>sum+list.length,0)}`);
console.log(`Timeline events: ${Object.values(content.presetTimelines).reduce((sum,list)=>sum+list.length,0)}`);
console.log(`TypeScript/TSX modules: ${allTs.length}`);
console.log(`TypeScript syntax diagnostics: ${transpileDiagnostics}`);
console.log('RaidPlan fixtures: scene1 typography/assets/native-token visibility + scene3 paths + scene4 off-canvas lines + strict visibility');
if(errors.length){ console.error('\n'+errors.map(error=>`FAIL: ${error}`).join('\n')); process.exit(1); }
console.log('RaidRU 3 Planner UX Cleanup validation: PASS');
