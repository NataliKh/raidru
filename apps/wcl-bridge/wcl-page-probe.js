(() => {
  const REQUEST='RAIDRU_WCL_PAGE_CAPTURE_REQUEST';
  const RESPONSE='RAIDRU_WCL_PAGE_CAPTURE_RESPONSE';
  const WINDOW_MS=240000;
  const BRIDGE_VERSION='2.2.1';

  const num=v=>{if(v==null||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null};
  const int=v=>{const n=num(v);return n==null?null:Math.trunc(n)};
  const validCode=v=>/^[A-Za-z0-9_-]{6,32}$/.test(String(v||''));
  const rowsOf=body=>Array.isArray(body)?body:(Array.isArray(body?.events)?body.events:(Array.isArray(body?.data)?body.data:null));
  const windows=(start,end)=>{start=Math.round(start);end=Math.round(end);const out=[];for(let s=start,i=1;s<=end;i++){const e=Math.min(end,s+WINDOW_MS-1);out.push({index:i,start:s,end:e});if(e>=end)break;s=e+1}return out};
  const abilityOf=e=>int(e?.abilityGameID??e?.abilityID??e?.ability?.gameID??e?.ability?.guid??e?.ability?.id)||0;

  function ownerOf(e,expected,knownPlayers){
    const source=int(e?.sourceID??e?.source?.id),target=int(e?.targetID??e?.target?.id),r=int(e?.resourceActor);
    const sourceFriendly=e?.sourceIsFriendly===true,targetFriendly=e?.targetIsFriendly===true;
    if(r===1&&source!=null)return {id:source,friendly:sourceFriendly||expected.has(String(source))||knownPlayers.has(String(source)),via:'resourceActor:1'};
    if(r===2&&target!=null)return {id:target,friendly:targetFriendly||expected.has(String(target))||knownPlayers.has(String(target)),via:'resourceActor:2'};
    // Some WCL payload variants omit the discriminator on otherwise valid x/y snapshots.
    // Prefer an expected fight participant when only one endpoint matches.
    const sourceExpected=source!=null&&expected.has(String(source)),targetExpected=target!=null&&expected.has(String(target));
    const sourcePlayer=source!=null&&knownPlayers.has(String(source)),targetPlayer=target!=null&&knownPlayers.has(String(target));
    if(sourceExpected&&!targetExpected)return {id:source,friendly:true,via:'expected-source'};
    if(targetExpected&&!sourceExpected)return {id:target,friendly:true,via:'expected-target'};
    if(sourcePlayer&&!targetPlayer)return {id:source,friendly:true,via:'master-player-source'};
    if(targetPlayer&&!sourcePlayer)return {id:target,friendly:true,via:'master-player-target'};
    // Next safest fallback is the explicit WCL friendliness flags.
    if(sourceFriendly&&!targetFriendly&&source!=null)return {id:source,friendly:true,via:'friendly-source'};
    if(targetFriendly&&!sourceFriendly&&target!=null)return {id:target,friendly:true,via:'friendly-target'};
    if(sourceFriendly&&targetFriendly&&source!=null&&source===target)return {id:source,friendly:true,via:'friendly-self'};
    // Legacy normalized variants sometimes expose the resolved actor id directly.
    const legacy1=int(e?.resourceActor1),legacy2=int(e?.resourceActor2);
    if(legacy1!=null)return {id:legacy1,friendly:expected.has(String(legacy1))||knownPlayers.has(String(legacy1))||sourceFriendly,via:'resourceActor1'};
    if(legacy2!=null)return {id:legacy2,friendly:expected.has(String(legacy2))||knownPlayers.has(String(legacy2))||targetFriendly,via:'resourceActor2'};
    return {id:null,friendly:false,via:'none'};
  }

  function compactTimelineEvent(e,start,expected,knownPlayers){
    const ts=num(e?.timestamp??e?.t);if(ts==null)return null;
    const type=String(e?.type||'').toLowerCase();
    const sourceID=int(e?.sourceID??e?.source?.id),targetID=int(e?.targetID??e?.target?.id);
    const sourceFriendly=e?.sourceIsFriendly===true||(sourceID!=null&&(expected.has(String(sourceID))||knownPlayers.has(String(sourceID))));
    const targetFriendly=e?.targetIsFriendly===true||(targetID!=null&&(expected.has(String(targetID))||knownPlayers.has(String(targetID))));
    let family='';
    if(type==='cast'||type==='begincast')family='casts';
    else if(type.includes('debuff'))family='debuffs';
    else if(type==='summon')family='summons';
    else if(type==='death')family='deaths';
    if(!family)return null;
    const abilityID=abilityOf(e);
    if(family==='casts'&&(sourceFriendly||abilityID===1))return null;
    if(family==='debuffs'&&(sourceFriendly||!targetFriendly))return null;
    if(family==='summons'&&sourceFriendly)return null;
    if(family==='deaths'&&!targetFriendly)return null;
    return {t:Math.max(0,ts-start),type,family,sourceID,targetID,sourceIsFriendly:!!sourceFriendly,targetIsFriendly:!!targetFriendly,abilityID:abilityID||null,abilityName:e?.abilityName||e?.ability?.name||e?.name||(abilityID?`Способность ${abilityID}`:(type==='death'?'Смерть':'Механика')),stack:int(e?.stack)};
  }

  function dedupePoints(points){
    const out=[],seen=new Set();points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    for(const p of points){const k=`${p[0]}:${Math.round(p[1])}:${p[2]}:${p[3]}`;if(seen.has(k))continue;seen.add(k);out.push(p)}return out;
  }
  function dedupeTimeline(events){
    const out=[],seen=new Set();events.sort((a,b)=>(a.t||0)-(b.t||0));
    for(const e of events){const k=[Math.round(e.t||0),e.type||'',e.sourceID||0,e.targetID||0,e.abilityID||0].join(':');if(seen.has(k))continue;seen.add(k);out.push(e)}return out;
  }

  async function fetchSegment(p,seg){
    const path=`/reports/replaysegment/${encodeURIComponent(p.code)}/${p.replayBossId}/${seg.start}/${seg.end}/`;
    const r=await fetch(path,{method:'GET',credentials:'include',cache:'no-store',headers:{Accept:'application/json,text/plain;q=0.9,*/*;q=0.1'}});
    const text=await r.text();
    if(!r.ok)return {ok:false,error:`WCL_REPLAYSEGMENT_HTTP_${r.status}`,status:r.status,contentType:r.headers.get('content-type')||'',sample:text.slice(0,160)};
    let body;try{body=JSON.parse(text)}catch(_){return {ok:false,error:'WCL_REPLAYSEGMENT_INVALID_JSON_BROWSER',status:r.status,contentType:r.headers.get('content-type')||'',sample:text.slice(0,160)}}
    const rows=rowsOf(body);if(!rows)return {ok:false,error:'WCL_REPLAYSEGMENT_EVENTS_MISSING_BROWSER'};
    return {ok:true,rows,path};
  }

  async function capture(p){
    if(!validCode(p.code)||!/^[0-9]+$/.test(String(p.fight||'')))throw new Error('WCL_BRIDGE_BAD_REPORT');
    const start=int(p.startTime),end=int(p.endTime),boss=int(p.replayBossId);
    if(start==null||end==null||end<start||!boss)throw new Error('WCL_BRIDGE_BAD_FIGHT_META');
    const expected=new Set((p.friendlyPlayerIds||[]).map(x=>String(int(x))).filter(x=>x!=='null'));
    const knownPlayers=new Set((p.playerActorIds||[]).map(x=>String(int(x))).filter(x=>x!=='null'));
    if(!expected.size&&!knownPlayers.size)throw new Error('WCL_BRIDGE_NO_PLAYER_IDS');

    const allFriendlyPoints=[],expectedPoints=[],timeline=[],segments=[],mapCounts={},ownerWays={},observedFriendly=new Set(),matchedExpected=new Set();
    let rawEvents=0,coordinateCandidates=0,positionEvents=0,nextPositionEvents=0,expectedPositionEvents=0;
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;

    const addPoint=(bucket,actor,t,x,y,face,mid,src)=>{
      bucket.push([actor,Math.max(0,t-start),x,y,face,mid,src]);
      if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;if(mid)mapCounts[mid]=(mapCounts[mid]||0)+1;
    };

    for(const seg of windows(start,end)){
      const got=await fetchSegment(p,seg);if(!got.ok)return got;
      rawEvents+=got.rows.length;segments.push({index:seg.index,start:seg.start,end:seg.end,events:got.rows.length});
      for(const e of got.rows){
        const mech=compactTimelineEvent(e,start,expected,knownPlayers);if(mech)timeline.push(mech);
        const ts=num(e?.timestamp??e?.t),x=num(e?.x),y=num(e?.y),mid=int(e?.mapID),face=num(e?.facing);
        if(ts==null||x==null||y==null)continue;
        coordinateCandidates++;
        const own=ownerOf(e,expected,knownPlayers);ownerWays[own.via]=(ownerWays[own.via]||0)+1;
        if(own.id==null||!own.friendly)continue;
        observedFriendly.add(String(own.id));
        addPoint(allFriendlyPoints,own.id,ts,x,y,face,mid,0);positionEvents++;
        const isExpected=expected.has(String(own.id));if(isExpected){addPoint(expectedPoints,own.id,ts,x,y,face,mid,0);matchedExpected.add(String(own.id));expectedPositionEvents++}
        const nts=num(e?.nextTimestamp),nx=num(e?.nextX),ny=num(e?.nextY),nf=num(e?.nextFacing??e?.facing);
        if(nts!=null&&nx!=null&&ny!=null){
          addPoint(allFriendlyPoints,own.id,nts,nx,ny,nf,mid,1);nextPositionEvents++;
          if(isExpected)addPoint(expectedPoints,own.id,nts,nx,ny,nf,mid,1);
        }
      }
    }

    // Prefer the official fight roster. If WCL's Replay actor ids and GraphQL roster ids do
    // not overlap (the production failure behind 2.2.0), retain all explicitly-friendly
    // Replay tracks and let the RaidRU client resolve Player actors via masterData.
    const useExpected=expectedPoints.length>0;
    const compact=dedupePoints(useExpected?expectedPoints:allFriendlyPoints);
    const compactTimeline=dedupeTimeline(timeline);
    if(!compact.length)return {ok:false,error:'WCL_BRIDGE_ZERO_COORDINATES',rawEvents,coordinateCandidates,segments,diagnostics:{expectedPlayerIds:[...expected],knownPlayerIds:[...knownPlayers].slice(0,600),observedFriendlyActorIds:[...observedFriendly].slice(0,120),matchedExpectedActorIds:[...matchedExpected],ownerWays}};
    return {ok:true,result:{
      format:'raidru-wcl-bridge-points',version:2,bridgeVersion:BRIDGE_VERSION,
      source:{reportCode:p.code,fight:String(p.fight),bossId:boss,pageUrl:location.href,segments,rosterFallback:!useExpected},
      time:{absoluteStart:start,absoluteEnd:end,duration:Math.max(1,end-start)},
      coordinateSemantics:{resourceActor1:'sourceID',resourceActor2:'targetID',nextXY:'same actor at nextTimestamp',fallback:'WCL friendliness flags / player masterData when fight roster ids do not overlap'},
      bounds:Number.isFinite(minX)?{minX,maxX,minY,maxY}:null,mapIDs:mapCounts,positions:compact,timeline:compactTimeline,
      stats:{rawEvents,coordinateCandidates,positionEvents,nextPositionEvents,expectedPositionEvents,compactPositionPoints:compact.length,segmentCount:segments.length,expectedPlayerCount:expected.size,knownPlayerCount:knownPlayers.size,matchedExpectedActorCount:matchedExpected.size,observedFriendlyActorCount:observedFriendly.size,rosterFallback:!useExpected,ownerWays}
    }};
  }

  window.addEventListener('message',event=>{
    if(event.source!==window||event.data?.type!==REQUEST)return;
    const requestId=String(event.data.requestId||'');if(!requestId)return;
    capture(event.data.payload||{}).then(response=>window.postMessage({type:RESPONSE,requestId,response},location.origin)).catch(err=>window.postMessage({type:RESPONSE,requestId,response:{ok:false,error:String(err?.message||err)}},location.origin));
  });
})();
