const fs=require('fs'),path=require('path'),root=__dirname;
const ui=fs.readFileSync(path.join(root,'wcl-mechanics-209.js'),'utf8');
const ws=fs.readFileSync(path.join(root,'wcl-workspace-208.js'),'utf8');
const worker=fs.readFileSync(path.join(root,'src/index.js'),'utf8');
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
function ok(v,m){if(!v)throw new Error(m)}
ok(worker.includes("url.pathname === '/wcl/mechanics'"),'mechanics endpoint missing');
ok(worker.includes('query RaidRUMechanics'),'mechanics GraphQL query missing');

ok(worker.includes('hostilityType: Enemies'),'enemy hostility must use GraphQL enum literal Enemies');
ok(worker.includes('hostilityType: Friendlies'),'friendly hostility must use GraphQL enum literal Friendlies');
ok(!/hostilityType:\s*[01](?:[,\s)])/.test(worker),'numeric hostilityType literals are invalid GraphQL enum values');
ok(worker.includes('dataType: Casts')&&worker.includes('dataType: Debuffs')&&worker.includes('dataType: Summons')&&worker.includes('dataType: Deaths'),'selective mechanics families missing');
ok(!/RaidRUMechanics[\s\S]{0,1600}includeResources:\s*true/.test(worker),'mechanics must not request coordinate resources');
ok(worker.includes("format: 'raidru-wcl-mechanics'"),'mechanics envelope missing');
ok(ui.includes('/wcl/mechanics?code='),'mechanics URL client missing');
ok(ui.includes('Механики + движение рейда'),'detailed timeline missing');
ok(ui.includes('Создать план из механик'),'mechanics-to-plan action missing');
ok(ui.includes('richBrowser209'),'browser JSON local reuse missing');
ok(ws.includes("window.wclMechanicsAnalysis209"),'analysis hook missing');
ok(css.includes('.wclMechTimeline209')&&css.includes('.wclMechanicCard209'),'mechanics styles missing');
ok(html.includes('wcl-mechanics-209.js?v=2.0.9-mechanics'),'mechanics script not loaded');
ok(sw.includes("raidru-v209-mechanics-analysis")&&sw.includes('wcl-mechanics-209.js?v=2.0.9-mechanics'),'SW cache not bumped');
console.log('WCL Mechanics Analysis 2.0.9 regression checks: OK');
