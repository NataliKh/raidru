const BRIDGE_VERSION = '2.2.1';
const WCL_TAB_PATTERN = 'https://*.warcraftlogs.com/reports/*';

function validCode(v){ return /^[A-Za-z0-9_-]{6,32}$/.test(String(v||'')); }
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function waitForContent(tabId, timeoutMs=30000){
  const until=Date.now()+timeoutMs;
  while(Date.now()<until){
    try{
      const r=await chrome.tabs.sendMessage(tabId,{type:'RAIDRU_WCL_BRIDGE_PING'});
      if(r?.ok)return r;
    }catch(_){}
    await sleep(350);
  }
  throw new Error('WCL_BRIDGE_TAB_NOT_READY');
}

async function findOrOpenWclTab(code,fight){
  const wanted=`https://www.warcraftlogs.com/reports/${encodeURIComponent(code)}?fight=${encodeURIComponent(fight)}&view=replay`;
  const tabs=await chrome.tabs.query({url:WCL_TAB_PATTERN});
  let tab=tabs.find(t=>String(t.url||'').includes(`/reports/${code}`));
  if(tab){
    const u=String(tab.url||'');
    if(!u.includes(`fight=${fight}`)||!/[?&]view=replay(?:&|$)/.test(u)){
      tab=await chrome.tabs.update(tab.id,{url:wanted,active:false});
    }
  }else{
    tab=await chrome.tabs.create({url:wanted,active:false});
  }
  await waitForContent(tab.id);
  return tab;
}

chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
  if(msg?.type==='RAIDRU_WCL_BRIDGE_STATUS'){
    sendResponse({ok:true,version:BRIDGE_VERSION});
    return;
  }
  if(msg?.type!=='RAIDRU_WCL_BRIDGE_CAPTURE')return;
  (async()=>{
    try{
      const p=msg.payload||{};
      if(!validCode(p.code)||!/^\d+$/.test(String(p.fight||'')))throw new Error('WCL_BRIDGE_BAD_REQUEST');
      const tab=await findOrOpenWclTab(p.code,String(p.fight));
      const result=await chrome.tabs.sendMessage(tab.id,{type:'RAIDRU_WCL_CAPTURE_NOW',payload:p});
      if(!result?.ok)throw new Error(result?.error||'WCL_BRIDGE_CAPTURE_FAILED');
      sendResponse({ok:true,version:BRIDGE_VERSION,result:result.result});
    }catch(err){
      sendResponse({ok:false,version:BRIDGE_VERSION,error:String(err?.message||err)});
    }
  })();
  return true;
});
