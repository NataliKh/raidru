const fs=require('fs');
const css=fs.readFileSync('styles.css','utf8');
const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const js=fs.readFileSync('wcl-mechanics-209.js','utf8');
function ok(v,m){if(!v)throw new Error(m)}
ok(css.includes('RaidRU 2.0.11 — WCL Mechanics readability pass'),'readability block missing');
ok(css.includes('.wclMechanicsHero209 h3{margin:7px 0 8px;font-size:24px'),'hero heading is not enlarged');
ok(css.includes('.wclMechLane209{grid-template-columns:150px minmax(0,1fr);min-height:60px}'),'timeline lanes are not enlarged');
ok(css.includes('.wclMechCardHead209 span b{margin:6px 0 5px;font-size:15px'),'mechanic card title is not enlarged');
ok(css.includes('@media(max-width:1200px)')&&css.includes('.wclMechanicList209{grid-template-columns:1fr}'),'single-column readability breakpoint missing');
ok(html.includes('styles.css?v=2.2.1-wcl-bridge-final-audit'),'styles cache bust missing');
ok(html.includes('wcl-mechanics-209.js?v=2.1.0-performance'),'mechanics cache bust missing');
ok(/raidru-v(210-performance-core|211-navigation|213-neutral-roles|214-wcl-fight-scope|215-wcl-full-event-replay|216-wcl-replaysegment-core|218-wcl-graphql-resource-replay|221-wcl-bridge-final-audit)/.test(sw),'service worker cache bump missing');
ok(js.includes('MECHANICS ANALYSIS · 2.2.1'),'visible mechanics version not bumped');
console.log('WCL readability + performance 2.1.0 checks: OK');
