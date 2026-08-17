const fs=require('fs');
const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('styles.css','utf8');
const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
function ok(v,m){if(!v)throw new Error(m)}
ok(!app.includes('♥ Холи-прист'), 'Holy Priest header button still present');
ok(!app.includes('togglePriest'), 'legacy specialization toggle still present');
ok(!app.includes('priestMode=')&&!app.includes('priestMode?')&&!app.includes('togglePriest'), 'legacy specialization runtime state still present');
ok(!app.includes('Холи-прист:'), 'specialization-specific raid note still present');
ok(!app.includes("const priest=["), 'specialization spell appendix still present');
ok(app.includes('<h3>♥ Хилы</h3>'), 'generic healer guidance card missing');
ok(app.includes('Хилы: ${b.heal}'), 'generic healer raid note missing');
ok(!css.includes('.priest.on')&&!css.includes('.priestCard'), 'legacy specialization CSS remains');
ok(html.includes('app.js?v=2.2.0-wcl-hybrid-bridge'), 'app cache bust missing');
ok((sw.includes("raidru-v213-neutral-roles")||sw.includes("raidru-v214-wcl-fight-scope")||sw.includes("raidru-v215-wcl-full-event-replay")||sw.includes("raidru-v220-wcl-hybrid-bridge")), 'service worker cache not bumped');
console.log('neutral roles 2.1.3 regression checks: OK');
