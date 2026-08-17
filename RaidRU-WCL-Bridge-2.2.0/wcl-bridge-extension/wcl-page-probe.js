(() => {
  const REQUEST='RAIDRU_WCL_PAGE_CAPTURE_REQUEST';
  const RESPONSE='RAIDRU_WCL_PAGE_CAPTURE_RESPONSE';
  const WINDOW_MS=240000;

  const num=v=>{if(v==null||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null};
  const int=v=>{const n=num(v);return n==null?null:Math.trunc(n)};
  const validCode=v=>/^[A-Za-z0-9_-]{6,32}$/.test(String(v||''));
  const actorOf=e=>{
    const r=int(e?.resourceActor);
    if(r===1)return int(e?.sourceID??e?.source?.id);
    if(r===2)return int(e?.targetID??e?.target?.id);
    if(e?.resourceActor1!=null)return int(e.resourceActor1);
    if(e?.resourceActor2!=null)return int(e.resourceActor2);
    return null;
  };
  const rowsOf=body=>Array.isArray(body)?body:(Array.isArray(body?.events)?body.events:(Array.isArray(body?.data)?body.data:null));
  const windows=(start,end)=>{
    start=Math.round(start);end=Math.round(end);const out=[];
    for(let s=start,i=1;s<=end;i++){
      const e=Math.min(end,s+WINDOW_MS-1);out.push({index:i,start:s,end:e});if(e>=end)break;s=e+1;
    }
    return out;
  };
  function dedupe(points){
    const out=[],seen=new Set();
    points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    for(const p of points){const k=`${p[0]}:${Math.round(p[1])}:${p[2]}:${p[3]}`;if(seen.has(k))continue;seen.add(k);out.push(p)}
    return out;
  }

  async function fetchSegment(p,seg){
    const path=`/reports/replaysegment/${encodeURIComponent(p.code)}/${p.replayBossId}/${seg.start}/${seg.end}/`;
    const r=await fetch(path,{method:'GET',credentials:'include',cache:'no-store',headers:{Accept:'application/json,text/plain;q=0.9,*/*;q=0.1'}});
    const text=await r.text();
    if(!r.ok)return {ok:false,error:`WCL_REPLAYSEGMENT_HTTP_${r.status}`,status:r.status,contentType:r.headers.get('content-type')||'',sample:text.slice(0,120)};
    let body;try{body=JSON.parse(text)}catch(_){return {ok:false,error:'WCL_REPLAYSEGMENT_INVALID_JSON_BROWSER',status:r.status,contentType:r.headers.get('content-type')||'',sample:text.slice(0,120)}}
    const rows=rowsOf(body);if(!rows)return {ok:false,error:'WCL_REPLAYSEGMENT_EVENTS_MISSING_BROWSER'};
    return {ok:true,rows,path};
  }

  async function capture(p){
    if(!validCode(p.code)||!/^\d+$/.test(String(p.fight||'')))throw new Error('WCL_BRIDGE_BAD_REPORT');
    const start=int(p.startTime),end=int(p.endTime),boss=int(p.replayBossId);
    if(start==null||end==null||end<start||!boss)throw new Error('WCL_BRIDGE_BAD_FIGHT_META');
    const friendly=new Set((p.friendlyPlayerIds||[]).map(x=>String(int(x))).filter(x=>x!=='null'));
    if(!friendly.size)throw new Error('WCL_BRIDGE_NO_FRIENDLY_PLAYERS');
    const points=[],segments=[],mapCounts={};let rawEvents=0,positionEvents=0,nextPositionEvents=0;
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const seg of windows(start,end)){
      const got=await fetchSegment(p,seg);if(!got.ok)return got;
      rawEvents+=got.rows.length;segments.push({index:seg.index,start:seg.start,end:seg.end,events:got.rows.length});
      for(const e of got.rows){
        const actor=actorOf(e);if(actor==null||!friendly.has(String(actor)))continue;
        const ts=num(e?.timestamp??e?.t),x=num(e?.x),y=num(e?.y),mid=int(e?.mapID),face=num(e?.facing);
        if(ts!=null&&x!=null&&y!=null){
          points.push([actor,Math.max(0,ts-start),x,y,face,mid,0]);positionEvents++;
          if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;if(mid)mapCounts[mid]=(mapCounts[mid]||0)+1;
        }
        const nts=num(e?.nextTimestamp),nx=num(e?.nextX),ny=num(e?.nextY),nf=num(e?.nextFacing??e?.facing);
        if(nts!=null&&nx!=null&&ny!=null){
          points.push([actor,Math.max(0,nts-start),nx,ny,nf,mid,1]);nextPositionEvents++;
          if(nx<minX)minX=nx;if(nx>maxX)maxX=nx;if(ny<minY)minY=ny;if(ny>maxY)maxY=ny;if(mid)mapCounts[mid]=(mapCounts[mid]||0)+1;
        }
      }
    }
    const compact=dedupe(points);
    if(!compact.length)return {ok:false,error:'WCL_BRIDGE_ZERO_COORDINATES',rawEvents,segments};
    return {ok:true,result:{
      format:'raidru-wcl-bridge-points',version:1,bridgeVersion:'2.2.0',
      source:{reportCode:p.code,fight:String(p.fight),bossId:boss,pageUrl:location.href,segments},
      time:{absoluteStart:start,absoluteEnd:end,duration:Math.max(1,end-start)},
      coordinateSemantics:{resourceActor1:'sourceID',resourceActor2:'targetID',nextXY:'same actor at nextTimestamp'},
      bounds:{minX,maxX,minY,maxY},mapIDs:mapCounts,positions:compact,
      stats:{rawEvents,positionEvents,nextPositionEvents,compactPositionPoints:compact.length,segmentCount:segments.length}
    }};
  }

  window.addEventListener('message',event=>{
    if(event.source!==window||event.data?.type!==REQUEST)return;
    const requestId=String(event.data.requestId||'');if(!requestId)return;
    capture(event.data.payload||{}).then(response=>window.postMessage({type:RESPONSE,requestId,response},location.origin)).catch(err=>window.postMessage({type:RESPONSE,requestId,response:{ok:false,error:String(err?.message||err)}},location.origin));
  });
})();
