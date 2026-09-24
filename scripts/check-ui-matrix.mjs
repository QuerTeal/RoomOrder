// Real read-only pages and display-only edge fixtures. All API writes are blocked.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9)||'captures/ui-v241';
const strict=process.argv.includes('--strict');fs.mkdirSync(output,{recursive:true});
const pages=await(await fetch('http://127.0.0.1:9222/json/list')).json();
const page=pages.find(p=>p.type==='page'&&p.url.startsWith('https://toss-order.tossplace.com/'));assert.ok(page);
const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),results=[];let id=0,mutations=0;
function call(method,params={}){return new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error(method));},20000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));});}
ws.onmessage=e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}
 if(m.method==='Fetch.requestPaused'){const p=m.params;if(['GET','HEAD','OPTIONS'].includes(p.request.method))call('Fetch.continueRequest',{requestId:p.requestId}).catch(()=>{});else{if(!p.request.url.includes('/activity-events'))mutations++;call('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:204,responseHeaders:[{name:'Access-Control-Allow-Origin',value:'https://toss-order.tossplace.com'},{name:'Access-Control-Allow-Credentials',value:'true'}]}).catch(()=>{});}}
};
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;}
async function ready(condition='true'){for(let n=0;n<100;n++){if(await evaluate(`!!window.__roomTablet && !window.__roomInteraction.state().busy && (${condition})`))return;await delay(200);}throw Error('UI not ready: '+condition);}
const menu=new URL(page.url);menu.pathname=menu.pathname.replace(/\/(menu|cart|checkout|order)(\/.*)?$/,'/menu');
async function navigate(url){await evaluate('window.__qaOld=true');await call('Page.navigate',{url});await ready('!window.__qaOld');}
const measure=`(() => {
 const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
 const visible=e=>{const r=rect(e),s=getComputedStyle(e);return r.w>0&&r.h>0&&r.bottom>0&&r.y<innerHeight&&r.right>0&&r.x<innerWidth&&s.visibility==='visible'&&s.display!=='none'&&s.opacity!=='0';};
 const controls=[...document.querySelectorAll('button,a[href],input,[role="button"],[role="tab"]')].filter(visible).map(e=>({name:(e.innerText||e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')||e.tagName).slice(0,80),...rect(e),disabled:e.disabled||e.getAttribute('aria-disabled')==='true'}));
 const cta=document.querySelector('[data-room-cta]'),badge=cta?.querySelector('.tds-mobile-paragraph__text');
 const price=document.querySelector('[data-room-detail] > div:has([style*="--numeric-spinner-layout-padding"]) > :first-child .tds-mobile-paragraph__text');
 let priceLines=0;if(price){const range=document.createRange();range.selectNodeContents(price);priceLines=new Set([...range.getClientRects()].filter(r=>r.width>0).map(r=>Math.round(r.top))).size;}
 const dialog=document.querySelector('[data-room-dialog]'),body=dialog?.querySelector('[data-room-dialog-body]');
 return {viewport:[innerWidth,innerHeight],mode:document.documentElement.dataset.roomTheme,page:document.documentElement.dataset.roomPage,url:location.pathname,
 overflow:document.documentElement.scrollWidth>innerWidth+1,small:controls.filter(e=>!e.disabled&&(e.w<48||e.h<48)),controls,
 cta:cta&&rect(cta),badge:badge&&{...rect(badge),text:badge.textContent,color:getComputedStyle(badge).color,background:getComputedStyle(badge).backgroundColor},
 priceLines,dialog:dialog&&{...rect(dialog),actions:[...dialog.querySelectorAll('button')].map(rect),bodyScrolls:body.scrollHeight>body.clientHeight,bodyOverflow:getComputedStyle(body).overflowY},options:document.querySelectorAll('form input').length};
})()`;
async function matrix(name){
 for(const [width,height] of [[1112,800],[856,600],[720,480]])for(const dark of [false,true]){
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:false});await evaluate(`window.__roomTheme.setDark(${dark});window.__roomTablet.apply()`);await delay(220);
  const value=await evaluate(measure);results.push({name,...value});
  if(strict){assert.ok(value.priceLines<=1,'Price broken across lines');if(name.startsWith('confirmation')){assert.ok(value.dialog,'Missing original dialog');assert.ok(value.dialog.y>=0&&value.dialog.bottom<=height+1);assert.ok(value.dialog.actions.every(r=>r.h>=64&&r.y>=0&&r.bottom<=height));if(name.endsWith('long'))assert.equal(value.dialog.bodyOverflow,'auto');}}
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`${output}/${name}-${width}-${dark?'dark':'light'}.png`,Buffer.from(shot.data,'base64'));
 }
 await call('Emulation.clearDeviceMetricsOverride');
}
try{
 await call('Fetch.enable',{patterns:[{urlPattern:'https://api-public.tossplace.com/*',requestStage:'Request'},{urlPattern:'https://toss-order.tossplace.com/api-public/*',requestStage:'Request'}]});
 await navigate(menu.href);await ready(`!!document.querySelector('[data-room-card]')`);await matrix('menu');
 await evaluate('document.querySelector("[data-room-category-fade] > button").click()');await delay(400);await matrix('categories');
 await navigate(menu.href);await ready(`!!document.querySelector('[data-room-card]')`);
 for(const index of [0,11]){
  await evaluate(`document.querySelectorAll('[data-room-card] > li button[aria-labelledby]')[${index}].click()`);await ready(`document.documentElement.dataset.roomPage==='detail'`);await matrix(index?'detail-paid':'detail');
  if(!index){
   // Local form state only; the add button is never activated.
   await evaluate(`document.querySelector('button[aria-label="더하기"]').click()`);await ready();
   const markup=await evaluate('document.querySelector("[data-room-cta]")?.outerHTML');fs.writeFileSync(`${output}/cta-markup.html`,markup||'');
  } else if(strict) {
   const read=`[...document.querySelectorAll('[data-room-cta] [aria-label]')].filter(e=>/^[\\d,.\\s+-]+$/.test(e.getAttribute('aria-label'))).map(e=>({value:Number(e.getAttribute('aria-label').replaceAll(',','')),source:e.getAttribute('aria-label'),rolling:[...e.querySelectorAll('*')].some(c=>getComputedStyle(c).maskImage?.includes('gradient')&&getComputedStyle(c).display!=='none')}))`;
   const initial=await evaluate(read);assert.equal(initial.length,2);const unit=initial[1].value/initial[0].value;
   for(const [label,delta] of [['더하기',1],['빼기',-1]]){
    const before=await evaluate(read),point=await evaluate(`(() => {const r=document.querySelector('button[aria-label="${label}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await ready(`(${read})[0]?.value===${before[0].value+delta}`);
    const after=await evaluate(read);assert.equal(after[0].value,before[0].value+delta);assert.equal(after[1].value,after[0].value*unit);
    assert.ok(after.every(v=>v.rolling),'Original rolling digits are not shown');
   }
   fs.writeFileSync(`${output}/numeric-touch-check.json`,JSON.stringify({pass:true,touches:2,originalValues:initial,finalValues:await evaluate(read),mutations},null,2));
  }
  await navigate(menu.href);await ready(`!!document.querySelector('[data-room-card]')`);
 }
 const history=new URL(menu);history.pathname=history.pathname.replace(/\/menu$/,'/order/history');await navigate(history.href);await matrix('history');
 const cart=new URL(menu);cart.pathname=cart.pathname.replace(/\/menu$/,'/cart');await navigate(cart.href);await matrix('cart-empty');
 const dialog=fs.readFileSync('captures/transition-v232/open-dialog.js','utf8').replace('(23189)','(30454)');await evaluate(dialog);await delay(350);await matrix('confirmation');
 await evaluate(`document.querySelector('[data-room-dialog-body] p').textContent+=' '.repeat(1)+'메뉴와 옵션, 수량을 확인해 주세요. '.repeat(18);window.__roomTablet.apply()`);await matrix('confirmation-long');
 await evaluate('window.__qaRoot.unmount()');await delay(200);
 await evaluate(`(() => {
  window.webpackChunk_N_E.push([['room-matrix-qa'],{},r=>window.__qaRequire=r]);
  const r=window.__qaRequire,React=r(94447),dom=r(22141),item=r(84371).Z.Item,counter=r(17316).P,h=React.createElement;
  const host=document.createElement('div');document.body.replaceChildren(host);
  function Fixture(){const [quantity,setQuantity]=React.useState(99);return h('main',null,h('article',null,h('div',null,h(item,{top:'긴 메뉴 이름과 여러 옵션이 있는 장바구니 표시 테스트',bottom:'123,456원',onRemove:()=>{}}),h('div',{style:{display:'flex',justifyContent:'flex-end',padding:'0 24px 16px'}},h(counter,{size:'small',minNumber:1,number:quantity,onNumberChange:setQuantity})))));}
  dom.createRoot(host).render(h(Fixture));
 })()`);await delay(400);await matrix('cart-long-fixture');
 fs.writeFileSync(`${output}/matrix-results.json`,JSON.stringify({results,mutations},null,2));
 const issues=results.filter(r=>r.overflow||r.small.length);console.log(JSON.stringify({screens:results.length,mutations,issues:issues.map(({name,viewport,mode,overflow,small})=>({name,viewport,mode,overflow,small}))},null,2));
 assert.equal(mutations,0);if(strict)assert.deepEqual(issues,[]);
}finally{
 fs.writeFileSync(`${output}/matrix-results.json`,JSON.stringify({results,mutations},null,2));
 await call('Emulation.clearDeviceMetricsOverride').catch(()=>{});await call('Page.navigate',{url:menu.href}).catch(()=>{});await call('Fetch.disable').catch(()=>{});
 for(const p of pending.values())clearTimeout(p.timer);ws.close();
}
