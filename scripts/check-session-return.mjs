import fs from 'node:fs';
import assert from 'node:assert/strict';
const pages=await(await fetch('http://127.0.0.1:9222/json/list')).json();
const page=pages.find(p=>p.type==='page'&&p.url.startsWith('https://toss-order.tossplace.com/'));
assert.ok(page,'No Toss debug WebView');
const ws=new WebSocket(page.webSocketDebuggerUrl);let id=0;const pending=new Map(),requests=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Network.requestWillBeSent')requests.push({url:m.params.request.url,method:m.params.request.method});const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
function call(method,params={}){return new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error(method));},15000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));});}
try {
 await call('Network.enable');
 const before=await call('Runtime.evaluate',{expression:'location.href',returnByValue:true});
 const old=new URL(before.result.value),expected=old.pathname.replace(/\/(menu(?:\/[^/]+)?|cart|order\/history)\/?$/,'/menu');
 const start=Date.now();
 await call('Runtime.evaluate',{expression:`(() => {
   const main=document.createElement('main');main.style.cssText='height:95vh;display:flex;align-items:center;justify-content:center';
   const title=document.createElement('h1');title.textContent='안녕히가세요';title.style.cssText='font-size:32px;line-height:1.5';main.append(title);
   document.body.replaceChildren(main);return location.href;
 })()`,returnByValue:true});
 const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync('captures/ui-v230/ended-fixture.png',Buffer.from(shot.data,'base64'));
 let state;
 for(let n=0;n<20;n++){
  await new Promise(r=>setTimeout(r,1000));
  const r=await call('Runtime.evaluate',{expression:'({url:location.href,ready:!!document.querySelector("main [role=tablist]")})',returnByValue:true});state=r.result.value;
  if(state?.ready)break;
 }
 assert.ok(state?.ready,'Native activity did not return to menu');
 const current=new URL(state.url);assert.equal(current.pathname,expected);assert.equal(current.searchParams.get('tid'),old.searchParams.get('tid'));
 assert.ok(requests.some(r=>r.url.startsWith('https://toss.place/_t/')&&r.method==='GET'),'Must reload original room QR, not a stale route');
 assert.ok(!requests.some(r=>r.method!=='GET'&&/\/api-public\/.*\/(cart\/checkout|orders|cart\/line-items)/.test(r.url)),'Order mutation detected');
 await new Promise(r=>setTimeout(r,2500));
 const history=await call('Page.getNavigationHistory');
 const after=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync('captures/ui-v230/returned-menu.png',Buffer.from(after.data,'base64'));
 console.log(JSON.stringify({pass:true,elapsedMs:Date.now()-start,returnedRoom:current.searchParams.get('tid'),originalQrGet:true,historyEntries:history.entries.length,orderMutations:0},null,2));
} finally {for(const p of pending.values())clearTimeout(p.timer);ws.close();}
