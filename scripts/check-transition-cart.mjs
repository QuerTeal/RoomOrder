// Delays and fulfills the real cart-add request locally in CDP. It never reaches the server.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const pages=await(await fetch('http://127.0.0.1:9222/json/list')).json();
const page=pages.find(p=>p.type==='page'&&p.url.startsWith('https://toss-order.tossplace.com/'));
assert.ok(page,'No debug WebView');
const ws=new WebSocket(page.webSocketDebuggerUrl);let id=0;const pending=new Map(),held=[];
const timeoutCase=process.argv.includes('--timeout'), taps=timeoutCase?24:12;
const output=process.argv.find(arg=>arg.startsWith('--output='))?.slice(9)||'captures/transition-v232';fs.mkdirSync(output,{recursive:true});
function call(method,params={}){return new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error(method));},15000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));});}
ws.onmessage=event=>{
 const message=JSON.parse(event.data),entry=pending.get(message.id);
 if(entry){clearTimeout(entry.timer);pending.delete(message.id);message.error?entry.reject(Error(JSON.stringify(message.error))):entry.resolve(message.result);}
 if(message.method==='Fetch.requestPaused'){
  const p=message.params;
  if(['GET','HEAD','OPTIONS'].includes(p.request.method))call('Fetch.continueRequest',{requestId:p.requestId}).catch(()=>{});
  else held.push({id:p.requestId,method:p.request.method,path:new URL(p.request.url).pathname});
 }
};
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;}
async function ready(){for(let n=0;n<80;n++){if(await evaluate('!!window.__roomInteraction && !window.__roomInteraction.state().busy'))return;await new Promise(r=>setTimeout(r,250));}throw Error('UI did not become ready');}
try {
 await call('Fetch.enable',{patterns:['*/cart/*','*/orders','*/payments/*'].map(suffix=>({urlPattern:'https://api-public.tossplace.com/api-public/table-order/*/merchants/'+suffix,requestStage:'Request'}))});
 await ready();
 assert.equal(await evaluate('document.documentElement.dataset.roomPage'),'menu');
 await evaluate('document.querySelector("[data-room-card] > li button[aria-labelledby]").click()');await ready();
 assert.equal(await evaluate('document.documentElement.dataset.roomPage'),'detail');
 await evaluate('document.querySelector(".tds-mobile-bottom-cta__button").click()');
 for(let n=0;n<40&&!held.length;n++)await new Promise(r=>setTimeout(r,100));
 assert.equal(held.length,1,'Expected one intercepted cart mutation');
 assert.match(held[0].path,/\/cart\/line-items$/);
 const before=await evaluate('location.href');
 for(let n=0;n<taps;n++){
  assert.equal(await evaluate('window.__roomInteraction.state().busy'),true);
  await evaluate('document.querySelector(".tds-mobile-bottom-cta__button")?.click()');
  assert.equal(await evaluate('window.__roomInteraction.back()'),false);
  await new Promise(r=>setTimeout(r,500));
 }
 assert.equal(held.length,1,'Rapid input submitted more than once');
 assert.equal(await evaluate('location.href'),before,'Back must not navigate during the mutation');
 const screenshot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(output+'/'+(timeoutCase?'timeout':'pending')+'-webview.png',Buffer.from(screenshot.data,'base64'));
 if(process.argv.includes('--capture-native')){
  const adb=path.join(process.env.LOCALAPPDATA,'Android/Sdk/platform-tools/adb.exe');
  const serial=process.argv.find(arg=>arg.startsWith('--serial='))?.slice(9)||'emulator-5554';
  fs.writeFileSync(output+'/'+(timeoutCase?'timeout':'pending')+'-native.png',execFileSync(adb,['-s',serial,'exec-out','screencap','-p']));
 }
 const request=held.shift();
 if(timeoutCase){
  assert.equal(await evaluate('window.__roomInteraction.state().phase'),'uncertain_cart');
  await call('Fetch.failRequest',{requestId:request.id,errorReason:'Aborted'}).catch(()=>{});
  assert.equal(await evaluate('window.__roomInteraction.review()'),true);
 }else await call('Fetch.fulfillRequest',{requestId:request.id,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'https://toss-order.tossplace.com'},{name:'Access-Control-Allow-Credentials',value:'true'}],body:Buffer.from('{}').toString('base64')});
 await ready();
 assert.equal(held.length,0);
  if(timeoutCase){assert.match(await evaluate('location.pathname'),/\/cart$/);assert.ok(!(await evaluate('location.pathname')).includes('/table/table/'));}
 console.log(JSON.stringify({pass:true,timeoutCase,delayMs:taps*500,repeatedTaps:taps,repeatedBacks:taps,interceptedCartRequests:1,requestsForwardedToServer:0,result:timeoutCase?'review_cart_before_retry':'unlocked_after_response'},null,2));
} finally {
 for(const request of held)await call('Fetch.failRequest',{requestId:request.id,errorReason:'Aborted'}).catch(()=>{});
 await call('Fetch.disable').catch(()=>{});
 for(const entry of pending.values())clearTimeout(entry.timer);ws.close();
}
