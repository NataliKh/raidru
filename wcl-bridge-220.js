/* RaidRU 2.2.1 — Browser WCL Bridge client.
 * Exact Replay coordinates are captured inside the user's WCL browser session.
 * The bridge now resolves player tracks against both fight.friendlyPlayers and
 * report masterData, because production showed that the two actor-id spaces may
 * not always overlap cleanly for composite encounters.
 */
(() => {
  const VERSION='2.2.1';
  const REQUEST='RAIDRU_WCL_BRIDGE_PAGE_REQUEST';
  const RESPONSE='RAIDRU_WCL_BRIDGE_PAGE_RESPONSE';
  const pending=new Map();
  function bridgeCall(action,payload={},timeout=95000){
    return new Promise(resolve=>{
      const requestId=`rr-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const timer=setTimeout(()=>{pending.delete(requestId);resolve({ok:false,error:'WCL_BRIDGE_TIMEOUT'});},timeout);
      pending.set(requestId,{resolve,timer});
      window.postMessage({type:REQUEST,requestId,action,payload},location.origin);
    });
  }
  window.addEventListener('message',e=>{
    if(e.source!==window||e.data?.type!==RESPONSE)return;
    const id=String(e.data.requestId||''),p=pending.get(id);if(!p)return;
    pending.delete(id);clearTimeout(p.timer);p.resolve(e.data.response||{ok:false,error:'WCL_BRIDGE_EMPTY_RESPONSE'});
  });
  const replayNameMap=[
    [/nek.?zali|soulcoiler/i,3470],
    [/entombed sentinels|blood of ula.?tek.*breath of ula.?tek|breath of ula.?tek.*blood of ula.?tek/i,3445],
    [/vashnik/i,3455],[/lost explorers/i,3497],[/sszorak/i,3420],[/twin fangs|vexhul.*ithraz|ithraz.*vexhul/i,3421],[/altar/i,3429]
  ];
  function replayBossId220(f){
    let n=+(f?.replayBossId||f?.bossId||f?.encounterID||f?.originalEncounterID||0)||0;
    if(!n){const hit=replayNameMap.find(([rx])=>rx.test(String(f?.name||'')));n=hit?.[1]||0}
    return n?(n>=50000?n:n+50000):0;
  }
  function unpackPositions220(rows){
    return (rows||[]).map(p=>({actorId:p[0],t:+p[1]||0,x:+p[2],y:+p[3],facing:p[4]==null?null:+p[4],mapID:p[5]==null?null:+p[5],source:p[6]===1?'next':'event'})).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)).sort((a,b)=>a.t-b.t);
  }
  function selectPlayerTracks220(report,fight,positions){
    const counts=new Map();for(const p of positions||[])counts.set(String(p.actorId),(counts.get(String(p.actorId))||0)+1);
    const coordinateIds=new Set(counts.keys());
    const expected=(fight?.friendlyPlayers||[]).map(String).filter(id=>coordinateIds.has(id));
    const byId=new Map((report?.actors||[]).map(a=>[String(a.id),a]));
    const metadataPlayers=[...coordinateIds].filter(id=>String(byId.get(id)?.type||'').toLowerCase()==='player');
    let ids=expected.length?expected:metadataPlayers;
    let mode=expected.length?'fight-friendlyPlayers':(metadataPlayers.length?'masterData-player-fallback':'coordinate-fallback');
    if(!ids.length)ids=[...coordinateIds];
    const size=Math.max(0,+fight?.size||0);
    ids=[...new Set(ids)].sort((a,b)=>(counts.get(b)||0)-(counts.get(a)||0));
    if(size&&ids.length>size)ids=ids.slice(0,size);
    const selected=new Set(ids);
    const actors=ids.map(id=>{const a=byId.get(String(id));return {id:+id||id,name:a?.name||`Игрок ${id}`,type:'Player',subType:a?.subType||'',class:a?.subType||'',role:a?.role||''}});
    return {ids:selected,actors,positions:(positions||[]).filter(p=>selected.has(String(p.actorId))),mode,counts};
  }
  async function wclBridgeStatus220(){
    const r=await bridgeCall('status',{},2500);return r?.ok?r:{ok:false,error:r?.error||'WCL_BRIDGE_NOT_INSTALLED'};
  }
  async function captureWclReplayBridge220(report,fight,pageUrl=''){
    if(!report||!fight)throw new Error('WCL_BRIDGE_FIGHT_META_MISSING');
    const bossId=replayBossId220(fight);if(!bossId)throw new Error('WCL_BRIDGE_BOSS_ID_MISSING');
    const friendly=(fight.friendlyPlayers||[]).map(x=>+x||x).filter(Boolean);if(!friendly.length)throw new Error('WCL_BRIDGE_FRIENDLY_PLAYERS_MISSING');
    const playerActorIds=(report.actors||[]).filter(a=>String(a?.type||'').toLowerCase()==='player').map(a=>+a.id||a.id).filter(Boolean);
    const request={code:report.code,fight:String(fight.id),startTime:+fight.startTime||0,endTime:+fight.endTime||0,replayBossId:bossId,friendlyPlayerIds:friendly,playerActorIds,pageUrl};
    const response=await bridgeCall('capture',request,120000);
    window.__raidruWclBridgeLastResponse221=response;
    if(!response?.ok){
      const d=response?.diagnostics||{};
      const hasDiag=response?.coordinateCandidates!=null||response?.rawEvents!=null;
      const detail=hasDiag?` · raw=${response.rawEvents||0}, candidates=${response.coordinateCandidates||0}, expected=${(d.expectedPlayerIds||[]).length}, knownPlayers=${(d.knownPlayerIds||[]).length}, matched=${(d.matchedExpectedActorIds||[]).length}, observed=${(d.observedFriendlyActorIds||[]).length}`:'';
      throw new Error(`${response?.error||'WCL_BRIDGE_NOT_INSTALLED'}${detail}`);
    }
    const b=response.result,allPositions=unpackPositions220(b?.positions||[]);
    if(!allPositions.length)throw new Error(`WCL_BRIDGE_ZERO_COORDINATES · raw=${b?.stats?.rawEvents||0}, coordinateCandidates=${b?.stats?.coordinateCandidates||0}`);
    const selected=selectPlayerTracks220(report,fight,allPositions);
    if(!selected.positions.length)throw new Error(`WCL_BRIDGE_PLAYER_TRACKS_MISSING · bridgePoints=${allPositions.length}, resolver=${selected.mode}`);
    const actors=selected.actors,positions=selected.positions;
    const timeline=(b.timeline||[]).map(e=>({...e,t:+e.t||0})).sort((a,b)=>(a.t||0)-(b.t||0));
    const mapIDs={};for(const p of positions)if(p.mapID)mapIDs[p.mapID]=(mapIDs[p.mapID]||0)+1;
    return {
      format:'raidru-wcl-replay-browser',version:2,createdAt:new Date().toISOString(),
      source:{pageUrl:`https://www.warcraftlogs.com/reports/${report.code}?fight=${fight.id}&view=replay`,reportCode:report.code,fight:String(fight.id),bossId,capture:'raidru-wcl-browser-bridge',bridgeVersion:response.version||VERSION,segments:b.source?.segments||[],safeImport:true,quality:'exact-browser',rosterResolver:selected.mode,bridgeRosterFallback:!!b.source?.rosterFallback},
      time:{absoluteStart:+fight.startTime||0,absoluteEnd:+fight.endTime||0,duration:Math.max(1,(+fight.endTime||0)-(+fight.startTime||0))},
      coordinateSemantics:b.coordinateSemantics||{resourceActor1:'sourceID',resourceActor2:'targetID',nextXY:'same actor at nextTimestamp'},
      bounds:null,mapIDs,actorIds:actors.map(a=>a.id),
      stats:{...(b.stats||{}),compactPositionPoints:positions.length,playerTracks:actors.length,timelineEvents:timeline.length,fetchMode:'browser-bridge',rosterResolver:selected.mode},
      positions,timeline,actors,
      report:{code:report.code,title:report.title||''},
      fight:{id:fight.id,name:fight.name,bossId,encounterID:fight.encounterID||fight.originalEncounterID||0,startTime:fight.startTime,endTime:fight.endTime,duration:Math.max(1,fight.endTime-fight.startTime),difficulty:fight.difficulty,kill:fight.kill,inProgress:fight.inProgress,size:fight.size||actors.length,friendlyPlayers:friendly},
      partial:false,quality:'exact-browser',cache:'local-browser',message:`Точные координаты и ${timeline.length.toLocaleString('ru-RU')} тактических событий получены локально из Replay Warcraft Logs через RaidRU WCL Bridge.`
    };
  }
  Object.assign(window,{wclBridgeStatus220,captureWclReplayBridge220,replayBossId220,RAIDRU_WCL_BRIDGE_VERSION:VERSION,selectPlayerTracks220});
})();
