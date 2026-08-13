/* RaidRU v0.8.21 — RaidPlan import adapter
 * Isolated from app.js on purpose: RaidPlan developer integration is not documented yet,
 * so transport/schema changes should stay in this file.
 */
(function(){
  'use strict';

  const VERSION='0.8.21';
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
    // RaidPlan has used both {scale:{x,y}} and scalar scale values across planner revisions.
    // Treat all variants as equivalent; ignoring scalar scale is what made small spell icons huge.
    const scalar=finite(deepPick(o,[['meta','scale'],['scale']]));
    const sx=finite(deepPick(o,[['meta','scale','x'],['scale','x'],['meta','scaleX'],['scaleX']]))??scalar??1;
    const sy=finite(deepPick(o,[['meta','scale','y'],['scale','y'],['meta','scaleY'],['scaleY']]))??scalar??1;
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
    let r=finite(deepPick(o,[['rotation'],['rot'],['angle'],['meta','angle'],['degrees'],['direction']]))||0;
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
      const aw=finite(arena?.meta?.size?.w),ah=finite(arena?.meta?.size?.h);
      if(aw&&ah)return{w:aw,h:ah};
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
    const a={x:finite(pick(o,['x1','startX','fromX'])),y:finite(pick(o,['y1','startY','fromY']))};
    const b={x:finite(pick(o,['x2','endX','toX'])),y:finite(pick(o,['y2','endY','toY']))};
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
    const ps=pointsOf(o),size=tf?.canvas||null;
    if(ps.length>=2){
      const a=ps[0],b=ps[ps.length-1];
      const looksAbsolute=!size||(a.x>=-size.w*.15&&a.x<=size.w*1.15&&b.x>=-size.w*.15&&b.x<=size.w*1.15&&a.y>=-size.h*.15&&a.y<=size.h*1.15&&b.y>=-size.h*.15&&b.y<=size.h*1.15);
      if(looksAbsolute){
        const p1=tf.map(a.x,a.y),p2=tf.map(b.x,b.y),dx=b.x-a.x,dy=b.y-a.y;
        // CSS width is relative to arena WIDTH. For a 1200x675 RaidPlan canvas,
        // angle/length must therefore be calculated in source pixels, not between X/Y percentages.
        const widthPct=size?Math.hypot(dx,dy)*(100/size.w):Math.hypot(p2.x-p1.x,p2.y-p1.y);
        return{x:(p1.x+p2.x)/2,y:(p1.y+p2.y)/2,w:widthPct,h:5,rot:Math.atan2(dy,dx)*180/Math.PI};
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
    const w=finite(deepPick(o,[['meta','size','w'],['meta','size','width'],['size','w'],['size','width'],['width'],['w']]));
    const h=finite(deepPick(o,[['meta','size','h'],['meta','size','height'],['size','h'],['size','height'],['height'],['h']]));
    const {sx,sy}=nativeScale(o);
    return{
      w:w!=null?Math.max(.08,w*sx*(tf.scaleX||1)):null,
      h:h!=null?Math.max(.08,h*sy*(tf.scaleY||1)):null
    };
  }
  function raidPlanArena(step){return step?.__raidplanV2?arr(step.nodes).find(n=>raidPlanNodeType(n)==='arena')||null:null}
  function raidPlanBackground(step){
    const arena=raidPlanArena(step),a=arena?.attr||{};
    if(a.imageUrl)return cdnAsset(a.imageUrl);
    const raid=text(a.raid||'').replace('.midnight.','.');
    const boss=text(a.boss||''),map=text(a.map||'');
    if(raid&&boss){const suffix=map&&map!=='default'?`-${map}`:'';return `https://cdn.raidplan.io/raid/${raid}/map/${boss}${suffix}.jpg`}
    return '';
  }
  function nativeMeta(o,tf,subtype,extra={}){
    const wh=nativeSize(o,tf),font=finite(o?.attr?.fontSize),cw=tf?.canvas?.w||1200;
    const opacity=finite(o?.attr?.opacity??o?.opacity??o?.meta?.opacity);
    const z=finite(o?.meta?.zIndex??o?.meta?.z??o?.zIndex??o?.z);
    return{kind:'raidplan',native:true,subtype,source:'RaidPlan',sourceType:raidPlanNodeType(o),w:wh.w,h:wh.h,fontCqw:font!=null?font/cw*100:null,angle:readRotation(o),opacity:opacity!=null?clamp(opacity,0,1):null,z,...extra};
  }
  function roleAssetMeta(o,tf,role){
    const asset=text(o?.attr?.asset||'');return nativeMeta(o,tf,'role',{role,asset,assetUrl:cdnAsset(asset)});
  }
  function markerAssetMeta(o,tf,key){
    const asset=text(o?.attr?.asset||'');return nativeMeta(o,tf,'marker',{markerKey:key,asset,assetUrl:cdnAsset(asset)});
  }
  function convertItem(o,ctx){
    const {tf,bossId,sceneName,report}=ctx,nodeType=raidPlanNodeType(o),s=typeString(o),label=objectLabel(o)||'RaidPlan',p=pointFor(o,tf,bossId,sceneName);
    if(nodeType==='arena')return null;
    if(!p){report.skipped++;return null}

    // 1) Text is text. Do this BEFORE any role/marker heuristics: instructions often
    // contain words like "танк" and "РДД" and must never become player markers.
    if(nodeType==='itext'){
      const raw=preserveText(o?.attr?.text||label),meta=nativeMeta(o,tf,'text',{
        text:raw,fill:text(o?.attr?.fill||'#ffffff'),backgroundColor:o?.attr?.backgroundColor||null,
        textAlign:text(o?.attr?.textAlign||'left'),verticalAlign:text(o?.attr?.verticalAlign||'top'),styles:Array.isArray(o?.attr?.styles)?o.attr.styles:[]
      });
      report.text++;report.tokens++;
      return{kind:'token',value:[`rp-${report.seq++}`,raw,'text',+p.x.toFixed(2),+p.y.toFixed(2),meta]};
    }

    // 2) RaidPlan v2 marker assets: role icons and raid markers are different things,
    // even though both use markerStyle="square".
    const asset=text(o?.attr?.asset||'');
    if(nodeType==='marker'&&/game\/wow\/role\//i.test(asset)){
      const role=roleType(o)||'ranged',rt=role,meta=roleAssetMeta(o,tf,role);report.tokens++;
      return{kind:'token',value:[`rp-${report.seq++}`,({tank:'Танк',healer:'Хил',melee:'Мили',ranged:'РДД'}[role]||'Игрок'),rt,+p.x.toFixed(2),+p.y.toFixed(2),meta]};
    }
    const mkey=markerKey(o);
    if(nodeType==='marker'&&mkey){report.tokens++;return{kind:'token',value:[`rp-${report.seq++}`,markerLabel(mkey),'marker',+p.x.toFixed(2),+p.y.toFixed(2),markerAssetMeta(o,tf,mkey)]}}

    // 3) Mob portraits are rendered from RaidPlan displayId with original size/ring.
    if(nodeType==='mob'){
      const display=text(o?.attr?.displayId||''),rawName=preserveText(o?.attr?.lname||label)||'Существо';
      const meta=nativeMeta(o,tf,'mob',{displayId:display,assetUrl:display?`https://cdn.raidplan.io/wow/portrait/${display}.png`:'',ringColor:text(o?.attr?.ringColor||'#d7180b'),ringSize:finite(o?.attr?.ringSize)??0,noDir:!!o?.attr?.noDir,noTip:!!o?.attr?.noTip});
      const it=mobEncounter(o,bossId,rawName);if(it){meta.encounterKey=it.key;meta.category=it.category;}
      report.tokens++;return{kind:'token',value:[`rp-${report.seq++}`,rawName,it?.category==='boss'?'boss':'encounter',+p.x.toFixed(2),+p.y.toFixed(2),meta]};
    }

    const role=roleType(o),cmeta=classMeta(o,label,role);
    if(role||cmeta||/(player|character|member|assignment|slot|role|class|job)/.test(s)){
      const rt=tokenType(role,cmeta),roleLabel=label&&label!=='RaidPlan'?label:({tank:'TANK',healer:'HEAL',melee:'MELEE',ranged:'RANGED'}[rt]||'Игрок');report.tokens++;
      return{kind:'token',value:[`rp-${report.seq++}`,roleLabel,rt,+p.x.toFixed(2),+p.y.toFixed(2),cmeta||{kind:'raidplan',subtype:'player',source:'RaidPlan'}]};
    }

    // Generic legacy text/labels.
    if(/(^|\s)(text|label|note|annotation|caption)(\s|$)/.test(s)||(!pick(o,['type','kind','objectType','shape','category'])&&label)){
      const raw=preserveText(label);report.text++;report.tokens++;return{kind:'token',value:[`rp-${report.seq++}`,raw,'text',+p.x.toFixed(2),+p.y.toFixed(2),nativeMeta(o,tf,'text',{text:raw})]};
    }

    let et='';
    if(/cone|wedge|sector/.test(s))et='cone';
    else if(/arrow/.test(s)||nodeType==='line'&&/drawn|arrow/.test(text(o?.attr?.endType).toLowerCase()))et='arrow';
    else if(nodeType==='line'||nodeType==='path'||/tether|line|beam|link/.test(s))et='line';
    else if(/soak|stack|safe/.test(s))et='soak';
    else if(['circle','ellipse','rect','rectangle','square'].includes(nodeType)||/circle|ellipse|aoe|zone|area|ring|donut|rect|rectangle|square/.test(s))et='zone';
    const shapeKind=['rect','rectangle','square'].includes(nodeType)||/\b(rect|rectangle|square)\b/.test(s)?'rect':(nodeType==='ellipse'||/\bellipse\b/.test(s)?'ellipse':(nodeType==='circle'||/\bcircle\b/.test(s)?'circle':'zone'));

    const poly=(nodeType==='line'||nodeType==='path')?[]:pointsOf(o);
    if(poly.length>=3){
      const mapped=poly.map(x=>tf.map(x.x,x.y)),xs=mapped.map(x=>x.x),ys=mapped.map(x=>x.y);
      report.approximated++;report.effects++;
      const shapeLabel=preserveText(objectLabel(o));
      return{kind:'effect',value:{id:`rpfx-${report.seq++}`,type:'zone',x:+((Math.min(...xs)+Math.max(...xs))/2).toFixed(2),y:+((Math.min(...ys)+Math.max(...ys))/2).toFixed(2),w:+clamp(Math.max(...xs)-Math.min(...xs),.5,99).toFixed(2),h:+clamp(Math.max(...ys)-Math.min(...ys),.5,99).toFixed(2),rot:readRotation(o),label:'',raidPlan:{native:true,hideLabel:true,shapeKind:'polygon',shapeLabel,fill:o?.attr?.fill||null,stroke:o?.attr?.stroke||null,strokeWidth:finite(o?.attr?.strokeWidth),opacity:finite(o?.attr?.opacity)}}};
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
      const font=finite(o?.attr?.fontSize),cw=tf?.canvas?.w||1200;
      return{kind:'effect',value:{id:`rpfx-${report.seq++}`,type:et,x:+clamp(geom.x,-10,110).toFixed(2),y:+clamp(geom.y,-10,110).toFixed(2),w:+geom.w.toFixed(2),h:+geom.h.toFixed(2),rot:+(geom.rot||0).toFixed(2),label:'',raidPlan:{native:true,hideLabel:true,nodeType,shapeKind:et==='zone'?shapeKind:null,shapeLabel,shapeFontCqw:font!=null?font/cw*100:null,labelFill:text(o?.attr?.textFill||o?.attr?.fontColor||o?.attr?.color||'#ffffff'),stroke:text(o?.attr?.stroke||'transparent'),fill:o?.attr?.fill||null,strokeWidth:strokeWidth??null,opacity:finite(o?.attr?.opacity),rx:finite(o?.attr?.rx??o?.attr?.radius),startType:text(o?.attr?.startType||'none'),endType:text(o?.attr?.endType||'none')}}};
    }

    if(/boss|enemy|npc|ability|spell|icon|sticker|encounter|object/.test(s)){
      const asset2=text(o?.attr?.asset||o?.attr?.assetUrl||'');
      if(asset2){report.tokens++;return{kind:'token',value:[`rp-${report.seq++}`,label,'text',+p.x.toFixed(2),+p.y.toFixed(2),nativeMeta(o,tf,'icon',{assetUrl:cdnAsset(asset2),objectFit:text(o?.attr?.objectFit||'contain'),lname:preserveText(o?.attr?.lname||''),rawLabel:preserveText(label)})]}}
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

  function convert(raw,opts={}){
    const plan=findPlanRoot(raw),steps=findSteps(plan),bossId=opts.bossId||bossFromRaw(plan)||bossFromRaw(raw)||opts.currentBoss||'nekzali';
    const report={version:VERSION,bossId,steps:steps.length,tokens:0,effects:0,text:0,skipped:0,approximated:0,unsupported:[],modes:{},seq:1};
    if(!steps.length)throw new Error('В данных RaidPlan не найден массив steps/scenes/pages.');
    const scenes=steps.map((step,i)=>{
      const name=stepName(step,i),items=flattenItems(step),tf=coordTransform(items,step,plan,bossId);report.modes[tf.mode]=(report.modes[tf.mode]||0)+1;
      const scene={name,note:stepNote(plan,i)||'',duration:8,map:{zoom:100,x:0,y:0,dark:0},tokens:[],effects:[],routes:{},raidPlan:{step:i+1,coordMode:tf.mode,background:raidPlanBackground(step),canvas:tf.canvas||canvasSize(step,plan),sourceCode:plan.code||'',revision:plan.revision??null}};
      for(const o of items){const c=convertItem(o,{tf,bossId,sceneName:name,report});if(!c)continue;if(c.kind==='token')scene.tokens.push(c.value);else scene.effects.push(c.value)}
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

  function applyConverted(result,mode='separate'){
    const bossId=result.bossId;
    if(typeof bossState!=='function')throw new Error('RaidRU state недоступен.');
    const activeDiff=typeof diff!=='undefined'?diff:'heroic';
    const bs=bossState(bossId,activeDiff),now=new Date().toISOString();
    if(typeof markDifficultyInitialized==='function')markDifficultyInitialized(bossId,activeDiff);
    // RaidRU-сцены намеренно не меняются. Backup и импорт привязаны к активной сложности.
    state._raidPlanTabBackups=state._raidPlanTabBackups||{};
    const backupKey=typeof raidPlanBackupKey==='function'?raidPlanBackupKey(bossId,activeDiff):`${bossId}::${activeDiff}`;
    if(bs.raidPlanScenes?.length){state._raidPlanTabBackups[backupKey]={createdAt:now,difficulty:activeDiff,scenes:deep(bs.raidPlanScenes),timelineV3:deep(bs.raidPlanTimelineV3||[]),importMeta:deep(bs.raidPlanImport||{})}}
    const imported=result.scenes.map((s,i)=>normalizeScene(deep({...s,name:s.name.replace(/^RaidPlan\s*·?\s*/i,'')}),bossId,i));
    bs.raidPlanScenes=imported;
    bs.raidPlanTimelineV3=typeof raidPlanTimelineForScenes==='function'?raidPlanTimelineForScenes(imported):imported.map((s,i)=>({id:`rp-time-${i}`,time:i*35,label:s.name,type:'move',scene:i,note:s.note||''}));
    bs.raidPlanImport={at:now,name:result.planName,report:result.report,mode:'separate-tab',sourceCode:result.rawRoot?.code||'',revision:result.rawRoot?.revision??null,renderer:'native-v3',difficulty:activeDiff};
    if(typeof setScenarioSourceFor==='function')setScenarioSourceFor(bossId,'raidplan',activeDiff);else{state._scenarioSourceByBoss=state._scenarioSourceByBoss||{};state._scenarioSourceByBoss[bossId]='raidplan';}
    if(mode!=='silent-refresh'){current=bossId;sceneIndex=0;playerSceneIndex=0;view='planner'}
    if(typeof save==='function')save();
    if(typeof render==='function')render();
    return `${reportText(result.report)} Сохранено в отдельной вкладке RaidPlan для текущей сложности; сценарии RaidRU не изменены.`;
  }

  async function refreshCurrentIfLegacy(){
    try{
      if(typeof bossState!=='function'||typeof current==='undefined')return false;
      const activeDiff=typeof diff!=='undefined'?diff:'heroic';const bs=bossState(current,activeDiff);if(!bs?.raidPlanScenes?.length||bs?.raidPlanImport?.renderer==='native-v3')return false;
      const name=text(bs?.raidPlanImport?.name||''),code=text(bs?.raidPlanImport?.sourceCode||'')||(name.match(/RaidPlan\s+([A-Za-z0-9_-]{8,64})/i)?.[1]||'');
      if(!code)return false;
      const guard=`raidru-rp-refresh-${current}-${activeDiff}-${code}-0821`;if(typeof sessionStorage!=='undefined'&&sessionStorage.getItem(guard))return false;
      if(typeof sessionStorage!=='undefined')sessionStorage.setItem(guard,'1');
      const raw=await fetchUrl(code),result=convert(raw,{bossId:current,currentBoss:current});applyConverted(result,'silent-refresh');return true;
    }catch(e){console.warn('RaidPlan legacy refresh skipped',e);return false}
  }

  window.RaidPlanImporter={VERSION,planCode,canonicalUrl,userdataUrl,findPlanRoot,findSteps,flattenItems,bossFromRaw,convert,fetchUrl,parseInput,applyConverted,reportText,refreshCurrentIfLegacy};
  // Rebuild an already imported RaidPlan tab when renderer semantics change.
  // This is silent and uses the same private RaidRU backend endpoint; no user action is needed.
  if(typeof setTimeout==='function')setTimeout(()=>{refreshCurrentIfLegacy().catch(()=>{})},80);
})();
