/* RaidRU 2.1.2 — Plan Viewer comfort pass
 * Keeps the active timeline event visible after scene/render changes without
 * scrolling the document itself. The timeline has its own scroll container.
 */
(() => {
  function syncPlayerRail212(){
    const version=document.querySelector('aside .version');
    if(version)version.textContent='RaidRU 2.1.3 · Neutral Roles';
    if(typeof view!=='undefined'&&view!=='player')return;
    const rail=document.querySelector('.playerPage .eventRail');
    if(!rail)return;
    const active=rail.querySelector('button.on');
    if(!active)return;
    const top=active.offsetTop-(rail.clientHeight-active.offsetHeight)/2;
    rail.scrollTop=Math.max(0,top);
  }
  const oldRender212=window.render;
  if(typeof oldRender212==='function'){
    window.render=function(){
      const out=oldRender212.apply(this,arguments);
      requestAnimationFrame(syncPlayerRail212);
      return out;
    };
  }
  window.syncPlayerRail212=syncPlayerRail212;
  requestAnimationFrame(syncPlayerRail212);
})();
