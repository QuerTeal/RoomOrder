// Debug WebView: read-only live menu/detail plus display-only original Toss fixtures.
// Every API mutation is intercepted. No cart or order request reaches Toss.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {tossModules,openConfirmDialog} from './toss-modules.mjs';
const output='captures/dark-v240';fs.mkdirSync(output,{recursive:true});
const pages=await(await fetch('http://127.0.0.1:9222/json/list')).json();
const page=pages.find(p=>p.type==='page'&&p.url.startsWith('https://toss-order.tossplace.com/'));
assert.ok(page,'No debug WebView');
const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map();let id=0,blocked=0;
function call(method,params={}){return new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error(method));},15000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));});}
ws.onmessage=event=>{
 const m=JSON.parse(event.data),p=pending.get(m.id);
 if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}
 if(m.method==='Fetch.requestPaused'){
  const p=m.params;
  if(['GET','HEAD','OPTIONS'].includes(p.request.method))call('Fetch.continueRequest',{requestId:p.requestId}).catch(()=>{});
  else {if(!p.request.url.includes('/activity-events'))blocked++;call('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:204,responseHeaders:[{name:'Access-Control-Allow-Origin',value:'https://toss-order.tossplace.com'},{name:'Access-Control-Allow-Credentials',value:'true'}]}).catch(()=>{});}
 }
};
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;}
async function ready(condition='true'){for(let n=0;n<100;n++){if(await evaluate(`!!window.__roomTheme && !!window.__roomInteraction && !window.__roomInteraction.state().busy && (${condition})`))return;await delay(200);}throw Error('UI not ready: '+condition);}
async function shot(name){const r=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`${output}/${name}.png`,Buffer.from(r.data,'base64'));}
const audit=`(() => {
 const rgb=c=>(c.match(/[\\d.]+/g)||[]).map(Number);
 const blend=(a,b)=>a.slice(0,3).map((v,i)=>v*(a[3]??1)+b[i]*(1-(a[3]??1)));
 const lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 function background(e){const chain=[];for(let p=e;p;p=p.parentElement)chain.unshift(p);const bg=chain.reduce((c,p)=>blend(rgb(getComputedStyle(p).backgroundColor),c),[17,21,28]);const button=e.closest('.tds-mobile-button');return button?blend(rgb(getComputedStyle(button).getPropertyValue('--button-background-color')),bg):bg;}
 const failures=[],samples=[];
 for(const e of document.querySelectorAll('.tds-mobile-paragraph__text,.tds-mobile-button__content,h1,h2,h3')){
  const r=e.getBoundingClientRect(),s=getComputedStyle(e);if(!e.textContent.trim()||r.width===0||r.height===0||r.bottom<0||r.top>innerHeight||s.visibility!=='visible'||e.closest('[aria-hidden="true"]'))continue;
  const bg=background(e),fg=blend(rgb(s.color),bg),a=lum(bg),b=lum(fg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  const size=parseFloat(s.fontSize),minimum=size>=24||(size>=18.667&&parseInt(s.fontWeight)>=700)?3:4.5;
  const sample={text:e.textContent.trim().slice(0,35),ratio:+ratio.toFixed(2),minimum,color:s.color,bg,font:size};samples.push(sample);
  if(ratio+.05<minimum)failures.push(sample);
 }
 return {theme:document.documentElement.dataset.roomTheme,bg:getComputedStyle(document.body).backgroundColor,samples,failures,
  images:[...document.querySelectorAll('img')].map(e=>({src:e.currentSrc,filter:getComputedStyle(e).filter})),overflow:document.documentElement.scrollWidth>innerWidth};
})()`;
const menu=new URL(page.url);menu.pathname=menu.pathname.replace(/\/(menu|cart|checkout|order)(\/.*)?$/,'/menu');
const results=[];
async function inspect(name){await delay(350);const r=await evaluate(audit);await shot(name);assert.equal(r.theme,'dark');assert.equal(r.bg,'rgb(17, 21, 28)');assert.equal(r.overflow,false);assert.ok(r.images.every(x=>x.filter==='none'));results.push({name,...r});fs.writeFileSync(`${output}/dark-results.json`,JSON.stringify({results,blocked},null,2));assert.deepEqual(r.failures,[],`${name} text contrast`);}
async function toggleWithoutReload(selector){
 const before=await evaluate(`(() => {window.__qaElement=document.querySelector(${JSON.stringify(selector)});window.__qaToken=crypto.randomUUID();return {token:window.__qaToken,url:location.href,history:history.length,text:window.__qaElement?.textContent,images:[...document.images].map(x=>x.currentSrc)};})()`);
 assert.ok(before.text);
 await evaluate('window.__roomTheme.setDark(false)');await delay(150);
 assert.equal(await evaluate('document.documentElement.dataset.roomTheme'),'light');
 assert.equal(await evaluate('getComputedStyle(document.body).backgroundColor'),'rgb(255, 255, 255)');
 await evaluate('window.__roomTheme.setDark(true)');await delay(150);
 const after=await evaluate(`({token:window.__qaToken,url:location.href,history:history.length,text:document.querySelector(${JSON.stringify(selector)})?.textContent,images:[...document.images].map(x=>x.currentSrc)})`);
 assert.deepEqual(after,before,'Theme changed page/session/content');
 assert.equal(await evaluate(`window.__qaElement===document.querySelector(${JSON.stringify(selector)})`),true,'Control replaced');
}
try{
 await call('Fetch.enable',{patterns:[{urlPattern:'https://api-public.tossplace.com/*',requestStage:'Request'},{urlPattern:'https://toss-order.tossplace.com/api-public/*',requestStage:'Request'}]});
 await evaluate('window.__qaPreviousDocument=true');await call('Page.navigate',{url:menu.href});await ready(`!window.__qaPreviousDocument && !!document.querySelector('[data-room-card]')`);
 assert.equal(await evaluate('window.__roomConfig.dark'),true,'Native saved dark setting missing');
 await inspect('menu-dark');await toggleWithoutReload('[data-room-card]');
 await evaluate('document.querySelector("[data-room-card] > li button[aria-labelledby]").click()');await ready(`document.documentElement.dataset.roomPage==='detail'`);
 await inspect('detail-dark');await toggleWithoutReload('form');
 await evaluate(tossModules);await evaluate(openConfirmDialog);await delay(350);
 for(const [width,height] of [[1112,800],[856,600],[720,480]]){
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:false});
  await inspect(`confirmation-dark-${width}`);
  const bounds=await evaluate(`(() => {const p=document.querySelector('[data-room-dialog]'),b=p.querySelector('[data-room-dialog-body]'),t=b.querySelector('h3'),d=b.querySelector('p');return{top:p.getBoundingClientRect().top,bottom:p.getBoundingClientRect().bottom,titleBottom:t.getBoundingClientRect().bottom,descriptionTop:d.getBoundingClientRect().top,buttons:[...p.querySelectorAll('button')].map(e=>e.getBoundingClientRect().height)};})()`);
  assert.ok(bounds.top>=0&&bounds.bottom<=height+1&&bounds.titleBottom<=bounds.descriptionTop);assert.ok(bounds.buttons.every(h=>h>=64));
 }
 await call('Emulation.clearDeviceMetricsOverride');await evaluate('window.__qaRoot.unmount()');await delay(300);
 const cart=new URL(menu);cart.pathname=cart.pathname.replace(/\/menu$/,'/cart');
 await evaluate('window.__qaPreviousDocument=true');await call('Page.navigate',{url:cart.href});await ready(`!window.__qaPreviousDocument && document.documentElement.dataset.roomPage==='cart'`);
 await inspect('cart-empty-dark');
 await evaluate(tossModules);await evaluate(`(() => {
  const t=window.__qaToss,React=t('React'),dom=t('ReactDOM'),cart=t('Cart'),counter=t('NumericSpinner'),h=React.createElement;
  const host=document.createElement('div');document.body.replaceChildren(host);
  function Fixture(){const [quantity,setQuantity]=React.useState(2);return h('main',null,h('article',null,h('div',null,h(cart.Item,{top:'Dark theme verification',bottom:'0원',onRemove:()=>{}}),h('div',{style:{display:'flex',justifyContent:'flex-end',padding:'0 24px 16px'}},h(counter,{size:'small',minNumber:1,number:quantity,onNumberChange:setQuantity})))));}
  dom.createRoot(host).render(h(Fixture));
 })()`);await delay(500);await ready();await inspect('cart-fixture-dark');await toggleWithoutReload('main');
 await evaluate(`(() => {const portal=document.createElement('div');portal.dataset.tdsColorScheme='light';portal.id='qa-late-theme';document.body.append(portal);})()`);await delay(100);
 assert.equal(await evaluate('document.querySelector("#qa-late-theme").dataset.tdsColorScheme'),'dark');
 assert.equal(blocked,0,'Unexpected mutation attempted');
 console.log(JSON.stringify({pass:true,screens:results.map(x=>x.name),contrastSamples:results.reduce((n,x)=>n+x.samples.length,0),themeToggle:'URL, history, DOM control, text and image sources preserved',mutationsForwarded:0},null,2));
}finally{
 await call('Emulation.clearDeviceMetricsOverride').catch(()=>{});
 await call('Page.navigate',{url:menu.href}).catch(()=>{});await call('Fetch.disable').catch(()=>{});
 for(const p of pending.values())clearTimeout(p.timer);ws.close();
}
