// Verify the cleanup adapter against original Toss cart components. All writes are local.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const output='captures/idle-v250';fs.mkdirSync(output,{recursive:true});
const pages=await(await fetch('http://127.0.0.1:9222/json/list')).json(),page=pages.find(p=>p.type==='page'&&p.url.startsWith('https://toss-order.tossplace.com/'));
assert.ok(page);
const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),held=[];let id=0,mutations=0;
function call(method,params={}){return new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error(method));},20000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));});}
const headers=[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'https://toss-order.tossplace.com'},{name:'Access-Control-Allow-Credentials',value:'true'}];
ws.onmessage=e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}
 if(m.method==='Fetch.requestPaused'){
  const p=m.params;
  if(['GET','HEAD','OPTIONS'].includes(p.request.method))call('Fetch.continueRequest',{requestId:p.requestId}).catch(()=>{});
  else if(p.request.url.includes('/merchants/codex-idle-test/')){mutations++;held.push(p);}
  else call('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:204,responseHeaders:headers}).catch(()=>{});
 }
};
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;}
async function ready(){for(let n=0;n<100;n++){if(await evaluate('!!window.__roomMaintenance && !!window.__roomInteraction && !window.__roomInteraction.state().busy'))return;await delay(100);}throw Error('Page did not settle');}
const menu=new URL(page.url);menu.pathname=menu.pathname.replace(/\/(menu|cart|checkout|order)(\/.*)?$/,'/menu');
const cart=new URL(menu);cart.pathname=cart.pathname.replace(/\/menu$/,'/cart');
const source=fs.readFileSync('app/src/main/assets/cart-maintenance.js','utf8');
async function fresh(count=1){
 await call('Page.navigate',{url:cart.href});await delay(1000);await ready();
 await evaluate(`(() => {
  window.webpackChunk_N_E.push([['idle-cart-test'],{},r=>window.__qaRequire=r]);
  const r=window.__qaRequire,React=r(94447),dom=r(22141),item=r(84371).Z.Item,h=React.createElement;
  const data=document.getElementById('__NEXT_DATA__').cloneNode(true),empty=JSON.parse(data.textContent).props.pageProps._nextI18Next.initialI18nStore.ko.common['cart-page']['empty-cart'];
  const host=document.createElement('div');document.body.replaceChildren(data,host);
  function Fixture(){const [items,setItems]=React.useState(Array.from({length:${count}},(_,i)=>i));return h('main',null,items.length?h('article',null,...items.map(id=>h('div',{key:id},h(item,{top:'자동 정리 표시 검증 '+id,bottom:'0원',onRemove:async()=>{const response=await fetch('https://api-public.tossplace.com/api-public/table-order/v1/merchants/codex-idle-test/cart/line-items/'+id,{method:'DELETE'});if(response.ok)setItems(v=>v.filter(n=>n!==id));}})))):h('p',null,empty));}
  dom.createRoot(host).render(h(Fixture));window.__roomMaintenance=undefined;
 })()`);await evaluate(source);await delay(800);await ready();
}
async function step(){return evaluate('window.__roomMaintenance.step()');}
async function release(code=200){assert.equal(held.length,1);const request=held.shift();assert.equal(request.request.method,'DELETE');await call('Fetch.fulfillRequest',{requestId:request.requestId,responseCode:code,responseHeaders:headers,body:Buffer.from('{}').toString('base64')});await delay(1100);}
const results=[];
try{
 await call('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
 await fresh(3);
 for(let i=0;i<3;i++){
  assert.equal((await step()).status,'removing');await delay(80);assert.equal(held.length,1);
  for(let n=0;n<12;n++)assert.equal((await step()).status,'waiting');assert.equal(held.length,1);
  await release();await ready();assert.equal((await step()).status,'removed');
 }
 assert.equal((await step()).status,'empty');assert.equal(mutations,3);results.push('three original delete controls; serial requests; duplicate suppression; empty confirmed');
 await fresh(0);assert.equal((await step()).status,'empty');assert.equal(held.length,0);results.push('already empty: no mutation');
 await fresh();await evaluate(`document.body.insertAdjacentHTML('beforeend','<div role="dialog">확인 중</div>')`);assert.equal((await step()).status,'failed');assert.equal(held.length,0);results.push('dialog: no deletion');
 await fresh();assert.equal((await step()).status,'removing');await delay(80);await release(500);assert.equal((await step()).status,'failed');assert.equal((await step()).status,'failed');assert.equal(held.length,0);results.push('failed request: no retry');
 await fresh();assert.equal((await step()).status,'removing');await delay(21000);assert.equal((await step()).reason,'delete_timeout');assert.equal(held.length,1);await release();assert.equal((await step()).status,'failed');results.push('20-second timeout: late response does not resume cleanup');
 await fresh(0);await evaluate('document.querySelector("main").replaceChildren()');assert.equal((await step()).reason,'unrecognized_cart');results.push('unknown empty state: fail closed');
 fs.writeFileSync(output+'/cart-adapter-results.json',JSON.stringify({pass:true,results,mutations,mutationsForwardedToServer:0},null,2));console.log(JSON.stringify({pass:true,results,mutations,mutationsForwardedToServer:0},null,2));
}finally{
 for(const request of held)await call('Fetch.failRequest',{requestId:request.requestId,errorReason:'Aborted'}).catch(()=>{});
 await call('Page.navigate',{url:menu.href}).catch(()=>{});await call('Fetch.disable').catch(()=>{});
 for(const p of pending.values())clearTimeout(p.timer);ws.close();
}
