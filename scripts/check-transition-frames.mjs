import assert from 'node:assert/strict';
import fs from 'node:fs';
const output=process.argv.find(arg=>arg.startsWith('--output='))?.slice(9)||'captures/transition-v232';fs.mkdirSync(output,{recursive:true});
const cpu=Number(process.argv.find(arg=>arg.startsWith('--cpu='))?.slice(6)||6);
const pages=await(await fetch('http://127.0.0.1:9222/json/list')).json();
const page=pages.find(p=>p.type==='page'&&p.url.startsWith('https://toss-order.tossplace.com/'));
assert.ok(page,'No debug WebView');
const ws=new WebSocket(page.webSocketDebuggerUrl);let id=0;const pending=new Map();
ws.onmessage=event=>{const m=JSON.parse(event.data),p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
function call(method,params={}){return new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error(method));},20000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));});}
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;}
async function ready(kind){for(let n=0;n<120;n++){if(await evaluate(`!window.__qaPreviousDocument && !!window.__roomInteraction && window.next?.router?.isReady && !window.__roomInteraction.state().busy && document.documentElement.dataset.roomPage===${JSON.stringify(kind)}`))return;await new Promise(r=>setTimeout(r,250));}throw Error('Not ready: '+kind);}
let probeId;
const probe=`(() => {
 window.__roomFrameProbeActive=true;
 window.__roomFrames=[];
 function frame(){
  if(!window.__roomFrameProbeActive)return;
  const main=document.querySelector('main'),html=document.documentElement;
  const shown=main && getComputedStyle(main).visibility!=='hidden' && !html.hasAttribute('data-room-busy');
  if(main && window.__roomFrames.length<6000){
   const narrow=[];for(let p=main;p&&p!==document.body;p=p.parentElement){const width=p.getBoundingClientRect().width;if(width>=500&&width<=610)narrow.push(Math.round(width));}
   window.__roomFrames.push({shown:!!shown,page:html.dataset.roomPage||'',mode:html.dataset.roomTablet||'',narrow,viewport:innerWidth});
  }
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
})();`;
try {
 await call('Page.enable');await call('Network.enable');
 probeId=(await call('Page.addScriptToEvaluateOnNewDocument',{source:probe})).identifier;
 await call('Emulation.setCPUThrottlingRate',{rate:cpu});
 await call('Network.emulateNetworkConditions',{offline:false,latency:300,downloadThroughput:400000,uploadThroughput:400000});
 const entry=new URL(page.url);entry.pathname=entry.pathname.replace(/\/(menu|cart|order|checkout)(\/.*)?$/,'/menu');
 await evaluate('window.__qaPreviousDocument=true');
 await call('Page.navigate',{url:entry.href});await ready('menu');
 await new Promise(r=>setTimeout(r,500));
 for(let round=0;round<3;round++){
  await evaluate('document.querySelector("[data-room-card] > li button[aria-labelledby]").click()');await ready('detail');
  const backs=await evaluate('[window.__roomInteraction.back(),window.__roomInteraction.back(),window.__roomInteraction.back()]');
  assert.deepEqual(backs,[true,false,false]);await ready('menu');
 }
 const result=await evaluate(`(() => {const frames=window.__roomFrames,shown=frames.filter(f=>f.shown);return {sampled:frames.length,shown:shown.length,covered:frames.length-shown.length,bad:shown.filter(f=>f.viewport>=720&&(f.mode!=='on'||f.narrow.length)).slice(0,20),pages:[...new Set(shown.map(f=>f.page))]};})()`);
 assert.ok(result.shown>0);assert.deepEqual(result.bad,[],'A phone-width frame was exposed');
 const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(output+'/menu-ready.png',Buffer.from(shot.data,'base64'));
 console.log(JSON.stringify({pass:true,cpuSlowdown:cpu,latencyMs:300,rounds:3,rapidBackSuppressed:true,...result},null,2));
} finally {
 await evaluate('window.__roomFrameProbeActive=false').catch(()=>{});
 if(probeId)await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:probeId}).catch(()=>{});
 await call('Emulation.setCPUThrottlingRate',{rate:1}).catch(()=>{});
 await call('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1}).catch(()=>{});
 for(const p of pending.values())clearTimeout(p.timer);ws.close();
}
