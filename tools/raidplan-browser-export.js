/* RaidRU RaidPlan Browser Export v0.3
 * Run on an opened RaidPlan plan page in DevTools > Sources > Snippets.
 * Purpose: export the plan data already available to the RaidPlan tab.
 *
 * Privacy:
 * - does NOT send plan data to RaidRU/OpenAI/third parties;
 * - may repeat GET requests to RaidPlan/API URLs that the current page already used;
 * - never reads document.cookie and never exports request headers/passwords;
 * - obvious auth/session fields are removed from the exported object.
 *
 * If no plan object can be found, the script downloads/copies a diagnostic JSON
 * containing sanitized resource URLs and storage/cache metadata so the adapter can
 * be updated without making the plan public.
 */
(async()=>{
  'use strict';

  const EXPORT_VERSION=3;
  const MAX_WALK=80000;
  const MAX_DEPTH=9;
  const MAX_IDB_RECORDS=750;
  const MAX_RESOURCE_FETCHES=100;
  const MAX_TEXT_SCAN=3_000_000;
  const pageCode=(location.pathname.match(/\/plan\/([^/?#]+)/i)||[])[1]||'plan';
  const now=new Date().toISOString();

  const isObj=v=>v&&typeof v==='object';
  const asArray=v=>Array.isArray(v)?v:(isObj(v)?Object.values(v):[]);
  const parse=s=>{try{return JSON.parse(s)}catch(_){return null}};
  const safeString=v=>{try{return String(v??'')}catch(_){return''}};
  const candidates=[];
  const diagnostics={
    format:'raidru-raidplan-diagnostic',version:EXPORT_VERSION,createdAt:now,
    page:{origin:location.origin,path:location.pathname,title:document.title},
    nextFlight:false,globals:[],storages:[],indexedDB:[],caches:[],resources:[],scripts:[],attempts:[],notes:[]
  };

  function score(v){
    if(!isObj(v))return -1;
    let s=0;
    const keys=Object.keys(v);
    for(const k of ['steps','scenes','pages','slides','frames']){
      const x=v[k]; if(Array.isArray(x)||isObj(x)) s+=55;
    }
    for(const k of ['objects','elements','items','layers','drawings','entities','components','nodes']){
      const x=v[k]; if(Array.isArray(x)||isObj(x)) s+=12;
    }
    if(Array.isArray(v.nodes)&&Number.isFinite(Number(v.steps)))s+=100;
    if(v.code&&v.version!=null&&v.revision!=null)s+=10;
    if(v.background||v.backgroundId||v.background_id)s+=7;
    if(v.notes||v.note||v.description)s+=4;
    if(v.name||v.title||v.planName)s+=3;
    if(v.id||v.planId||v.plan_id)s+=2;
    if(keys.some(k=>/assignment|slot/i.test(k)))s+=4;
    return s;
  }

  function add(v,source){
    if(!isObj(v))return;
    const sc=score(v);
    if(sc>0)candidates.push({v,source,score:sc});
  }

  function sanitizeUrl(raw){
    try{
      const u=new URL(raw,location.href);
      const safe=new URL(u.origin+u.pathname);
      for(const [k,v] of u.searchParams){
        if(/token|auth|secret|key|session|signature|sig|jwt|code|csrf/i.test(k))safe.searchParams.set(k,'[redacted]');
        else if(v.length>120)safe.searchParams.set(k,'[long-value]');
        else safe.searchParams.set(k,v);
      }
      return safe.toString();
    }catch(_){return safeString(raw).slice(0,500)}
  }

  function scrub(value,seen=new WeakMap(),depth=0){
    if(depth>40)return '[max-depth]';
    if(value==null||typeof value==='string'||typeof value==='number'||typeof value==='boolean')return value;
    if(typeof value==='bigint')return String(value);
    if(typeof value==='function'||typeof value==='symbol')return undefined;
    if(!isObj(value))return safeString(value);
    if(seen.has(value))return '[circular]';
    seen.set(value,true);
    if(Array.isArray(value))return value.slice(0,20000).map(v=>scrub(v,seen,depth+1));
    const out={};
    let count=0;
    for(const [k,v] of Object.entries(value)){
      if(++count>10000){out.__truncated__=true;break}
      if(/^(cookie|cookies|authorization|password|passwd|access_?token|refresh_?token|id_?token|session|sessionid|csrf|xsrf|secret|api_?key)$/i.test(k))continue;
      if(/token|authorization|password|secret/i.test(k)&&typeof v==='string'&&v.length>20)continue;
      const sv=scrub(v,seen,depth+1);if(sv!==undefined)out[k]=sv;
    }
    return out;
  }

  function innerCandidates(root,source){
    if(!isObj(root))return;
    const seen=new WeakSet();
    const q=[{v:root,d:0,path:source}];
    let walked=0;
    while(q.length&&walked<MAX_WALK){
      const {v,d,path}=q.shift();
      if(!isObj(v)||seen.has(v))continue;
      seen.add(v);walked++;
      const sc=score(v);if(sc>0)candidates.push({v,source:path,score:sc});
      if(d>=MAX_DEPTH)continue;
      let entries;
      try{entries=Object.entries(v)}catch(_){continue}
      for(const [k,x] of entries){
        if(!isObj(x))continue;
        if(/^(window|document|ownerDocument|parentNode|children|childNodes|firstChild|lastChild|nextSibling|previousSibling)$/i.test(k))continue;
        q.push({v:x,d:d+1,path:`${path}.${k}`});
      }
    }
  }

  function scanJsonText(text,source){
    if(typeof text!=='string'||!text)return;
    const tx=text.slice(0,MAX_TEXT_SCAN);
    const direct=parse(tx);if(direct){add(direct,source);innerCandidates(direct,source);return}
    if(!/steps|scenes|objects|elements|nodes|planId|plan_id|background/i.test(tx))return;
    // Next/React script payloads often contain escaped JSON strings.
    const stringMatches=tx.match(/"(?:\\.|[^"\\])*"/g)||[];
    let parsedStrings=0;
    for(const quoted of stringMatches){
      if(parsedStrings>250)break;
      if(!/steps|scenes|objects|elements|plan/i.test(quoted))continue;
      const unquoted=parse(quoted);if(typeof unquoted!=='string')continue;
      const v=parse(unquoted);if(v){parsedStrings++;add(v,`${source}:quoted-json`);innerCandidates(v,`${source}:quoted-json`)}
    }
    // Look around promising JSON object starts rather than brute-force every brace.
    const needles=['"steps"','"nodes"','"scenes"','"objects"','"elements"','"planId"','"plan_id"'];
    let attempts=0;
    for(const needle of needles){
      let at=tx.indexOf(needle);
      while(at>=0&&attempts<120){
        attempts++;
        let start=at;
        while(start>0&&at-start<180000&&tx[start]!=='{'&&tx[start]!=='[')start--;
        const maxEnd=Math.min(tx.length,at+900000);
        for(let end=maxEnd;end>at+needle.length&&attempts<160;end=Math.floor((end+at)/2)){
          const v=parse(tx.slice(start,end));
          if(v){add(v,`${source}:embedded`);innerCandidates(v,`${source}:embedded`);break}
        }
        at=tx.indexOf(needle,at+needle.length);
      }
    }
  }

  // 1) Known framework/global state, including modern Next.js Flight payload.
  const known=['__NEXT_DATA__','__NUXT__','__INITIAL_STATE__','__APOLLO_STATE__','__PRELOADED_STATE__','__REDUX_STATE__','__STATE__'];
  for(const k of known){try{if(window[k]!=null){diagnostics.globals.push(k);add(window[k],`window.${k}`);innerCandidates(window[k],`window.${k}`)}}catch(_){}}
  try{
    if(Array.isArray(window.__next_f)){
      diagnostics.nextFlight=true;diagnostics.globals.push('__next_f');
      innerCandidates(window.__next_f,'window.__next_f');
      for(const entry of window.__next_f){
        const s=Array.isArray(entry)?entry.find(x=>typeof x==='string'):null;
        if(s)scanJsonText(s,'window.__next_f');
      }
    }
  }catch(_){}

  // Scan likely user-land globals without touching cookies or browser internals deeply.
  let globalNames=[];try{globalNames=Object.getOwnPropertyNames(window)}catch(_){}
  for(const k of globalNames.filter(k=>/plan|planner|store|state|query|cache|redux|apollo|trpc|data/i.test(k)).slice(0,250)){
    if(/cookie/i.test(k))continue;
    try{
      const v=window[k];if(isObj(v)){diagnostics.globals.push(k);add(v,`window.${k}`);innerCandidates(v,`window.${k}`)}
    }catch(_){}
  }
  diagnostics.globals=[...new Set(diagnostics.globals)].slice(0,250);

  // 2) Script JSON / inline framework payloads.
  const scripts=[...document.scripts];
  for(let i=0;i<scripts.length;i++){
    const s=scripts[i];
    if(s.src)diagnostics.scripts.push(sanitizeUrl(s.src));
    const type=(s.type||'').toLowerCase();
    const tx=s.textContent||'';
    if(type.includes('json')||s.id==='__NEXT_DATA__'||/steps|nodes|scenes|objects|elements|__next_f|planId|plan_id/i.test(tx))scanJsonText(tx,`script:${s.id||i}`);
  }
  diagnostics.scripts=[...new Set(diagnostics.scripts)].slice(0,250);

  // 3) localStorage / sessionStorage.
  for(const [name,store] of [['localStorage',localStorage],['sessionStorage',sessionStorage]]){
    try{
      for(let i=0;i<store.length;i++){
        const k=store.key(i),raw=store.getItem(k);
        diagnostics.storages.push({store:name,key:k,size:raw?.length||0});
        const v=parse(raw);if(v){add(v,`${name}:${k}`);innerCandidates(v,`${name}:${k}`)}
      }
    }catch(e){diagnostics.notes.push(`${name}: ${e?.message||e}`)}
  }

  // 4) IndexedDB — common home of React Query/offline caches.
  try{
    const dbInfos=typeof indexedDB.databases==='function'?await indexedDB.databases():[];
    for(const info of dbInfos.slice(0,30)){
      if(!info?.name)continue;
      await new Promise(resolve=>{
        let req;try{req=indexedDB.open(info.name)}catch(_){resolve();return}
        req.onerror=()=>resolve();
        req.onsuccess=()=>{
          const db=req.result;const stores=[...db.objectStoreNames];
          diagnostics.indexedDB.push({name:info.name,version:db.version,stores});
          if(!stores.length){db.close();resolve();return}
          let pending=stores.length;
          const done=()=>{if(--pending<=0){db.close();resolve()}};
          for(const storeName of stores){
            try{
              const tr=db.transaction(storeName,'readonly'),os=tr.objectStore(storeName),cur=os.openCursor();let n=0;
              cur.onerror=done;
              cur.onsuccess=e=>{
                const c=e.target.result;if(!c||n++>=MAX_IDB_RECORDS){done();return}
                try{add(c.value,`indexedDB:${info.name}/${storeName}`);innerCandidates(c.value,`indexedDB:${info.name}/${storeName}`)}catch(_){}
                c.continue();
              };
            }catch(_){done()}
          }
        };
      });
    }
  }catch(e){diagnostics.notes.push(`indexedDB: ${e?.message||e}`)}

  // 5) CacheStorage responses, if RaidPlan/PWA cached API results.
  try{
    if('caches' in window){
      const names=await caches.keys();
      for(const name of names.slice(0,20)){
        const cache=await caches.open(name),reqs=await cache.keys();
        diagnostics.caches.push({name,count:reqs.length});
        for(const req of reqs.slice(0,150)){
          const u=req.url;if(!/plan|api|graphql|trpc|planner/i.test(u))continue;
          try{
            const res=await cache.match(req);if(!res)continue;const txt=await res.clone().text();scanJsonText(txt,`cache:${name}:${sanitizeUrl(u)}`);
          }catch(_){}
        }
      }
    }
  }catch(e){diagnostics.notes.push(`CacheStorage: ${e?.message||e}`)}

  // 6) React/Preact internals reachable from DOM nodes.
  try{
    const roots=[document.getElementById('root'),document.getElementById('__next'),document.getElementById('app'),document.querySelector('main'),document.body].filter(Boolean);
    for(const node of roots){
      for(const k of Object.getOwnPropertyNames(node)){
        if(!/^__react|^__preact|fiber|props/i.test(k))continue;
        try{const v=node[k];add(v,`DOM.${k}`);innerCandidates(v,`DOM.${k}`)}catch(_){}
      }
    }
  }catch(e){diagnostics.notes.push(`DOM state: ${e?.message||e}`)}

  // 7) Re-fetch GET resources already used by this page. Unlike v0.1, this is not
  // restricted to location.origin: RaidPlan may use api/cdn subdomains.
  let entries=[];
  try{entries=performance.getEntriesByType('resource')||[]}catch(_){}
  const interesting=entries.filter(e=>{
    const t=(e.initiatorType||'').toLowerCase();
    return t==='fetch'||t==='xmlhttprequest'||t==='other'||/api|graphql|trpc|plan|planner|document|load/i.test(e.name);
  });
  const resourceUrls=[...new Set(interesting.map(e=>e.name))];
  diagnostics.resources=resourceUrls.slice(0,300).map(u=>sanitizeUrl(u));

  let fetched=0;
  for(const u of resourceUrls){
    if(fetched++>=MAX_RESOURCE_FETCHES)break;
    let url;
    try{url=new URL(u,location.href)}catch(_){continue}
    if(!/^https?:$/.test(url.protocol))continue;
    // Avoid images/fonts/static bundles unless their name strongly suggests API data.
    if(/\.(png|jpe?g|webp|gif|svg|woff2?|ttf|otf|css|mp4|webm)(\?|$)/i.test(url.pathname))continue;
    if(/\.(js|mjs)(\?|$)/i.test(url.pathname)&&!/api|graphql|trpc|plan/i.test(url.pathname))continue;
    try{
      const r=await fetch(url.toString(),{method:'GET',credentials:'include',cache:'no-store',headers:{Accept:'application/json,text/plain,text/html;q=0.8,*/*;q=0.5'}});
      const ct=r.headers.get('content-type')||'';
      diagnostics.attempts.push({url:sanitizeUrl(url),status:r.status,type:ct.slice(0,100)});
      if(!r.ok)continue;
      const txt=await r.text();
      if(txt.length>12_000_000)continue;
      if(/json|text|javascript|html/i.test(ct)||/^[\s]*[\[{]/.test(txt))scanJsonText(txt,`resource:${sanitizeUrl(url)}`);
    }catch(e){diagnostics.attempts.push({url:sanitizeUrl(url),error:safeString(e?.message||e).slice(0,180)})}
  }
  diagnostics.attempts=diagnostics.attempts.slice(0,180);

  // Final nested pass and best candidate selection.
  const seed=[...candidates];
  for(const c of seed.slice(0,400))innerCandidates(c.v,c.source||'candidate');
  const best=candidates.sort((a,b)=>b.score-a.score)[0];

  function downloadJson(obj,filename){
    try{
      const json=JSON.stringify(obj,null,2),blob=new Blob([json],{type:'application/json'}),a=document.createElement('a');
      a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
      return json;
    }catch(_){return JSON.stringify(obj,null,2)}
  }
  async function copyJson(json){
    try{await navigator.clipboard.writeText(json);return true}catch(_){}
    try{if(typeof copy==='function'){copy(json);return true}}catch(_){}
    console.log(json);return false;
  }

  if(best&&best.score>=30){
    const payload={
      format:'raidru-raidplan-browser',version:EXPORT_VERSION,createdAt:now,
      source:{origin:location.origin,path:location.pathname,title:document.title,capture:best.source,score:best.score},
      plan:scrub(best.v)
    };
    const json=downloadJson(payload,`raidplan-${pageCode}-raidru.json`);
    const copied=await copyJson(json);
    console.log('RaidRU: найден план', {score:best.score,source:best.source,candidates:candidates.length,sizeKB:Math.round(json.length/1024)});
    alert(`RaidRU: данные плана найдены.\n\nФайл raidplan-${pageCode}-raidru.json скачан${copied?' и JSON скопирован в буфер':''}.\nЗагрузи этот файл сюда или импортируй его в RaidRU.`);
    return;
  }

  const userdataResource=resourceUrls.find(u=>{try{const x=new URL(u,location.href);return x.hostname==='userdata.raidplan.io'&&x.pathname.includes(`/${pageCode}.json`)}catch(_){return false}});
  if(userdataResource){
    const safe=sanitizeUrl(userdataResource);
    diagnostics.notes.push(`RaidPlan userdata endpoint detected: ${safe}`);
    try{window.open(userdataResource,'_blank','noopener,noreferrer')}catch(_){}
    try{await navigator.clipboard.writeText(userdataResource)}catch(_){}
    diagnostics.summary={candidateCount:candidates.length,bestScore:best?.score??-1,bestSource:best?.source||null,resourceCount:resourceUrls.length,userdataResource:safe};
    downloadJson(diagnostics,`raidplan-${pageCode}-diagnostic.json`);
    console.warn('RaidRU: CORS blocked reading the exact userdata response; opened it directly.',userdataResource);
    alert(`RaidRU: нашёл точный JSON-ресурс плана, но RaidPlan запрещает читать его из Snippet через CORS.

Я открыл JSON в новой вкладке и скопировал его URL. Сохрани страницу (Ctrl+S) как .json и импортируй файл в RaidRU.

План публиковать не нужно.`);
    return;
  }

  diagnostics.summary={candidateCount:candidates.length,bestScore:best?.score??-1,bestSource:best?.source||null,resourceCount:resourceUrls.length};
  const diagJson=downloadJson(diagnostics,`raidplan-${pageCode}-diagnostic.json`);
  const copied=await copyJson(diagJson);
  console.warn('RaidRU: объект плана пока не найден. Диагностика сохранена.',diagnostics.summary);
  alert(`RaidRU: сам объект плана пока не найден, но теперь это не тупик.\n\nСкачан raidplan-${pageCode}-diagnostic.json${copied?' (и скопирован в буфер)':''}.\nЗагрузи этот файл мне — по нему я увижу фактический источник данных RaidPlan и поправлю импортёр.`);
})();
