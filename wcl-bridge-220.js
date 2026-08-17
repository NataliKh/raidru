/* RaidRU 2.2.0 — Browser WCL Bridge client.
 * Exact Replay coordinates are captured inside the user's WCL browser session.
 * Official GraphQL remains the source for report metadata and mechanics.
 */
(() => {
  const VERSION='2.2.0';
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
  function actors220(report,fight){
    const ids=new Set((fight?.friendlyPlayers||[]).map(String));
    const by=new Map((report?.actors||[]).map(a=>[String(a.id),a]));
    return [...ids].map(id=>{const a=by.get(id);return {id:+id||id,name:a?.name||`Игрок ${id}`,type:'Player',subType:a?.subType||'',class:a?.subType||''}});
  }
  function unpackPositions220(rows){
    return (rows||[]).map(p=>({actorId:p[0],t:+p[1]||0,x:+p[2],y:+p[3],facing:p[4]==null?null:+p[4],mapID:p[5]==null?null:+p[5],source:p[6]===1?'next':'event'})).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)).sort((a,b)=>a.t-b.t);
  }

  async function wclBridgeStatus220(){
    const r=await bridgeCall('status',{},2500);return r?.ok?r:{ok:false,error:r?.error||'WCL_BRIDGE_NOT_INSTALLED'};
  }

  async function captureWclReplayBridge220(report,fight,pageUrl=''){
    if(!report||!fight)throw new Error('WCL_BRIDGE_FIGHT_META_MISSING');
    const bossId=replayBossId220(fight);if(!bossId)throw new Error('WCL_BRIDGE_BOSS_ID_MISSING');
    const friendly=(fight.friendlyPlayers||[]).map(x=>+x||x).filter(Boolean);if(!friendly.length)throw new Error('WCL_BRIDGE_FRIENDLY_PLAYERS_MISSING');
    const request={code:report.code,fight:String(fight.id),startTime:+fight.startTime||0,endTime:+fight.endTime||0,replayBossId:bossId,friendlyPlayerIds:friendly,pageUrl};
    const response=await bridgeCall('capture',request,120000);
    if(!response?.ok)throw new Error(response?.error||'WCL_BRIDGE_NOT_INSTALLED');
    const b=response.result;if(!b?.positions?.length)throw new Error('WCL_BRIDGE_ZERO_COORDINATES');
    const positions=unpackPositions220(b.positions),actors=actors220(report,fight);
    return {
      format:'raidru-wcl-replay-browser',version:2,createdAt:new Date().toISOString(),
      source:{pageUrl:`https://www.warcraftlogs.com/reports/${report.code}?fight=${fight.id}&view=replay`,reportCode:report.code,fight:String(fight.id),bossId,capture:'raidru-wcl-browser-bridge',bridgeVersion:response.version||VERSION,segments:b.source?.segments||[],safeImport:true,quality:'exact-browser'},
      time:{absoluteStart:+fight.startTime||0,absoluteEnd:+fight.endTime||0,duration:Math.max(1,(+fight.endTime||0)-(+fight.startTime||0))},
      coordinateSemantics:b.coordinateSemantics||{resourceActor1:'sourceID',resourceActor2:'targetID',nextXY:'same actor at nextTimestamp'},
      bounds:b.bounds||null,mapIDs:b.mapIDs||{},actorIds:actors.map(a=>a.id),
      stats:{...(b.stats||{}),playerTracks:actors.length,timelineEvents:0,fetchMode:'browser-bridge'},
      positions,timeline:[],actors,
      report:{code:report.code,title:report.title||''},
      fight:{id:fight.id,name:fight.name,bossId,encounterID:fight.encounterID||fight.originalEncounterID||0,startTime:fight.startTime,endTime:fight.endTime,duration:Math.max(1,fight.endTime-fight.startTime),difficulty:fight.difficulty,kill:fight.kill,inProgress:fight.inProgress,size:fight.size||actors.length,friendlyPlayers:friendly},
      partial:false,quality:'exact-browser',cache:'local-browser',message:'Точные координаты получены локально из Replay Warcraft Logs через RaidRU WCL Bridge. Механики загружаются отдельно через официальный WCL API.'
    };
  }

  Object.assign(window,{wclBridgeStatus220,captureWclReplayBridge220,replayBossId220,RAIDRU_WCL_BRIDGE_VERSION:VERSION});
})();
