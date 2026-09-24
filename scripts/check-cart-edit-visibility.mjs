// Debug WebView only. Real detail quantity controls and original cart components with
// local fixture handlers. CDP holds every API mutation; no mutation reaches Toss.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9)||'captures/interaction-v233';fs.mkdirSync(output,{recursive:true});
const pages=await(await fetch('http://127.0.0.1:9222/json/list')).json();
const page=pages.find(p=>p.type==='page'&&p.url.startsWith('https://toss-order.tossplace.com/'));
assert.ok(page,'No debug WebView');
const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),held=[];
let id=0,mutations=0;
function call(method,params={}){return new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error(method));},15000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));});}
ws.onmessage=event=>{
 const m=JSON.parse(event.data),p=pending.get(m.id);
 if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}
 if(m.method==='Fetch.requestPaused') {
  const p=m.params;
  if(['GET','HEAD','OPTIONS'].includes(p.request.method))call('Fetch.continueRequest',{requestId:p.requestId}).catch(()=>{});
  else if(new URL(p.request.url).pathname==='/api-public/table-order/v1/activity-events')
   call('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:204,responseHeaders:[{name:'Access-Control-Allow-Origin',value:'https://toss-order.tossplace.com'},{name:'Access-Control-Allow-Credentials',value:'true'}]}).catch(()=>{});
  else {mutations++;held.push(p);}
 }
};
await new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>{ws.close();reject(Error('WebView connection timed out; refresh the ADB forward'));},5000);
 ws.onopen=()=>{clearTimeout(timer);resolve();};ws.onerror=error=>{clearTimeout(timer);reject(error);};
 ws.onclose=()=>{clearTimeout(timer);reject(Error('WebView connection closed'));};
});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;}
async function tap(selector){
 const point=await evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control');const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
 await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}
async function ready(condition='true'){for(let n=0;n<100;n++){if(await evaluate(`!!window.__roomInteraction && !window.__roomInteraction.state().busy && (${condition})`))return;await delay(200);}throw Error('UI not ready: '+condition);}
async function visible(){const result=await evaluate(`({cover:window.__roomInteraction.state().cover,cssCover:document.documentElement.hasAttribute('data-room-busy'),visibility:getComputedStyle(document.querySelector('main')).visibility})`);assert.deepEqual(result,{cover:false,cssCover:false,visibility:'visible'});}
function nativeCheck(name){
 const adb=path.join(process.env.LOCALAPPDATA,'Android/Sdk/platform-tools/adb.exe');
 const serial=process.argv.find(a=>a.startsWith('--serial='))?.slice(9)||'emulator-5554';
 execFileSync(adb,['-s',serial,'shell','uiautomator','dump','/sdcard/room-edit-check.xml']);
 const xml=execFileSync(adb,['-s',serial,'shell','cat','/sdcard/room-edit-check.xml'],{encoding:'utf8'});
 fs.writeFileSync(`${output}/${name}.xml`,xml);
 assert.ok(!/화면을 준비|요청을 처리|처리가 늦어/.test(String(xml)),'Native cover is visible');
 fs.writeFileSync(`${output}/${name}.png`,execFileSync(adb,['-s',serial,'exec-out','screencap','-p']));
}
const menu=new URL(page.url);menu.pathname=menu.pathname.replace(/\/(menu|cart|checkout|order)(\/.*)?$/,'/menu');
try {
 await call('Fetch.enable',{patterns:[{urlPattern:'https://api-public.tossplace.com/*',requestStage:'Request'},{urlPattern:'https://toss-order.tossplace.com/api-public/*',requestStage:'Request'}]});
 await evaluate('window.__qaPreviousDocument=true');
 await call('Page.navigate',{url:menu.href});await ready(`!window.__qaPreviousDocument && window.next?.router?.isReady && !!document.querySelector('[data-room-card] > li button[aria-labelledby]')`);
 await delay(500);
 await evaluate('document.querySelector("[data-room-card] > li button[aria-labelledby]").click()');await ready(`document.documentElement.dataset.roomPage==='detail'`);
 assert.equal(await evaluate('document.documentElement.dataset.roomPage'),'detail');
 const quantityValue='Number(document.querySelector(\'button[aria-label="더하기"]\')?.parentElement.querySelector(\'[aria-live="polite"]\')?.textContent)';
 for(const label of ['더하기','더하기','빼기']){
  const before=await evaluate(quantityValue);
  assert.ok(Number.isFinite(before),'Missing original quantity value');
  await tap(`button[aria-label="${label}"]`);
  await visible();await ready();await visible();
  assert.equal(await evaluate(quantityValue),before+(label==='더하기'?1:-1));
 }
 nativeCheck('detail-quantity');assert.equal(mutations,0,JSON.stringify(held.map(p=>({method:p.request.method,path:new URL(p.request.url).pathname}))));
 const title=await evaluate('document.querySelector("main [role=heading]")?.textContent');
 assert.ok(title);
 const cart=new URL(menu);cart.pathname=cart.pathname.replace(/\/menu$/,'/cart');
 await evaluate('window.__qaPreviousDocument=true');
 await call('Page.navigate',{url:cart.href});await ready(`!window.__qaPreviousDocument && window.next?.router?.isReady && location.pathname.endsWith('/cart') && document.documentElement.dataset.roomPage==='cart'`);
 // Only fixture handlers below generate requests; they use a test merchant and are intercepted above.
 await evaluate(`(() => {
  window.webpackChunk_N_E.push([['room-cart-edit-qa'],{},r=>window.__qaRequire=r]);
  const r=window.__qaRequire,React=r(94447),dom=r(22141),cart=r(84371).Z,counter=r(17316).P,h=React.createElement;
  const heading=document.querySelector('h1')?.textContent||document.title;
  const host=document.createElement('div');document.body.replaceChildren(host);
  const endpoint='https://api-public.tossplace.com/api-public/table-order/v1/merchants/codex-local-verification/cart/line-items/fixture';
  function Fixture(){
   const [quantity,setQuantity]=React.useState(2),[removed,setRemoved]=React.useState(false);
   window.__qaQuantity=quantity;window.__qaRemoved=removed;
   const change=async(method,value)=>{await fetch(endpoint,{method,headers:{'Content-Type':'application/json'},...(method==='PATCH'?{body:JSON.stringify({quantity:value,optionChoices:[]})}:{})});if(method==='DELETE')setRemoved(true);else setQuantity(value);};
   return h('div',{style:{maxWidth:600,margin:'auto'}},h('h1',{style:{padding:'16px 24px'}},heading),h('main',null,h('article',null,
    !removed&&h('div',null,h(cart.Item,{top:${JSON.stringify(title)},bottom:'0원',onRemove:()=>change('DELETE')}),h('div',{style:{display:'flex',justifyContent:'flex-end',padding:'0 24px 16px'}},h(counter,{size:'small',minNumber:1,number:quantity,onNumberChange:value=>change('PATCH',value)}))))));
  }
  dom.createRoot(host).render(h(Fixture));return true;
 })()`);
 await delay(500);await ready();
 const results=[];
 for(const method of ['PATCH','DELETE']){
  const selector=method==='PATCH'?'button[aria-label="더하기"]':'[data-tds-mobile-component="ListRowRight"]';
  await tap(selector);
  for(let n=0;n<40&&!held.length;n++)await delay(50);
  assert.equal(held.length,1,'Expected one '+method+' request');assert.equal(held[0].request.method,method);
  assert.match(held[0].request.url,/merchants\/codex-local-verification\/cart\/line-items\/fixture$/);
  for(let n=0;n<10;n++){
   await visible();assert.equal(await evaluate('window.__roomInteraction.state().busy'),true);
   await tap(selector);
   assert.equal(await evaluate('window.__roomInteraction.back()'),false);await delay(300);
  }
  assert.equal(held.length,1,'Duplicate edit escaped the input gate');
  nativeCheck(method.toLowerCase()+'-pending');
  const request=held.shift();
  await call('Fetch.fulfillRequest',{requestId:request.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'https://toss-order.tossplace.com'},{name:'Access-Control-Allow-Credentials',value:'true'}],body:Buffer.from('{}').toString('base64')});
  await ready();await visible();
  if(method==='PATCH')assert.equal(await evaluate('window.__qaQuantity'),3);
  else assert.equal(await evaluate('window.__qaRemoved'),true);
  results.push({method,duplicateTapsBlocked:10,backBlocked:10,webAndNativeCover:false,updatedAfterResponse:true});
 }
 assert.equal(mutations,2);
 console.log(JSON.stringify({pass:true,realDetailQuantityClicks:3,cartTest:'Original Toss components with local fixture handlers',results,mutationsForwardedToServer:0},null,2));
} finally {
 for(const request of held)await call('Fetch.failRequest',{requestId:request.requestId,errorReason:'Aborted'}).catch(()=>{});
 await call('Page.navigate',{url:menu.href}).catch(()=>{});
 await call('Fetch.disable').catch(()=>{});
 for(const p of pending.values())clearTimeout(p.timer);ws.close();
}
