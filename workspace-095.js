/* RaidRU 0.9.5 — Raid Workspace
 * Projects, history, presentation controls, visual timeline, assignments,
 * and WCL replay -> editable draft scenes.
 * Kept separate from the RaidPlan renderer so import geometry stays isolated.
 */
(() => {
  const WORKSPACE_VERSION='0.9.5';
  const WORKSPACE_KEY='_workspace095';
  const HISTORY_LIMIT=12;
  const HISTORY_BUDGET=1200000;
  const SLOT=(boss,difficulty)=>`${boss}::${difficulty}`;
  const nowIso=()=>new Date().toISOString();
  const fmtDate=v=>{try{return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}catch(_){return 'сейчас'}};
  const bossName=id=>raid.find(b=>b.id===id)?.name||id;
  const safeDeep=v=>deep(v??null);

  function workspaceState(){
    if(!state[WORKSPACE_KEY])state[WORKSPACE_KEY]={version:WORKSPACE_VERSION,plans:[],activeId:null,lastPlanBySlot:{},migrated:false};
    const ws=state[WORKSPACE_KEY];
    ws.version=WORKSPACE_VERSION;ws.plans=Array.isArray(ws.plans)?ws.plans:[];ws.lastPlanBySlot=ws.lastPlanBySlot||{};
    return ws;
  }
  function workspacePlan(id=workspaceState().activeId){return workspaceState().plans.find(p=>p.id===id)||null}
  function workspaceCurrentPlan(){const p=workspacePlan();return p&&p.boss===current&&p.diff===diff?p:null}
  function workspaceCapture(id=current,difficulty=diff){
    const root=bossStateRaw(id),bs=bossState(id,difficulty);
    return {
      favorite:!!root.favorite,progress:+root.progress||0,note:root.note||'',
      scenes:safeDeep(bs.scenes||[]),timelineV3:safeDeep(bs.timelineV3||[]),
      cooldowns:safeDeep(bs.cooldowns||[]),assignments:safeDeep(bs.assignments||[]),roster:safeDeep(rosterState()),
      scenarioSource:scenarioSourceStored(id,difficulty)==='raidplan'?'raidplan':'raidru'
    };
  }
  function workspaceHistoryData(data){
    return {favorite:!!data.favorite,progress:+data.progress||0,note:data.note||'',scenes:safeDeep(data.scenes||[]),timelineV3:safeDeep(data.timelineV3||[]),cooldowns:safeDeep(data.cooldowns||[]),assignments:safeDeep(data.assignments||[]),roster:safeDeep(data.roster||[]),scenarioSource:data.scenarioSource||'raidru'};
  }
  function workspaceApplyData(p){
    if(!p?.data)return;
    const root=bossStateRaw(p.boss),bs=bossState(p.boss,p.diff),d=p.data;
    root.favorite=!!d.favorite;root.progress=+d.progress||0;root.note=d.note||'';
    bs.scenes=(safeDeep(d.scenes||[]).length?safeDeep(d.scenes):[blankDifficultyScene(p.boss)]).map((sc,i)=>normalizeScene(sc,p.boss,i));
    bs.timelineV3=safeDeep(d.timelineV3||[]);bs.cooldowns=safeDeep(d.cooldowns||[]);bs.assignments=safeDeep(d.assignments||[]);state.roster=(safeDeep(d.roster||[])).map((x,i)=>normalizeRosterMember(x,i));
    markDifficultyInitialized(p.boss,p.diff);
    const wanted=d.scenarioSource==='raidplan'&&bs.raidPlanScenes?.length?'raidplan':'raidru';setScenarioSourceFor(p.boss,wanted,p.diff);
  }
  function workspaceMakePlan(id,difficulty,name,data){
    const t=nowIso();return {id:uid(),name:name||`${bossName(id)} — ${difficultyLabels[difficulty]}`,boss:id,diff:difficulty,createdAt:t,updatedAt:t,lastOpenedAt:t,data:safeDeep(data||workspaceCapture(id,difficulty)),history:[],lastHistoryAt:0};
  }
  function workspaceEnsureSlot(id,difficulty,{apply=false}={}){
    const ws=workspaceState(),key=SLOT(id,difficulty);let p=workspacePlan(ws.lastPlanBySlot[key]);
    if(!p)p=ws.plans.find(x=>x.boss===id&&x.diff===difficulty)||null;
    if(!p){p=workspaceMakePlan(id,difficulty,`${bossName(id)} — ${difficultyLabels[difficulty]}`,workspaceCapture(id,difficulty));ws.plans.push(p)}
    ws.activeId=p.id;ws.lastPlanBySlot[key]=p.id;p.lastOpenedAt=nowIso();if(apply)workspaceApplyData(p);return p;
  }
  function workspaceInit(){
    const ws=workspaceState();
    if(!ws.migrated){
      // Existing 0.8.x data becomes one editable project per boss in Heroic.
      for(const b of raid){if(!ws.plans.some(p=>p.boss===b.id&&p.diff==='heroic'))ws.plans.push(workspaceMakePlan(b.id,'heroic',`${b.name} — Героический`,workspaceCapture(b.id,'heroic')))}
      ws.migrated=true;
    }
    workspaceEnsureSlot(current,diff,{apply:false});
    localStorage.setItem('raidru-standalone',JSON.stringify(state));
  }
  function workspaceTrimHistory(p){
    p.history=Array.isArray(p.history)?p.history:[];
    while(p.history.length>HISTORY_LIMIT)p.history.shift();
    let size=0;for(let i=p.history.length-1;i>=0;i--){size+=JSON.stringify(p.history[i]).length;if(size>HISTORY_BUDGET){p.history.splice(0,i+1);break}}
  }
  function workspacePushHistory(p,reason,data=p.data){
    if(!p||!data)return;
    const snap={id:uid(),at:nowIso(),reason:reason||'Снимок',data:workspaceHistoryData(data)};
    p.history=p.history||[];p.history.push(snap);p.lastHistoryAt=Date.now();workspaceTrimHistory(p);
  }
  function workspaceCheckpoint(reason='Перед изменением'){
    workspaceFlushSync();const p=workspaceCurrentPlan();if(!p)return;workspacePushHistory(p,reason,workspaceCapture());workspacePersist();
  }
  let syncTimer=null;
  function workspacePersist(){try{localStorage.setItem('raidru-standalone',JSON.stringify(state))}catch(e){console.warn('RaidRU workspace localStorage',e)}}
  function workspaceSyncNow({autoHistory=true}={}){
    const p=workspaceCurrentPlan();if(!p)return;
    const next=workspaceCapture(),prev=p.data||{};let changed=false;
    try{changed=JSON.stringify(prev)!==JSON.stringify(next)}catch(_){changed=true}
    if(!changed)return;
    if(autoHistory&&Date.now()-(p.lastHistoryAt||0)>45000)workspacePushHistory(p,'Автосохранение',prev);
    p.data=safeDeep(next);p.updatedAt=nowIso();workspaceState().lastPlanBySlot[SLOT(current,diff)]=p.id;workspacePersist();
  }
  function workspaceScheduleSync(){clearTimeout(syncTimer);syncTimer=setTimeout(()=>workspaceSyncNow({autoHistory:true}),650)}
  function workspaceFlushSync(){if(syncTimer){clearTimeout(syncTimer);syncTimer=null}workspaceSyncNow({autoHistory:false})}

  function workspaceOpenPlan(id){
    workspaceFlushSync();const ws=workspaceState(),p=workspacePlan(id);if(!p)return;
    current=p.boss;diff=p.diff;ws.activeId=p.id;ws.lastPlanBySlot[SLOT(p.boss,p.diff)]=p.id;p.lastOpenedAt=nowIso();workspaceApplyData(p);
    sceneIndex=0;playerSceneIndex=0;routeTokenId=null;view='planner';coreSave095();render();toast(`Открыт план: ${p.name}`);
  }
  function workspaceNewFromCurrent(){
    workspaceFlushSync();const ws=workspaceState(),def=`${bossName(current)} — ${difficultyLabels[diff]} · вариант ${ws.plans.filter(p=>p.boss===current&&p.diff===diff).length+1}`;
    const name=prompt('Название нового плана',def);if(!name)return;
    const p=workspaceMakePlan(current,diff,name.slice(0,80),workspaceCapture());ws.plans.push(p);ws.activeId=p.id;ws.lastPlanBySlot[SLOT(current,diff)]=p.id;workspacePersist();render();toast('Новый план создан');
  }
  function workspaceDuplicatePlan(id){
    workspaceFlushSync();const ws=workspaceState(),src=workspacePlan(id);if(!src)return;const p=workspaceMakePlan(src.boss,src.diff,`${src.name} — копия`,src.data);ws.plans.push(p);ws.activeId=p.id;ws.lastPlanBySlot[SLOT(p.boss,p.diff)]=p.id;workspacePersist();workspaceOpenPlan(p.id);
  }
  function workspaceRenamePlan(id){const p=workspacePlan(id);if(!p)return;const v=prompt('Название плана',p.name);if(!v)return;p.name=v.slice(0,80);p.updatedAt=nowIso();workspacePersist();render()}
  function workspaceDeletePlan(id){
    const ws=workspaceState(),p=workspacePlan(id);if(!p||!confirm(`Удалить план «${p.name}»? Текущие данные босса не удаляются.`))return;const wasActive=ws.activeId===id;
    ws.plans=ws.plans.filter(x=>x.id!==id);for(const [k,v] of Object.entries(ws.lastPlanBySlot))if(v===id)delete ws.lastPlanBySlot[k];if(wasActive)ws.activeId=null;
    if(wasActive)workspaceEnsureSlot(current,diff,{apply:true});else if(!workspaceCurrentPlan())workspaceEnsureSlot(current,diff,{apply:true});workspacePersist();coreSave095();render();
  }
  function workspaceRestoreHistory(planId,snapId){
    const p=workspacePlan(planId),s=p?.history?.find(x=>x.id===snapId);if(!p||!s||!confirm(`Восстановить снимок «${s.reason}» от ${fmtDate(s.at)}?`))return;
    workspaceFlushSync();workspacePushHistory(p,'Перед восстановлением истории',p.data);p.data=safeDeep(s.data);p.updatedAt=nowIso();workspaceState().activeId=p.id;workspaceState().lastPlanBySlot[SLOT(p.boss,p.diff)]=p.id;current=p.boss;diff=p.diff;workspaceApplyData(p);sceneIndex=0;playerSceneIndex=0;workspacePersist();document.getElementById('workspaceHistoryModal')?.remove();view='planner';coreSave095();render();toast('Версия плана восстановлена');
  }
  function workspaceShowHistory(id){
    const p=workspacePlan(id);if(!p)return;document.getElementById('workspaceHistoryModal')?.remove();const wrap=document.createElement('div');wrap.id='workspaceHistoryModal';wrap.className='raidplanModalBackdrop';
    const rows=[...(p.history||[])].reverse().map(s=>`<button class="historyRow095" onclick="workspaceRestoreHistory('${p.id}','${s.id}')"><span><b>${esc(s.reason)}</b><small>${fmtDate(s.at)}</small></span><em>${s.data?.scenes?.length||0} сцен · ${s.data?.timelineV3?.length||0} событий</em></button>`).join('');
    wrap.innerHTML=`<div class="workspaceHistoryModal095"><div class="difficultySwitchHead"><div><small>ИСТОРИЯ ПЛАНА</small><h2>${esc(p.name)}</h2></div><button onclick="document.getElementById('workspaceHistoryModal')?.remove()">×</button></div><p>RaidRU автоматически хранит контрольные точки и снимки перед крупными изменениями.</p><div class="historyList095">${rows||'<div class="empty">История пока пуста.</div>'}</div></div>`;wrap.onclick=e=>{if(e.target===wrap)wrap.remove()};document.body.appendChild(wrap);
  }
  function workspaceDownload(filename,payload){const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();URL.revokeObjectURL(a.href)}
  function workspaceExportPlan(id){const p=workspacePlan(id);if(!p)return;workspaceDownload(`raidru-${p.boss}-${p.diff}-workspace-095.json`,{format:'raidru-workspace-plan',version:WORKSPACE_VERSION,exportedAt:nowIso(),plan:p})}
  function workspaceExportAll(){workspaceFlushSync();workspaceDownload('raidru-workspace-backup-0.9.5.json',{format:'raidru-workspace-backup',version:WORKSPACE_VERSION,exportedAt:nowIso(),plans:workspaceState().plans})}
  function workspaceImportFile(file){if(!file)return;const fr=new FileReader();fr.onload=()=>{try{const raw=JSON.parse(fr.result),arr=raw.format==='raidru-workspace-plan'?[raw.plan]:(raw.format==='raidru-workspace-backup'?raw.plans:null);if(!Array.isArray(arr))throw new Error('Не тот формат');const ws=workspaceState();for(const x of arr){if(!x?.boss||!x?.data)continue;const p={...safeDeep(x),id:uid(),name:`${x.name||bossName(x.boss)} · импорт`,createdAt:nowIso(),updatedAt:nowIso(),lastOpenedAt:nowIso(),history:[]};ws.plans.push(p)}workspacePersist();render();toast(`Импортировано планов: ${arr.length}`)}catch(e){toast('Не удалось импортировать Workspace JSON')}};fr.readAsText(file)}

  function workspaceView(){
    workspaceFlushSync();const ws=workspaceState(),plans=[...ws.plans].sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))),active=workspaceCurrentPlan();
    return `<section class="page workspacePage095"><div class="workspaceHero095"><div><small>RAID WORKSPACE · 0.9.5</small><h2>Мои рейдовые планы</h2><p>Каждый вариант тактики хранится отдельно: сцены, таймлайн, назначения и история изменений.</p></div><div class="workspaceHeroActions095"><button class="primary" onclick="workspaceNewFromCurrent()">＋ Новый из текущего</button><button onclick="setView('replay')">◉ WCL → черновик</button><button onclick="setView('assignments')">◎ Назначения</button><button onclick="workspaceExportAll()">⇩ Резервная копия</button><label class="importBtn">⇧ Импорт Workspace<input type="file" accept="application/json,.json" onchange="workspaceImportFile(this.files[0])"></label></div></div>${active?`<div class="activePlan095"><span>Сейчас редактируется</span><b>${esc(active.name)}</b><em>${difficultyLabels[active.diff]} · ${active.data?.scenes?.length||0} сцен · автосохранение включено</em></div>`:''}<div class="workspaceGrid095">${plans.map(p=>{const b=raid.find(x=>x.id===p.boss),is=p.id===ws.activeId;return `<article class="workspaceCard095 ${is?'active':''}"><div class="workspaceCardMap095">${bossThumbMapHtml(p.boss)}<span>${b?.order||'?'}</span>${is?'<i>АКТИВЕН</i>':''}</div><div class="workspaceCardBody095"><small>${esc(difficultyLabels[p.diff]||p.diff)} · изменён ${fmtDate(p.updatedAt)}</small><h3>${esc(p.name)}</h3><p>${esc(b?.name||p.boss)}</p><div class="workspaceStats095"><span><b>${p.data?.scenes?.length||0}</b> сцен</span><span><b>${p.data?.timelineV3?.length||0}</b> событий</span><span><b>${p.data?.roster?.length||0}</b> игроков</span><span><b>${p.data?.assignments?.length||0}</b> назначений</span><span><b>${p.history?.length||0}</b> версий</span></div><div class="workspaceActions095"><button class="primary" onclick="workspaceOpenPlan('${p.id}')">Открыть</button><button onclick="workspaceDuplicatePlan('${p.id}')">Дублировать</button><button onclick="workspaceShowHistory('${p.id}')">История</button><button onclick="workspaceRenamePlan('${p.id}')">Переименовать</button><button onclick="workspaceExportPlan('${p.id}')">Экспорт</button><button class="red" onclick="workspaceDeletePlan('${p.id}')">Удалить</button></div></div></article>`}).join('')}</div></section>`;
  }

  const assignmentTypes={healcd:'Хил-КД',defensive:'Личный / внешний сейв',soak:'Soak / группа',interrupt:'Кик / контроль',utility:'Утилити',bloodlust:'Героизм',custom:'Другое'};
  function assignmentsState(){const bs=bossState(current,diff);if(!Array.isArray(bs.assignments))bs.assignments=[];return bs.assignments}
  function addAssignment(){workspaceCheckpoint('Перед добавлением назначения');const bs=scenarioState(current),e=bs.timelineV3[Math.min(bs.timelineV3.length-1,0)]||null,r=rosterState()[0];assignmentsState().push({id:uid(),eventId:e?.id||'',time:+e?.time||0,playerId:r?.id||'',playerName:r?.name||'Весь рейд',kind:'healcd',label:'Новый КД / назначение',note:''});save();render()}
  function editAssignment(i,k,v){const a=assignmentsState()[i];if(!a)return;if(k==='eventId'){a.eventId=v;const e=scenarioState(current).timelineV3.find(x=>x.id===v);if(e)a.time=+e.time||0}else if(k==='time'){const p=parseTime(v);if(Number.isFinite(p))a.time=p}else a[k]=v;save();render()}
  function removeAssignment(i){workspaceCheckpoint('Перед удалением назначения');assignmentsState().splice(i,1);save();render()}
  function assignmentEvent(a,events){return events.find(e=>e.id===a.eventId)||events.reduce((best,e)=>Math.abs(e.time-a.time)<Math.abs((best?.time??Infinity)-a.time)?e:best,null)}
  function assignmentsView(b,bs){
    const arr=assignmentsState(),events=[...scenarioState(current).timelineV3].sort((a,b)=>a.time-b.time),roster=rosterState();
    return `<section class="page assignmentsPage095">${scenarioTabsHtml(b.id)}<div class="assignHead095"><div><small>0.9.3 · РАСПРЕДЕЛЕНИЯ</small><h2>Назначения и рейдовые КД</h2><p>Привязывай игроков, soak-группы, сейвы и хил-КД к конкретным событиям таймлайна.</p></div><button class="primary" onclick="addAssignment()">＋ Назначение</button></div><div class="assignmentList095">${arr.length?arr.map((a,i)=>{const ev=assignmentEvent(a,events);return `<article class="assignmentRow095"><time>${fmtTime((ev?.time ?? a.time ?? 0))}</time><select onchange="editAssignment(${i},'eventId',this.value)"><option value="">Без события</option>${events.map(e=>`<option value="${e.id}" ${a.eventId===e.id?'selected':''}>${fmtTime(e.time)} · ${esc(e.label)}</option>`).join('')}</select><select onchange="editAssignment(${i},'playerName',this.value)"><option value="Весь рейд" ${a.playerName==='Весь рейд'?'selected':''}>Весь рейд</option>${roster.map(r=>`<option value="${esc(r.name)}" ${a.playerName===r.name?'selected':''}>${esc(r.name)}</option>`).join('')}</select><select onchange="editAssignment(${i},'kind',this.value)">${Object.entries(assignmentTypes).map(([k,v])=>`<option value="${k}" ${a.kind===k?'selected':''}>${v}</option>`).join('')}</select><input value="${esc(a.label||'')}" onchange="editAssignment(${i},'label',this.value)" placeholder="Например: Божественный гимн"><input value="${esc(a.note||'')}" onchange="editAssignment(${i},'note',this.value)" placeholder="Примечание"><button class="red" onclick="removeAssignment(${i})">×</button></article>`}).join(''):'<div class="empty assignmentEmpty095"><b>Назначений пока нет</b><p>Добавь первый хил-КД, soak, сейв или персональное задание.</p></div>'}</div></section>`;
  }
  function assignmentBadgesForEvent(e){return assignmentsState().filter(a=>a.eventId===e.id||(!a.eventId&&Math.abs((+a.time||0)-(+e.time||0))<1)).map(a=>`<span class="assignBadge095 ${a.kind||'custom'}">${esc(a.playerName||'Рейд')}: ${esc(a.label||assignmentTypes[a.kind]||'Назначение')}</span>`).join('')}
  function timelineJump095(i){const e=scenarioState(current).timelineV3[i];if(!e)return;playerSceneIndex=Math.max(0,+e.scene||0);sceneIndex=playerSceneIndex;view='player';render()}
  function timelineVisual095(bs){
    const ev=[...bs.timelineV3].sort((a,b)=>a.time-b.time),max=Math.max(60,...ev.map(e=>+e.time||0));const ticks=[];for(let t=0;t<=max;t+=Math.max(30,Math.ceil(max/8/30)*30))ticks.push(t);
    return `<div class="timelineBoard095"><div class="timelineBoardHead095"><div><small>ВИЗУАЛЬНЫЙ ТАЙМЛАЙН</small><b>${fmtTime(max)} длительность</b></div><button onclick="setView('assignments')">Назначения →</button></div><div class="timelineScale095">${ticks.map(t=>`<span style="left:${t/max*100}%">${fmtTime(t)}</span>`).join('')}<i class="timelineTrack095"></i>${ev.map((e,i)=>`<button class="timelineDot095 ${e.type}" style="left:${Math.max(0,Math.min(100,e.time/max*100))}%" onclick="timelineJump095(${bs.timelineV3.indexOf(e)})" title="${fmtTime(e.time)} · ${esc(e.label)}"><b>${fmtTime(e.time)}</b><span>${esc(e.label)}</span></button>`).join('')}</div></div>`;
  }

  function presentationAssignments(){
    const bs=scenarioState(current),events=bs.timelineV3.filter(e=>e.scene===playerSceneIndex),ids=new Set(events.map(e=>e.id)),arr=assignmentsState().filter(a=>ids.has(a.eventId)||events.some(e=>Math.abs((+a.time||0)-(+e.time||0))<1));
    return arr.length?`<div class="presentationAssignments095"><b>Назначения этого кадра</b>${arr.map(a=>`<span class="${a.kind||'custom'}"><strong>${esc(a.playerName||'Рейд')}</strong>${esc(a.label||assignmentTypes[a.kind]||'Назначение')}</span>`).join('')}</div>`:'';
  }
  function togglePresentationMode(){const root=document.documentElement;if(!document.fullscreenElement){root.requestFullscreen?.().catch(()=>{});document.body.classList.add('raidruPresentation095')}else{document.exitFullscreen?.();document.body.classList.remove('raidruPresentation095')}}

  function replayBoss095(raw){
    const wclId=+(raw?.source?.bossId||raw?.fight?.bossId||0);if(!wclId)return null;
    const hit=Object.entries(NSRT_VOICE_PROFILES||{}).find(([,p])=>+p.encounterId===wclId||(+p.encounterId+50000)===wclId);
    return hit?.[0]||null;
  }
  function knownSpellText(){const m=new Map();for(const p of Object.values(NSRT_VOICE_PROFILES||{}))for(const e of p.events||[])if(e.spellId&&e.text)m.set(+e.spellId,e.text);return m}
  function inferPlayerTracks095(raw,friendly){
    const counts=new Map();
    for(const p of raw.positions||[]){const k=String(p.actorId);if(friendly.size&&!friendly.has(k))continue;counts.set(k,(counts.get(k)||0)+1)}
    const ranked=[...counts.entries()].sort((a,b)=>b[1]-a[1]);if(!ranked.length)return [];
    // Browser Replay intentionally has no actor metadata. Pets/summons have much shorter
    // position tracks, so use the strongest natural gap in sustained tracks as the raid cutoff.
    let inferred=Math.min(30,ranked.length),bestRatio=1;
    for(let i=7;i<Math.min(29,ranked.length-1);i++){
      const ratio=ranked[i][1]/Math.max(1,ranked[i+1][1]);
      if(ratio>=1.65&&ratio>bestRatio){bestRatio=ratio;inferred=i+1}
    }
    const rosterCount=rosterState().length;
    const wanted=Math.max(1,Math.min(ranked.length,rosterCount?Math.min(rosterCount,inferred):inferred));
    return ranked.slice(0,wanted).map(x=>x[0]).sort((a,b)=>(+a||0)-(+b||0));
  }
  function normalizeBrowserReplay095(raw){
    const spellText=knownSpellText(),timeline=Array.isArray(raw.timeline)?raw.timeline:[],friendly=new Set();
    for(const e of timeline){if(e.sourceIsFriendly===true&&e.sourceID!=null)friendly.add(String(e.sourceID));if(e.targetIsFriendly===true&&e.targetID!=null)friendly.add(String(e.targetID))}
    const selectedIds=inferPlayerTracks095(raw,friendly),selected=new Set(selectedIds),roster=rosterState();
    const actors=selectedIds.map((id,i)=>{const r=roster[i];return {id:+id||id,name:r?.name||`Игрок ${i+1}`,type:'Player',role:r?.role==='tank'?'tank':r?.role==='healer'?'healer':(r?.range==='melee'?'melee':'ranged'),classKey:r?.classKey||'',sourceActorId:+id||id}});
    const positions=(raw.positions||[]).filter(p=>selected.has(String(p.actorId))).map(p=>({actorId:p.actorId,t:+p.t||0,x:+p.x,y:+p.y,alive:p.alive!==false,mapID:p.mapID})).filter(p=>p.actorId!=null&&Number.isFinite(p.x)&&Number.isFinite(p.y)).sort((a,b)=>a.t-b.t);
    const mechanics=[],lastByKey=new Map();
    for(const e of timeline){
      if(e.sourceIsFriendly!==false||!['cast','begincast'].includes(e.type)||!e.abilityName||+e.abilityID===1)continue;
      const key=String(e.abilityID||e.abilityName),t=+e.t||0;if(t-(lastByKey.get(key)||-1e9)<2500)continue;lastByKey.set(key,t);
      const major=spellText.has(+e.abilityID);mechanics.push({t,type:e.type,label:spellText.get(+e.abilityID)||e.abilityName,abilityID:e.abilityID||null,sourceID:e.sourceID,targetID:e.targetID,major});
    }
    const duration=+(raw.time?.duration||0)||Math.max(1,...positions.map(p=>p.t),...mechanics.map(e=>e.t));
    return {sourceBrowser:true,source:raw.source||{},report:{code:raw.source?.reportCode||'',title:'WCL Browser Replay'},fight:{name:bossName(current),duration,bossId:raw.source?.bossId||null},actors,positions,events:mechanics,duration,mapIDs:raw.mapIDs||[],normalizedPercent:false,coordinateSemantics:raw.coordinateSemantics||null,stats:{...(raw.stats||{}),playerTracks:actors.length}};
  }
  function draftMoments095(d){
    const src=(d.events||[]).filter(e=>e.major),ev=(src.length?src:(d.events||[])).slice().sort((a,b)=>a.t-b.t);
    const out=[{id:uid(),time:0,label:'Пул / стартовая позиция',type:'phase',scene:0,note:'WCL'}];let last=0;
    for(const e of ev){const sec=e.t/1000;if(sec<8||sec-last<22)continue;out.push({id:uid(),time:sec,label:e.label,type:'move',scene:out.length,note:'WCL'});last=sec;if(out.length>=12)break}
    if(out.length<3){const duration=replayDuration(d),step=Math.max(30000,duration/8);for(let t=step;t<duration&&out.length<9;t+=step)out.push({id:uid(),time:t/1000,label:`Ключевой кадр ${out.length+1}`,type:'move',scene:out.length,note:'WCL'})}
    return out;
  }
  function wclTimeline095(d,moments){
    const src=(d.events||[]).filter(e=>e.major),events=(src.length?src:(d.events||[])).slice().sort((a,b)=>a.t-b.t);
    return events.map(e=>{const time=e.t/1000;let scene=0,dist=Infinity;moments.forEach((m,i)=>{const x=Math.abs(m.time-time);if(x<dist){dist=x;scene=i}});return {id:uid(),time,label:e.label,type:/зарыться|героизм|бурст/i.test(e.label)?'burst':/увечье|камнелом|трапез/i.test(e.label)?'raid':'move',scene,note:`WCL · spell ${e.abilityID||'—'}`}});
  }
  function createDraftFromReplay095(){
    const r=replayState(),d=r.data;if(!d?.positions?.length)return toast('Сначала импортируй WCL replay JSON');const actors=replayActors(d);if(!actors.length)return toast('Не удалось определить игроков в replay');
    workspaceFlushSync();const base=bossPresetScenes(current),moments=draftMoments095(d),newScenes=[];
    for(let i=0;i<moments.length;i++){
      const e=moments[i],template=deep(base[Math.min(i,base.length-1)]||base[0]||defaultScene()),t=e.time*1000;
      const staticTokens=(template.tokens||[]).filter(x=>['marker','boss'].includes(x[2]));
      const playerTokens=actors.map(a=>{const p=positionAt(d,a.id,t);if(!p)return null;const q=d.normalizedPercent?{x:p.x,y:p.y}:replayPoint(d,p.x,p.y),rt=replayRole(a),ck=a.classKey||detectClassKey(a.subType||a.class||'');return [`wcl-${a.id}`,shortActorName(a.name),rt,q.x,q.y,{kind:'roster',rosterId:`wcl-${a.id}`,classKey:ck,role:rt==='tank'?'tank':rt==='healer'?'healer':'dps',range:rt==='melee'?'melee':'ranged'}]}).filter(Boolean);
      template.name=`${fmtTime(e.time)} · ${e.label}`;template.note=`WCL-черновик: реальные позиции рейда в ${fmtTime(e.time)}. Кадр создан автоматически и полностью редактируется.`;template.tokens=[...staticTokens,...playerTokens];template.routes={};newScenes.push(normalizeScene(template,current,i));
    }
    const draft=workspaceCapture();draft.scenes=newScenes;draft.timelineV3=wclTimeline095(d,moments);draft.cooldowns=[];draft.assignments=[];draft.scenarioSource='raidru';
    const ws=workspaceState(),code=d.source?.reportCode||d.report?.code||'replay',p=workspaceMakePlan(current,diff,`${bossName(current)} — WCL ${code}`,draft);workspacePushHistory(p,'Создано из WCL Browser Replay',draft);ws.plans.push(p);ws.activeId=p.id;ws.lastPlanBySlot[SLOT(current,diff)]=p.id;workspaceApplyData(p);sceneIndex=0;playerSceneIndex=0;routeTokenId=null;view='planner';workspacePersist();coreSave095();render();toast(`WCL → новый план: ${newScenes.length} ключевых сцен`);
  }
  function wclDraftSummary095(d){if(!d)return '';const moments=draftMoments095(d);return `<div class="wclDraftSummary095"><div><small>АВТО-ЧЕРНОВИК</small><b>${moments.length} ключевых кадров</b><span>${replayActors(d).length} игроков · ${d.positions.length.toLocaleString('ru-RU')} точек позиций</span></div><div>${moments.map(m=>`<span>${fmtTime(m.time)} · ${esc(m.label)}</span>`).join('')}</div></div>`}

  // Keep references to 0.8 core, then extend it without touching RaidPlan geometry code.
  const coreSave095=save,coreContent095=content,coreRender095=render,coreTimeline095=timeline,coreReplayView095=replayView,coreNormalizeReplay095=normalizeReplayPayload,coreCreateReplayPlan095=createPlanFromReplay,coreChooseBoss095=chooseBoss,coreOpenBoss095=openBoss,coreApplyDifficulty095=applyDifficultySwitch,corePlayer095=player,coreImportReplayJson095=importReplayJson,coreImportPlanFile095=importPlanFile;

  save=function(){coreSave095();workspaceScheduleSync()};
  content=function(b,bs){if(view==='workspace')return workspaceView();if(view==='assignments')return assignmentsView(b,scenarioState(b.id));return coreContent095(b,bs)};
  timeline=function(b,bs){
    return `<section class="page timelineEditor timeline095">${scenarioTabsHtml(b.id)}${rolebar()}${timelineVisual095(bs)}<div class="timelineActions"><button onclick="addTimelineEvent()">＋ Событие</button><button onclick="resetTimeline()">↻ Из шаблона</button><button onclick="setView('assignments')">◎ Назначения</button><button onclick="setView('player')">▶ Проигрыватель</button><span>Событие привязано к сцене; назначения отображаются прямо под ним.</span></div><div class="timeline">${bs.timelineV3.map((e,i)=>`<article class="event editEvent ${e.type}"><input value="${fmtTime(e.time)}" onchange="editTimeline(${i},'time',this.value)" aria-label="Время"><input value="${esc(e.label)}" onchange="editTimeline(${i},'label',this.value)" aria-label="Событие"><select onchange="editTimeline(${i},'type',this.value)">${Object.keys(eventTypes).map(t=>`<option value="${t}" ${e.type===t?'selected':''}>${eventTypes[t]}</option>`).join('')}</select><select onchange="editTimeline(${i},'scene',this.value)">${bs.scenes.map((s,j)=>`<option value="${j}" ${e.scene===j?'selected':''}>${j+1}. ${esc(s.name)}</option>`).join('')}</select><button onclick="moveTimeline(${i},-1)">↑</button><button onclick="moveTimeline(${i},1)">↓</button><button class="red" onclick="removeTimeline(${i})">×</button><div class="timelineAssignments095">${assignmentBadgesForEvent(e)||'<span class="muted095">назначений нет</span>'}</div></article>`).join('')}</div></section>`;
  };
  player=function(b,bs){return corePlayer095(b,bs)};
  normalizeReplayPayload=function(raw){if(raw?.format==='raidru-wcl-replay-browser'||(raw?.positionsByActor&&raw?.timeline&&raw?.time))return normalizeBrowserReplay095(raw);return coreNormalizeReplay095(raw)};
  importReplayJson=function(file){
    if(!file)return;const fr=new FileReader();fr.onload=()=>{try{const raw=JSON.parse(fr.result),detected=replayBoss095(raw);workspaceFlushSync();if(detected&&detected!==current){current=detected;sceneIndex=0;playerSceneIndex=0;workspaceEnsureSlot(current,diff,{apply:true})}const r=replayState();if(raw?.format==='raidru-wcl-replay-browser'){window.__raidruExactReplay208=raw;try{window.clearWclMechanics209?.()}catch(_){}}r.data=normalizeReplayPayload(raw);r.source='json';replayClock=0;autoCalibrateReplay();coreSave095();render();toast(`WCL Replay загружен${detected?' · '+bossName(detected):''}`)}catch(e){console.warn(e);toast('Не удалось прочитать replay JSON')}};fr.readAsText(file)
  };
  createPlanFromReplay=function(){return createDraftFromReplay095()};
  importPlanFile=function(file){
    if(!file)return;const r=new FileReader();r.onload=()=>{try{
      const q=JSON.parse(r.result);if(!q.boss||!q.data)throw new Error('bad plan');workspaceFlushSync();
      const d=['normal','heroic','mythic'].includes(q.diff)?q.diff:'heroic',root=bossStateRaw(q.boss);root.favorite=!!q.data.favorite;root.progress=+q.data.progress||0;root.note=q.data.note||root.note||'';
      const plan={_initialized:true,scenes:deep(q.data.scenes||[]),timelineV3:deep(q.data.timelineV3||[]),cooldowns:deep(q.data.cooldowns||[]),assignments:deep(q.data.assignments||[]),raidPlanScenes:deep(q.data.raidPlanScenes||[]),raidPlanTimelineV3:deep(q.data.raidPlanTimelineV3||[]),raidPlanImport:deep(q.data.raidPlanImport||{})};
      replaceDifficultyPlan(q.boss,d,plan);current=q.boss;diff=d;role=q.role||role;setScenarioSourceFor(current,plan.raidPlanScenes?.length?'raidplan':'raidru',diff);sceneIndex=0;playerSceneIndex=0;
      const ws=workspaceState(),p=workspaceMakePlan(current,diff,`${bossName(current)} — импорт`,workspaceCapture());ws.plans.push(p);ws.activeId=p.id;ws.lastPlanBySlot[SLOT(current,diff)]=p.id;workspacePersist();coreSave095();render();toast(`Стратегия импортирована как новый план · ${difficultyLabels[diff]}`);
    }catch(e){console.warn(e);toast('Не удалось импортировать JSON')}};r.readAsText(file)
  };
  replayView=function(b,bs){const d=replayState().data;let html=coreReplayView095(b,bs).replace('Replay — экспериментальный локальный инструмент','WCL → черновик сцен').replace('Replay оставлен только как внутренний локальный инструмент. Для проверки можно импортировать ранее сохранённый replay JSON; основной продукт — планировщик.','Импортируй RaidRU WCL Browser Replay JSON. RaidRU возьмёт реальные позиции рейда и создаст несколько ключевых редактируемых кадров вместо сотен сырых событий.').replace('✦ Создать план из replay','✦ Создать WCL-черновик').replace('Сетевой импорт WCL в этой сборке отключён.','Сетевой запрос к Warcraft Logs не нужен: используется локальный Browser Replay JSON.');return `<section class="wclIntro095"><small>0.9.4 · WCL DRAFT</small><h2>Реальный бой → редактируемая тактика</h2><p>Координаты остаются локальными в браузере. Исходный replay не публикуется.</p>${wclDraftSummary095(d)}</section>${html}`};
  chooseBoss=function(id){workspaceFlushSync();coreChooseBoss095(id);workspaceEnsureSlot(current,diff,{apply:true});coreSave095();render()};
  openBoss=function(id){workspaceFlushSync();coreOpenBoss095(id);workspaceEnsureSlot(current,diff,{apply:true});coreSave095();render()};
  applyDifficultySwitch=function(mode){
    workspaceFlushSync();const before=diff;coreApplyDifficulty095(mode);if(diff===before)return;
    // The core switch already applied the user's choice (existing/copy/clear). Preserve that
    // exact result as the active Workspace variant instead of overwriting it with an older plan.
    const ws=workspaceState(),key=SLOT(current,diff);let p=workspacePlan(ws.lastPlanBySlot[key]);
    if(!p){p=workspaceMakePlan(current,diff,`${bossName(current)} — ${difficultyLabels[diff]}`,workspaceCapture());ws.plans.push(p)}
    else if(mode!=='existing'){workspacePushHistory(p,`Перед сменой сложности: ${mode==='copy'?'копирование':'очистка'}`,p.data);p.data=workspaceCapture();p.updatedAt=nowIso()}
    ws.activeId=p.id;ws.lastPlanBySlot[key]=p.id;if(mode==='existing')workspaceApplyData(p);workspacePersist();coreSave095();render();
  };

  // History checkpoints around destructive/high-impact operations.
  const coreDelScene095=delScene,coreResetScene095=resetScene,coreResetTimeline095=resetTimeline,coreLoadPreset095=loadBossPreset,coreRaidPlanApplyRaw095=raidPlanApplyRaw;
  delScene=function(){workspaceCheckpoint('Перед удалением сцены');return coreDelScene095()};
  resetScene=function(){workspaceCheckpoint('Перед сбросом сцены');return coreResetScene095()};
  resetTimeline=function(){workspaceCheckpoint('Перед пересозданием таймлайна');return coreResetTimeline095()};
  loadBossPreset=function(){workspaceCheckpoint('Перед загрузкой шаблона босса');return coreLoadPreset095()};
  raidPlanApplyRaw=async function(raw,ctx={}){workspaceCheckpoint('Перед импортом RaidPlan');const result=await coreRaidPlanApplyRaw095(raw,ctx);workspaceEnsureSlot(current,diff,{apply:false});workspaceSyncNow({autoHistory:false});return result};

  function decorate095(){
    const header=document.querySelector('main > header');if(header&&!header.querySelector('[data-workspace095]')){
      header.insertAdjacentHTML('afterbegin',`<button data-workspace095 class="workspaceNav095 ${view==='workspace'?'on':''}" onclick="setView('workspace')">▦ Мои планы</button>`);
      // Keep autosave state inside the flexible spacer. It may shrink/clip there,
      // but it must never steal width from navigation and make header buttons wrap.
      const spacer=header.querySelector(':scope > span');const p=workspaceCurrentPlan();if(spacer&&p)spacer.insertAdjacentHTML('afterbegin',`<div class="workspaceStatus095" title="Автосохранение Workspace · ${esc(p.name)}"><i></i><span>${esc(p.name)}</span><small>сохранено</small></div>`);
    }
    const version=document.querySelector('aside .version');if(version)version.textContent='RaidRU 0.9.5 · Raid Workspace + WCL Draft';
    if(view==='player'){
      const bar=document.querySelector('.playerTop > div:last-child');if(bar&&!bar.querySelector('.presentBtn095'))bar.insertAdjacentHTML('beforeend','<button class="presentBtn095" onclick="togglePresentationMode()">⛶ Полный экран</button>');
      const layout=document.querySelector('.playerLayout');if(layout&&!document.querySelector('.presentationAssignments095'))layout.insertAdjacentHTML('beforebegin',presentationAssignments());
    }
  }
  render=function(){coreRender095();decorate095()};

  Object.assign(window,{workspaceOpenPlan,workspaceNewFromCurrent,workspaceDuplicatePlan,workspaceRenamePlan,workspaceDeletePlan,workspaceShowHistory,workspaceRestoreHistory,workspaceExportPlan,workspaceExportAll,workspaceImportFile,addAssignment,editAssignment,removeAssignment,timelineJump095,togglePresentationMode});

  document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)document.body.classList.remove('raidruPresentation095')});
  window.addEventListener('beforeunload',workspaceFlushSync);
  workspaceInit();render();
})();
