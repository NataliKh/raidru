const CACHE='raidru-v054-real-maps';
const ASSETS=[
'./','./index.html','./styles.css?v=0.5.4','./app.js?v=0.5.4',
'./manifest.webmanifest','./icon.svg',
'./assets/maps/nekzali.webp','./assets/maps/sentinels.webp','./assets/maps/vashnik.webp',
'./assets/maps/explorers.webp','./assets/maps/sszorak.webp','./assets/maps/fangs.webp',
'./assets/maps/altar.webp','./assets/maps/ulatek.webp','./assets/maps/ulatek_p3.webp'
];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 e.respondWith(fetch(e.request).then(r=>{ const copy=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)); return r; }).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
});
