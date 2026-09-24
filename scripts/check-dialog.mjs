import fs from 'node:fs';
import assert from 'node:assert/strict';
const pages=await(await fetch('http://127.0.0.1:9222/json/list')).json();
const page=pages.find(p=>p.type==='page'&&p.url.startsWith('https://toss-order.tossplace.com/'));
assert.ok(page,'No Toss debug WebView');
const ws=new WebSocket(page.webSocketDebuggerUrl);let id=0;const pending=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
function call(method,params={}){return new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error(method));},15000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));});}
const measure=`(() => {
 const panel=document.querySelector('[data-room-dialog]');if(!panel)throw Error('Open the display-only confirmation fixture first');
 const body=panel.querySelector('[data-room-dialog-body]'), title=body.querySelector('h3'), description=body.querySelector('p');
 const rect=e=>e.getBoundingClientRect().toJSON();
 return {viewport:[innerWidth,innerHeight],panel:rect(panel),title:rect(title),description:rect(description),titleLine:parseFloat(getComputedStyle(title).lineHeight),
 buttons:Array.from(panel.querySelectorAll('button'),rect),horizontalOverflow:document.documentElement.scrollWidth>innerWidth};
})()`;
try {
 const results=[];
 for(const [width,height] of [[1112,800],[856,600],[720,480]]){
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:false});
  await call('Runtime.evaluate',{expression:'new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))',awaitPromise:true});
  const r=await call('Runtime.evaluate',{expression:measure,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));const v=r.result.value;
  assert.ok(v.title.bottom<=v.description.top,'Title overlaps description');
  assert.ok(v.titleLine>0,'Zero line height');
  assert.ok(v.panel.top>=0&&v.panel.bottom<=height+1,'Dialog exceeds viewport');
  assert.ok(!v.horizontalOverflow,'Horizontal overflow');
  for(const b of v.buttons){assert.ok(b.top>=v.description.bottom,'Actions overlap body');assert.ok(b.height>=64&&b.bottom<=height,'Action inaccessible');}
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`captures/ui-v230/dialog-${width}x${height}.png`,Buffer.from(shot.data,'base64'));
  results.push(v);
 }
 console.log(JSON.stringify(results,null,2));
} finally {await call('Emulation.clearDeviceMetricsOverride');for(const p of pending.values())clearTimeout(p.timer);ws.close();}
