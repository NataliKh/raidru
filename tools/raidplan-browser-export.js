/* RaidRU RaidPlan Browser Export v0.1
 * Run on an opened public RaidPlan plan page in DevTools > Sources > Snippets.
 * The script only reads data already loaded in the current RaidPlan tab and copies
 * the best plan-like JSON candidate to the clipboard.
 */
(async()=>{
  const seen=new WeakSet(),candidates=[];
  const isObj=v=>v&&typeof v==='object';
  const score=v=>{if(!isObj(v))return-1;let s=0;for(const k of ['steps','scenes','pages','slides','frames'])if(Array.isArray(v[k])||isObj(v[k]))s+=40;for(const k of ['objects','elements','items','layers','drawings'])if(Array.isArray(v[k])||isObj(v[k]))s+=10;if(v.background)s+=4;if(v.notes||v.note)s+=3;return s};
  const add=(v,source)=>{if(!isObj(v))return;candidates.push({v,source,score:score(v)})};
  const parse=s=>{try{return JSON.parse(s)}catch(_){return null}};
  for(const k of ['__NEXT_DATA__','__NUXT__','__INITIAL_STATE__','__APOLLO_STATE__','__PRELOADED_STATE__'])try{add(window[k],`window.${k}`)}catch(_){}
  for(const el of document.querySelectorAll('script[type="application/json"],script#__NEXT_DATA__'))add(parse(el.textContent),`script#${el.id||'json'}`);
  for(const store of [localStorage,sessionStorage])for(let i=0;i<store.length;i++){const k=store.key(i),v=parse(store.getItem(k));if(v)add(v,`${store===localStorage?'local':'session'}Storage:${k}`)}

  // React/Preact state reachable from mounted DOM nodes.
  let walked=0;
  function walk(v,depth=0,path='root'){
    if(!isObj(v)||seen.has(v)||depth>7||walked>12000)return;seen.add(v);walked++;
    const sc=score(v);if(sc>0)candidates.push({v,source:path,score:sc});
    for(const [k,x] of Object.entries(v)){
      if(depth>4&&!/step|scene|plan|object|element|state|props|data/i.test(k))continue;
      if(isObj(x))walk(x,depth+1,`${path}.${k}`);
    }
  }
  for(const node of document.querySelectorAll('#root,#app,main,[data-reactroot],body')){
    for(const k of Object.keys(node))if(/^__react|^__preact|fiber|props/i.test(k))try{walk(node[k],0,`DOM.${k}`)}catch(_){}
  }

  // Same-origin resources already used by RaidPlan. GET only; no cookies are exported.
  const urls=[...new Set(performance.getEntriesByType('resource').map(x=>x.name).filter(u=>u.startsWith(location.origin)&&/api|plan|planner|editor|graphql/i.test(u)))].slice(0,40);
  for(const u of urls){
    try{const r=await fetch(u,{credentials:'same-origin'});const ct=r.headers.get('content-type')||'';if(!r.ok||!/json/i.test(ct))continue;add(await r.json(),`resource:${u}`)}catch(_){}
  }
  // Search nested candidates one more time for an inner plan root.
  const nested=[];const seen2=new WeakSet();
  function find(v,d=0){if(!isObj(v)||seen2.has(v)||d>5)return;seen2.add(v);const sc=score(v);if(sc>0)nested.push({v,score:sc});for(const x of Object.values(v))if(isObj(x))find(x,d+1)}
  for(const c of candidates)try{find(c.v)}catch(_){}
  const best=[...candidates,...nested].sort((a,b)=>b.score-a.score)[0];
  if(!best||best.score<20){console.error('RaidRU: данные плана не найдены. Открой именно страницу публичного плана и повтори.');alert('RaidRU: данные RaidPlan не найдены. Открой страницу плана и повтори запуск snippet.');return}
  const payload={format:'raidru-raidplan-browser',version:1,createdAt:new Date().toISOString(),sourceUrl:location.href,captureSource:best.source||'nested-state',plan:best.v};
  const json=JSON.stringify(payload,null,2);
  try{await navigator.clipboard.writeText(json);console.log(`RaidRU: JSON скопирован (${Math.round(json.length/1024)} KB). Источник:`,best.source||'nested');alert('RaidRU: JSON плана скопирован в буфер. Вернись в RaidRU → RaidPlan → вставь JSON.')}catch(_){console.log(json);alert('RaidRU: не удалось записать буфер. JSON выведен в Console.')}
})();
