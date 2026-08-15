/* RaidRU v0.8.35 — RaidPlan import adapter
 * Isolated from app.js on purpose: RaidPlan developer integration is not documented yet,
 * so transport/schema changes should stay in this file.
 */
(function(){
  'use strict';

  const VERSION='0.8.35';
  const STEP_KEYS=['steps','scenes','pages','slides','frames'];
  const ITEM_KEYS=['objects','elements','items','components','drawings','entities','children','nodes'];
  const ROLE_WORDS={
    tank:['tank','танк'],healer:['healer','heal','хил','лекарь'],
    melee:['melee','мили','mdd'],ranged:['ranged','range','рдд','rdd']
  };
  const BOSS_ALIASES={
    nekzali:['nakzali','nekzali','nek\'zali','nek’zali','soulcoiler','заклинательница душ'],
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
  const finite=v=>(v==null||v==='')?null:(Number.isFinite(Number(v))?Number(v):null);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const text=v=>v==null?'':String(v);
  const safeJsonParse=s=>{try{return JSON.parse(s)}catch(_){return null}};
  const pick=(o,keys)=>{for(const k of keys){if(o&&o[k]!=null)return o[k]}return null};
  const deepPick=(o,paths)=>{for(const path of paths){let v=o;for(const k of path){v=v?.[k]}if(v!=null)return v}return null};
  const clean=s=>text(s).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  const preserveText=s=>text(s).replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]+>/g,'').replace(/\r\n/g,'\n').trim();
  const cdnAsset=asset=>asset?(/^https?:\/\//i.test(text(asset))?text(asset):`https://cdn.raidplan.io/${text(asset).replace(/^\/+/, '')}`):'';

  // RaidPlan/Fabric revisions have used several names for alpha.  Keep fill and
  // stroke alpha separate: applying only a global opacity turns translucent
  // arena overlays into solid white/black slabs.
  function alphaNumber(v){
    const n=finite(v);if(n==null)return null;
    // Some serializers store percentages (18 instead of .18).
    const x=n>1&&n<=100?n/100:n;return clamp(x,0,1);
  }
  function colorEmbeddedAlpha(v){
    const c=text(v).trim();if(!c)return null;
    let m=c.match(/^rgba\(\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*([0-9.]+)\s*\)$/i);
    if(m)return alphaNumber(m[1]);
    m=c.match(/^hsla\(\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*([0-9.]+)\s*\)$/i);
    if(m)return alphaNumber(m[1]);
    const h=c.match(/^#([0-9a-f]{4}|[0-9a-f]{8})$/i);
    if(h){const x=h[1],a=x.length===4?parseInt(x[3]+x[3],16):parseInt(x.slice(6,8),16);return a/255}
    return null;
  }
  function deepAlpha(o,kind='opacity'){
    const roots=[o?.attr,o?.style,o?.data,o?.meta,o];
    const keys=kind==='fill'
      ?['fillOpacity','fillAlpha','backgroundOpacity','backgroundAlpha']
      :kind==='stroke'
        ?['strokeOpacity','strokeAlpha','borderOpacity','borderAlpha']
        :['opacity','alpha','globalAlpha'];
    for(const root of roots)for(const k of keys){const n=alphaNumber(root?.[k]);if(n!=null)return n}
    if(kind==='fill')return colorEmbeddedAlpha(o?.attr?.fill??o?.style?.fill??o?.fill);
    if(kind==='stroke')return colorEmbeddedAlpha(o?.attr?.stroke??o?.style?.stroke??o?.stroke);
    return null;
  }
  function shapeAlpha(o){return{opacity:deepAlpha(o,'opacity'),fillOpacity:deepAlpha(o,'fill'),strokeOpacity:deepAlpha(o,'stroke')}}

  function flagTrue(v){
    if(v===true||v===1)return true;
    if(typeof v==='string')return /^(1|true|yes|on)$/i.test(v.trim());
    return false;
  }
  function flagFalse(v){
    if(v===false||v===0)return true;
    if(typeof v==='string')return /^(0|false|no|off)$/i.test(v.trim());
    return false;
  }
  // RaidPlan keeps hidden/editor helper nodes in the payload. The planner itself
  // does not paint them, so RaidRU must not turn them into encounter mechanics.
  function hiddenRaidPlanNode(o){
    // RaidRU 0.8.30 visibility filter:
    // opacity=0 and zero scale are non-painted Fabric/RaidPlan nodes.
    const globalOpacity=deepAlpha(o,'opacity');
    if(globalOpacity!==null&&globalOpacity<=0.0001)return true;
    const scalarScale=finite(deepPick(o,[['meta','scale'],['scale']]));
    const scaleX=finite(deepPick(o,[['meta','scale','x'],['scale','x'],['meta','scaleX'],['scaleX']]));
    const scaleY=finite(deepPick(o,[['meta','scale','y'],['scale','y'],['meta','scaleY'],['scaleY']]));
    if(scalarScale===0||scaleX===0||scaleY===0)return true;
    const roots=[o?.meta,o?.attr,o?.data,o];
    for(const r of roots){
      if(flagTrue(r?.hidden)||flagTrue(r?.isHidden)||flagTrue(r?.disabled))return true;
      if(r&&Object.prototype.hasOwnProperty.call(r,'visible')&&flagFalse(r.visible))return true;
      if(r&&Object.prototype.hasOwnProperty.call(r,'display')&&String(r.display).toLowerCase()==='none')return true;
    }
    const probe=[o?.type,o?.kind,o?.category,o?.meta?.type,o?.meta?.kind,o?.meta?.category,o?.attr?.type,o?.attr?.kind,o?.attr?.category,o?.attr?.name]
      .filter(v=>v!=null).join(' ').toLowerCase();
    return /(?:^|[\s_-])(clip(?:path)?|mask|viewport|hitbox|selection|helper|guide|interaction)(?:$|[\s_-])/.test(probe);
  }
  function transparentColor(v){
    const c=text(v).trim().toLowerCase();
    if(!c||c==='transparent'||c==='none')return true;
    if(/^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(c))return true;
    if(/^#(?:[0-9a-f]{6}00|[0-9a-f]{3}0)$/.test(c))return true;
    return false;
  }
  function visualValue(o,keys){
    const roots=[o?.attr,o?.style,o?.data,o?.meta,o];
    for(const r of roots)for(const k of keys){if(r&&r[k]!=null)return r[k]}
    return null;
  }
  function hasVisiblePaint(o){
    const fill=visualValue(o,['fill','backgroundColor','bgColor']);
    const stroke=visualValue(o,['stroke','borderColor','outlineColor']);
    const fa=deepAlpha(o,'fill'),sa=deepAlpha(o,'stroke'),oa=deepAlpha(o,'opacity');
    const fillVisible=fill!=null&&!transparentColor(fill)&&(fa==null||fa>0)&&(oa==null||oa>0);
    const strokeVisible=stroke!=null&&!transparentColor(stroke)&&(sa==null||sa>0)&&(oa==null||oa>0);
    return fillVisible||strokeVisible;
  }
  function strictV2ShapeType(nodeType,o){
    const nt=text(nodeType).toLowerCase();
    if(['circle','ellipse','rect','rectangle','square','polygon'].includes(nt))return 'zone';
    if(nt==='line')return /drawn|arrow/i.test(text(visualValue(o,['endType'])))?'arrow':'line';
    if(nt==='path')return 'line';
    if(['cone','wedge','sector'].includes(nt))return 'cone';
    return '';
  }
  function strictV2NodeAllowed(o){
    const nt=raidPlanNodeType(o),asset=text(visualValue(o,['asset','assetUrl'])||'');
    if(['arena','itext','marker','mob'].includes(nt))return true;
    if(['circle','ellipse','rect','rectangle','square','polygon'].includes(nt))return hasVisiblePaint(o)||!!objectLabel(o);
    if(nt==='line'||nt==='path')return hasVisiblePaint(o)||/drawn|arrow/i.test(text(visualValue(o,['endType'])));
    if(['cone','wedge','sector'].includes(nt))return hasVisiblePaint(o);
    if(['player','character','member','assignment','slot','role','class','job'].includes(nt))return true;
    if(['icon','ability','spell','status','effect','aura','sticker','encountericon','encounter_icon','encounter-icon','tooltip'].includes(nt))return !!asset;
    // Unknown v2 nodes are intentionally NOT rendered. RaidPlan keeps editor/helper
    // records in the same nodes array; permissive fallback is the main source of extras.
    return false;
  }
  function nearWhiteColor(v){
    const c=text(v).trim().toLowerCase();
    if(/^#fff(?:fff)?$/.test(c))return true;
    let m=c.match(/^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i);
    if(m){const h=m[1],r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);return r>=245&&g>=245&&b>=245}
    m=c.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i);
    return !!(m&&+m[1]>=245&&+m[2]>=245&&+m[3]>=245);
  }
  // Safety for editor/background geometry. A near-full-canvas, unlabeled white
  // shape with no explicit fill alpha is almost always a planner helper/mask.
  // Keep its stroke/geometry metadata, but do not flood the encounter map white.
  function suppressUnresolvedBackdropFill(o,geom,shapeLabel,alpha){
    if(shapeLabel||alpha?.fillOpacity!=null)return false;
    if(!nearWhiteColor(o?.attr?.fill??o?.style?.fill??o?.fill))return false;
    if((geom?.w||0)<58||(geom?.h||0)<58)return false;
    const semantic=typeString(o);
    if(/danger|damage|safe|soak|stack|aoe|mechanic/.test(semantic))return false;
    const stroke=o?.attr?.stroke??o?.style?.stroke??o?.stroke;
    return transparentColor(stroke)||!text(stroke).trim();
  }

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
    // Real RaidPlan v2 payload: {code, version, revision, steps:<number>, nodes:[...]}.
    if(Array.isArray(v.nodes)&&Number.isFinite(Number(v.steps)))s+=80;
    if(v.code&&v.version!=null&&v.revision!=null)s+=12;
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
  function isRaidPlanV2(plan){return !!(obj(plan)&&Array.isArray(plan.nodes)&&Number.isFinite(Number(plan.steps)))}
  function findSteps(plan){
    if(isRaidPlanV2(plan)){
      const nodes=plan.nodes.filter(obj),maxStep=Math.max(-1,...nodes.map(n=>finite(n?.meta?.step)).filter(v=>v!=null));
      const count=Math.max(0,Number(plan.steps)||0,maxStep+1);
      return Array.from({length:count},(_,i)=>({
        __raidplanV2:true,index:i,
        nodes:nodes.filter(n=>(finite(n?.meta?.step)??0)===i),
        code:plan.code||'',revision:plan.revision??null
      }));
    }
    for(const k of STEP_KEYS){const v=plan?.[k];if(Array.isArray(v))return v;if(obj(v))return Object.values(v)}
    if(Array.isArray(plan))return plan;
    if(ITEM_KEYS.some(k=>Array.isArray(plan?.[k])||obj(plan?.[k])))return [plan];
    return [];
  }
  function flattenItems(step){
    if(step?.__raidplanV2)return arr(step.nodes).filter(n=>text(n?.type).toLowerCase()!=='arena');
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
    const x=finite(deepPick(o,[['x'],['left'],['cx'],['position','x'],['pos','x'],['meta','pos','x'],['transform','x'],['point','x'],['coordinates','x'],['location','x']]));
    const y=finite(deepPick(o,[['y'],['top'],['cy'],['position','y'],['pos','y'],['meta','pos','y'],['transform','y'],['point','y'],['coordinates','y'],['location','y']]));
    return{x,y};
  }
  function nativeScale(o){
    // RaidPlan v2 keeps most Fabric visual transforms under attr, while older
    // revisions used meta/top-level fields. Read all known locations. Missing
    // attr.scaleX/scaleY was one reason vector objects lost their real geometry.
    const scalar=finite(deepPick(o,[['meta','scale'],['attr','scale'],['data','scale'],['scale']]));
    const sx=finite(deepPick(o,[['meta','scale','x'],['attr','scale','x'],['data','scale','x'],['scale','x'],['meta','scaleX'],['attr','scaleX'],['data','scaleX'],['scaleX']]))??scalar??1;
    const sy=finite(deepPick(o,[['meta','scale','y'],['attr','scale','y'],['data','scale','y'],['scale','y'],['meta','scaleY'],['attr','scaleY'],['data','scaleY'],['scaleY']]))??scalar??1;
    return{sx:Math.abs(sx)||1,sy:Math.abs(sy)||1};
  }
  function readWH(o){
    let w=finite(deepPick(o,[['w'],['width'],['size','width'],['size','w'],['meta','size','w'],['meta','size','width'],['dimensions','width'],['radius']]));
    let h=finite(deepPick(o,[['h'],['height'],['size','height'],['size','h'],['meta','size','h'],['meta','size','height'],['dimensions','height'],['radius']]));
    const {sx,sy}=nativeScale(o);
    if(w!=null)w*=sx;if(h!=null)h*=sy;
    return{w,h};
  }
  function readRotation(o){
    // RaidPlan v2 serializes Fabric angle on attr for lines/drawings. Earlier
    // imports only inspected top-level/meta values, so rotated arrow strokes
    // were rendered as horizontal segments. Prefer explicit degree-like angle
    // fields but keep the legacy radian compatibility for small values.
    let r=finite(deepPick(o,[
      ['attr','rotation'],['attr','rot'],['attr','angle'],
      ['data','rotation'],['data','rot'],['data','angle'],
      ['style','rotation'],['style','rot'],['style','angle'],
      ['transform','rotation'],['transform','rot'],['transform','angle'],
      ['rotation'],['rot'],['angle'],['meta','rotation'],['meta','rot'],['meta','angle'],['degrees'],['direction']
    ]))||0;
    if(Math.abs(r)<=Math.PI*2+.02&&Math.abs(r)>.001)r=r*180/Math.PI;
    return r;
  }
  function objectLabel(o){return clean(deepPick(o,[['text'],['label'],['name'],['title'],['displayName'],['value'],['caption'],['header'],['attr','text'],['attr','lname'],['attr','label'],['attr','name']])||'')}
  function typeString(o){
    return [pick(o,['type','kind','objectType','shape','category','elementType']),pick(o,['icon','role','class','job']),deepPick(o,[['attr','asset']]),deepPick(o,[['attr','markerStyle']]),objectLabel(o)]
      .filter(Boolean).join(' ').toLowerCase();
  }
  function roleType(o){
    const node=raidPlanNodeType(o),asset=text(o?.attr?.asset||pick(o,['asset','icon'])||'').toLowerCase();
    // В RaidPlan v2 роль определяется прежде всего asset-файлом. Текстовые блоки
    // нельзя классифицировать по словам "танк/РДД" внутри самой инструкции.
    if(node==='itext')return '';
    if(/role\/tank\.svg(?:$|\?)/.test(asset))return 'tank';
    if(/role\/healer\.svg(?:$|\?)/.test(asset))return 'healer';
    if(/role\/mdps\.svg(?:$|\?)/.test(asset))return 'melee';
    if(/role\/rdps\.svg(?:$|\?)/.test(asset))return 'ranged';
    const roleRaw=[pick(o,['role','job','class']),pick(o?.attr||{},['role','job','class'])].filter(Boolean).join(' ').toLowerCase();
    if(/\btank\b|танк/.test(roleRaw))return 'tank';
    if(/\bhealer\b|\bheal\b|хил|лекарь/.test(roleRaw))return 'healer';
    if(/\bmdps\b|\bmelee\b|мили/.test(roleRaw))return 'melee';
    if(/\brdps\b|\branged\b|\brange\b|рдд/.test(roleRaw))return 'ranged';
    return '';
  }
  function markerKey(o){
    const asset=text(o?.attr?.asset||pick(o,['asset','icon'])||'').toLowerCase();
    if(/game\/wow\/role\//.test(asset))return '';
    const assetPairs=[
      ['star','/raid/star.'],['circle','/raid/circle.'],['diamond','/raid/diamond.'],['triangle','/raid/triangle.'],
      ['moon','/raid/moon.'],['square','/raid/square.'],['cross','/raid/cross.'],['skull','/raid/skull.']
    ];
    for(const [k,needle] of assetPairs)if(asset.includes(needle))return k;
    const rawType=text(pick(o,['type','kind','objectType','category','icon'])).toLowerCase(),lab=objectLabel(o).toLowerCase();
    const explicit=/marker|raid.?mark|waymark|world.?mark/.test(rawType)||/[★⭐●◆♦▲☾■✕☠💀]/.test(lab);
    if(!explicit)return '';
    const s=[rawType,lab,text(o?.attr?.text),text(o?.attr?.lname)].join(' ').toLowerCase();
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
    if(step?.__raidplanV2){
      const arena=arr(step.nodes).find(n=>text(n?.type).toLowerCase()==='arena');
      // Prefer explicit canvas fields when present.  arena.meta.size is not always
      // the planner canvas: on custom/blank steps it may be the custom arena itself
      // (e.g. a 600x600 circle inside RaidPlan's standard 1200x675 board).
      const ew=finite(deepPick(arena,[['meta','canvas','w'],['meta','canvas','width'],['attr','canvasWidth'],['attr','canvas','width']]));
      const eh=finite(deepPick(arena,[['meta','canvas','h'],['meta','canvas','height'],['attr','canvasHeight'],['attr','canvas','height']]));
      if(ew&&eh)return{w:ew,h:eh};
      const aw=finite(arena?.meta?.size?.w),ah=finite(arena?.meta?.size?.h);
      if(aw&&ah){
        const ratio=aw/ah;
        // RaidPlan's board is 16:9.  Only treat arena size as canvas size when it
        // actually looks like a board; square/circular custom arenas are content.
        if(ratio>=1.45&&ratio<=2.05)return{w:aw,h:ah};
        return{w:1200,h:675};
      }
      return{w:1200,h:675};
    }
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
      const sx=100/size.w,sy=100/size.h;return{mode:'canvas',scaleX:sx,scaleY:sy,canvas:size,map:(x,y)=>({x:x*sx,y:y*sy}),sizeScale:v=>v*Math.min(sx,sy)};
    }
    const minX=Math.min(...xs,0),maxX=Math.max(...xs,1),minY=Math.min(...ys,0),maxY=Math.max(...ys,1);
    const rawW=Math.max(1,maxX-minX),rawH=Math.max(1,maxY-minY),tarW=tb.maxX-tb.minX,tarH=tb.maxY-tb.minY;
    const s=Math.min(tarW/rawW,tarH/rawH),rcx=(minX+maxX)/2,rcy=(minY+maxY)/2,tcx=(tb.minX+tb.maxX)/2,tcy=(tb.minY+tb.maxY)/2;
    return{mode:'fit',scaleX:s,scaleY:s,canvas:size,map:(x,y)=>({x:tcx+(x-rcx)*s,y:tcy+(y-rcy)*s}),sizeScale:v=>v*s};
  }
  function pointFor(o,tf,bossId,sceneName){
    const p=readXY(o);if(p.x==null||p.y==null)return null;let q=tf.map(p.x,p.y);
    // RaidPlan text/markers are deliberately allowed around the arena. Do not snap them
    // into RaidRU's playable mask: doing so destroys the original plan layout.
    q.x=clamp(q.x,0.5,99.5);q.y=clamp(q.y,0.5,99.5);
    return q;
  }
  function lineFromEndpoints(o,tf,bossId,sceneName){
    const a={x:finite(deepPick(o,[['x1'],['startX'],['fromX'],['attr','x1'],['attr','startX'],['attr','fromX']])),y:finite(deepPick(o,[['y1'],['startY'],['fromY'],['attr','y1'],['attr','startY'],['attr','fromY']]))};
    const b={x:finite(deepPick(o,[['x2'],['endX'],['toX'],['attr','x2'],['attr','endX'],['attr','toX']])),y:finite(deepPick(o,[['y2'],['endY'],['toY'],['attr','y2'],['attr','endY'],['attr','toY']]))};
    if([a.x,a.y,b.x,b.y].some(v=>v==null))return null;
    const p1=tf.map(a.x,a.y),p2=tf.map(b.x,b.y),cx=(p1.x+p2.x)/2,cy=(p1.y+p2.y)/2;
    const w=Math.hypot(p2.x-p1.x,p2.y-p1.y),rot=Math.atan2(p2.y-p1.y,p2.x-p1.x)*180/Math.PI;
    return{x:clamp(cx,2,98),y:clamp(cy,2,98),w:clamp(w,5,90),h:6,rot};
  }
  function pointsOf(o){
    const ps=pick(o,['points','vertices','path'])??o?.attr?.points;if(!Array.isArray(ps))return [];
    if(ps.length>=4&&ps.every(v=>finite(v)!=null)){
      const out=[];for(let i=0;i+1<ps.length;i+=2)out.push({x:Number(ps[i]),y:Number(ps[i+1])});return out;
    }
    return ps.map(p=>Array.isArray(p)?{x:finite(p[0]),y:finite(p[1])}:readXY(p)).filter(p=>p.x!=null&&p.y!=null);
  }
  function flatRaidPlanPathPoints(o){
    const raw=deepPick(o,[['attr','points'],['points'],['data','points'],['meta','points']]);
    if(!Array.isArray(raw)||raw.length<4||raw.length%2!==0)return null;
    const nums=raw.map(finite);if(nums.some(v=>v==null))return null;
    const out=[];for(let i=0;i<nums.length;i+=2)out.push([Number(nums[i]),Number(nums[i+1])]);
    return out;
  }
  function degenerateRaidPlanPath(o){
    const pts=flatRaidPlanPathPoints(o);if(!pts?.length)return false;
    const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
    return Math.max(...xs)-Math.min(...xs)<0.01&&Math.max(...ys)-Math.min(...ys)<0.01;
  }
  function raidPlanSvgPath(o){
    const flatPoints=flatRaidPlanPathPoints(o);
    const raw=deepPick(o,[['attr','path'],['path'],['data','path'],['meta','path'],['attr','d'],['d'],['data','d']]);

    let d='',cmds=[],coordPairs=[],pointUnitScale=1,boundsSource='path-commands';

    if(flatPoints?.length){
      // RaidPlan v2 freehand drawings are exported as attr.points.
      // The point coordinates live in a high-resolution brush coordinate space,
      // while meta.pos/meta.size/meta.scale describe the final Fabric object.
      // Preserve the raw point shape inside the SVG, then position/scale the
      // whole SVG using the Fabric meta box.
      d=`M ${flatPoints[0][0]} ${flatPoints[0][1]}`+
        flatPoints.slice(1).map(p=>` L ${p[0]} ${p[1]}`).join('');
      coordPairs=flatPoints.slice();
      boundsSource='raidplan-flat-points';

      const xs=coordPairs.map(p=>p[0]),ys=coordPairs.map(p=>p[1]);
      const rawW=Math.max(0,Math.max(...xs)-Math.min(...xs));
      const rawH=Math.max(0,Math.max(...ys)-Math.min(...ys));
      const baseW=finite(deepPick(o,[['meta','size','w'],['meta','size','width']]));
      const baseH=finite(deepPick(o,[['meta','size','h'],['meta','size','height']]));
      const ratios=[];
      if(baseW!=null&&baseW>0.0001&&rawW>0.0001)ratios.push(rawW/baseW);
      if(baseH!=null&&baseH>0.0001&&rawH>0.0001)ratios.push(rawH/baseH);
      if(ratios.length){
        ratios.sort((a,b)=>a-b);
        pointUnitScale=ratios.length===1?ratios[0]:(ratios[0]+ratios[ratios.length-1])/2;
        pointUnitScale=clamp(pointUnitScale,0.1,100);
      }
    }else{
      if(raw==null)return null;

      if(typeof raw==='string'){
        d=raw.trim();
      }else if(Array.isArray(raw)){
        const chunks=[];
        for(const cmd of raw){
          if(Array.isArray(cmd)&&cmd.length&&typeof cmd[0]==='string'){
            const op=String(cmd[0]).trim();
            if(!/^[a-z]$/i.test(op))continue;
            const nums=cmd.slice(1).map(Number).filter(Number.isFinite);
            cmds.push([op,...nums]);
            chunks.push([op,...nums].join(' '));
          }
        }
        d=chunks.join(' ');
      }

      if(!d||!/[a-z]/i.test(d))return null;

      if(cmds.length){
        let cx=0,cy=0,sx=0,sy=0;
        const push=(x,y)=>{if(Number.isFinite(x)&&Number.isFinite(y))coordPairs.push([x,y])};
        for(const cmd of cmds){
          const op=String(cmd[0]),u=op.toUpperCase(),rel=op!==u,a=cmd.slice(1);
          const absPair=(x,y)=>[rel?cx+x:x,rel?cy+y:y];
          if(u==='M'||u==='L'||u==='T'){
            for(let i=0;i+1<a.length;i+=2){const q=absPair(a[i],a[i+1]);cx=q[0];cy=q[1];if(u==='M'&&i===0){sx=cx;sy=cy}push(cx,cy)}
          }else if(u==='H'){
            for(const x of a){cx=rel?cx+x:x;push(cx,cy)}
          }else if(u==='V'){
            for(const y of a){cy=rel?cy+y:y;push(cx,cy)}
          }else if(u==='Q'||u==='S'){
            for(let i=0;i+3<a.length;i+=4){const c=absPair(a[i],a[i+1]),q=absPair(a[i+2],a[i+3]);push(c[0],c[1]);push(q[0],q[1]);cx=q[0];cy=q[1]}
          }else if(u==='C'){
            for(let i=0;i+5<a.length;i+=6){const c1=absPair(a[i],a[i+1]),c2=absPair(a[i+2],a[i+3]),q=absPair(a[i+4],a[i+5]);push(c1[0],c1[1]);push(c2[0],c2[1]);push(q[0],q[1]);cx=q[0];cy=q[1]}
          }else if(u==='A'){
            for(let i=0;i+6<a.length;i+=7){const q=absPair(a[i+5],a[i+6]);push(q[0],q[1]);cx=q[0];cy=q[1]}
          }else if(u==='Z'){
            cx=sx;cy=sy;push(cx,cy);
          }
        }
      }

      if(!coordPairs.length){
        const segments=[...d.matchAll(/([MLTQCSHVACZmltqcshvacz])([^MLTQCSHVACZmltqcshvacz]*)/g)];
        let cx=0,cy=0,sx=0,sy=0;
        const push=(x,y)=>{if(Number.isFinite(x)&&Number.isFinite(y))coordPairs.push([x,y])};
        for(const seg of segments){
          const op=seg[1],u=op.toUpperCase(),rel=op!==u;
          const a=(seg[2].match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/ig)||[]).map(Number);
          const absPair=(x,y)=>[rel?cx+x:x,rel?cy+y:y];
          if(u==='M'||u==='L'||u==='T'){
            for(let i=0;i+1<a.length;i+=2){const q=absPair(a[i],a[i+1]);cx=q[0];cy=q[1];if(u==='M'&&i===0){sx=cx;sy=cy}push(cx,cy)}
          }else if(u==='H'){
            for(const x of a){cx=rel?cx+x:x;push(cx,cy)}
          }else if(u==='V'){
            for(const y of a){cy=rel?cy+y:y;push(cx,cy)}
          }else if(u==='Q'||u==='S'){
            for(let i=0;i+3<a.length;i+=4){const c=absPair(a[i],a[i+1]),q=absPair(a[i+2],a[i+3]);push(c[0],c[1]);push(q[0],q[1]);cx=q[0];cy=q[1]}
          }else if(u==='C'){
            for(let i=0;i+5<a.length;i+=6){const c1=absPair(a[i],a[i+1]),c2=absPair(a[i+2],a[i+3]),q=absPair(a[i+4],a[i+5]);push(c1[0],c1[1]);push(c2[0],c2[1]);push(q[0],q[1]);cx=q[0];cy=q[1]}
          }else if(u==='A'){
            for(let i=0;i+6<a.length;i+=7){const q=absPair(a[i+5],a[i+6]);push(q[0],q[1]);cx=q[0];cy=q[1]}
          }else if(u==='Z'){cx=sx;cy=sy;push(cx,cy)}
        }
      }
    }

    if(!coordPairs.length)return null;

    const xs=coordPairs.map(p=>p[0]),ys=coordPairs.map(p=>p[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const vw=Math.max(.001,maxX-minX),vh=Math.max(.001,maxY-minY);
    if(vw<.01&&vh<.01)return null;

    const sourceStrokeWidth=finite(visualValue(o,['strokeWidth']))??3;
    const strokeWidth=sourceStrokeWidth*pointUnitScale;
    const sourceFill=text(visualValue(o,['fill'])||'');
    const sourceStroke=text(visualValue(o,['stroke'])||'');
    const brushStroke=sourceStroke&&!transparentColor(sourceStroke)
      ?sourceStroke
      :(sourceFill&&!transparentColor(sourceFill)?sourceFill:'#ffffff');

    return{
      d,
      viewBox:[minX,minY,vw,vh],
      fill:'none',
      stroke:brushStroke,
      sourceFill:sourceFill||null,
      strokeWidth,
      sourceStrokeWidth,
      pointUnitScale,
      lineCap:text(visualValue(o,['strokeLineCap','lineCap'])||'round'),
      lineJoin:text(visualValue(o,['strokeLineJoin','lineJoin'])||'round'),
      boundsSource
    };
  }
  function nearestEncounter(label,bossId){
    try{
      const q=clean(label).toLowerCase();if(!q)return null;
      const norm=x=>clean(x).toLowerCase().replace(/[’'`´._-]+/g,'').replace(/\s+/g,'');
      const nq=norm(q),items=typeof allEncounterIcons==='function'?allEncounterIcons():[];
      let best=null,score=0;
      for(const it of items){
        const hay=`${it.name||''} ${it.aliases||''}`.toLowerCase(),nh=norm(hay),nn=norm(it.name||'');
        let s=0;if(hay===q||nh===nq)s=100;else if(hay.includes(q)||q.includes((it.name||'').toLowerCase())||nh.includes(nq)||nq.includes(nn))s=60;
        for(const w of q.split(/\s+/).filter(x=>x.length>3))if(hay.includes(w)||nh.includes(norm(w)))s+=8;
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
  function raidPlanNodeType(o){return text(o?.type||o?.kind||o?.objectType).toLowerCase()}
  function fabricLineGeometry(o,tf){
    const size=tf?.canvas||null,p=readXY(o),nwh=nativeSize(o,tf),rot=readRotation(o);

    // RaidPlan v2/Fabric line nodes are object-local vectors: meta.pos is the
    // object position, meta.size is its box and attr.angle is the object
    // rotation. Treating local points/x1/x2 as absolute canvas coordinates
    // flattens diagonal hand-drawn arrows into horizontal fragments.
    if(o?.meta?.pos&&p.x!=null&&p.y!=null&&(nwh.w!=null||nwh.h!=null)){
      const q=tf.map(p.x,p.y);
      return{x:q.x,y:q.y,w:nwh.w??Math.max(.2,nwh.h||.2),h:nwh.h??5,rot};
    }

    const ps=pointsOf(o);
    if(ps.length>=2){
      const a=ps[0],b=ps[ps.length-1];
      const looksAbsolute=!size||(a.x>=-size.w*.15&&a.x<=size.w*1.15&&b.x>=-size.w*.15&&b.x<=size.w*1.15&&a.y>=-size.h*.15&&a.y<=size.h*1.15&&b.y>=-size.h*.15&&b.y<=size.h*1.15);
      if(looksAbsolute){
        const p1=tf.map(a.x,a.y),p2=tf.map(b.x,b.y),dx=b.x-a.x,dy=b.y-a.y;
        // CSS width is relative to arena WIDTH. For a 1200x675 RaidPlan canvas,
        // angle/length must therefore be calculated in source pixels, not between X/Y percentages.
        const widthPct=size?Math.hypot(dx,dy)*(100/size.w):Math.hypot(p2.x-p1.x,p2.y-p1.y);
        return{x:(p1.x+p2.x)/2,y:(p1.y+p2.y)/2,w:widthPct,h:5,rot:Math.atan2(dy,dx)*180/Math.PI+rot};
      }
    }
    return null;
  }
  function mobEncounter(o,bossId,label){
    const display=text(o?.attr?.displayId||'');
    if(bossId==='nekzali'&&display==='142077')return typeof encounterItemByKey==='function'?encounterItemByKey('nekzali','nekzali'):nearestEncounter(label,bossId);
    if(bossId==='nekzali'&&display==='143588')return typeof encounterItemByKey==='function'?encounterItemByKey('nekzali','echo'):null;
    if(bossId==='nekzali'&&display==='143999')return typeof encounterItemByKey==='function'?encounterItemByKey('nekzali','cultist'):null;
    return nearestEncounter(label,bossId);
  }

  function nativeSize(o,tf){
    // Fabric IText stores its actual wrapping box in attr.width/height. meta.size can
    // be a control/bounding size and was making text blocks much narrower than RaidPlan.
    const isText=raidPlanNodeType(o)==='itext';
    const wPaths=isText
      ?[['attr','width'],['attr','w'],['attr','size','width'],['attr','size','w'],['meta','size','w'],['meta','size','width'],['size','w'],['size','width'],['width'],['w']]
      :[['meta','size','w'],['meta','size','width'],['size','w'],['size','width'],['attr','width'],['attr','w'],['attr','size','width'],['attr','size','w'],['width'],['w']];
    const hPaths=isText
      ?[['attr','height'],['attr','h'],['attr','size','height'],['attr','size','h'],['meta','size','h'],['meta','size','height'],['size','h'],['size','height'],['height'],['h']]
      :[['meta','size','h'],['meta','size','height'],['size','h'],['size','height'],['attr','height'],['attr','h'],['attr','size','height'],['attr','size','h'],['height'],['h']];
    const w=finite(deepPick(o,wPaths)),h=finite(deepPick(o,hPaths));
    const {sx,sy}=nativeScale(o);
    return{w:w!=null?Math.max(.08,w*sx*(tf.scaleX||1)):null,h:h!=null?Math.max(.08,h*sy*(tf.scaleY||1)):null};
  }
  function raidPlanArena(step){return step?.__raidplanV2?arr(step.nodes).find(n=>raidPlanNodeType(n)==='arena')||null:null}
  function arenaShapeKind(arena){
    const probe=['shape','arenaShape','kind','variant','geometry','mask','clipShape'].map(k=>visualValue(arena,[k])).filter(Boolean).join(' ').toLowerCase();
    if(/circle|round/.test(probe))return 'circle';
    if(/ellipse|oval/.test(probe))return 'ellipse';
    if(/rect|square|box/.test(probe))return 'rect';
    return '';
  }
  function arenaHasCustomVisual(arena){
    const shape=arenaShapeKind(arena),fill=visualValue(arena,['fill','backgroundColor','bgColor','color']),stroke=visualValue(arena,['stroke','borderColor','outlineColor']);
    return !!(shape&&(text(fill).trim()||text(stroke).trim()));
  }
  function raidPlanBackground(step){
    const arena=raidPlanArena(step),a=arena?.attr||{};
    if(a.imageUrl)return cdnAsset(a.imageUrl);
    const raid=text(a.raid||'').replace('.midnight.','.');
    const boss=text(a.boss||''),map=text(a.map||'').trim(),mode=text(a.backgroundType||a.backgroundMode||a.mode||'').trim().toLowerCase();
    // A RaidPlan step may deliberately use a blank/custom arena.  Do not invent a
    // boss-map URL for it; scene 9 in the Mythic test plan uses exactly this layout.
    if(/^(?:none|blank|transparent|custom|empty|off)$/i.test(map)||/(?:^|[-_ ])(?:none|blank|custom|empty)(?:$|[-_ ])/.test(mode))return '';
    if(raid&&boss){const suffix=map&&map!=='default'?`-${map}`:'';return `https://cdn.raidplan.io/raid/${raid}/map/${boss}${suffix}.jpg`}
    return '';
  }
  function nativeMeta(o,tf,subtype,extra={}){
    const wh=nativeSize(o,tf),font=finite(o?.attr?.fontSize),cw=tf?.canvas?.w||1200,{sx,sy}=nativeScale(o);
    const opacity=deepAlpha(o,'opacity');
    const sourceOrder=finite(extra.sourceOrder)??0;
    const explicitZ=finite(o?.meta?.zIndex??o?.meta?.z??o?.zIndex??o?.z);
    let rawAttr={};try{rawAttr=JSON.parse(JSON.stringify(o?.attr||{}))}catch(_){}
    return{kind:'raidplan',native:true,subtype,source:'RaidPlan',sourceType:raidPlanNodeType(o),w:wh.w,h:wh.h,fontCqw:font!=null?font*(Math.abs(sy)||Math.abs(sx)||1)/cw*100:null,angle:readRotation(o),opacity:opacity!=null?clamp(opacity,0,1):null,z:explicitZ??sourceOrder,sourceOrder,rawAttr,...extra};
  }
  function richField(v){
    if(typeof v==='string'||typeof v==='number')return preserveText(v);
    if(Array.isArray(v))return v.map(richField).filter(Boolean).join('\n');
    if(obj(v)){for(const k of ['text','value','label','name','title','description','body','content','html','markdown','desc','tooltip']){const t=richField(v[k]);if(t)return t}}
    return '';
  }
  function deepNamedField(root,keys,maxDepth=5){
    const wanted=new Set(keys.map(x=>String(x).toLowerCase())),seen=new WeakSet();
    let best='';
    function walk(v,depth){
      if(depth>maxDepth||v==null)return;
      if(typeof v==='string'||typeof v==='number')return;
      if(Array.isArray(v)){for(const x of v)walk(x,depth+1);return}
      if(!obj(v)||seen.has(v))return;seen.add(v);
      for(const [k,x] of Object.entries(v)){
        if(wanted.has(String(k).toLowerCase())){
          const t=richField(x);
          if(t&&t.length>best.length)best=t;
        }
      }
      for(const x of Object.values(v))if(obj(x))walk(x,depth+1);
    }
    walk(root,0);return best;
  }
  function humanStrings(root,maxDepth=5){
    const out=[],seen=new WeakSet();
    function add(v,key=''){
      const t=preserveText(v);if(!t)return;
      if(/^https?:\/\//i.test(t)||/^#?[0-9a-f]{3,8}$/i.test(t)||/^(true|false|null|undefined)$/i.test(t))return;
      if(/(?:cdn\.|assets?\/|\.(?:png|jpe?g|webp|svg)(?:$|\?))/i.test(t))return;
      if(/^(RaidPlan|icon|object|ability|spell|tooltip)$/i.test(t))return;
      if(t.length<2)return;
      out.push({text:t,key:String(key).toLowerCase()});
    }
    function walk(v,depth,key=''){
      if(depth>maxDepth||v==null)return;
      if(typeof v==='string'||typeof v==='number'){add(v,key);return}
      if(Array.isArray(v)){for(const x of v)walk(x,depth+1,key);return}
      if(!obj(v)||seen.has(v))return;seen.add(v);
      for(const [k,x] of Object.entries(v)){
        if(['asset','asseturl','url','src','fill','stroke','color','id','uuid','key'].includes(k.toLowerCase()))continue;
        walk(x,depth+1,k);
      }
    }
    walk(root,0);return out;
  }
  function meaningfulCardText(v){const t=preserveText(v);return t&&!/^(RaidPlan|Способность|Ability|Spell)$/i.test(t)?t:''}
  function iconCardMeta(o,tf,label,sourceOrder){
    const a=o?.attr||{},wh=nativeSize(o,tf),asset=text(a.asset||a.assetUrl||deepPick(o,[['asset'],['assetUrl'],['data','asset'],['meta','asset']])||'');
    let cardTitle=meaningfulCardText(deepNamedField(o,['tooltipTitle','spellName','abilityName','lname','displayName','title','header','name','label']));
    let cardBody=meaningfulCardText(deepNamedField(o,['tooltipText','description','details','body','helpText','longText','content','html','markdown','desc','effectText','tooltipBody','tooltipDescription']));
    let cardMeta=meaningfulCardText(deepNamedField(o,['range','castTime','cooldown','subtext','metaText','durationText','cast','duration']));
    const strings=humanStrings(o);
    if(!cardTitle){const x=strings.find(x=>x.text.length<=90&&/(title|name|label|lname|spell|ability|header)/.test(x.key))||strings.find(x=>x.text.length<=70);if(x)cardTitle=x.text}
    if(!cardBody){const x=strings.filter(x=>x.text!==cardTitle).sort((x,y)=>y.text.length-x.text.length).find(x=>x.text.length>=45);if(x)cardBody=x.text}
    if(!cardMeta){const x=strings.find(x=>x.text!==cardTitle&&x.text!==cardBody&&x.text.length<=100&&/(range|cast|cooldown|duration|meta|subtext)/.test(x.key));if(x)cardMeta=x.text}
    cardTitle=meaningfulCardText(cardTitle);cardBody=meaningfulCardText(cardBody);cardMeta=meaningfulCardText(cardMeta);
    const type=raidPlanNodeType(o),probe=`${type} ${text(a.kind)} ${text(a.category)} ${text(o?.kind)} ${text(o?.category)} ${asset} ${Object.keys(o||{}).join(' ')}`.toLowerCase();
    const looksAbility=/spell|ability|status|effect|aura|tooltip|encounter.?icon|wow.?spell|wow.?ability/.test(probe);
    const large=(wh.w??0)>=11||(wh.h??0)>=11;
    const hasContent=!!(cardTitle||cardBody||cardMeta);
    // Never use the generic fallback label "RaidPlan" as evidence that a tooltip card has content.
    // If the source does not expose tooltip text, render a compact native icon instead of a huge empty panel.
    const renderAsCard=!!(large&&looksAbility&&hasContent);
    return{cardTitle,cardBody,cardMeta,renderAsCard,iconOnly:!!(large&&looksAbility&&!hasContent),sourceOrder};
  }
  function roleAssetMeta(o,tf,role,sourceOrder=0){
    const asset=text(o?.attr?.asset||'');return nativeMeta(o,tf,'role',{role,asset,assetUrl:cdnAsset(asset),sourceOrder});
  }
  function markerAssetMeta(o,tf,key,sourceOrder=0){
    const asset=text(o?.attr?.asset||'');return nativeMeta(o,tf,'marker',{markerKey:key,asset,assetUrl:cdnAsset(asset),sourceOrder});
  }
  function convertItem(o,ctx){
    const {tf,bossId,sceneName,report}=ctx,sourceOrder=Number.isFinite(+ctx.order)?+ctx.order:0,nodeType=raidPlanNodeType(o),s=typeString(o),label=objectLabel(o)||'RaidPlan',p=pointFor(o,tf,bossId,sceneName),strictV2=!!ctx.strictV2;
    if(nodeType==='arena')return null;
    if(nodeType==='path'&&degenerateRaidPlanPath(o)){report.hidden=(report.hidden||0)+1;report.degeneratePaths=(report.degeneratePaths||0)+1;return null}
    if(hiddenRaidPlanNode(o)){report.hidden=(report.hidden||0)+1;return null}
    if(strictV2&&!strictV2NodeAllowed(o)){report.skipped++;report.unsupported.push(`filtered:${nodeType||'unknown'}`);return null}
    if(!p){report.skipped++;return null}

    // 1) Text is text. Do this BEFORE any role/marker heuristics: instructions often
    // contain words like "танк" and "РДД" and must never become player markers.
    if(nodeType==='itext'){
      const raw=preserveText(o?.attr?.text||label),meta=nativeMeta(o,tf,'text',{
        text:raw,fill:text(o?.attr?.fill||'#ffffff'),backgroundColor:o?.attr?.backgroundColor||null,
        textAlign:text(o?.attr?.textAlign||'left'),verticalAlign:text(o?.attr?.verticalAlign||'top'),
        lineHeight:finite(o?.attr?.lineHeight),fontFamily:text(o?.attr?.fontFamily||''),fontWeight:o?.attr?.fontWeight??null,
        styles:Array.isArray(o?.attr?.styles)?o.attr.styles:[],sourceOrder
      });
      report.text++;report.tokens++;
      return{kind:'token',value:[`rp-${report.seq++}`,raw,'text',+p.x.toFixed(2),+p.y.toFixed(2),meta]};
    }

    // 2) RaidPlan v2 marker assets: role icons and raid markers are different things,
    // even though both use markerStyle="square".
    const asset=text(o?.attr?.asset||'');
    if(nodeType==='marker'&&/game\/wow\/role\//i.test(asset)){
      const role=roleType(o)||'ranged',rt=role,meta=roleAssetMeta(o,tf,role,sourceOrder);report.tokens++;
      return{kind:'token',value:[`rp-${report.seq++}`,({tank:'Танк',healer:'Хил',melee:'Мили',ranged:'РДД'}[role]||'Игрок'),rt,+p.x.toFixed(2),+p.y.toFixed(2),meta]};
    }
    const mkey=markerKey(o);
    if(nodeType==='marker'&&mkey){report.tokens++;return{kind:'token',value:[`rp-${report.seq++}`,markerLabel(mkey),'marker',+p.x.toFixed(2),+p.y.toFixed(2),markerAssetMeta(o,tf,mkey,sourceOrder)]}}

    // 3) Mob portraits are rendered from RaidPlan displayId with original size/ring.
    if(nodeType==='mob'){
      const display=text(o?.attr?.displayId||''),rawName=preserveText(o?.attr?.lname||label)||'Существо';
      const meta=nativeMeta(o,tf,'mob',{displayId:display,assetUrl:display?`https://cdn.raidplan.io/wow/portrait/${display}.png`:'',ringColor:text(o?.attr?.ringColor||'#d7180b'),ringSize:finite(o?.attr?.ringSize)??0,noDir:!!o?.attr?.noDir,noTip:!!o?.attr?.noTip,sourceOrder});
      const it=mobEncounter(o,bossId,rawName);if(it){meta.encounterKey=it.key;meta.category=it.category;}
      report.tokens++;return{kind:'token',value:[`rp-${report.seq++}`,rawName,it?.category==='boss'?'boss':'encounter',+p.x.toFixed(2),+p.y.toFixed(2),meta]};
    }

    const role=roleType(o),cmeta=classMeta(o,label,role);
    if(role||cmeta||(!strictV2&&/(player|character|member|assignment|slot|role|class|job)/.test(s))||strictV2&&['player','character','member','assignment','slot','role','class','job'].includes(nodeType)){
      const rt=tokenType(role,cmeta),roleLabel=label&&label!=='RaidPlan'?label:({tank:'TANK',healer:'HEAL',melee:'MELEE',ranged:'RANGED'}[rt]||'Игрок');report.tokens++;
      return{kind:'token',value:[`rp-${report.seq++}`,roleLabel,rt,+p.x.toFixed(2),+p.y.toFixed(2),cmeta||{kind:'raidplan',subtype:'player',source:'RaidPlan'}]};
    }

    // Generic legacy text/labels.
    if(!strictV2&&(/(^|\s)(text|label|note|annotation|caption)(\s|$)/.test(s)||(!pick(o,['type','kind','objectType','shape','category'])&&label))){
      const raw=preserveText(label);report.text++;report.tokens++;return{kind:'token',value:[`rp-${report.seq++}`,raw,'text',+p.x.toFixed(2),+p.y.toFixed(2),nativeMeta(o,tf,'text',{text:raw,sourceOrder})]};
    }

    let et='';
    if(strictV2)et=strictV2ShapeType(nodeType,o);
    else if(/cone|wedge|sector/.test(s))et='cone';
    else if(/arrow/.test(s)||nodeType==='line'&&/drawn|arrow/.test(text(o?.attr?.endType).toLowerCase()))et='arrow';
    else if(nodeType==='line'||nodeType==='path'||/tether|line|beam|link/.test(s))et='line';
    else if(/soak|stack|safe/.test(s))et='soak';
    else if(['circle','ellipse','rect','rectangle','square'].includes(nodeType)||/circle|ellipse|aoe|zone|area|ring|donut|rect|rectangle|square/.test(s))et='zone';
    const shapeKind=['rect','rectangle','square'].includes(nodeType)||(!strictV2&&/\b(rect|rectangle|square)\b/.test(s))?'rect':(nodeType==='ellipse'||(!strictV2&&/\bellipse\b/.test(s))?'ellipse':(nodeType==='circle'||(!strictV2&&/\bcircle\b/.test(s))?'circle':'zone'));

    const poly=(nodeType==='line'||nodeType==='path')?[]:pointsOf(o);
    if(poly.length>=3){
      const mapped=poly.map(x=>tf.map(x.x,x.y)),xs=mapped.map(x=>x.x),ys=mapped.map(x=>x.y);
      report.approximated++;report.effects++;
      const shapeLabel=preserveText(objectLabel(o)),alpha=shapeAlpha(o);
      const pg={w:clamp(Math.max(...xs)-Math.min(...xs),.5,99),h:clamp(Math.max(...ys)-Math.min(...ys),.5,99)};
      const suppressFill=suppressUnresolvedBackdropFill(o,pg,shapeLabel,alpha);if(suppressFill)report.suppressedBackdropFills=(report.suppressedBackdropFills||0)+1;
      return{kind:'effect',value:{id:`rpfx-${report.seq++}`,type:'zone',x:+((Math.min(...xs)+Math.max(...xs))/2).toFixed(2),y:+((Math.min(...ys)+Math.max(...ys))/2).toFixed(2),w:+pg.w.toFixed(2),h:+pg.h.toFixed(2),rot:readRotation(o),label:'',raidPlan:{native:true,hideLabel:true,shapeKind:'polygon',shapeLabel,fill:suppressFill?'transparent':(o?.attr?.fill||null),stroke:o?.attr?.stroke||null,strokeWidth:finite(o?.attr?.strokeWidth),opacity:alpha.opacity,fillOpacity:alpha.fillOpacity,strokeOpacity:alpha.strokeOpacity,suppressedBackdropFill:suppressFill,z:finite(o?.meta?.zIndex??o?.meta?.z??o?.zIndex??o?.z)??sourceOrder,sourceOrder}}};
    }
    if(et){
      let geom=(nodeType==='line')?fabricLineGeometry(o,tf):((et==='line'||et==='arrow')?lineFromEndpoints(o,tf,bossId,sceneName):null);
      const wh=readWH(o),nwh=nativeSize(o,tf);
      if(!geom)geom={x:p.x,y:p.y,w:nwh.w??(wh.w!=null?wh.w*(tf.scaleX||tf.sizeScale(1)):((et==='line'||et==='arrow')?35:22)),h:nwh.h??(wh.h!=null?wh.h*(tf.scaleY||tf.sizeScale(1)):((et==='line'||et==='arrow')?6:22)),rot:readRotation(o)};
      if(et==='zone'&&(nwh.w!=null||nwh.h!=null)){geom.w=nwh.w??nwh.h??12;geom.h=nwh.h??nwh.w??12}
      if(wh.w!=null&&wh.h==null&&/(radius)/.test(s)){geom.w=geom.h=tf.sizeScale(wh.w)*2}
      geom.w=clamp(Math.abs(geom.w)||12,.08,99);geom.h=clamp(Math.abs(geom.h)||.8,.08,99);report.effects++;
      const strokeWidth=finite(o?.attr?.strokeWidth),nativeLine=nodeType==='line';
      if(nativeLine&&strokeWidth!=null)geom.h=Math.max(.12,strokeWidth*(tf.scaleY||1));
      if(nodeType==='path'||/tether|group|pin|locked/.test(s))report.approximated++;
      const shapeLabel=et==='zone'?preserveText(objectLabel(o)):'';
      const font=finite(o?.attr?.fontSize),cw=tf?.canvas?.w||1200,alpha=shapeAlpha(o);
      const suppressFill=et==='zone'&&suppressUnresolvedBackdropFill(o,geom,shapeLabel,alpha);if(suppressFill)report.suppressedBackdropFills=(report.suppressedBackdropFills||0)+1;
      const svgPath=nodeType==='path'?raidPlanSvgPath(o):null;
      if(nodeType==='path'&&svgPath)report.nativePaths=(report.nativePaths||0)+1;
      return{kind:'effect',value:{id:`rpfx-${report.seq++}`,type:et,x:+clamp(geom.x,-10,110).toFixed(2),y:+clamp(geom.y,-10,110).toFixed(2),w:+geom.w.toFixed(2),h:+geom.h.toFixed(2),rot:+(geom.rot||0).toFixed(2),label:'',raidPlan:{native:true,hideLabel:true,nodeType,shapeKind:et==='zone'?shapeKind:null,shapeLabel,shapeFontCqw:font!=null?font/cw*100:null,labelFill:text(o?.attr?.textFill||o?.attr?.fontColor||o?.attr?.color||'#ffffff'),stroke:text(o?.attr?.stroke||'transparent'),fill:suppressFill?'transparent':(o?.attr?.fill||null),strokeWidth:strokeWidth??null,opacity:alpha.opacity,fillOpacity:alpha.fillOpacity,strokeOpacity:alpha.strokeOpacity,suppressedBackdropFill:suppressFill,svgPath,rx:finite(o?.attr?.rx??o?.attr?.radius),startType:text(o?.attr?.startType||'none'),endType:text(o?.attr?.endType||'none'),z:finite(o?.meta?.zIndex??o?.meta?.z??o?.zIndex??o?.z)??sourceOrder,sourceOrder}}};
    }

    if((strictV2&&['icon','ability','spell','status','effect','aura','sticker','encountericon','encounter_icon','encounter-icon','tooltip'].includes(nodeType))||(!strictV2&&/boss|enemy|npc|ability|spell|icon|sticker|encounter|object/.test(s))){
      const asset2=text(o?.attr?.asset||o?.attr?.assetUrl||'');
      if(asset2){
        const card=iconCardMeta(o,tf,label,sourceOrder),meta=nativeMeta(o,tf,'icon',{assetUrl:cdnAsset(asset2),objectFit:text(o?.attr?.objectFit||'contain'),lname:preserveText(o?.attr?.lname||''),rawLabel:preserveText(label),...card});
        if(card.iconOnly){const base=Math.max(2.4,Math.min(5.2,Math.min(meta.w||4,meta.h||4)));meta.w=base;meta.h=base;}
        report.tokens++;return{kind:'token',value:[`rp-${report.seq++}`,card.cardTitle||label,'text',+p.x.toFixed(2),+p.y.toFixed(2),meta]}
      }
      const it=nearestEncounter(label,bossId);
      if(it){report.tokens++;return{kind:'token',value:[`rp-${report.seq++}`,it.name,'encounter',+p.x.toFixed(2),+p.y.toFixed(2),{kind:'encounter',key:it.key,boss:it.boss||bossId,category:it.category,icon:it.icon,name:it.name,aliases:it.aliases||'',source:'raidplan'}]}}
    }

    report.unsupported.push(clean(pick(o,['type','kind','objectType','shape','category'])||'unknown'));report.skipped++;return null;
  }

  function noteFrom(v){
    const parts=[];
    for(const k of ['notes','note','description','header','footer','markdown']){const x=v?.[k];if(typeof x==='string'&&clean(x))parts.push(clean(x))}
    // Текстовые блоки на карте не являются заметкой шага. В RaidPlan v2
    // заметки хранятся отдельно в step_notes_raw.
    if(Array.isArray(v?.step_notes_raw))for(const x of v.step_notes_raw)if(preserveText(x))parts.push(preserveText(x));
    return [...new Set(parts)].join('\n');
  }
  function stepNote(plan,i){
    const raw=Array.isArray(plan?.step_notes_raw)?plan.step_notes_raw[i]:'';
    return preserveText(raw||'');
  }
  function stepName(step,i){
    const explicit=clean(pick(step,['name','title','label','header'])||'');if(explicit)return explicit;
    if(step?.__raidplanV2){
      const texts=arr(step.nodes).filter(n=>raidPlanNodeType(n)==='itext'&&clean(n?.attr?.text)).sort((a,b)=>(finite(a?.meta?.pos?.y)??9999)-(finite(b?.meta?.pos?.y)??9999));
      const heading=texts.map(n=>text(n.attr.text).split(/\r?\n/)[0].trim()).find(Boolean);
      if(heading)return heading.length>64?heading.slice(0,61)+'…':heading;
    }
    return `RaidPlan · сцена ${i+1}`;
  }

  function arenaVisualEffect(step,tf,report){
    const arena=raidPlanArena(step);if(!arena||hiddenRaidPlanNode(arena)||!arenaHasCustomVisual(arena))return null;
    // RaidRU 0.8.30 map-backed arena suppression:
    // RaidPlan uses the arena node as backing geometry/mask. If a real map is
    // available, do not turn that internal geometry into a visible RaidRU zone.
    const mapBackground=raidPlanBackground(step);
    if(mapBackground){report.suppressedArenaVisuals=(report.suppressedArenaVisuals||0)+1;return null;}
    const a=arena.attr||{},shape=arenaShapeKind(arena)||'rect',wh=nativeSize(arena,tf),alpha=shapeAlpha(arena);
    let w=wh.w,h=wh.h;
    const radius=finite(a.radius??a.r??arena?.radius);
    if(radius!=null){const {sx,sy}=nativeScale(arena);if(w==null)w=radius*2*sx*(tf.scaleX||1);if(h==null)h=radius*2*sy*(tf.scaleY||1)}
    if(w==null||h==null)return null;
    const raw=readXY(arena),q=raw.x!=null&&raw.y!=null?tf.map(raw.x,raw.y):{x:50,y:50};
    const fill=visualValue(arena,['fill','backgroundColor','bgColor','color'])??'transparent';
    const stroke=visualValue(arena,['stroke','borderColor','outlineColor'])??'transparent';
    const strokeWidth=finite(visualValue(arena,['strokeWidth','borderWidth','outlineWidth']));
    report.effects++;report.arenaVisuals=(report.arenaVisuals||0)+1;
    return{id:`rpfx-${report.seq++}`,type:'zone',x:+clamp(q.x,-10,110).toFixed(2),y:+clamp(q.y,-10,110).toFixed(2),w:+clamp(Math.abs(w),.08,99).toFixed(2),h:+clamp(Math.abs(h),.08,99).toFixed(2),rot:+readRotation(arena).toFixed(2),label:'',raidPlan:{native:true,hideLabel:true,arenaVisual:true,shapeKind:shape,shapeLabel:'',stroke:text(stroke),fill:fill,strokeWidth:strokeWidth??null,opacity:alpha.opacity,fillOpacity:alpha.fillOpacity,strokeOpacity:alpha.strokeOpacity,z:-100,sourceOrder:-100}};
  }

  function convert(raw,opts={}){
    const plan=findPlanRoot(raw),steps=findSteps(plan),bossId=opts.bossId||bossFromRaw(plan)||bossFromRaw(raw)||opts.currentBoss||'nekzali';
    const report={version:VERSION,bossId,steps:steps.length,tokens:0,effects:0,text:0,skipped:0,hidden:0,suppressedBackdropFills:0,suppressedArenaVisuals:0,nativePaths:0,arenaVisuals:0,approximated:0,unsupported:[],modes:{},seq:1};
    if(!steps.length)throw new Error('В данных RaidPlan не найден массив steps/scenes/pages.');
    const scenes=steps.map((step,i)=>{
      const name=stepName(step,i),items=flattenItems(step),tf=coordTransform(items,step,plan,bossId);report.modes[tf.mode]=(report.modes[tf.mode]||0)+1;
      const scene={name,note:stepNote(plan,i)||'',duration:8,map:{zoom:100,x:0,y:0,dark:0},tokens:[],effects:[],routes:{},raidPlan:{step:i+1,coordMode:tf.mode,background:raidPlanBackground(step),canvas:tf.canvas||canvasSize(step,plan),sourceCode:plan.code||'',revision:plan.revision??null}};
      const arenaFx=arenaVisualEffect(step,tf,report);if(arenaFx)scene.effects.push(arenaFx);
      for(let order=0;order<items.length;order++){const o=items[order],c=convertItem(o,{tf,bossId,sceneName:name,report,order,strictV2:!!step.__raidplanV2});if(!c)continue;if(c.kind==='token')scene.tokens.push(c.value);else scene.effects.push(c.value)}
      if(!scene.tokens.length&&!scene.effects.length){scene.tokens.push([`rp-${report.seq++}`,'Пустая сцена RaidPlan','text',50,50,{kind:'raidplan',subtype:'text',source:'RaidPlan'}]);report.tokens++}
      try{return typeof normalizeScene==='function'?normalizeScene(scene,bossId,i):scene}catch(_){return scene}
    });
    report.unsupported=[...new Set(report.unsupported.filter(Boolean))].slice(0,20);
    return{bossId,scenes,planName:clean(pick(plan,['name','title','planName'])||pick(raw,['name','title','planName'])||(plan.code?`RaidPlan ${plan.code}`:'RaidPlan import')),notes:noteFrom(plan),report,rawRoot:plan};
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
  function userdataUrl(input,revision=''){
    const c=planCode(input);if(!c)return '';
    const q=revision!==''&&revision!=null?`?v=${encodeURIComponent(revision)}`:'';
    return `https://userdata.raidplan.io/${c}.json${q}`;
  }
  async function fetchUrl(input){
    const code=planCode(input);if(!code)throw new Error('Нужна ссылка вида https://raidplan.io/plan/…');
    // GitHub Pages intentionally talks only to the RaidRU backend. RaidPlan's userdata
    // host does not expose browser CORS, so direct client-side probing just creates a
    // broken UX and leaks implementation details to the user.
    const endpoint=text(window.RAIDRU_RAIDPLAN_API||'https://raidru-raidplan.raidru-wcl.workers.dev/raidplan').trim();
    if(!endpoint)throw new Error('Попробуй ещё раз через несколько секунд.');
    const sep=endpoint.includes('?')?'&':'?';
    let r;
    try{
      r=await fetch(`${endpoint}${sep}code=${encodeURIComponent(code)}`,{
        method:'GET',credentials:'omit',cache:'no-store',headers:{Accept:'application/json'}
      });
    }catch(_){throw new Error('Не удалось загрузить план. Попробуй ещё раз.');}
    if(!r.ok){
      if(r.status===404)throw new Error('План RaidPlan не найден или ссылка недействительна.');
      if(r.status===403)throw new Error('Этот план недоступен для импорта по ссылке.');
      throw new Error('Не удалось загрузить план. Попробуй ещё раз.');
    }
    let v;try{v=await r.json()}catch(_){throw new Error('RaidPlan вернул повреждённые данные.');}
    if(!v)throw new Error('RaidPlan не вернул данные плана.');
    return v;
  }

  function parseInput(s){const v=safeJsonParse(text(s).trim());if(!v)throw new Error('Это не JSON RaidPlan.');return v}

  function reportText(r){
    const coord=Object.entries(r.modes).map(([k,v])=>`${k}: ${v}`).join(', ')||'—';
    return `${r.steps} сцен · ${r.tokens} объектов/игроков · ${r.effects} зон/линий · ${r.skipped} пропущено${r.approximated?` · ${r.approximated} приближённо`:''}. Координаты: ${coord}.`;
  }

  function applyConverted(result,mode='separate',options={}){
    const bossId=result.bossId;
    if(typeof bossState!=='function')throw new Error('RaidRU state недоступен.');
    const activeDiff=['normal','heroic','mythic'].includes(options.difficulty)?options.difficulty:(['normal','heroic','mythic'].includes(result.difficulty)?result.difficulty:(typeof diff!=='undefined'?diff:'heroic'));
    const bs=bossState(bossId,activeDiff),now=new Date().toISOString();
    if(typeof markDifficultyInitialized==='function')markDifficultyInitialized(bossId,activeDiff);
    state._raidPlanTabBackups=state._raidPlanTabBackups||{};
    const backupKey=typeof raidPlanBackupKey==='function'?raidPlanBackupKey(bossId,activeDiff):`${bossId}::${activeDiff}`;
    if(bs.raidPlanScenes?.length){state._raidPlanTabBackups[backupKey]={createdAt:now,difficulty:activeDiff,scenes:deep(bs.raidPlanScenes),timelineV3:deep(bs.raidPlanTimelineV3||[]),importMeta:deep(bs.raidPlanImport||{})}}
    const imported=result.scenes.map((scene,i)=>normalizeScene(deep({...scene,name:scene.name.replace(/^RaidPlan\s*·?\s*/i,'')}),bossId,i));
    bs.raidPlanScenes=imported;
    bs.raidPlanTimelineV3=typeof raidPlanTimelineForScenes==='function'?raidPlanTimelineForScenes(imported):imported.map((scene,i)=>({id:`rp-time-${i}`,time:i*35,label:scene.name,type:'move',scene:i,note:scene.note||''}));
    bs.raidPlanImport={at:now,name:result.planName,report:result.report,mode:'separate-tab',sourceCode:result.rawRoot?.code||'',revision:result.rawRoot?.revision??null,renderer:'native-v16-flat-path-points',difficulty:activeDiff,sceneStats:imported.map(sc=>({tokens:(sc.tokens||[]).length,effects:(sc.effects||[]).length}))};
    if(typeof setScenarioSourceFor==='function')setScenarioSourceFor(bossId,'raidplan',activeDiff);else{state._scenarioSourceByBoss=state._scenarioSourceByBoss||{};state._scenarioSourceByBoss[bossId]='raidplan'}
    if(mode!=='silent-refresh'){current=bossId;if(typeof diff!=='undefined')diff=activeDiff;sceneIndex=0;playerSceneIndex=0;view='planner'}
    if(typeof save==='function')save();
    if(typeof render==='function')render();
    return `${reportText(result.report)} Сохранено в RaidPlan · ${activeDiff}; сценарии RaidRU не изменены.`;
  }

  async function refreshCurrentIfLegacy(){
    try{
      if(typeof bossState!=='function'||typeof current==='undefined')return false;
      const activeDiff=typeof diff!=='undefined'?diff:'heroic';const bs=bossState(current,activeDiff);if(!bs?.raidPlanScenes?.length||bs?.raidPlanImport?.renderer==='native-v16-flat-path-points')return false;
      const name=text(bs?.raidPlanImport?.name||''),code=text(bs?.raidPlanImport?.sourceCode||'')||(name.match(/RaidPlan\s+([A-Za-z0-9_-]{8,64})/i)?.[1]||'');
      if(!code)return false;
      const guard=`raidru-rp-refresh-${current}-${activeDiff}-${code}-0835`;if(typeof sessionStorage!=='undefined'&&sessionStorage.getItem(guard))return false;
      if(typeof sessionStorage!=='undefined')sessionStorage.setItem(guard,'1');
      const raw=await fetchUrl(code),result=convert(raw,{bossId:current,currentBoss:current});applyConverted(result,'silent-refresh',{difficulty:activeDiff});return true;
    }catch(e){console.warn('RaidPlan legacy refresh skipped',e);return false}
  }

  window.RaidPlanImporter={VERSION,planCode,canonicalUrl,userdataUrl,findPlanRoot,findSteps,flattenItems,bossFromRaw,convert,fetchUrl,parseInput,applyConverted,reportText,refreshCurrentIfLegacy};
  // Rebuild an already imported RaidPlan tab when renderer semantics change.
  // This is silent and uses the same private RaidRU backend endpoint; no user action is needed.
  if(typeof setTimeout==='function')setTimeout(()=>{refreshCurrentIfLegacy().catch(()=>{})},80);
})();
