// Debug WebView only. Renders Toss's QR-expired component and verifies native GET recovery.
// All API mutations are intercepted locally. No cart/order/payment reaches the server.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tossModules} from './toss-modules.mjs';
const output='captures/expiry-v234';fs.mkdirSync(output,{recursive:true});
const pages=await(await fetch('http://127.0.0.1:9222/json/list')).json();
const page=pages.find(p=>p.type==='page'&&p.url.startsWith('https://toss-order.tossplace.com/'));
assert.ok(page,'No debug WebView');
const menu=new URL(page.url);menu.pathname=menu.pathname.replace(/\/(menu|cart|checkout|order)(\/.*)?$/,'/menu');
const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),held=[],qrGets=[],results=[];
let id=0,mutationCount=0,httpFixtureCount=0;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function call(method,params={}){return new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error(method));},12000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));});}
const cors=[{name:'Access-Control-Allow-Origin',value:'https://toss-order.tossplace.com'},{name:'Access-Control-Allow-Credentials',value:'true'}];
ws.onmessage=event=>{
 const m=JSON.parse(event.data),p=pending.get(m.id);
 if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}
 if(m.method==='Network.requestWillBeSent'&&m.params.request.url.startsWith('https://toss.place/_t/'))qrGets.push({method:m.params.request.method,url:m.params.request.url});
 if(m.method==='Fetch.requestPaused'){
  const p=m.params,url=new URL(p.request.url);
  if(url.origin===menu.origin&&url.searchParams.has('__room_qr_expiry_test')){
   httpFixtureCount++;
   const html='<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><span class="tds-mobile-paragraph__text">QR을 다시 인식해주세요</span><p>접속 가능한 시간이 지났어요</p></main></body></html>';
   call('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:404,responseHeaders:[{name:'Content-Type',value:'text/html; charset=utf-8'}],body:Buffer.from(html).toString('base64')}).catch(()=>{});
  }else if(['GET','HEAD','OPTIONS'].includes(p.request.method))call('Fetch.continueRequest',{requestId:p.requestId}).catch(()=>{});
  else if(url.pathname==='/api-public/table-order/v1/activity-events')call('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:204,responseHeaders:cors}).catch(()=>{});
  else {mutationCount++;held.push(p);}
 }
};
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.close();reject(Error('WebView connection timeout'));},5000);ws.onopen=()=>{clearTimeout(timer);resolve();};ws.onerror=e=>{clearTimeout(timer);reject(e);};ws.onclose=()=>{clearTimeout(timer);reject(Error('WebView closed'));};});
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;}
async function until(expression){for(let n=0;n<50;n++){const value=await evaluate(expression);if(value)return value;await delay(300);}throw Error('Timed out: '+expression);}
async function ready(){await until(`!window.__qaPreviousDocument && !!window.__roomInteraction && !window.__roomInteraction.state().busy && window.next?.router?.isReady && !!document.querySelector('main [role=tablist]')`);}
async function openMenu(){await evaluate('window.__qaPreviousDocument=true');await call('Page.navigate',{url:menu.href});await ready();}
async function renderQr(){
 await evaluate(tossModules);await evaluate(`(() => {
  const t=window.__qaToss,React=t('React'),dom=t('ReactDOM'),Expired=t('QrExpired');
  const host=document.createElement('div');document.body.replaceChildren(host);
  dom.createRoot(host).render(React.createElement(Expired));return true;
 })()`);
 await until(`document.body.textContent.includes('QR을 다시 인식해주세요')`);
}
async function screenshot(name){const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`${output}/${name}.png`,Buffer.from(shot.data,'base64'));}
async function recovered(name,before,start){
 await until(`document.querySelector('main [role=tablist]') && !window.__roomInteraction?.state().busy`);
 assert.equal(qrGets.length,before+1,'Expected one original QR GET');assert.equal(qrGets.at(-1).method,'GET');
 const current=new URL(await evaluate('location.href'));assert.equal(current.pathname,menu.pathname);assert.equal(current.searchParams.get('tid'),menu.searchParams.get('tid'));
 await delay(2500);
 const history=await call('Page.getNavigationHistory');assert.equal(history.entries.length,1,'Expired history was not cleared');
 results.push({name,pass:true,elapsedMs:Date.now()-start,originalQrGet:true,sameRoom:true,historyEntries:history.entries.length});
 console.error('PASS: '+name);await screenshot(name+'-returned');
}
async function startMutation(method){
 const resource=method==='PATCH'?'cart/line-items/fixture':'orders';
 const endpoint='https://api-public.tossplace.com/api-public/table-order/v1/merchants/codex-local-expiry/'+resource;
 await evaluate(`fetch(${JSON.stringify(endpoint)},{method:${JSON.stringify(method)},headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.arrayBuffer()).catch(()=>{});void 0`);
 for(let n=0;n<30&&!held.length;n++)await delay(100);
 assert.equal(held.length,1);assert.equal(held[0].request.url,endpoint);
}
async function failMutation(status){const request=held.shift();await call('Fetch.fulfillRequest',{requestId:request.requestId,responseCode:status,responseHeaders:[...cors,{name:'Content-Type',value:'application/json'}],body:Buffer.from('{}').toString('base64')});}
try {
 await call('Network.enable');
 await call('Fetch.enable',{patterns:[{urlPattern:'https://api-public.tossplace.com/*',requestStage:'Request'},{urlPattern:'https://toss-order.tossplace.com/api-public/*',requestStage:'Request'},{urlPattern:'https://toss-order.tossplace.com/*__room_qr_expiry_test*',requestStage:'Request'}]});
 await openMenu();await delay(12000); // Reset the bounded recovery budget through the normal menu policy.
 let before=qrGets.length,start=Date.now();await renderQr();await screenshot('original-qr-expired');
 await recovered('qr-expired',before,start);
 await delay(12000);
 before=qrGets.length;await startMutation('PATCH');await renderQr();await delay(6500);
 assert.equal(qrGets.length,before,'Must wait while a cart request is pending');
 assert.equal(await evaluate('window.__roomInteraction.state().sessionRecoveryAllowed'),false);
 await failMutation(401);await until(`window.__roomInteraction.state().phase==='uncertain_cart'`);
 assert.equal(await evaluate('window.__roomInteraction.state().sessionRecoveryAllowed'),true);
 await screenshot('expired-under-cart-cover');start=Date.now();await recovered('expired-after-cart-failure',before,start);
 await startMutation('POST');await failMutation(503);await until(`window.__roomInteraction.state().phase==='uncertain_order'`);
 before=qrGets.length;await renderQr();await delay(6500);
 assert.equal(qrGets.length,before,'Uncertain order must remain for explicit review');
 assert.equal(await evaluate('window.__roomInteraction.state().phase'),'uncertain_order');
 await screenshot('uncertain-order-preserved');results.push({name:'uncertain-order-preserved',pass:true,waitedMs:6500,automaticReload:false});
 console.error('PASS: uncertain-order-preserved');
 await openMenu();await delay(12000);
 before=qrGets.length;start=Date.now();const expired=new URL(menu);expired.searchParams.set('__room_qr_expiry_test','1');
 await evaluate('window.__qaPreviousDocument=true');await call('Page.navigate',{url:expired.href});
 await until(`!window.__qaPreviousDocument && location.search.includes('__room_qr_expiry_test')`);
 await recovered('http404-qr-expired',before,start);
 assert.equal(httpFixtureCount,1);assert.equal(mutationCount,2);assert.equal(held.length,0);
 console.log(JSON.stringify({pass:true,results,cartPendingWaitMs:6500,http404Fixtures:1,interceptedMutations:mutationCount,mutationsForwardedToServer:0,actualServerExpirationNotModified:true},null,2));
} finally {
 for(const request of held)await call('Fetch.failRequest',{requestId:request.requestId,errorReason:'Aborted'}).catch(()=>{});
 await call('Page.navigate',{url:menu.href}).catch(()=>{});await call('Fetch.disable').catch(()=>{});
 for(const p of pending.values())clearTimeout(p.timer);ws.close();
}
