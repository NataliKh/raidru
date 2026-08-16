/* RaidRU 2.0 — WCL Safe URL Import
 * Direct Warcraft Logs URL -> cached, quota-aware Worker replay.
 */
(() => {
  const VERSION='2.0.8-wcl-workspace';
  const API=(window.RAIDRU_WCL_API||'https://raidru-raidplan.raidru-wcl.workers.dev').replace(/\/$/,'');
  let ui={state:'idle',message:'',quota:null,report:null,url:'',fight:null,code:null,loops:0,partial:false,quality:null};

  function parseWclUrl200(v){
    const s=String(v||'').trim();
    const m=s.match(/(?:https?:\/\/)?(?:[a-z]{2}\.)?warcraftlogs\.com\/reports\/([A-Za-z0-9_-]+)(?:[^#?]*[?#][^#]*?fight=([A-Za-z0-9_-]+))?/i);
    if(m){const f=String(m[2]||'').toLowerCase();return {code:m[1],fight:f==='last'?'last':(/^\d+$/.test(f)?+f:null)}}
    const plain=s.match(/^([A-Za-z0-9_-]+)(?::(last|\d+))?$/i);if(!plain)return null;
    return {code:plain[1],fight:plain[2]?.toLowerCase()==='last'?'last':(plain[2]?+plain[2]:null)};
  }
  parseWclUrl=parseWclUrl200;

  const qText=q=>q&&q.limitPerHour?`${Math.round(q.pointsSpentThisHour||0)} / ${Math.round(q.limitPerHour)} pts · осталось ${Math.round(q.remaining||0)}`:'';
  const waitText=s=>{s=Math.max(0,Math.ceil(+s||0));const m=Math.ceil(s/60);return m<=1?'меньше минуты':`${m} мин.`};
  const knownSpellMap=()=>{const m=new Map();try{for(const p of Object.values(NSRT_VOICE_PROFILES||{}))for(const e of p.events||[])if(e.spellId&&e.text)m.set(+e.spellId,e.text)}catch(_){}return m};
  function enrichReplay(d){const spells=knownSpellMap();for(const e of d.events||[]){const id=+e.abilityID||0;if(spells.has(id)){e.label=spells.get(id);e.major=true}else e.major=false}return d}
  function bossFromWcl(id){id=+id||0;try{const hit=Object.entries(NSRT_VOICE_PROFILES||{}).find(([,p])=>+p.encounterId===id||(+p.encounterId+50000)===id||(+p.encounterId)===(id-50000));return hit?.[0]||null}catch(_){return null}}

  async function apiJson(path){
    const url=`${API}${path}`;
    try{
      const r=await fetch(url,{method:'GET',mode:'cors',credentials:'omit',headers:{Accept:'application/json'},cache:'no-store'});
      let body={};
      try{body=await r.json()}catch(_){body={error:'invalid_json',message:`Worker вернул не JSON (${r.status}).`}}
      return {status:r.status,ok:r.ok,body,url};
    }catch(err){
      return {status:0,ok:false,url,networkError:true,body:{error:'worker_fetch_failed',message:`Не удалось связаться с RaidRU Worker из ${location.origin}. Проверь /health и CORS.`,detail:String(err?.message||err)}};
    }
  }
  function setUi(state,message,extra={}){ui={...ui,...extra,state,message};decorateReplay200();try{window.decorateWclWorkspace208?.()}catch(_){}}
  function inputValue(){return document.querySelector('#wclUrl200')?.value?.trim()||ui.url||replayState()?.url||''}

  function showFightPicker200(parsed,report){
    document.querySelector('#wclFightPicker200')?.remove();
    const wrap=document.createElement('div');wrap.id='wclFightPicker200';wrap.className='raidplanModalBackdrop wclPickerBackdrop200';
    const fights=(report.fights||[]).slice().sort((a,b)=>b.id-a.id);
    wrap.innerHTML=`<div class="wclPicker200"><div class="difficultySwitchHead"><div><small>WARCRAFT LOGS · ${esc(report.code||parsed.code)}</small><h2>Выбери пул</h2></div><button onclick="document.getElementById('wclFightPicker200')?.remove()">×</button></div><p>${esc(report.title||'Отчёт Warcraft Logs')} · ${fights.length} боёв</p><div class="wclFightList200">${fights.map(f=>`<button onclick="wclPickFight200('${parsed.code}',${f.id})"><span><b>#${f.id} · ${esc(f.name)}</b><small>${f.kill?'✓ убийство':'вайп'} · ${fmtTime(Math.max(0,(f.endTime-f.startTime)/1000))}${f.size?' · '+f.size+' игроков':''}</small></span><em>${f.inProgress?'LIVE':'▶'}</em></button>`).join('')||'<div class="empty">В отчёте нет боёв.</div>'}</div></div>`;
    wrap.onclick=e=>{if(e.target===wrap)wrap.remove()};document.body.appendChild(wrap);
  }

  async function loadReport200(parsed){
    setUi('loading','Проверяю отчёт и безопасный лимит WCL…',{url:inputValue()});
    const res=await apiJson(`/wcl/report?code=${encodeURIComponent(parsed.code)}`);
    if(res.networkError){setUi('error',`${res.body?.message||'Не удалось связаться с Worker'} API: ${res.url}`);return null}
    if(res.status===202){const b=res.body||{};const msg=b.error==='wcl_rate_limited'?`Warcraft Logs вернул 429. Повтори через ${waitText(b.retryAfter)}.`:'WCL API points сейчас исчерпаны почти полностью. Это не искусственный таймер RaidRU.';setUi('paused',msg,{quota:b.quota});return null}
    if(!res.ok){const b=res.body||{};setUi('error',b.error==='wcl_not_configured'?'На Worker ещё не заданы WCL_CLIENT_ID / WCL_CLIENT_SECRET.':`Не удалось открыть отчёт: ${b.message||b.error||res.status}`);return null}
    ui.report=res.body;ui.quota=res.body.quota||ui.quota;return res.body;
  }

  function normalizeExactReplay200(raw){
    if(raw?.format!=='raidru-wcl-replay-browser'||!Array.isArray(raw?.actors)||!raw.actors.length)return normalizeReplayPayload(raw);
    const players=raw.actors.filter(a=>!a?.type||String(a.type).toLowerCase().includes('player'));
    const ids=new Set(players.map(a=>String(a.id)));
    const actors=players.map(a=>({id:a.id,name:a.name||`Игрок ${a.id}`,type:'Player',subType:a.subType||'',class:a.subType||'',role:a.role||''}));
    const positions=(raw.positions||[]).filter(p=>ids.has(String(p.actorId))).map(p=>({actorId:p.actorId,t:+p.t||0,x:+p.x,y:+p.y,alive:p.alive!==false,mapID:p.mapID,source:p.source||''})).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)).sort((a,b)=>a.t-b.t);
    const spells=knownSpellMap(),events=[],last=new Map();
    for(const e of raw.timeline||[]){const type=String(e.type||'').toLowerCase();if(!['cast','begincast'].includes(type)||e.sourceIsFriendly===true)continue;const abilityID=+e.abilityID||+e.abilityGameID||0,t=+e.t||0,key=`${e.sourceID||0}:${abilityID||e.abilityName||''}`;if(t-(last.get(key)||-1e9)<900)continue;last.set(key,t);events.push({t,type,label:spells.get(abilityID)||e.abilityName||`Способность ${abilityID||''}`.trim(),abilityID:abilityID||null,sourceID:e.sourceID??null,targetID:e.targetID??null,major:spells.has(abilityID)})}
    const duration=+(raw.time?.duration||raw.fight?.duration||0)||Math.max(1,...positions.map(p=>p.t),...events.map(e=>e.t));
    return {sourceBrowser:true,source:raw.source||{},report:raw.report||{code:raw.source?.reportCode||'',title:'Warcraft Logs'},fight:{...(raw.fight||{}),name:raw.fight?.name||bossName(current),duration,bossId:raw.source?.bossId||raw.fight?.bossId||null},actors,positions,events,duration,mapIDs:raw.mapIDs||{},normalizedPercent:false,coordinateSemantics:raw.coordinateSemantics||null,stats:{...(raw.stats||{}),playerTracks:actors.length},partial:!!raw.partial,quality:raw.quality||raw.source?.quality||'fast',quota:raw.quota||null};
  }

  async function loadWclFight200(code,fight,mode='smart'){
    let attempts=0;
    while(attempts++<12){
      setUi('loading',attempts===1?'Загружаю быстрый Replay из WCL…':'Продолжаю из сохранённой контрольной точки…',{fight,code,partial:false});
      const res=await apiJson(`/wcl/exact-replay?code=${encodeURIComponent(code)}&fight=${encodeURIComponent(fight)}&mode=${encodeURIComponent(mode)}`),b=res.body||{};
      if(res.networkError){setUi('error',`${b.message||'Не удалось связаться с Worker'} API: ${res.url}`);return}
      if(res.status===202&&b.error==='batch_yield'){
        ui.quota=b.quota||ui.quota;setUi('loading',`Собрано страниц: ${b.pages||0} (из WCL: ${b.fetchedPages||0}). Продолжаю с контрольной точки…`,{quota:ui.quota});await new Promise(r=>setTimeout(r,450));continue;
      }
      if(res.status===202){
        ui.quota=b.quota||ui.quota;
        if(b.error==='wcl_rate_limited'){
          setUi('paused',`Warcraft Logs сам вернул 429. RaidRU не делает повторных запросов. Продолжить через ${waitText(b.retryAfter)}.`,{quota:ui.quota});
        }else if(b.error==='wcl_quota_empty'){
          const q=ui.quota,tail=q&&q.limitPerHour?` Сейчас ${Math.round(q.remaining||0)} points из ${Math.round(q.limitPerHour)}.`:'';
          setUi('paused',`У WCL практически закончились реальные API points.${tail} Это не блокировка RaidRU — уже загруженное остаётся доступно.`,{quota:ui.quota});
        }else{
          setUi('paused',b.message||`WCL временно не может продолжить. Повтори через ${waitText(b.retryAfter)}.`,{quota:ui.quota});
        }
        return;
      }
      if(!res.ok){setUi('error',b.error==='wcl_not_configured'?'Нужно один раз добавить WCL OAuth secrets в Cloudflare Worker.':`WCL: ${b.message||b.error||'ошибка загрузки'}`);return}
      const raw=b,detected=bossFromWcl(raw?.source?.bossId||raw?.fight?.bossId);
      if(detected&&detected!==current)chooseBoss(detected);
      const r=replayState();r.url=ui.url||inputValue();r.source='wcl-url';window.__raidruExactReplay208=raw;r.data=enrichReplay(normalizeExactReplay200(raw));r.mapId=replayPrimaryMapId(r.data);r.mapSource=r.mapId?'wcl':'fallback';replayClock=0;autoCalibrateReplay();save();ui.quota=raw.quota||ui.quota;
      const isPartial=!!raw.partial,quality=raw.quality||raw?.source?.fetchMode||'fast';
      const coverage=Math.round((raw?.stats?.actorCoverage||0)*100);
      const cacheText=raw.message||(raw.cache==='hit'||raw.cache==='legacy-hit'?'Из кэша — WCL API не потрачен.':(isPartial?'Часть боя уже доступна.':'Replay загружен и закэширован.'));
      const qualityText=isPartial?'частичный':(quality==='full'?'полный':'быстрый');
      setUi(isPartial?'partial':'done',`${cacheText} ${qualityText} Replay · ${r.data.actors?.length||0} игроков · ${(r.data.positions?.length||0).toLocaleString('ru-RU')} точек${coverage?` · охват ${coverage}%`:''}${r.mapId?` · WCL mapID ${r.mapId}`:''}.`,{fight,code,partial:isPartial,quality});render();return;
    }
    setUi('error','Загрузка разбита на слишком много порций. Нажми «Продолжить» — уже полученные страницы останутся в кэше.');
  }

  async function loadWclReplay200(){
    const v=inputValue(),parsed=parseWclUrl200(v);ui.url=v;
    if(!parsed){setUi('error','Вставь ссылку вида https://www.warcraftlogs.com/reports/CODE?fight=10');return}
    replayState().url=v;
    if(parsed.fight==='last'){
      const report=await loadReport200(parsed);if(!report)return;const last=(report.fights||[]).slice().sort((a,b)=>b.id-a.id)[0];if(!last){setUi('error','В отчёте нет боёв.');return}return loadWclFight200(parsed.code,last.id);
    }
    if(parsed.fight)return loadWclFight200(parsed.code,parsed.fight);
    const report=await loadReport200(parsed);if(report){setUi('idle','Выбери нужный пул.',{report});showFightPicker200(parsed,report)}
  }
  function wclPickFight200(code,fight){document.querySelector('#wclFightPicker200')?.remove();const base=ui.url||`https://www.warcraftlogs.com/reports/${code}`;ui.url=base.replace(/([?&])fight=[^&#]*/i,'$1fight='+fight)+(base.includes('fight=')?'':(base.includes('?')?'&':'?')+'fight='+fight);loadWclFight200(code,fight)}

  function clearWclReplay200(){
    document.querySelector('#wclFightPicker200')?.remove();
    try{stopReplay()}catch(_){}
    replayClock=0;
    try{replaySelectedActor='all'}catch(_){}
    const r=replayState();
    r.data=null;window.__raidruExactReplay208=null;
    r.source='';
    r.url='';
    r.mapId=null;
    r.mapSource='';
    r.cal=typeof defaultReplayCal==='function'?defaultReplayCal(null,''):{v:2,rot:0,flipX:false,flipY:false,scale:88,offX:0,offY:0};
    ui={state:'idle',message:'',quota:null,report:null,url:'',fight:null,code:null,loops:0,partial:false,quality:null};
    save();
    render();
    requestAnimationFrame(()=>document.querySelector('#wclUrl200')?.focus());
    toast('Replay очищен · можно загрузить новый бой');
  }

  function statusHtml(){
    if(!ui.message&&!ui.quota)return '<span class="wclStatusText200">Обычный импорт: один GraphQL-запрос к WCL за шаг, без отдельных запросов отчёта и квоты. Готовый бой затем берётся из кэша.</span>';
    return `<div class="wclStatus200 ${ui.state}"><i></i><span>${esc(ui.message||'')}</span>${ui.quota?`<small>${esc(qText(ui.quota))}</small>`:''}</div>`;
  }
  function decorateReplay200(){
    if(typeof view==='undefined'||view!=='replay')return;const card=document.querySelector('.replayImport.card');if(!card)return;
    const d=replayState().data,currentUrl=ui.url||replayState().url||'';
    card.innerHTML=`<div class="wclImportHead200"><div><small>RAIDRU 2.0.6 · WCL ONE-SHOT IMPORT</small><h3>Warcraft Logs → Replay</h3><p>Обычная загрузка делает максимум один WCL GraphQL-запрос за нажатие. После просмотра нажми «Новый бой» — текущий Replay очистится, а серверный кэш останется для экономии WCL quota.</p></div><span class="wclSafeBadge200">⚡ 1 запрос / шаг</span></div><div class="wclUrlRow200 ${d||currentUrl?'hasReset':''}"><input id="wclUrl200" value="${esc(currentUrl)}" placeholder="https://www.warcraftlogs.com/reports/…?fight=10" onkeydown="if(event.key==='Enter')loadWclReplay200()"><button class="primary" onclick="loadWclReplay200()">${ui.state==='paused'||ui.state==='partial'?'↻ Продолжить':'▶ Загрузить бой'}</button>${d||currentUrl?'<button class="wclReset200" onclick="clearWclReplay200()">＋ Новый бой</button>':''}</div>${statusHtml()}<div class="replayButtons wclSecondary200"><button onclick="loadDemoReplay()">Демо из плана</button><label class="importBtn">Диагностика: replay JSON<input type="file" accept="application/json,.json" onchange="importReplayJson(this.files[0])"></label>${d?'<button onclick="exportReplayJson()">Экспорт replay JSON</button><button class="rehearse" onclick="createPlanFromReplay()">✦ Создать WCL-черновик</button>':''}${d&&ui.code&&ui.fight&&!ui.partial&&ui.quality!=='full'?`<button title="Не обязательно. Запрашивает более тяжёлый поток WCL." onclick="loadWclFight200('${esc(ui.code)}','${esc(ui.fight)}','full')">Высокая точность</button>`:''}</div>`;
    const empty=document.querySelector('.emptyReplay');if(empty&&!d)empty.innerHTML='<b>Вставь ссылку Warcraft Logs выше</b><p>Если в ссылке нет <code>fight=</code>, RaidRU покажет список пулов из отчёта.</p>';
  }

  const coreRender200=render;
  render=function(){coreRender200();decorateReplay200();const version=document.querySelector('aside .version');if(version)version.textContent='RaidRU 2.0.8 preview · WCL Workspace'};
  loadWclReplay=loadWclReplay200;
  Object.assign(window,{loadWclReplay200,wclPickFight200,loadWclFight200,clearWclReplay200,wclUiState200:()=>ui});
  render();
})();
