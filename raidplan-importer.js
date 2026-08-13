/* RaidRU v0.8.12 — RaidPlan import adapter
 * Isolated from app.js on purpose: RaidPlan developer integration is not documented yet,
 * so transport/schema changes should stay in this file.
 */
(function(){
  'use strict';

  const VERSION='0.8.12';
  const STEP_KEYS=['steps','scenes','pages','slides','frames'];
  const ITEM_KEYS=['objects','elements','items','components','drawings','entities','children'];
  const ROLE_WORDS={
    tank:['tank','танк'],healer:['healer','heal','хил','лекарь'],
    melee:['melee','мили','mdd'],ranged:['ranged','range','рдд','rdd']
  };
  const BOSS_ALIASES={
    nekzali:['nekzali','nek\'zali','nek’zali','soulcoiler','заклинательница душ'],
    sentinels:['entombed sentinels','sentinels','погребенные часовые','погребённые часовые'],
    vashnik:['vashnik','malignant','вашник'],
    explorers:['lost explorers','explorers','потерянные исследователи'],
    sszorak:['sszorak','сззорак'],
    fangs:['twin fangs','fangs','двойные клыки','pit of fangs'],
    altar:['coiled altar','altar','спиральный алтарь'],
    ulatek:['ulatek','ula\'tek','ula’tek','ула’тек','улатек']
  };

  const obj=v=>v&&typeof v==='object';
  const arr=v=>Array.isArray(v)?v:obj(v)?Object.values(v):[];
  const finite=v=>Number.isFinite(Number(v))?Number(v):null;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const text=v=>v==null?'':String(v);
  const safeJsonParse=s=>{try{return JSON.parse(s)}catch(_){return null}};
  const pick=(o,keys)=>{for(const k of keys){if(o&&o[k]!=null)return o[k]}return null};
  const deepPick=(o,paths)=>{for(const path of paths){let v=o;for(const k of path){v=v?.[k]}if(v!=null)return v}return null};
  const clean=s=>text(s).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();

  function planCode(input){
    const s=text(input).trim();
    const m=s.match(/(?:https?:\/\/)?(?:www\.)?raidplan\.io\/plan\/([^/?#]+)/i);
    if(m)return m[1];
    return /^[A-Za-z0-9_-]{8,64}$/.test(s)?s:'';
  }
  function canonicalUrl(input){const c=planCode(input);return c?`https://raidplan.io/plan/${c}`:''}

  function scoreCandidate(v){
    if(!obj(v))return -1;
    let s=0;
    for(const k of STEP_KEYS)if(Array.isArray(v[k])||obj(v[k]))s+=30;
    for(const k of ITEM_KEYS)if(Array.isArray(v[k])||obj(v[k]))s+=8;
    if(v.plan)s+=5;if(v.background)s+=3;if(v.notes||v.note)s+=2;
    return s;
  }
  function findPlanRoot(raw){
    const seeds=[raw,raw?.plan,raw?.data,raw?.data?.plan,raw?.payload,raw?.payload?.plan,raw?.result,raw?.result?.plan].filter(obj);
    let best=null,bestScore=-1,seen=new WeakSet(),queue=seeds.map(v=>({v,d:0})),walked=0;
    while(queue.length&&walked<2500){
      const {v,d}=queue.shift();if(!obj(v)||seen.has(v))continue;seen.add(v);walked++;
      const sc=scoreCandidate(v);if(sc>bestScore){best=v;bestScore=sc}
      if(d>=5)continue;
      for(const [k,x] of Object.entries(v)){
        if(k==='positions'||k==='events'||k==='timeline')continue;
        if(obj(x))queue.push({v:x,d:d+1});
      }
    }
    return best||raw;
  }
  function findSteps(plan){
    for(const k of STEP_KEYS){const v=plan?.[k];if(Array.isArray(v))return v;if(obj(v))return Object.values(v)}
    if(Array.isArray(plan))return plan;
    if(ITEM_KEYS.some(k=>Array.isArray(plan?.[k])||obj(plan?.[k])))return [plan];
    return [];
  }
  function flattenItems(step){
    const out=[],seen=new WeakSet();
    function visit(v,depth=0){
      if(!obj(v)||seen.has(v)||depth>7)return;seen.add(v);
      let foundChild=false;
      for(const k of ITEM_KEYS){
        const xs=v[k];if(Array.isArray(xs)||obj(xs)){foundChild=true;for(const x of arr(xs))visit(x,depth+1)}
      }
      const hasPos=readXY(v).x!=null&&readXY(v).y!=null;
      const hasType=pick(v,['type','kind','objectType','shape','category','icon','role','class','job'])!=null;
      const hasText=pick(v,['text','label','name','title','value'])!=null;
      if(v!==step&&(hasPos||hasType||hasText)&&(!foundChild||hasPos||hasType))out.push(v);
    }
    let hadRoot=false;
    for(const k of ITEM_KEYS){if(Array.isArray(step?.[k])||obj(step?.[k])){hadRoot=true;for(const x of arr(step[k]))visit(x,0)}}
    if(!hadRoot&&obj(step))for(const x of arr(step))visit(x,0);
    return out;
  }

  function readXY(o){
    const x=finite(deepPick(o,[['x'],['left'],['cx'],['position','x'],['pos','x'],['transform','x'],['point','x'],['coordinates','x'],['location','x']]));
    const y=finite(deepPick(o,[['y'],['top'],['cy'],['position','y'],['pos','y'],['transform','y'],['point','y'],['coordinates','y'],['location','y']]));
    return{x,y};
  }
  function readWH(o){
    return{
      w:finite(deepPick(o,[['w'],['width'],['size','width'],['dimensions','width'],['radius']])),
      h:finite(deepPick(o,[['h'],['height'],['size','height'],['dimensions','height'],['radius']]))
    };
  }
  function readRotation(o){
    let r=finite(pick(o,['rotation','rot','angle','degrees','direction']))||0;
    if(Math.abs(r)<=Math.PI*2+.02&&Math.abs(r)>.001)r=r*180/Math.PI;
    return r;
  }
  function objectLabel(o){return clean(pick(o,['text','label','name','title','displayName','value','caption','header'])||'')}
  function typeString(o){
    return [pick(o,['type','kind','objectType','shape','category','elementType']),pick(o,['icon','role','class','job']),objectLabel(o)]
      .filter(Boolean).join(' ').toLowerCase();
  }
  function roleType(o){
    const s=typeString(o);
    for(const [role,words] of Object.entries(ROLE_WORDS))if(words.some(w=>s.includes(w)))return role;
    return '';
  }
  function markerKey(o){
    const s=typeString(o),rawType=text(pick(o,['type','kind','objectType','category','icon'])).toLowerCase(),lab=objectLabel(o).toLowerCase();
    const explicit=/marker|raid.?mark|waymark|world.?mark/.test(rawType)||/[★⭐●◆♦▲☾■✕☠💀]/.test(lab);
    if(!explicit)return ''; // plain circle/square/polygon are geometry, not raid markers
    const pairs=[
      ['star',['star','звезд','⭐','★']],['circle',['circle','orange','круг','●']],['diamond',['diamond','purple','ромб','◆']],
      ['triangle',['triangle','green','треуг','▲']],['moon',['moon','луна','☾']],['square',['square','blue','квадрат','■']],
      ['cross',['cross','x marker','крест','✕']],['skull',['skull','череп','☠','💀']]
    ];
    for(const [k,ws] of pairs)if(ws.some(w=>s.includes(w)))return k;
    return '';
  }
  function markerLabel(k){return {star:'★',circle:'●',diamond:'◆',triangle:'▲',moon:'☾',square:'■',cross:'✕',skull:'☠'}[k]||'★'}
  function bossFromRaw(raw){
    let s='';try{s=JSON.stringify(raw).slice(0,80000).toLowerCase()}catch(_){s=text(raw).toLowerCase()}
    for(const [id,words] of Object.entries(BOSS_ALIASES))if(words.some(w=>s.includes(w.toLowerCase())))return id;
    return '';
  }

  function canvasSize(step,plan){
    const w=finite(deepPick(step,[['canvasWidth'],['width'],['canvas','width'],['background','width'],['background','naturalWidth']]))||
            finite(deepPick(plan,[['canvasWidth'],['width'],['canvas','width'],['background','width'],['background','naturalWidth']]));
    const h=finite(deepPick(step,[['canvasHeight'],['height'],['canvas','height'],['background','height'],['background','naturalHeight']]))||
            finite(deepPick(plan,[['canvasHeight'],['height'],['canvas','height'],['background','height'],['background','naturalHeight']]));
    return{w,h};
  }
  function targetBox(bossId){
    try{
      const zones=typeof arenaZonesFor==='function'?arenaZonesFor(bossId,'',true):null;
      const pts=(zones||[]).flat();
      if(pts.length){
        const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
        return{minX:Math.min(...xs)+3,maxX:Math.max(...xs)-3,minY:Math.min(...ys)+3,maxY:Math.max(...ys)-3};
      }
    }catch(_){}
    return{minX:8,maxX:92,minY:8,maxY:92};
  }
  function coordTransform(items,step,plan,bossId){
    const pts=items.map(readXY).filter(p=>p.x!=null&&p.y!=null);
    const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),size=canvasSize(step,plan),tb=targetBox(bossId);
    const maxAbs=Math.max(0,...xs.map(Math.abs),...ys.map(Math.abs));
    const allUnit=pts.length&&xs.every(x=>x>=-0.05&&x<=1.05)&&ys.every(y=>y>=-0.05&&y<=1.05);
    const allPct=pts.length&&xs.every(x=>x>=-2&&x<=102)&&ys.every(y=>y>=-2&&y<=102)&&maxAbs>1.1;
    if(allUnit)return {mode:'unit',scaleX:100,scaleY:100,map:(x,y)=>({x:x*100,y:y*100}),sizeScale:v=>v*100};
    if(allPct)return {mode:'percent',scaleX:1,scaleY:1,map:(x,y)=>({x,y}),sizeScale:v=>v};
    if(size.w&&size.h&&pts.length&&xs.every(x=>x>=-size.w*.1&&x<=size.w*1.1)&&ys.every(y=>y>=-size.h*.1&&y<=size.h*1.1)){
      const sx=100/size.w,sy=100/size.h;return{mode:'canvas',scaleX:sx,scaleY:sy,map:(x,y)=>({x:x*sx,y:y*sy}),sizeScale:v=>v*Math.min(sx,sy)};
    }
    const minX=Math.min(...xs,0),maxX=Math.max(...xs,1),minY=Math.min(...ys,0),maxY=Math.max(...ys,1);
    const rawW=Math.max(1,maxX-minX),rawH=Math.max(1,maxY-minY),tarW=tb.maxX-tb.minX,tarH=tb.maxY-tb.minY;
    const s=Math.min(tarW/rawW,tarH/rawH),rcx=(minX+maxX)/2,rcy=(minY+maxY)/2,tcx=(tb.minX+tb.maxX)/2,tcy=(tb.minY+tb.maxY)/2;
    return{mode:'fit',scaleX:s,scaleY:s,map:(x,y)=>({x:tcx+(x-rcx)*s,y:tcy+(y-rcy)*s}),sizeScale:v=>v*s};
  }
  function pointFor(o,tf,bossId,sceneName){
    const p=readXY(o);if(p.x==null||p.y==null)return null;let q=tf.map(p.x,p.y);q.x=clamp(q.x,2,98);q.y=clamp(q.y,2,98);
    try{if(typeof hardArenaPoint==='function')q=hardArenaPoint(bossId,q.x,q.y,sceneName,1.5,false)}catch(_){}
    return q;
  }
  function lineFromEndpoints(o,tf,bossId,sceneName){
    const a={x:finite(pick(o,['x1','startX','fromX'])),y:finite(pick(o,['y1','startY','fromY']))};
    const b={x:finite(pick(o,['x2','endX','toX'])),y:finite(pick(o,['y2','endY','toY']))};
    if([a.x,a.y,b.x,b.y].some(v=>v==null))return null;
    const p1=tf.map(a.x,a.y),p2=tf.map(b.x,b.y),cx=(p1.x+p2.x)/2,cy=(p1.y+p2.y)/2;
    const w=Math.hypot(p2.x-p1.x,p2.y-p1.y),rot=Math.atan2(p2.y-p1.y,p2.x-p1.x)*180/Math.PI;
    return{x:clamp(cx,2,98),y:clamp(cy,2,98),w:clamp(w,5,90),h:6,rot};
  }
  function pointsOf(o){
    const ps=pick(o,['points','vertices','path']);if(!Array.isArray(ps))return [];
    return ps.map(p=>Array.isArray(p)?{x:finite(p[0]),y:finite(p[1])}:readXY(p)).filter(p=>p.x!=null&&p.y!=null);
  }
  function nearestEncounter(label,bossId){
    try{
      const q=clean(label).toLowerCase();if(!q)return null;
      const items=typeof allEncounterIcons==='function'?allEncounterIcons():[];
      let best=null,score=0;
      for(const it of items){
        const hay=`${it.name||''} ${it.aliases||''}`.toLowerCase();
        let s=0;if(hay===q)s=100;else if(hay.includes(q)||q.includes((it.name||'').toLowerCase()))s=60;
        for(const w of q.split(/\s+/).filter(x=>x.length>3))if(hay.includes(w))s+=8;
        if(it.boss===bossId)s+=5;if(s>score){score=s;best=it}
      }
      return score>=18?best:null;
    }catch(_){return null}
  }
  function classMeta(o,label,role){
    let key='';try{key=typeof detectClassKey==='function'?detectClassKey([label,pick(o,['class','job','spec','iconName'])].filter(Boolean).join(' ')):''}catch(_){}
    if(!key)return null;
    const range=role==='melee'||role==='ranged'?role:(role==='tank'?'melee':(typeof defaultRangeForClass==='function'?defaultRangeForClass(key,role==='healer'?'healer':'dps'):'ranged'));
    return{kind:'class',classKey:key,role:role==='tank'?'tank':role==='healer'?'healer':'dps',range,source:'raidplan'};
  }
  function tokenType(role,meta){if(role)return role;if(meta?.role==='tank')return'tank';if(meta?.role==='healer')return'healer';return meta?.range||'ranged'}

  function convertItem(o,ctx){
    const {tf,bossId,sceneName,report}=ctx,s=typeString(o),label=objectLabel(o)||'RaidPlan',p=pointFor(o,tf,bossId,sceneName);
    if(!p){report.skipped++;return null}
    const mkey=markerKey(o);
    if(mkey){report.tokens++;return{kind:'token',value:[`rp-${report.seq++}`,markerLabel(mkey),'marker',+p.x.toFixed(2),+p.y.toFixed(2),{kind:'raidplan',subtype:'marker',source:'RaidPlan'}]}}

    const role=roleType(o),cmeta=classMeta(o,label,role);
    if(role||cmeta||/(player|character|member|assignment|slot|role|class|job)/.test(s)){
      const rt=tokenType(role,cmeta);report.tokens++;
      return{kind:'token',value:[`rp-${report.seq++}`,label||String(pick(o,['slot','number','index'])||'Игрок'),rt,+p.x.toFixed(2),+p.y.toFixed(2),cmeta||{kind:'raidplan',subtype:'player',source:'RaidPlan'}]};
    }

    const isText=/(^|\s)(text|label|note|annotation|caption)(\s|$)/.test(s)||(!pick(o,['type','kind','objectType','shape','category'])&&label);
    if(isText){report.text++;report.tokens++;return{kind:'token',value:[`rp-${report.seq++}`,label,'text',+p.x.toFixed(2),+p.y.toFixed(2),{kind:'raidplan',subtype:'text',source:'RaidPlan'}]}}

    let et='';
    if(/cone|wedge|sector/.test(s))et='cone';
    else if(/arrow/.test(s))et='arrow';
    else if(/tether|line|beam|link/.test(s))et='line';
    else if(/soak|stack|safe/.test(s))et='soak';
    else if(/circle|ellipse|aoe|zone|area|ring|donut|rect|rectangle|square/.test(s))et='zone';
    const poly=pointsOf(o);
    if(poly.length>=3){
      const mapped=poly.map(x=>tf.map(x.x,x.y)),xs=mapped.map(x=>x.x),ys=mapped.map(x=>x.y);
      report.approximated++;report.effects++;
      return{kind:'effect',value:{id:`rpfx-${report.seq++}`,type:'zone',x:+((Math.min(...xs)+Math.max(...xs))/2).toFixed(2),y:+((Math.min(...ys)+Math.max(...ys))/2).toFixed(2),w:+clamp(Math.max(...xs)-Math.min(...xs),6,90).toFixed(2),h:+clamp(Math.max(...ys)-Math.min(...ys),6,90).toFixed(2),rot:0,label:label||'Polygon (приближённо)'}};
    }
    if(et){
      let geom=(et==='line'||et==='arrow')?lineFromEndpoints(o,tf,bossId,sceneName):null;
      const wh=readWH(o);if(!geom)geom={x:p.x,y:p.y,w:wh.w!=null?tf.sizeScale(wh.w):((et==='line'||et==='arrow')?35:22),h:wh.h!=null?tf.sizeScale(wh.h):((et==='line'||et==='arrow')?6:22),rot:readRotation(o)};
      if(wh.w!=null&&wh.h==null&&/(radius)/.test(s)){geom.w=geom.h=tf.sizeScale(wh.w)*2}
      geom.w=clamp(Math.abs(geom.w)||12,5,90);geom.h=clamp(Math.abs(geom.h)||6,4,90);report.effects++;
      if(/tether|group|pin|locked/.test(s))report.approximated++;
      return{kind:'effect',value:{id:`rpfx-${report.seq++}`,type:et,x:+geom.x.toFixed(2),y:+geom.y.toFixed(2),w:+geom.w.toFixed(2),h:+geom.h.toFixed(2),rot:+(geom.rot||0).toFixed(2),label:label||({zone:'Зона',soak:'Soak',line:'Линия',arrow:'Стрелка',cone:'Конус'}[et])}};
    }

    if(/boss|enemy|npc|mob|ability|spell|icon|sticker|encounter|object/.test(s)){
      const it=nearestEncounter(label,bossId);
      if(it){report.tokens++;return{kind:'token',value:[`rp-${report.seq++}`,it.name,'encounter',+p.x.toFixed(2),+p.y.toFixed(2),{kind:'encounter',key:it.key,boss:it.boss||bossId,category:it.category,icon:it.icon,name:it.name,aliases:it.aliases||'',source:'raidplan'}]}}
      report.tokens++;return{kind:'token',value:[`rp-${report.seq++}`,label,'text',+p.x.toFixed(2),+p.y.toFixed(2),{kind:'raidplan',subtype:'icon',source:'RaidPlan'}]};
    }

    report.unsupported.push(clean(pick(o,['type','kind','objectType','shape','category'])||'unknown'));report.skipped++;return null;
  }

  function noteFrom(v){
    const parts=[];
    for(const k of ['notes','note','description','header','footer','markdown']){const x=v?.[k];if(typeof x==='string'&&clean(x))parts.push(clean(x))}
    return [...new Set(parts)].join('\n');
  }
  function stepName(step,i){return clean(pick(step,['name','title','label','header'])||'')||`RaidPlan · сцена ${i+1}`}

  function convert(raw,opts={}){
    const plan=findPlanRoot(raw),steps=findSteps(plan),bossId=opts.bossId||bossFromRaw(plan)||bossFromRaw(raw)||opts.currentBoss||'nekzali';
    const report={version:VERSION,bossId,steps:steps.length,tokens:0,effects:0,text:0,skipped:0,approximated:0,unsupported:[],modes:{},seq:1};
    if(!steps.length)throw new Error('В данных RaidPlan не найден массив steps/scenes/pages.');
    const scenes=steps.map((step,i)=>{
      const name=stepName(step,i),items=flattenItems(step),tf=coordTransform(items,step,plan,bossId);report.modes[tf.mode]=(report.modes[tf.mode]||0)+1;
      const scene={name,note:noteFrom(step)||noteFrom(plan)||'Импортировано из RaidPlan.',duration:8,map:{zoom:100,x:0,y:0,dark:4},tokens:[],effects:[],routes:{},raidPlan:{step:i+1,coordMode:tf.mode}};
      for(const o of items){const c=convertItem(o,{tf,bossId,sceneName:name,report});if(!c)continue;if(c.kind==='token')scene.tokens.push(c.value);else scene.effects.push(c.value)}
      if(!scene.tokens.length&&!scene.effects.length){scene.tokens.push([`rp-${report.seq++}`,'Пустая сцена RaidPlan','text',50,50,{kind:'raidplan',subtype:'text',source:'RaidPlan'}]);report.tokens++}
      try{return typeof normalizeScene==='function'?normalizeScene(scene,bossId,i):scene}catch(_){return scene}
    });
    report.unsupported=[...new Set(report.unsupported.filter(Boolean))].slice(0,20);
    return{bossId,scenes,planName:clean(pick(plan,['name','title','planName'])||pick(raw,['name','title','planName'])||'RaidPlan import'),notes:noteFrom(plan),report,rawRoot:plan};
  }

  function parseEmbeddedHtml(html){
    const found=[];
    try{
      const doc=new DOMParser().parseFromString(html,'text/html');
      for(const s of doc.querySelectorAll('script[type="application/json"],script#__NEXT_DATA__')){const v=safeJsonParse(s.textContent);if(v)found.push(v)}
      for(const s of doc.querySelectorAll('script')){
        const tx=s.textContent||'';if(!/steps|scenes|objects|elements/i.test(tx))continue;
        const starts=[...tx.matchAll(/[\[{]/g)].slice(0,40).map(m=>m.index);
        for(const st of starts){for(let en=tx.length;en>st+20;en=Math.floor((en+st)/2)){const v=safeJsonParse(tx.slice(st,en));if(v){found.push(v);break}}}
      }
    }catch(_){}
    if(!found.length)throw new Error('Страница открылась, но данные плана не обнаружены в HTML.');
    return found.sort((a,b)=>scoreCandidate(findPlanRoot(b))-scoreCandidate(findPlanRoot(a)))[0];
  }
  async function fetchUrl(input){
    const url=canonicalUrl(input);if(!url)throw new Error('Нужна ссылка вида https://raidplan.io/plan/…');
    let r;
    try{r=await fetch(url,{method:'GET',mode:'cors',credentials:'omit',headers:{Accept:'application/json,text/html;q=0.9,*/*;q=0.8'}})}catch(e){throw new Error('RaidPlan не разрешил браузеру RaidRU прочитать план напрямую (CORS). Используй резервный импорт JSON ниже.')}
    if(!r.ok)throw new Error(`RaidPlan ответил HTTP ${r.status}.`);
    const ct=r.headers.get('content-type')||'';const body=await r.text();
    if(/json/i.test(ct)){const v=safeJsonParse(body);if(v)return v}
    const direct=safeJsonParse(body);if(direct)return direct;
    return parseEmbeddedHtml(body);
  }

  function parseInput(s){const v=safeJsonParse(text(s).trim());if(!v)throw new Error('Это не JSON RaidPlan.');return v}

  function reportText(r){
    const coord=Object.entries(r.modes).map(([k,v])=>`${k}: ${v}`).join(', ')||'—';
    return `${r.steps} сцен · ${r.tokens} объектов/игроков · ${r.effects} зон/линий · ${r.skipped} пропущено${r.approximated?` · ${r.approximated} приближённо`:''}. Координаты: ${coord}.`;
  }

  function applyConverted(result,mode='append'){
    const bossId=result.bossId;
    if(typeof bossState!=='function')throw new Error('RaidRU state недоступен.');
    const bs=bossState(bossId),now=new Date().toISOString();
    state._raidPlanBackups=state._raidPlanBackups||{};
    state._raidPlanBackups[bossId]={createdAt:now,scenes:deep(bs.scenes||[]),timelineV3:deep(bs.timelineV3||[]),note:bs.note||''};
    const imported=result.scenes.map((s,i)=>normalizeScene(deep({...s,name:`RP ${i+1}. ${s.name.replace(/^RaidPlan\s*·?\s*/i,'')}`}),bossId,i));
    let start=0;
    if(mode==='replace'){bs.scenes=imported;start=0}else{start=(bs.scenes||[]).length;bs.scenes=[...(bs.scenes||[]),...imported]}
    bs.raidPlanImport={at:now,name:result.planName,report:result.report,mode};
    current=bossId;sceneIndex=start;playerSceneIndex=start;view='planner';
    if(typeof save==='function')save();
    if(typeof render==='function')render();
    return reportText(result.report);
  }

  window.RaidPlanImporter={VERSION,planCode,canonicalUrl,findPlanRoot,findSteps,flattenItems,bossFromRaw,convert,fetchUrl,parseInput,applyConverted,reportText};
})();
