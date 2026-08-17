const REQUEST='RAIDRU_WCL_PAGE_CAPTURE_REQUEST';
const RESPONSE='RAIDRU_WCL_PAGE_CAPTURE_RESPONSE';
const pending=new Map();

window.addEventListener('message',(event)=>{
  if(event.source!==window||event.data?.type!==RESPONSE)return;
  const id=String(event.data.requestId||'');
  const p=pending.get(id);if(!p)return;
  pending.delete(id);clearTimeout(p.timer);p.resolve(event.data.response||{ok:false,error:'WCL_BRIDGE_EMPTY_PAGE_RESPONSE'});
});

function pageCapture(payload){
  return new Promise(resolve=>{
    const requestId=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const timer=setTimeout(()=>{pending.delete(requestId);resolve({ok:false,error:'WCL_BRIDGE_PAGE_TIMEOUT'});},90000);
    pending.set(requestId,{resolve,timer});
    window.postMessage({type:REQUEST,requestId,payload},location.origin);
  });
}

chrome.runtime.onMessage.addListener((msg,_sender,sendResponse)=>{
  if(msg?.type==='RAIDRU_WCL_BRIDGE_PING'){
    sendResponse({ok:true,url:location.href});return;
  }
  if(msg?.type!=='RAIDRU_WCL_CAPTURE_NOW')return;
  pageCapture(msg.payload||{}).then(sendResponse).catch(e=>sendResponse({ok:false,error:String(e?.message||e)}));
  return true;
});
