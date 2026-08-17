const CACHE='raidru-v218-wcl-graphql-resource-replay';
const CORE=[
'./',
'./index.html',
'./styles.css?v=2.1.8-wcl-graphql-resource-replay',
'./app.js?v=2.1.8-wcl-graphql-resource-replay',
'./raidplan-importer.js?v=1.0.0',
'./workspace-095.js?v=2.1.0-performance',
'./raid-ready-100.js?v=2.1.0-performance',
'./ui-101.js?v=2.1.8-wcl-graphql-resource-replay',
'./wcl-safe-200.js?v=2.1.8-wcl-graphql-resource-replay',
'./wcl-workspace-208.js?v=2.1.0-performance',
'./wcl-mechanics-209.js?v=2.1.0-performance',
'./navigation-211.js?v=2.1.1-navigation',
'./viewer-212.js?v=2.1.8-wcl-graphql-resource-replay',
'./manifest.webmanifest',
'./icon.svg'
];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);if(u.origin!==self.location.origin)return;
  const isStatic=/\.(?:png|webp|jpg|jpeg|gif|svg|woff2?)$/i.test(u.pathname)||u.pathname.includes('/assets/');
  if(isStatic){
    e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{if(r&&r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{})}return r})));
    return;
  }
  e.respondWith(fetch(e.request).then(r=>{if(r&&r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{})}return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
});
