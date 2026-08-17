import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const content=JSON.parse(fs.readFileSync(path.join(root,'apps/web/src/data/legacy-content.json'),'utf8'));
const errors=[];
if(content.raid.length!==8)errors.push(`expected 8 bosses, got ${content.raid.length}`);
for(const boss of content.raid){
  const scenes=content.presetScenes[boss.id]||[];
  const timeline=content.presetTimelines[boss.id]||[];
  if(!scenes.length)errors.push(`${boss.id}: no scenes`);
  if(!timeline.length)errors.push(`${boss.id}: no timeline`);
  const map=path.join(root,'apps/web/public/assets/maps',`${boss.id}.webp`);
  if(!fs.existsSync(map))errors.push(`${boss.id}: map asset missing`);
}
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const versionSource=read('apps/web/src/app/version.ts');
if(!versionSource.includes("3.0.0-alpha.2"))errors.push('central version mismatch');
const store=read('apps/web/src/app/store.ts');
const planner=read('apps/web/src/features/planner/PlannerWorkspace.tsx');
const arena=read('apps/web/src/features/planner/Arena.tsx');
const palette=read('apps/web/src/features/planner/palette.ts');
const types=read('packages/shared-types/src/index.ts');
const plannerCore=read('packages/planner-core/src/index.ts');
const required=[
  [store,'schemaVersion: 4','schema v4'],
  [store,'difficultyPlans','difficulty plans'],
  [store,'switchDifficulty','difficulty switching'],
  [store,'beginPlannerGesture','gesture history'],
  [store,'undo()','undo'],
  [store,'redo()','redo'],
  [store,'addScene','scene add'],
  [store,'duplicateScene','scene duplicate'],
  [store,'createRoute','route create'],
  [planner,'PalettePanel','palette UI'],
  [planner,'InspectorPanel','inspector UI'],
  [arena,'application/x-raidru-palette','drag/drop'],
  [arena,'routePath','route rendering'],
  [palette,"id:'effect-arrow'",'arrow palette'],
  [types,'interface SceneRoute','route type'],
  [plannerCore,'clearMapObjects','planner-core difficulty operation'],
  [plannerCore,'insertScene','planner-core scene operation'],
  [plannerCore,'moveRoutePoint','planner-core route operation']
];
for(const [source,needle,label] of required)if(!source.includes(needle))errors.push(`planner core missing: ${label}`);
const tsxFiles=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.tsx?$/.test(e.name)&&!e.name.includes('__react-test-shim'))tsxFiles.push(p)}}
walk(path.join(root,'apps/web/src'));
console.log(`Bosses: ${content.raid.length}`);
console.log(`Scenes: ${Object.values(content.presetScenes).reduce((s,a)=>s+a.length,0)}`);
console.log(`Timeline events: ${Object.values(content.presetTimelines).reduce((s,a)=>s+a.length,0)}`);
console.log(`TypeScript/TSX modules: ${tsxFiles.length}`);
console.log(`Planner checks: ${required.length}`);
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('RaidRU 3 Planner Core validation: PASS');
