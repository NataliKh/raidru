/* RaidRU 2.0.8 — WCL Workspace UI
 * URL-first workflow. Replay JSON lives in diagnostics only.
 */
(() => {
  let wclTab208='replay',wclInfo208=false;
  const ui208=()=>typeof wclUiState200==='function'?wclUiState200():{};
  const d208=()=>replayState()?.data||null;
  const raw208=()=>window.__raidruExactReplay208||null;
  const count208=n=>(Number(n)||0).toLocaleString('ru-RU');
  const diff208=v=>({1:'Обычный',2:'Героический',3:'Эпохальный',4:'Эпохальный',normal:'Обычный',heroic:'Героический',mythic:'Эпохальный'}[v]||'');
  const quota208=q=>q&&q.limitPerHour?`${Math.round(q.pointsSpentThisHour||0)}/${Math.round(q.limitPerHour)} WCL pts`:'';

  function source208(d){
    const r=raw208(),src=r?.source||d?.source||{},fight=r?.fight||d?.fight||{},report=r?.report||d?.report||{};
    return {code:src.reportCode||report.code||'',fight:String(src.fight||fight.id||''),bossId:+(src.bossId||fight.bossId||0)||0,name:fight.name||bossName(current),duration:+(r?.time?.duration||fight.duration||d?.duration||0)||0,difficulty:fight.difficulty,kill:!!fight.kill,partial:!!(r?.partial||d?.partial),quality:r?.quality||d?.quality||src.quality||'fast',cache:r?.cache||'',mapId:replayPrimaryMapId(d)};
  }

  function badge208(d){
    const s=source208(d),raw=raw208();
    if(raw?.format==='raidru-wcl-replay-browser'&&raw?.version===2&&!s.partial&&s.quality==='full')return {cls:'exact',label:'✓ WCL Exact Replay'};
    if(raw?.format==='raidru-wcl-replay-browser'&&raw?.version===2&&!s.partial)return {cls:'ready',label:'✓ WCL Replay v2'};
    if(s.partial)return {cls:'partial',label:'◐ Replay доступен частично'};
    return {cls:'ready',label:'✓ WCL Replay'};
  }

  function canonical208(d){
    const s=source208(d),positions=(d?.positions||[]).map(p=>({...p})),timeline=(d?.events||[]).map(e=>({t:+e.t||0,type:e.type||'cast',sourceID:e.sourceID??null,targetID:e.targetID??null,sourceIsFriendly:false,targetIsFriendly:null,abilityID:e.abilityID??null,abilityName:e.label||e.abilityName||''}));
    const mapIDs=d?.mapIDs||{},by={};for(const p of positions){const k=String(p.actorId);(by[k]||(by[k]=[])).push(p)}
    return {format:'raidru-wcl-replay-browser',version:2,createdAt:new Date().toISOString(),source:{pageUrl:s.code?`https://www.warcraftlogs.com/reports/${s.code}?fight=${s.fight}&view=replay`:'',reportCode:s.code,fight:s.fight,bossId:s.bossId,capture:'raidru-ui-export',partial:s.partial,quality:s.quality},time:{absoluteStart:+d?.fight?.startTime||0,absoluteEnd:+d?.fight?.endTime||s.duration,duration:s.duration},coordinateSemantics:d?.coordinateSemantics||{resourceActor1:'sourceID',resourceActor2:'targetID',nextXY:'same actor at nextTimestamp'},bounds:replayBounds(d),mapIDs,actorIds:(d?.actors||[]).map(a=>a.id),stats:{...(d?.stats||{}),compactPositionPoints:positions.length,timelineEvents:timeline.length},positions,positionsByActor:by,timeline,actors:d?.actors||[],report:d?.report||null,fight:d?.fight||null,partial:s.partial,quality:s.quality,quota:d?.quota||null};
  }

  function exportReplayV2208(){
    const d=d208();if(!d)return toast('Replay ещё не загружен');const raw=raw208();let payload;if(raw?.positions?.length)payload=raw;else{payload=canonical208(d);if(raw?.timeline?.length){payload.timeline=raw.timeline;payload.stats={...(payload.stats||{}),...(raw.stats||{}),timelineEvents:raw.timeline.length}}}const s=source208(d),blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`wcl-${s.code||'report'}-fight-${s.fight||'replay'}.raidru-replay.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1200);
  }
  function setWclTab208(v){wclTab208=['replay','analysis','plan'].includes(v)?v:'replay';decorateWclWorkspace208()}
  function toggleWclInfo208(){wclInfo208=!wclInfo208;decorateWclWorkspace208()}
  function refreshWclReplay208(){const d=d208(),s=d?source208(d):null;if(s?.code&&s?.fight)return loadWclFight200(s.code,s.fight);return loadWclReplay200()}

  function centroidFrames208(d){
    const actors=replayActors(d),dur=replayDuration(d),b=replayBounds(d);if(!actors.length||!b)return [];
    const diag=Math.max(1,Math.hypot((b.maxX-b.minX)||1,(b.maxY-b.minY)||1)),step=Math.max(1500,Math.min(3000,dur/160)),out=[];
    for(let t=0;t<=dur;t+=step){const pts=actors.map(a=>positionAt(d,a.id,t)).filter(Boolean);if(pts.length<Math.max(3,actors.length*.35))continue;const x=pts.reduce((s,p)=>s+p.x,0)/pts.length,y=pts.reduce((s,p)=>s+p.y,0)/pts.length,spread=Math.sqrt(pts.reduce((s,p)=>s+(p.x-x)**2+(p.y-y)**2,0)/pts.length)/diag*100,prev=out[out.length-1],move=prev?Math.hypot(x-prev.x,y-prev.y)/diag*100:0;out.push({t,x,y,spread,move,count:pts.length})}return out;
  }
  function analysis208(d){
    const frames=centroidFrames208(d);if(!frames.length)return {frames:[],moments:[],maxSpread:0};
    const maxSpread=Math.max(...frames.map(x=>x.spread)),cand=frames.slice(1).sort((a,b)=>b.move-a.move),moments=[];
    for(const x of cand){if(x.move<.35)break;if(moments.every(m=>Math.abs(m.t-x.t)>12000)){const ev=replayEventNear(d,x.t);moments.push({...x,label:ev?.label||'Сильное движение рейда'});if(moments.length>=6)break}}
    return {frames,moments:moments.sort((a,b)=>a.t-b.t),maxSpread};
  }
  function analysisHtml208(d){
    if(typeof window.wclMechanicsAnalysis209==='function')return window.wclMechanicsAnalysis209(d);
    const a=analysis208(d),s=source208(d);return `<div class="wclAnalysis208"><div class="wclMetricGrid208"><article><small>ДЛИТЕЛЬНОСТЬ</small><b>${fmtTime(s.duration/1000)}</b><span>${replayActors(d).length} игроков</span></article><article><small>ПОЗИЦИИ</small><b>${count208(d.positions?.length)}</b><span>координатных точек</span></article><article><small>РАЗБРОС РЕЙДА</small><b>${a.maxSpread.toFixed(1)}%</b><span>максимум по траектории</span></article><article><small>КЛЮЧЕВЫЕ СДВИГИ</small><b>${a.moments.length}</b><span>найдено автоматически</span></article></div><section class="wclMoments208"><div><small>FIGHT INTELLIGENCE · PREVIEW</small><h3>Ключевые моменты движения</h3><p>Разбор работает локально по уже загруженным координатам и не расходует WCL API.</p></div>${a.moments.length?`<div class="wclMomentList208">${a.moments.map(m=>`<button onclick="setReplayTime(${Math.round(m.t)});setWclTab208('replay')"><time>${fmtTime(m.t/1000)}</time><span><b>${esc(m.label)}</b><small>движение ${m.move.toFixed(1)}% · разброс ${m.spread.toFixed(1)}%</small></span><em>▶</em></button>`).join('')}</div>`:'<div class="wclAnalysisEmpty208">Недостаточно координат для уверенного поиска движений.</div>'}</section></div>`;
  }
  function planHtml208(d){return `<div class="wclPlan208"><section><small>WCL → RAIDRU</small><h3>Фактический бой → редактируемый план</h3><p>RaidRU создаст отдельный Workspace-план из реальных позиций игроков. Исходная тактика не перезаписывается.</p><div class="wclPlanActions208"><button class="primary" onclick="createPlanFromReplay()">✦ Создать план из боя</button><button onclick="setWclTab208('analysis')">Посмотреть ключевые моменты</button></div></section><div class="wclPlanStats208"><b>${replayActors(d).length}</b><span>игроков</span><b>${count208(d.positions?.length)}</b><span>точек позиции</span><b>${count208(d.events?.length)}</b><span>событий</span></div></div>`}
  function statusHtml208(){const u=ui208();if(!u?.message)return '';return `<div class="wclInlineStatus208 ${esc(u.state||'')}"><i></i><span>${esc(u.message)}</span>${u.quota?`<small>${esc(quota208(u.quota))}</small>`:''}</div>`}
  function diagnostics208(d){return `<details class="wclDiag208"><summary title="Дополнительные действия">•••</summary><div><button onclick="toggleWclInfo208()">ⓘ Информация о Replay</button><label>⇧ Импорт Replay JSON<input type="file" accept="application/json,.json" onchange="importReplayJson(this.files[0])"></label>${d?'<button onclick="exportReplayV2208()">⇩ Экспорт Replay v2 JSON</button>':''}</div></details>`}
  function infoHtml208(d){if(!wclInfo208||!d)return '';const s=source208(d),r=raw208(),st=r?.stats||d.stats||{};return `<div class="wclInfo208"><span><small>Формат</small><b>${esc(r?.format||'RaidRU normalized replay')} ${r?.version?`v${r.version}`:''}</b></span><span><small>Карта</small><b>${s.mapId?`mapID ${s.mapId}`:'fallback'}</b></span><span><small>Позиции</small><b>${count208(st.compactPositionPoints||d.positions?.length)}</b></span><span><small>События</small><b>${count208(st.timelineEvents||d.events?.length)}</b></span><span><small>Кэш</small><b>${esc(s.cache||'локально')}</b></span></div>`}

  function decorateWclWorkspace208(){
    if(typeof view==='undefined'||view!=='replay')return;document.querySelectorAll('.wclIntro095').forEach(x=>x.style.display='none');
    const card=document.querySelector('.replayImport.card');if(!card)return;const d=d208(),u=ui208(),s=d?source208(d):null,currentUrl=u?.url||replayState()?.url||'';
    if(!d){
      card.className='replayImport card wclImportCard208';card.innerHTML=`<div class="wclUpload208"><div><small>WARCRAFT LOGS</small><h2>Загрузить бой</h2><p>Вставь ссылку на отчёт или конкретный пул. RaidRU сам получает Replay — JSON и браузерные скрипты для обычной работы не нужны.</p></div><span class="wclSafeBadge208">⚡ безопасный импорт</span></div><div class="wclInput208"><input id="wclUrl200" value="${esc(currentUrl)}" placeholder="https://www.warcraftlogs.com/reports/…?fight=10" onkeydown="if(event.key==='Enter')loadWclReplay200()"><button class="primary" onclick="loadWclReplay200()">${u?.state==='paused'?'↻ Продолжить':'▶ Загрузить бой'}</button>${diagnostics208(null)}</div>${statusHtml208()||'<div class="wclHint208">Ссылка без <b>fight=</b> откроет выбор пулов. Повторное открытие готового боя берётся из серверного кэша.</div>'}`;
      document.querySelectorAll('.wclFightShell208,.wclAnalysis208,.wclPlan208,.wclInfo208').forEach(x=>x.remove());const empty=document.querySelector('.emptyReplay');if(empty)empty.innerHTML='<b>Здесь появится Replay боя</b><p>После загрузки можно переключаться между Replay, автоматическим разбором и созданием плана.</p>';return;
    }
    const st=badge208(d),difficulty=diff208(s.difficulty);
    card.className='replayImport card wclLoadedCard208';card.innerHTML=`<div class="wclLoaded208"><div class="wclLoadedTitle208"><small>WARCRAFT LOGS · ${esc(s.code||'REPORT')}${s.fight?` · ПУЛ #${esc(s.fight)}`:''}</small><h2>${esc(s.name)}</h2><p>${[difficulty,fmtTime(s.duration/1000),`${replayActors(d).length} игроков`,s.kill?'Kill':''].filter(Boolean).join(' · ')}</p></div><div class="wclLoadedActions208"><span class="wclReplayBadge208 ${st.cls}">${st.label}</span>${s.partial&&s.code&&s.fight?`<button class="primary" onclick="loadWclFight200('${esc(s.code)}','${esc(s.fight)}')">↻ Догрузить ещё</button>`:''}<button onclick="refreshWclReplay208()">↻ Обновить</button><button class="wclNewFight208" onclick="clearWclReplay200()">＋ Новый бой</button>${diagnostics208(d)}</div></div>${statusHtml208()}${infoHtml208(d)}`;
    let shell=document.querySelector('.wclFightShell208');if(!shell){shell=document.createElement('div');shell.className='wclFightShell208';const target=document.querySelector('.replayGrid');target?.parentNode.insertBefore(shell,target)}
    shell.innerHTML=`<nav><button class="${wclTab208==='replay'?'on':''}" onclick="setWclTab208('replay')">▶ Replay</button><button class="${wclTab208==='analysis'?'on':''}" onclick="setWclTab208('analysis')">✦ Разбор</button><button class="${wclTab208==='plan'?'on':''}" onclick="setWclTab208('plan')">▦ План</button></nav><span>${st.label}${s.mapId?` · mapID ${s.mapId}`:''}</span>`;
    const grid=document.querySelector('.replayGrid');if(grid)grid.style.display=wclTab208==='replay'?'grid':'none';document.querySelectorAll('.wclAnalysis208,.wclPlan208').forEach(x=>x.remove());if(wclTab208!=='replay'){const holder=document.createElement('div');holder.innerHTML=wclTab208==='analysis'?analysisHtml208(d):planHtml208(d);shell.insertAdjacentElement('afterend',holder.firstElementChild)}
  }

  const oldRender208=render;render=function(){oldRender208();decorateWclWorkspace208();const version=document.querySelector('aside .version');if(version)version.textContent='RaidRU 2.1.0 · Performance Core'};
  const oldClear208=clearWclReplay200;clearWclReplay200=function(){wclTab208='replay';wclInfo208=false;window.__raidruExactReplay208=null;oldClear208()};
  Object.assign(window,{setWclTab208,toggleWclInfo208,refreshWclReplay208,exportReplayV2208,decorateWclWorkspace208});
  render();
})();
