const fs=require('fs');
const css=fs.readFileSync('styles.css','utf8');
const html=fs.readFileSync('index.html','utf8');
const js=fs.readFileSync('viewer-212.js','utf8');
const sw=fs.readFileSync('sw.js','utf8');
function ok(v,m){if(!v)throw new Error(m)}
ok(css.includes('.playerPage .playerLayout>div:first-child'), 'sticky player stage selector missing');
ok(css.includes('position:sticky;') && css.includes('height:min(760px,calc(100vh - 148px))'), 'independent timeline viewport missing');
ok(css.includes('overscroll-behavior:contain'), 'timeline overscroll containment missing');
ok(js.includes('rail.scrollTop='), 'active event rail sync missing');
ok(html.includes('viewer-212.js?v=2.1.7-wcl-replay-boss-resolver'), 'viewer script not loaded');
ok(html.includes('navigation-211.js?v=2.1.1-navigation'), 'navigation script missing from page');
ok((sw.includes("raidru-v213-neutral-roles")||sw.includes("raidru-v214-wcl-fight-scope")||sw.includes("raidru-v215-wcl-full-event-replay")||sw.includes("raidru-v217-wcl-replay-boss-resolver")), 'service worker cache version not bumped');
console.log('plan viewer 2.1.2 regression checks: OK');
