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
const versionSource=fs.readFileSync(path.join(root,'apps/web/src/app/version.ts'),'utf8');
if(!versionSource.includes("3.0.0-alpha.1"))errors.push('central version mismatch');
const tsxFiles=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.tsx?$/.test(e.name))tsxFiles.push(p)}}
walk(path.join(root,'apps/web/src'));
console.log(`Bosses: ${content.raid.length}`);
console.log(`Scenes: ${Object.values(content.presetScenes).reduce((s,a)=>s+a.length,0)}`);
console.log(`Timeline events: ${Object.values(content.presetTimelines).reduce((s,a)=>s+a.length,0)}`);
console.log(`TypeScript/TSX modules: ${tsxFiles.length}`);
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('RaidRU 3 architecture validation: PASS');
