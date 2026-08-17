const REQUEST='RAIDRU_WCL_BRIDGE_PAGE_REQUEST';
const RESPONSE='RAIDRU_WCL_BRIDGE_PAGE_RESPONSE';

window.addEventListener('message',(event)=>{
  if(event.source!==window||event.data?.type!==REQUEST)return;
  const requestId=String(event.data.requestId||'');
  if(!requestId)return;
  const action=event.data.action==='status'?'status':'capture';
  const message=action==='status'
    ? {type:'RAIDRU_WCL_BRIDGE_STATUS'}
    : {type:'RAIDRU_WCL_BRIDGE_CAPTURE',payload:event.data.payload||{}};
  chrome.runtime.sendMessage(message,(response)=>{
    const err=chrome.runtime.lastError;
    window.postMessage({
      type:RESPONSE,
      requestId,
      response:err?{ok:false,error:err.message}:response
    },location.origin);
  });
});
