/* RaidRU 1.0.1 — UI polish
 * Cleaner application header + readable lane-based visual timeline.
 * Isolated from RaidPlan import geometry and planner canvas code.
 */
(() => {
  const UI_KEY='_ui101';
  function uiState101(){
    if(!state[UI_KEY])state[UI_KEY]={timelineCompact:false,selectedEventId:''};
    return state[UI_KEY];
  }
  function pct101(t,max){return Math.max(0,Math.min(100,(+t||0)/Math.max(1,max)*100))}
  function timelineTicks101(max){
    const rough=max/8;
    const step=rough<=45?30:rough<=90?60:rough<=180?120:180;
    const out=[];for(let t=0;t<=max;t+=step)out.push(t);if(out.at(-1)!==max)out.push(max);return out;
  }
  function laneMeta101(){return [
    {key:'raid',label:'Урон рейду',icon:'♨',types:['raid']},
    {key:'move',label:'Перемещение',icon:'➜',types:['move']},
    {key:'tank',label:'Механика танка',icon:'⬡',types:['tank']},
    {key:'adds',label:'Адды',icon:'☠',types:['adds']},
    {key:'utility',label:'Назначения / КД',icon:'◆',types:['heal','burst']}
  ]}
  function laneColorClass101(type){return ['raid','move','tank','adds','heal','burst'].includes(type)?type:'assign'}
  function trackLayout101(items,max){
    const tracks=[];
    const minGap=Math.max(16,Math.min(46,max/12));
    return items.map(item=>{
      let track=tracks.findIndex(last=>item.time-last>=minGap);
      if(track<0){track=tracks.length;tracks.push(item.time)}else tracks[track]=item.time;
      return {...item,track};
    });
  }
  function eventChip101(e,bs,max){
    const x=pct101(e.time,max),side=x<7?'start':x>93?'end':'mid',idx=bs.timelineV3.findIndex(x=>x.id===e.id),selected=uiState101().selectedEventId===e.id;
    return `<button class="timelineChip101 ${laneColorClass101(e.type)} ${side} ${selected?'selected':''}" data-event-id="${esc(e.id)}" style="--x:${x}%;--track:${e._track||0}" onclick="selectTimelineEvent101('${esc(e.id)}')" ondblclick="timelineJump095(${idx})" title="${fmtTime(e.time)} · ${esc(e.label)} · двойной клик: открыть кадр"><span>${esc(e.label)}</span><time>${fmtTime(e.time)}</time></button>`;
  }
  function assignmentItems101(bs){
    const owner=bossState(current,diff),arr=Array.isArray(owner.assignments)?owner.assignments:[];
    const groups=new Map();
    for(const a of arr){
      const e=bs.timelineV3.find(x=>x.id===a.eventId);const time=+(e?.time ?? a.time ?? 0);
      const key=`${Math.round(time*10)/10}`;if(!groups.has(key))groups.set(key,{time,items:[]});groups.get(key).items.push(a);
    }
    return [...groups.values()].sort((a,b)=>a.time-b.time).map((g,i)=>({id:`assign-${i}-${g.time}`,time:g.time,label:g.items.length===1?`${g.items[0].playerName||'Рейд'} · ${g.items[0].label||'Назначение'}`:`${g.items.length} назначения`,count:g.items.length}));
  }
  function assignmentChip101(a,max){
    const x=pct101(a.time,max),side=x<7?'start':x>93?'end':'mid';
    return `<button class="timelineChip101 assign ${side}" style="--x:${x}%;--track:${a._track||0}" onclick="setView('assignments')" title="${fmtTime(a.time)} · ${esc(a.label)}"><span>${esc(a.label)}</span><time>${fmtTime(a.time)}</time></button>`;
  }
  function timelineVisual101(bs){
    const ev=[...(bs.timelineV3||[])].sort((a,b)=>a.time-b.time),assign=assignmentItems101(bs),max=Math.max(60,...ev.map(e=>+e.time||0),...assign.map(a=>+a.time||0));
    const ui=uiState101();if(ev.length&&!ev.some(e=>e.id===ui.selectedEventId))ui.selectedEventId=ev[0].id;
    const ticks=timelineTicks101(max),selected=ev.find(e=>e.id===ui.selectedEventId)||ev[0]||null,playX=pct101(selected?.time||0,max),compact=!!ui.timelineCompact;
    const laneHtml=laneMeta101().map(l=>{
      const items=trackLayout101(ev.filter(e=>l.types.includes(e.type)),max);items.forEach(x=>x._track=x.track);const tracks=Math.max(1,...items.map(x=>x.track+1));
      return `<div class="timelineLane101 ${compact?'compact':''}" style="--tracks:${tracks}"><div class="timelineLaneLabel101"><i class="${l.key}">${l.icon}</i><span>${l.label}</span></div><div class="timelineLaneTrack101">${ticks.map(t=>`<i class="timelineGrid101" style="left:${pct101(t,max)}%"></i>`).join('')}${items.map(e=>eventChip101(e,bs,max)).join('')}</div></div>`;
    }).join('');
    const assigns=trackLayout101(assign,max);assigns.forEach(x=>x._track=x.track);const aTracks=Math.max(1,...assigns.map(x=>x.track+1));
    const assignLane=`<div class="timelineLane101 assignmentLane101 ${compact?'compact':''}" style="--tracks:${aTracks}"><div class="timelineLaneLabel101"><i class="assign">◆</i><span>Назначения</span></div><div class="timelineLaneTrack101">${ticks.map(t=>`<i class="timelineGrid101" style="left:${pct101(t,max)}%"></i>`).join('')}${assigns.map(a=>assignmentChip101(a,max)).join('')}</div></div>`;
    return `<section class="timelineBoard101 ${compact?'isCompact':''}"><div class="timelineBoardHead101"><div><small>ВИЗУАЛЬНЫЙ ТАЙМЛАЙН</small><b>${fmtTime(max)} <span>длительность</span></b></div><div class="timelineLegend101"><span class="raid"><i></i>Урон</span><span class="move"><i></i>Движение</span><span class="tank"><i></i>Танки</span><span class="adds"><i></i>Адды</span><span class="assign"><i></i>Назначения</span></div><div class="timelineView101"><button class="${compact?'':'on'}" onclick="setTimelineCompact101(false)">Линии</button><button class="${compact?'on':''}" onclick="setTimelineCompact101(true)">Сжатый вид</button><button title="Назначения" onclick="setView('assignments')">◎</button></div></div><div class="timelineCanvas101"><div class="timelineRuler101"><span></span><div>${ticks.map(t=>`<time style="left:${pct101(t,max)}%">${fmtTime(t)}</time>`).join('')}</div></div><div class="timelinePlayhead101" data-playhead style="left:calc(154px + (100% - 154px) * ${playX/100})"><b>${fmtTime(selected?.time||0)}</b></div>${laneHtml}${assignLane}</div><div class="timelineHint101">Один клик — выбрать событие · двойной клик — открыть связанный кадр в проигрывателе</div></section>`;
  }
  function timelineAssignmentBadges101(e){
    const arr=Array.isArray(bossState(current,diff).assignments)?bossState(current,diff).assignments:[];
    const badges=arr.filter(a=>a.eventId===e.id||(!a.eventId&&Math.abs((+a.time||0)-(+e.time||0))<1)).map(a=>`<span class="assignBadge095 ${a.kind||'custom'}">${esc(a.playerName||'Рейд')}: ${esc(a.label||'Назначение')}</span>`).join('');
    return badges||'<span class="muted095">назначений нет</span>';
  }
  function timelineEditorRows101(bs){
    return (bs.timelineV3||[]).map((e,i)=>`<article class="event editEvent timelineEdit101 ${e.type} ${uiState101().selectedEventId===e.id?'selected':''}" data-event-row="${esc(e.id)}"><input value="${fmtTime(e.time)}" onchange="editTimeline(${i},'time',this.value)" aria-label="Время"><input value="${esc(e.label)}" onchange="editTimeline(${i},'label',this.value)" aria-label="Событие"><select onchange="editTimeline(${i},'type',this.value)">${Object.keys(eventTypes).map(t=>`<option value="${t}" ${e.type===t?'selected':''}>${eventTypes[t]}</option>`).join('')}</select><select onchange="editTimeline(${i},'scene',this.value)">${bs.scenes.map((s,j)=>`<option value="${j}" ${e.scene===j?'selected':''}>${j+1}. ${esc(s.name)}</option>`).join('')}</select><button title="Выше" onclick="moveTimeline(${i},-1)">↑</button><button title="Ниже" onclick="moveTimeline(${i},1)">↓</button><button class="red" title="Удалить" onclick="removeTimeline(${i})">×</button><div class="timelineAssignments095">${timelineAssignmentBadges101(e)}</div></article>`).join('');
  }

  const previousTimeline101=timeline;
  timeline=function(b,bs){
    return `<section class="page timelineEditor timeline095 timeline101">${scenarioTabsHtml(b.id)}${rolebar()}${timelineVisual101(bs)}<div class="timelineActions timelineActions101"><button onclick="addTimelineEvent()">＋ Событие</button><button onclick="resetTimeline()">↻ Из шаблона</button><button onclick="setView('assignments')">◎ Назначения</button><button onclick="setView('player')">▶ Проигрыватель</button><span>События разнесены по дорожкам; редактор ниже остаётся источником данных.</span></div><div class="timeline timelineList101">${timelineEditorRows101(bs)}</div></section>`;
  };

  function setTimelineCompact101(v){uiState101().timelineCompact=!!v;save();render()}
  function selectTimelineEvent101(id){
    uiState101().selectedEventId=id;save();const bs=scenarioState(current),e=bs.timelineV3.find(x=>x.id===id);if(!e)return;
    document.querySelectorAll('.timelineChip101.selected,.timelineEdit101.selected').forEach(n=>n.classList.remove('selected'));
    document.querySelector(`.timelineChip101[data-event-id="${CSS.escape(id)}"]`)?.classList.add('selected');
    const row=document.querySelector(`.timelineEdit101[data-event-row="${CSS.escape(id)}"]`);row?.classList.add('selected');
    const all=[...(bs.timelineV3||[])],max=Math.max(60,...all.map(x=>+x.time||0));const play=document.querySelector('.timelinePlayhead101');if(play){play.style.left=`calc(154px + (100% - 154px) * ${pct101(e.time,max)/100})`;const b=play.querySelector('b');if(b)b.textContent=fmtTime(e.time)}
    row?.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  function buildOverflow101(header){
    let menu=header.querySelector('.headerMoreMenu101');if(menu)return menu;
    menu=document.createElement('div');menu.className='headerMoreMenu101';menu.innerHTML='<button type="button" class="headerMoreBtn101" aria-label="Ещё" onclick="toggleHeaderMore101(event)">•••</button><div class="headerDropdown101"></div>';return menu;
  }
  function toggleHeaderMore101(e){e?.stopPropagation();document.querySelector('.headerMoreMenu101')?.classList.toggle('open')}
  document.addEventListener('click',e=>{if(!e.target.closest('.headerMoreMenu101'))document.querySelector('.headerMoreMenu101')?.classList.remove('open')});

  function decorateHeader101(){
    const header=document.querySelector('main > header');if(!header)return;
    header.classList.add('header101');
    let nav=header.querySelector('.headerNav101'),tools=header.querySelector('.headerTools101'),spacer=header.querySelector(':scope > span');
    if(!nav){
      nav=document.createElement('div');nav.className='headerNav101';
      tools=document.createElement('div');tools.className='headerTools101';
      const more=buildOverflow101(header),drop=more.querySelector('.headerDropdown101');
      const nodes=[...header.children];
      const primaryKeys=['dashboard','guide','raidmode','planner','timeline','roster','notes'];
      for(const node of nodes){
        if(node===spacer)continue;
        const oc=node.getAttribute?.('onclick')||'';
        const key=(oc.match(/setView\('([^']+)'\)/)||[])[1];
        if(key&&primaryKeys.includes(key)){nav.appendChild(node);continue}
        if(key&&['workspace','player','glossary','readiness','replay','assignments'].includes(key)){drop.appendChild(node);continue}
        if(node.matches?.('.priest,.raidplanHeaderBtn,.importBtn')||/sharePlan\(|exportPlan\(/.test(oc)){tools.appendChild(node);continue}
        if(node.tagName==='BUTTON'){drop.appendChild(node);continue}
        if(node.classList?.contains('workspaceStatus095'))continue;
      }
      nav.appendChild(more);
      if(!spacer){spacer=document.createElement('span');header.appendChild(spacer)}
      header.insertBefore(nav,spacer);header.appendChild(tools);
    }
    // Workspace decorator may inject the button again on later renders; move it to overflow.
    const drop=header.querySelector('.headerDropdown101');
    [...header.querySelectorAll(':scope > [data-workspace095]')].forEach(x=>drop?.appendChild(x));
    const player=[...header.querySelectorAll('button')].find(x=>x.getAttribute('onclick')?.includes("setView('player')"));if(player&&player.parentElement!==drop)drop?.appendChild(player);
    const glossary=[...header.querySelectorAll('button')].find(x=>x.getAttribute('onclick')?.includes("setView('glossary')"));if(glossary&&glossary.parentElement!==drop)drop?.appendChild(glossary);
    // Compact autosave: no long plan name in the width budget.
    if(spacer){
      const old=spacer.querySelector('.workspaceStatus095');if(old){old.classList.add('workspaceStatus101');const s=old.querySelector('span');if(s)s.textContent='Сохранено';const sm=old.querySelector('small');if(sm)sm.remove()}
    }
    const more=header.querySelector('.headerMoreMenu101');if(more){const anyOn=more.querySelector('.headerDropdown101 .on');more.classList.toggle('hasActive',!!anyOn)}
  }
  function decorateTimeline101(){
    if(view!=='timeline')return;
    const id=uiState101().selectedEventId;if(id)document.querySelector(`.timelineEdit101[data-event-row="${CSS.escape(id)}"]`)?.classList.add('selected');
  }
  const coreRender101=render;
  render=function(){coreRender101();decorateHeader101();decorateTimeline101();const version=document.querySelector('aside .version');if(version)version.textContent='RaidRU 1.0.1 · Raid Ready'};

  Object.assign(window,{setTimelineCompact101,selectTimelineEvent101,toggleHeaderMore101});
  render();
})();
