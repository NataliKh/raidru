/* RaidRU 1.0 — Raid Ready
 * Readiness audit, battle mode, per-player plan, scene script fields,
 * explicit snapshots/history compare and personal NSRT export.
 * Loaded after workspace-095.js to keep RaidPlan geometry/import isolated.
 */
(() => {
  const VERSION='1.0.0';
  const READY_KEY='_raidReady100';
  const nowIso=()=>new Date().toISOString();
  const cfg=()=>state[READY_KEY]||(state[READY_KEY]={playerId:'',raidSpeed:1});
  const deep100=v=>typeof deep==='function'?deep(v):JSON.parse(JSON.stringify(v));
  const activeWorkspace100=()=>{
    const ws=state._workspace095;
    if(!ws?.plans?.length)return null;
    const p=ws.plans.find(x=>x.id===ws.activeId);
    return p&&p.boss===current&&p.diff===diff?p:null;
  };
  const roleLabel100=r=>r==='tank'?'Танк':r==='healer'?'Хил':r==='dps'?'ДД':'Игрок';
  const playerRole100=r=>r?.role==='tank'?'tank':r?.role==='healer'?'healer':(r?.range==='melee'?'melee':'ranged');
  const htmlText100=v=>esc(String(v??''));

  function currentData100(){
    const root=bossStateRaw(current),bs=bossState(current,diff);
    return {
      favorite:!!root.favorite,progress:+root.progress||0,note:root.note||'',
      scenes:deep100(bs.scenes||[]),timelineV3:deep100(bs.timelineV3||[]),
      cooldowns:deep100(bs.cooldowns||[]),assignments:deep100(bs.assignments||[]),
      roster:deep100(rosterState()),scenarioSource:scenarioSourceStored(current,diff)==='raidplan'?'raidplan':'raidru'
    };
  }

  function workspaceSnapshotPlan100(planId,reason){
    const ws=state._workspace095,p=ws?.plans?.find(x=>x.id===planId);if(!p)return toast('Активный план не найден');
    if(p.boss===current&&p.diff===diff)p.data=currentData100();
    const title=reason||prompt('Название снимка','Перед рейдом');if(!title)return;
    p.history=Array.isArray(p.history)?p.history:[];
    p.history.push({id:uid(),at:nowIso(),reason:String(title).slice(0,80),data:deep100(p.data)});
    while(p.history.length>12)p.history.shift();p.lastHistoryAt=Date.now();p.updatedAt=nowIso();
    raidruPersistNow();
    render();toast(`Снимок создан: ${title}`);
  }
  function workspaceSnapshot100(reason){const p=activeWorkspace100();if(!p)return toast('Сначала открой план из «Мои планы»');workspaceSnapshotPlan100(p.id,reason)}

  function comparePlanData100(a,b){
    const names=x=>(x?.scenes||[]).map(s=>s.name||'Без названия');
    const an=names(a),bn=names(b),changedNames=[];
    for(let i=0;i<Math.max(an.length,bn.length);i++)if(an[i]!==bn[i])changedNames.push(`${i+1}. ${an[i]||'—'} → ${bn[i]||'—'}`);
    return [
      ['Сцены',(a?.scenes||[]).length,(b?.scenes||[]).length],
      ['Таймлайн',(a?.timelineV3||[]).length,(b?.timelineV3||[]).length],
      ['Игроки',(a?.roster||[]).length,(b?.roster||[]).length],
      ['Назначения',(a?.assignments||[]).length,(b?.assignments||[]).length]
    ].map(x=>({...{label:x[0],before:x[1],after:x[2]},changed:x[1]!==x[2]})).concat([{label:'Названия сцен',before:changedNames.length?changedNames.join('\n'):'без изменений',after:'',changed:changedNames.length>0,long:true}]);
  }
  function workspaceCompareSnapshot100(planId,snapId){
    const ws=state._workspace095,p=ws?.plans?.find(x=>x.id===planId),s=p?.history?.find(x=>x.id===snapId);if(!p||!s)return;
    const current=p.boss===current&&p.diff===diff?currentData100():p.data,rows=comparePlanData100(s.data,current);
    document.getElementById('workspaceCompare100')?.remove();const wrap=document.createElement('div');wrap.id='workspaceCompare100';wrap.className='raidplanModalBackdrop';
    wrap.innerHTML=`<div class="compareModal100"><div class="difficultySwitchHead"><div><small>СРАВНЕНИЕ СНИМКА</small><h2>${htmlText100(s.reason)}</h2></div><button onclick="document.getElementById('workspaceCompare100')?.remove()">×</button></div><p>${new Date(s.at).toLocaleString('ru-RU')} → текущая версия «${htmlText100(p.name)}»</p><div class="compareRows100">${rows.map(r=>r.long?`<div class="compareLong100 ${r.changed?'changed':''}"><b>${r.label}</b><pre>${htmlText100(r.before)}</pre></div>`:`<div class="compareRow100 ${r.changed?'changed':''}"><b>${r.label}</b><span>${r.before}</span><i>→</i><strong>${r.after}</strong></div>`).join('')}</div><div class="compareActions100"><button onclick="document.getElementById('workspaceCompare100')?.remove()">Закрыть</button><button class="primary" onclick="workspaceRestoreHistory('${p.id}','${s.id}')">↶ Восстановить снимок</button></div></div>`;
    wrap.onclick=e=>{if(e.target===wrap)wrap.remove()};document.body.appendChild(wrap);
  }
  function workspaceShowHistory100(id){
    const ws=state._workspace095,p=ws?.plans?.find(x=>x.id===id);if(!p)return;document.getElementById('workspaceHistoryModal')?.remove();
    const wrap=document.createElement('div');wrap.id='workspaceHistoryModal';wrap.className='raidplanModalBackdrop';
    const rows=[...(p.history||[])].reverse().map(s=>`<article class="historyRow100"><span><b>${htmlText100(s.reason)}</b><small>${new Date(s.at).toLocaleString('ru-RU')} · ${s.data?.scenes?.length||0} сцен · ${s.data?.timelineV3?.length||0} событий</small></span><div><button onclick="workspaceCompareSnapshot100('${p.id}','${s.id}')">Сравнить</button><button class="primary" onclick="workspaceRestoreHistory('${p.id}','${s.id}')">Восстановить</button></div></article>`).join('');
    wrap.innerHTML=`<div class="workspaceHistoryModal095 historyModal100"><div class="difficultySwitchHead"><div><small>ИСТОРИЯ ПЛАНА · 1.0</small><h2>${htmlText100(p.name)}</h2></div><button onclick="document.getElementById('workspaceHistoryModal')?.remove()">×</button></div><p>Явные снимки перед рейдом и автоматические контрольные точки. Снимок можно сравнить с текущей версией перед восстановлением.</p><div class="historyList095">${rows||'<div class="empty">История пока пуста.</div>'}</div></div>`;
    wrap.onclick=e=>{if(e.target===wrap)wrap.remove()};document.body.appendChild(wrap);
  }

  function sceneOffcanvas100(sc){
    let bad=0;
    for(const t of sc?.tokens||[]){const x=+t[3],y=+t[4];if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>100||y<0||y>100)bad++}
    for(const e of sc?.effects||[]){const x=+e.x,y=+e.y,w=Math.max(0,+e.w||0),h=Math.max(0,+e.h||0);if(!Number.isFinite(x)||!Number.isFinite(y)||x-w/2<-1||x+w/2>101||y-h/2<-1||y+h/2>101)bad++}
    return bad;
  }
  function readiness100(){
    const bs=scenarioState(current),scenes=bs.scenes||[],timeline=bs.timelineV3||[],roster=rosterState(),assign=bs.assignments||[];
    const tanks=roster.filter(x=>x.role==='tank').length,healers=roster.filter(x=>x.role==='healer').length;
    const off=scenes.reduce((n,s)=>n+sceneOffcanvas100(s),0),blank=scenes.filter(s=>!String(s.name||'').trim()||/^пустая карта$|^новая сцена$/i.test(String(s.name||'').trim())).length;
    const invalidEvents=timeline.filter(e=>!Number.isInteger(+e.scene)||+e.scene<0||+e.scene>=scenes.length).length;
    const scripted=scenes.filter(s=>String(s.raidAction||s.note||'').trim()).length;
    const healcd=assign.filter(a=>a.kind==='healcd').length;
    const unowned=assign.filter(a=>a.playerName&&a.playerName!=='Весь рейд'&&!roster.some(r=>r.name===a.playerName||r.id===a.playerId)).length;
    const checks=[
      {key:'roster',label:'Состав загружен',detail:roster.length?`${roster.length} игроков`:'Добавь игроков во вкладке «Состав»',ok:roster.length>=10,level:roster.length?'warn':'bad',action:'roster'},
      {key:'tanks',label:'Танки назначены',detail:tanks>=2?`${tanks} танка`:`Сейчас танков: ${tanks}. Для рейда нужно назначить двух.`,ok:tanks>=2,level:'bad',action:'roster'},
      {key:'healers',label:'Хилы назначены',detail:healers?`${healers} хилов`:'В составе нет хилов.',ok:healers>=2,level:healers?'warn':'bad',action:'roster'},
      {key:'scenes',label:'Ключевые сцены готовы',detail:`${scenes.length} сцен${blank?` · пустых: ${blank}`:''}`,ok:scenes.length>=2&&blank===0,level:blank?'bad':'warn',action:'planner'},
      {key:'script',label:'Сценарий объяснения заполнен',detail:`${scripted}/${scenes.length} сцен содержат действие рейда или описание`,ok:scenes.length>0&&scripted===scenes.length,level:'warn',action:'planner'},
      {key:'timeline',label:'Таймлайн связан со сценами',detail:timeline.length?`${timeline.length} событий${invalidEvents?` · ошибок привязки: ${invalidEvents}`:''}`:'Таймлайн пуст',ok:timeline.length>0&&invalidEvents===0,level:invalidEvents?'bad':'warn',action:'timeline'},
      {key:'bounds',label:'Объекты не выходят за карту',detail:off?`Найдено объектов за границей: ${off}`:'Все объекты внутри координат арены',ok:off===0,level:'bad',action:'planner'},
      {key:'assign',label:'Персональные назначения',detail:assign.length?`${assign.length} назначений${unowned?` · без игрока: ${unowned}`:''}`:'Нет персональных назначений',ok:assign.length>0&&unowned===0,level:unowned?'bad':'warn',action:'assignments'},
      {key:'healcd',label:'Хил-КД распределены',detail:healcd?`${healcd} хил-КД в плане`:'Хил-КД не назначены',ok:healcd>0,level:'warn',action:'assignments'},
      {key:'notes',label:'Есть рейдовая заметка',detail:String(bossStateRaw(current).note||'').trim()?'Заметка заполнена':'Добавь итоговую заметку или договорённости',ok:!!String(bossStateRaw(current).note||'').trim(),level:'warn',action:'notes'}
    ];
    const weights={roster:8,tanks:12,healers:8,scenes:12,script:10,timeline:12,bounds:12,assign:10,healcd:8,notes:8};
    const total=checks.reduce((n,c)=>n+(c.ok?weights[c.key]:0),0),critical=checks.filter(c=>!c.ok&&c.level==='bad').length;
    return {score:Math.round(total),checks,critical,scenes:scenes.length,timeline:timeline.length,roster:roster.length,assign:assign.length};
  }

  function readinessView100(b){
    const r=readiness100(),ready=r.score>=85&&r.critical===0;
    return `<section class="page readyPage100"><div class="readyHero100"><div class="readyScore100" style="--ready:${r.score}"><strong>${r.score}%</strong><span>готовность</span></div><div><small>RAID READY · 1.0</small><h2>${ready?'План готов к рейду':'Подготовка к рейду'}</h2><p>${ready?'Критических проблем не найдено. Можно создать снимок и открыть боевой режим.':`Критических пунктов: ${r.critical}. RaidRU показывает, что стоит поправить до пула.`}</p><div class="readyStats100"><span><b>${r.scenes}</b> сцен</span><span><b>${r.timeline}</b> событий</span><span><b>${r.roster}</b> игроков</span><span><b>${r.assign}</b> назначений</span></div></div><div class="readyHeroActions100"><button onclick="workspaceSnapshot100('Перед рейдом')">◈ Снимок перед рейдом</button><button class="primary" onclick="setView('raidmode')">▶ Открыть режим «Рейд»</button></div></div><div class="readyGrid100"><div class="readyChecklist100">${r.checks.map(c=>`<article class="readyCheck100 ${c.ok?'ok':c.level}"><i>${c.ok?'✓':c.level==='bad'?'!':'•'}</i><div><b>${c.label}</b><span>${htmlText100(c.detail)}</span></div>${c.ok?'':`<button onclick="setView('${c.action}')">Исправить</button>`}</article>`).join('')}</div><aside class="readySide100"><div class="readyCard100"><small>ПОСЛЕДНИЙ ШАГ</small><h3>Перед первым пулом</h3><p>Создай снимок версии, проверь персональные назначения и открой «Рейд». После вайпа можно спокойно менять тактику — сохранённый снимок останется в истории.</p><button onclick="workspaceSnapshot100('Перед первым пулом')">Создать снимок</button></div><div class="readyCard100"><small>ПЕРСОНАЛЬНЫЙ ПЛАН</small><h3>Что делать конкретному игроку</h3><p>RaidRU собирает назначения и действия сцены в отдельную ленту для выбранного игрока.</p><button onclick="setView('raidmode')">Открыть «Мой план» →</button></div></aside></div></section>`;
  }

  function sceneEvents100(sceneIndexValue){return (scenarioState(current).timelineV3||[]).filter(e=>+e.scene===+sceneIndexValue).sort((a,b)=>a.time-b.time)}
  function sceneAssignments100(sceneIndexValue){const ev=sceneEvents100(sceneIndexValue),ids=new Set(ev.map(e=>e.id));return (bossState(current,diff).assignments||[]).filter(a=>ids.has(a.eventId)||ev.some(e=>Math.abs((+a.time||0)-(+e.time||0))<1))}
  function sceneTime100(idx){const ev=sceneEvents100(idx);return ev.length?Math.min(...ev.map(e=>+e.time||0)):null}

  function selectedPlayer100(){
    const roster=rosterState();if(!roster.length)return null;
    let id=cfg().playerId,p=roster.find(x=>String(x.id)===String(id));if(!p){p=roster[0];cfg().playerId=p.id}
    return p;
  }
  function setPersonalPlayer100(id){cfg().playerId=id;save();render()}
  function personalRows100(player=selectedPlayer100()){
    if(!player)return [];
    const bs=scenarioState(current),assign=bossState(current,diff).assignments||[],out=[];
    for(const e of [...(bs.timelineV3||[])].sort((a,b)=>a.time-b.time)){
      const sc=bs.scenes?.[+e.scene]||{},role=playerRole100(player),mine=assign.filter(a=>(a.eventId===e.id||(!a.eventId&&Math.abs((+a.time||0)-(+e.time||0))<1))&&(a.playerName==='Весь рейд'||a.playerName===player.name||String(a.playerId||'')===String(player.id)));
      const actions=[];if(sc.raidAction)actions.push(sc.raidAction);if(role==='tank'&&sc.tankAction)actions.push(sc.tankAction);if(role==='healer'&&sc.healerAction)actions.push(sc.healerAction);
      mine.forEach(a=>actions.push(`${a.label||'Назначение'}${a.note?` — ${a.note}`:''}`));
      const uniq=[...new Set(actions.map(x=>String(x).trim()).filter(Boolean))];if(uniq.length)out.push({time:+e.time||0,event:e.label,scene:+e.scene||0,actions:uniq,voice:sc.voice||''});
    }
    if(!out.length){for(let i=0;i<(bs.scenes||[]).length;i++){const sc=bs.scenes[i],role=playerRole100(player),actions=[sc.raidAction,role==='tank'?sc.tankAction:'',role==='healer'?sc.healerAction:''].filter(Boolean);if(actions.length)out.push({time:sceneTime100(i)||i*30,event:sc.name,scene:i,actions:[...new Set(actions)],voice:sc.voice||''})}}
    return out;
  }
  function personalText100(player=selectedPlayer100()){
    if(!player)return 'Состав пока пуст.';const rows=personalRows100(player);
    return [`[RaidRU] ${raid.find(x=>x.id===current)?.name||current} · ${difficultyLabels[diff]}`,`${player.name} · ${roleLabel100(player.role)}`,'',...rows.flatMap(r=>[`${fmtTime(r.time)}  ${r.event}`,...r.actions.map(a=>`  → ${a}`)])].join('\n');
  }
  function personalNsrt100(player=selectedPlayer100()){
    const profile=NSRT_VOICE_PROFILES?.[current];if(!player||!profile)return '';
    const lines=personalRows100(player).flatMap(r=>r.actions.map(a=>({t:r.time,text:a}))).filter(x=>x.t>=0);
    return [`EncounterID:${profile.encounterId}`,...lines.map(x=>nsrtReminderLine(+x.t.toFixed(2),'everyone',0,x.text,x.text,3))].join('\n');
  }
  function copyPersonalPlan100(){copyText(personalText100());toast('Персональный план скопирован')}
  function copyPersonalNsrt100(){const txt=personalNsrt100();if(!txt)return toast('Для этого босса нет EncounterID NSRT');copyText(txt);toast('Персональный импорт NSRT скопирован')}

  const run100={playing:false,timer:null,lastPerf:0,currentTime:0,lastScene:-1};
  function clearRaidTimer100(){if(run100.timer){clearInterval(run100.timer);run100.timer=null}}
  function raidRunStop100(doRender=true){clearRaidTimer100();run100.playing=false;if(doRender&&view==='raidmode')render()}
  function raidApplyTime100(t,{rerender=true}={}){
    const events=[...(scenarioState(current).timelineV3||[])].sort((a,b)=>a.time-b.time);if(!events.length)return;
    run100.currentTime=Math.max(events[0].time,Math.min(t,events.at(-1).time));let active=events[0];for(const e of events){if(e.time<=run100.currentTime)active=e;else break}
    const target=Math.max(0,Math.min((scenarioState(current).scenes||[]).length-1,+active.scene||0));
    if(target!==playerSceneIndex){playerSceneIndex=target;run100.lastScene=target;if(rerender)render()}
    const timeNode=document.getElementById('raidClock100');if(timeNode)timeNode.textContent=fmtTime(run100.currentTime);
    const slider=document.getElementById('raidScrub100');if(slider)slider.value=String(run100.currentTime);
    const label=document.getElementById('raidNowEvent100');if(label)label.textContent=active.label||'';
  }
  function raidRunToggle100(){
    if(run100.playing)return raidRunStop100(true);
    const events=[...(scenarioState(current).timelineV3||[])].sort((a,b)=>a.time-b.time);if(!events.length)return toast('Сначала заполни таймлайн');
    run100.playing=true;run100.currentTime=Number.isFinite(run100.currentTime)&&run100.currentTime>=events[0].time&&run100.currentTime<events.at(-1).time?run100.currentTime:events[0].time;run100.lastPerf=performance.now();raidApplyTime100(run100.currentTime);render();
    run100.lastPerf=performance.now();run100.timer=setInterval(()=>{if(!run100.playing||view!=='raidmode')return raidRunStop100(false);const now=performance.now(),dt=(now-run100.lastPerf)/1000;run100.lastPerf=now;run100.currentTime+=dt*(+cfg().raidSpeed||1);if(run100.currentTime>=events.at(-1).time){run100.currentTime=events.at(-1).time;raidApplyTime100(run100.currentTime);raidRunStop100(true);return}raidApplyTime100(run100.currentTime)},200);
  }
  function raidSeek100(v){run100.currentTime=+v||0;raidApplyTime100(run100.currentTime)}
  function raidSetSpeed100(v){cfg().raidSpeed=+v||1;save()}
  function raidPrev100(){raidRunStop100(false);playerSceneIndex=Math.max(0,playerSceneIndex-1);run100.currentTime=sceneTime100(playerSceneIndex)||0;render()}
  function raidNext100(){raidRunStop100(false);playerSceneIndex=Math.min((scenarioState(current).scenes||[]).length-1,playerSceneIndex+1);run100.currentTime=sceneTime100(playerSceneIndex)||run100.currentTime;render()}

  function personalPanel100(){
    const roster=rosterState(),p=selectedPlayer100(),rows=personalRows100(p).slice(0,8),hasNsrt=!!NSRT_VOICE_PROFILES?.[current];
    return `<div class="personalPanel100"><div class="personalHead100"><div><small>МОЙ ПЛАН</small><h3>${p?htmlText100(p.name):'Состав не заполнен'}</h3></div>${roster.length?`<select onchange="setPersonalPlayer100(this.value)">${roster.map(x=>`<option value="${x.id}" ${p&&String(x.id)===String(p.id)?'selected':''}>${htmlText100(x.name)} · ${roleLabel100(x.role)}</option>`).join('')}</select>`:''}</div>${p?`<div class="personalRows100">${rows.length?rows.map(r=>`<article><time>${fmtTime(r.time)}</time><div><b>${htmlText100(r.event)}</b>${r.actions.map(a=>`<span>→ ${htmlText100(a)}</span>`).join('')}</div></article>`).join(''):'<p class="muted100">Для игрока пока нет персональных действий. Добавь назначения или сценарий сцены.</p>'}</div><div class="personalActions100"><button onclick="copyPersonalPlan100()">Копировать план</button><button ${hasNsrt?'':'disabled'} onclick="copyPersonalNsrt100()">Копировать NSRT</button></div>`:'<p class="muted100">Добавь состав — после этого RaidRU соберёт персональный план.</p>'}</div>`;
  }

  function raidModeView100(b){
    const bs=scenarioState(current),sc=bs.scenes?.[Math.min(playerSceneIndex,bs.scenes.length-1)]||bs.scenes?.[0],idx=Math.min(playerSceneIndex,Math.max(0,bs.scenes.length-1));if(!sc)return `<section class="page"><div class="empty">Нет сцен для рейдового режима.</div></section>`;
    const ev=sceneEvents100(idx),assign=sceneAssignments100(idx),all=[...(bs.timelineV3||[])].sort((a,b)=>a.time-b.time),max=Math.max(1,...all.map(e=>+e.time||0)),r=readiness100(),nextEvents=all.filter(e=>(+e.time||0)>(sceneTime100(idx)??-1)).slice(0,4);
    const instructions=[['Рейд',sc.raidAction||sc.note],['Танки',sc.tankAction],['Хилы',sc.healerAction],['Голос',sc.voice]].filter(x=>String(x[1]||'').trim());
    return `<section class="page raidModePage100"><div class="raidModeTop100"><div><small>RAID MODE · ${difficultyLabels[diff]}</small><h2>${htmlText100(b.name)}</h2><span class="readyPill100 ${r.score>=85&&r.critical===0?'ok':'warn'}">Готовность ${r.score}%</span></div><div class="raidModeTopActions100"><button onclick="setView('readiness')">✓ Проверка</button><button onclick="workspaceSnapshot100('Снимок во время рейда')">◈ Снимок</button><button onclick="toggleRaidFullscreen100()">⛶ Экран</button></div></div><div class="raidModeGrid100"><div class="raidArenaWrap100">${arenaHtml(sc,{player:true,next:bs.scenes[idx+1]||null})}<div class="raidSceneTitle100"><span>СЦЕНА ${idx+1}/${bs.scenes.length}</span><b>${htmlText100(sc.name)}</b></div></div><aside class="raidBrief100"><div class="raidNow100"><small>СЕЙЧАС <b id="raidClock100">${fmtTime(run100.currentTime||sceneTime100(idx)||0)}</b></small><h3 id="raidNowEvent100">${htmlText100(ev[0]?.label||sc.name)}</h3></div>${instructions.map(x=>`<div class="raidInstruction100 ${x[0]==='Голос'?'voice':''}"><span>${x[0]}</span><p>${htmlText100(x[1])}</p></div>`).join('')}${assign.length?`<div class="raidAssignments100"><span>НАЗНАЧЕНИЯ</span>${assign.map(a=>`<p><b>${htmlText100(a.playerName||'Рейд')}</b> — ${htmlText100(a.label||'Назначение')}</p>`).join('')}</div>`:''}<div class="raidNext100"><span>ДАЛЬШЕ</span>${nextEvents.map(e=>`<button onclick="raidSeek100(${+e.time||0})"><time>${fmtTime(e.time)}</time><b>${htmlText100(e.label)}</b></button>`).join('')||'<p>Финальная сцена</p>'}</div>${personalPanel100()}</aside></div><div class="raidTransport100"><button onclick="raidPrev100()">‹ Сцена</button><button class="raidPlay100 ${run100.playing?'on':''}" onclick="raidRunToggle100()">${run100.playing?'■ Стоп':'▶ Репетиция'}</button><button onclick="raidNext100()">Сцена ›</button><select onchange="raidSetSpeed100(this.value)">${[.5,1,1.5,2].map(x=>`<option value="${x}" ${+cfg().raidSpeed===x?'selected':''}>${x}×</option>`).join('')}</select><input id="raidScrub100" type="range" min="${all[0]?.time||0}" max="${max}" step="1" value="${run100.currentTime||sceneTime100(idx)||0}" oninput="raidSeek100(this.value)"><span>${all.length} событий</span></div></section>`;
  }

  function toggleRaidFullscreen100(){const root=document.documentElement;if(!document.fullscreenElement){root.requestFullscreen?.().catch(()=>{});document.body.classList.add('raidruRaidFullscreen100')}else{document.exitFullscreen?.();document.body.classList.remove('raidruRaidFullscreen100')}}

  function setSceneScript100(k,v){const sc=scenarioState(current).scenes?.[sceneIndex];if(!sc)return;sc[k]=String(v||'').slice(0,500);save()}
  function sceneScriptEditor100(){
    const sc=scenarioState(current).scenes?.[sceneIndex];if(!sc)return '';
    return `<div class="sceneScript100"><div class="sceneScriptHead100"><div><small>СЦЕНАРИЙ СЦЕНЫ · 1.0</small><b>Что должен сделать рейд в этом кадре</b></div><button onclick="setView('readiness')">✓ Проверить план</button></div><div class="sceneScriptGrid100"><label><span>Весь рейд</span><textarea onchange="setSceneScript100('raidAction',this.value)" placeholder="Например: две группы расходятся по своим сторонам">${htmlText100(sc.raidAction||'')}</textarea></label><label><span>Танки</span><textarea onchange="setSceneScript100('tankAction',this.value)" placeholder="Позиция босса, своп, направление">${htmlText100(sc.tankAction||'')}</textarea></label><label><span>Хилы</span><textarea onchange="setSceneScript100('healerAction',this.value)" placeholder="Пик урона, сейвы, хил-КД">${htmlText100(sc.healerAction||'')}</textarea></label><label><span>Голосовая команда</span><textarea onchange="setSceneScript100('voice',this.value)" placeholder="Короткая команда РЛ / TTS">${htmlText100(sc.voice||'')}</textarea></label></div></div>`;
  }

  const coreContent100=content,coreRender100=render;
  content=function(b,bs){if(view==='readiness')return readinessView100(b);if(view==='raidmode')return raidModeView100(b);return coreContent100(b,bs)};

  let previousView100=view;
  function decorate100(){
    if(previousView100==='raidmode'&&view!=='raidmode')raidRunStop100(false);previousView100=view;
    document.body.classList.toggle('raidruRaidMode100',view==='raidmode');
    const header=document.querySelector('main > header');if(header){
      const dashboard=[...header.querySelectorAll('button')].find(x=>x.getAttribute('onclick')?.includes("setView('dashboard')"));if(dashboard)dashboard.textContent='Обзор';
      if(!header.querySelector('[data-raidmode100]')){
        const player=[...header.querySelectorAll('button')].find(x=>x.getAttribute('onclick')?.includes("setView('player')"));if(player)player.insertAdjacentHTML('beforebegin',`<button data-raidmode100 class="raidModeNav100 ${view==='raidmode'?'on':''}" onclick="setView('raidmode')">▶ Рейд</button>`);
      }
      const rbtn=header.querySelector('[data-raidmode100]');if(rbtn)rbtn.classList.toggle('on',view==='raidmode');
    }
    const version=document.querySelector('aside .version');if(version)version.textContent='RaidRU 1.0 · Raid Ready';
    if(view==='workspace'){
      const actions=document.querySelector('.workspaceHeroActions095');if(actions&&!actions.querySelector('[data-ready100]'))actions.insertAdjacentHTML('afterbegin','<button data-ready100 class="primary" onclick="setView(\'readiness\')">✓ Готовность</button><button data-snapshot100 onclick="workspaceSnapshot100(\'Перед рейдом\')">◈ Снимок</button>');
      const hero=document.querySelector('.workspaceHero095 small');if(hero)hero.textContent='RAID WORKSPACE · 1.0';
    }
    if(view==='planner'){
      const canvas=document.querySelector('.plannerCanvas');if(canvas&&!canvas.querySelector('.sceneScript100'))canvas.insertAdjacentHTML('beforeend',sceneScriptEditor100());
    }
    if(view==='guide'){
      const right=document.querySelector('.guide + .right');if(right&&!right.querySelector('[data-ready-card100]'))right.insertAdjacentHTML('beforeend','<div class="card" data-ready-card100><h3>✅ Готовность к рейду</h3><p>Проверь состав, сцены, таймлайн, объекты на карте и назначения перед первым пулом.</p><button onclick="setView(\'readiness\')">Проверить план</button><button onclick="setView(\'raidmode\')">▶ Режим «Рейд»</button></div>');
    }
  }
  render=function(){coreRender100();decorate100()};

  const originalHistory100=window.workspaceShowHistory;
  if(originalHistory100)window.workspaceShowHistory=workspaceShowHistory100;
  Object.assign(window,{workspaceSnapshot100,workspaceSnapshotPlan100,workspaceCompareSnapshot100,workspaceShowHistory100,setSceneScript100,setPersonalPlayer100,copyPersonalPlan100,copyPersonalNsrt100,raidRunToggle100,raidSeek100,raidSetSpeed100,raidPrev100,raidNext100,toggleRaidFullscreen100});
  document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)document.body.classList.remove('raidruRaidFullscreen100')});
  render();
})();
