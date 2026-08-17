/* RaidRU 2.1.1 — Breadcrumbs & Context Navigation
 * Lightweight navigation layer: breadcrumbs, back/forward history and boss prev/next.
 * Does not persist large data or touch WCL/RaidPlan pipelines.
 */
(() => {
  const VIEW_LABELS={
    dashboard:'Обзор',guide:'Тактика',raidmode:'Рейд',player:'План просмотра',planner:'Планировщик',
    timeline:'Таймлайн',roster:'Состав',notes:'Заметки',glossary:'Словарь',workspace:'Мои планы',
    readiness:'Готовность',replay:'Warcraft Logs',assignments:'Назначения'
  };
  const WCL_LABELS={replay:'Replay',analysis:'Разбор',plan:'План'};
  let backStack=[],forwardStack=[],restoring=false;

  function activeWclTab211(){
    if(typeof view==='undefined'||view!=='replay')return '';
    const btn=document.querySelector('.wclFightShell208 nav button.on');
    const txt=(btn?.textContent||'').replace(/[▶✦▦]/g,'').trim().toLowerCase();
    if(txt.includes('разбор'))return 'analysis';if(txt.includes('план'))return 'plan';return 'replay';
  }
  function snap211(){return {boss:typeof current==='string'?current:'',view:typeof view==='string'?view:'dashboard',wcl:activeWclTab211()}}
  function key211(s){return `${s.boss}|${s.view}|${s.wcl||''}`}
  function remember211(){
    if(restoring)return;const s=snap211(),k=key211(s),last=backStack[backStack.length-1];
    if(!last||key211(last)!==k){backStack.push(s);if(backStack.length>40)backStack.shift()}
    forwardStack=[];
  }
  function sFromKey211(k){const [boss,v,wcl]=String(k||'').split('|');return {boss,view:v||'dashboard',wcl:wcl||''}}
  function restore211(s){
    if(!s)return;restoring=true;
    try{
      if(s.boss&&typeof current!=='undefined'&&current!==s.boss){current=s.boss;sceneIndex=0;if(typeof playerSceneIndex!=='undefined')playerSceneIndex=0}
      if(s.view&&typeof view!=='undefined')view=s.view;
      if(typeof stopPlayback==='function')stopPlayback();if(typeof stopReplay==='function')stopReplay();
      if(typeof render==='function')render();
      if(s.view==='replay'&&s.wcl&&typeof window.setWclTab208==='function')window.setWclTab208(s.wcl);
    }finally{restoring=false}
  }
  function navBack211(){if(!backStack.length)return;const now=snap211(),prev=backStack.pop();forwardStack.push(now);restore211(prev)}
  function navForward211(){if(!forwardStack.length)return;const now=snap211(),next=forwardStack.pop();backStack.push(now);restore211(next)}
  function navHome211(){if(typeof setView==='function')setView('dashboard')}
  function navBoss211(delta){
    const arr=typeof orderedRaid==='function'?orderedRaid():raid||[];const idx=arr.findIndex(x=>x.id===current);if(idx<0)return;
    const next=arr[idx+delta];if(next&&typeof chooseBoss==='function')chooseBoss(next.id)
  }
  function goCrumb211(kind){
    if(kind==='home'){navHome211();return}
    if(kind==='boss'){if(typeof setView==='function')setView('guide');return}
  }
  function bossNeighbors211(){if(typeof view!=='undefined'&&view==='dashboard')return {prev:null,next:null};const arr=typeof orderedRaid==='function'?orderedRaid():raid||[],idx=arr.findIndex(x=>x.id===current);return {prev:idx>0?arr[idx-1]:null,next:idx>=0&&idx<arr.length-1?arr[idx+1]:null}}
  function viewLabel211(){return VIEW_LABELS[typeof view==='string'?view:'']||'Раздел'}
  function breadcrumbItems211(){
    const b=(typeof raid!=='undefined'?raid:[]).find(x=>x.id===current),items=[{label:'Ядовитая бездна',kind:'home'}];
    if(view==='dashboard')return items;
    if(b)items.push({label:b.name,kind:'boss'});
    items.push({label:viewLabel211(),current:view!=='replay'});
    if(view==='replay')items.push({label:WCL_LABELS[activeWclTab211()]||'Replay',current:true});
    return items;
  }
  function decorateNavigation211(){
    const main=document.querySelector('main'),header=main?.querySelector(':scope > header');if(!main||!header)return;
    let bar=main.querySelector(':scope > .contextNav211');if(!bar){bar=document.createElement('div');bar.className='contextNav211';header.insertAdjacentElement('afterend',bar)}
    const crumbs=breadcrumbItems211(),n=bossNeighbors211();
    bar.innerHTML=`<div class="navHistory211"><button onclick="navBack211()" ${backStack.length?'':'disabled'} title="Назад">←</button><button onclick="navForward211()" ${forwardStack.length?'':'disabled'} title="Вперёд">→</button></div><nav class="breadcrumbs211" aria-label="Хлебные крошки">${crumbs.map((x,i)=>`${i?'<i>›</i>':''}${x.current?`<span aria-current="page">${esc(x.label)}</span>`:`<button onclick="goCrumb211('${x.kind}')">${esc(x.label)}</button>`}`).join('')}</nav><div class="bossPager211">${n.prev?`<button onclick="navBoss211(-1)" title="Предыдущий босс"><small>← Босс ${n.prev.order}</small><b>${esc(n.prev.name)}</b></button>`:''}${n.next?`<button onclick="navBoss211(1)" title="Следующий босс"><small>Босс ${n.next.order} →</small><b>${esc(n.next.name)}</b></button>`:''}</div>`;
    const version=document.querySelector('aside .version');if(version)version.textContent='RaidRU 2.1.1 · Navigation';
  }

  // Record only user-level navigation actions. Render itself stays cheap.
  const oldSetView=window.setView;if(typeof oldSetView==='function')window.setView=function(v){if(v!==view)remember211();const r=oldSetView.apply(this,arguments);return r};
  const oldChooseBoss=window.chooseBoss;if(typeof oldChooseBoss==='function')window.chooseBoss=function(id){if(id!==current)remember211();const r=oldChooseBoss.apply(this,arguments);return r};
  const oldWclTab=window.setWclTab208;if(typeof oldWclTab==='function')window.setWclTab208=function(v){if(v!==activeWclTab211())remember211();const r=oldWclTab.apply(this,arguments);decorateNavigation211();return r};
  const oldRender=render;render=function(){oldRender();decorateNavigation211()};

  document.addEventListener('keydown',e=>{
    if(e.altKey&&e.key==='ArrowLeft'){e.preventDefault();navBack211()}
    else if(e.altKey&&e.key==='ArrowRight'){e.preventDefault();navForward211()}
  });
  Object.assign(window,{navBack211,navForward211,navHome211,navBoss211,goCrumb211,decorateNavigation211});
  render();
})();
