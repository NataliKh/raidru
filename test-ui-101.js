const fs=require('fs');
const ui=fs.readFileSync('ui-101.js','utf8');
const css=fs.readFileSync('styles.css','utf8');
const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const checks=[
 ['ui script loaded',html.includes('ui-101.js?v=2.1.5-wcl-full-event-replay')],
 ['current cache',/raidru-v(207-wcl-coordinates|208-wcl-workspace|209-mechanics-analysis|210-performance-core|211-mechanics-readability|211-navigation|212-plan-viewer|213-neutral-roles|214-wcl-fight-scope|215-wcl-full-event-replay)/.test(sw)&&(/ui-101\.js\?v=2\.1\.(3-neutral-roles|4-wcl-fight-scope|5-wcl-full-event-replay)/.test(sw))&&/wcl-safe-200\.js\?v=(2\.0\.(7-wcl-coordinates|8-wcl-workspace|9-mechanics)|2\.1\.(0-performance|4-wcl-fight-scope|5-wcl-full-event-replay))/.test(sw)],
 ['five mechanic lanes',ui.includes("label:'Урон рейду'")&&ui.includes("label:'Перемещение'")&&ui.includes("label:'Механика танка'")&&ui.includes("label:'Адды'")&&ui.includes("label:'Назначения / КД'")],
 ['assignments lane',ui.includes('assignmentLane101')&&ui.includes('Назначения</span>')],
 ['compact mode',ui.includes('setTimelineCompact101')&&ui.includes('Сжатый вид')],
 ['event selection',ui.includes('selectTimelineEvent101')&&ui.includes('timelinePlayhead101')],
 ['header grouping',ui.includes('headerNav101')&&ui.includes('headerTools101')&&ui.includes('headerDropdown101')],
 ['styles',css.includes('.timelineBoard101')&&css.includes('.header101')],
 ['raidplan importer untouched',!ui.includes('raidPlanApplyRaw=')&&!ui.includes('raidPlanImport')]
];
let bad=0;
for(const [name,ok] of checks){console.log(`${ok?'OK':'FAIL'} ${name}`);if(!ok)bad++}
process.exitCode=bad?1:0;
