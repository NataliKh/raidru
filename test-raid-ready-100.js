const fs=require('fs');
const js=fs.readFileSync('raid-ready-100.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const must=[
  'function readiness100()',
  "view==='raidmode'",
  'function personalNsrt100',
  'function workspaceSnapshot100',
  'function setSceneScript100',
  'function raidRunToggle100'
];
for(const x of must)if(!js.includes(x))throw new Error('missing '+x);
if(!html.includes('raid-ready-100.js?v=1.0.0'))throw new Error('1.0 script not connected');
if(!/(raidru-v10[01]-|raidru-v20[0-2]-)/.test(sw))throw new Error('service worker cache not bumped');
console.log('RaidRU 1.0 static checks: OK');
