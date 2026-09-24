// Original completion page with local GET response fixtures. Never submits an order.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9)||'captures/tablet-v242/complete';
const preview=process.argv.includes('--preview');
fs.mkdirSync(output,{recursive:true});
const pages=await(await fetch('http://127.0.0.1:9222/json/list')).json();
const page=pages.find(p=>p.type==='page'&&p.url.startsWith('https://toss-order.tossplace.com/'));
assert.ok(page,'No development WebView');
const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),results=[];
let id=0,mutations=0,fixtures=0,blockedWrites=0,orders=[];
function call(method,params={}){return new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error(method));},20000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));});}
const headers=[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'https://toss-order.tossplace.com'},{name:'Access-Control-Allow-Credentials',value:'true'}];
ws.onmessage=e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}
 if(m.method==='Fetch.requestPaused'){
  const p=m.params,url=new URL(p.request.url);
  if(!['GET','HEAD','OPTIONS'].includes(p.request.method)){
   blockedWrites++;
   if(url.pathname.startsWith('/api-public/')&&!url.pathname.endsWith('/activity-events'))mutations++;
   call('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:204,responseHeaders:headers}).catch(()=>{});
  }else if(url.pathname.endsWith('/orders')){
   fixtures++;call('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:200,responseHeaders:headers,body:Buffer.from(JSON.stringify({resultType:'SUCCESS',error:null,success:{orders}})).toString('base64')}).catch(()=>{});
  }else call('Fetch.continueRequest',{requestId:p.requestId}).catch(()=>{});
 }
};
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const nativeViewport=await evaluate('[innerWidth,innerHeight]');
async function ready(condition){for(let i=0;i<80;i++){if(await evaluate(`!!window.__roomTablet && !window.__roomInteraction.state().busy && !!(${condition})`))return;await delay(150);}throw Error('Not ready: '+condition);}
const menu=new URL(page.url);menu.pathname=menu.pathname.replace(/\/(menu|cart|order|checkout)(\/.*)?$/,'/menu');
const complete=new URL(menu);complete.pathname=complete.pathname.replace(/\/menu$/,'/order/complete');
const measure=`(() => {
 const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
 const summary=document.querySelector('[data-room-complete-summary]'),total=document.querySelector('[data-room-total]'),number=total?.querySelector('[data-room-number]'),panel=document.querySelector('[data-room-complete-panel]'),toggle=document.querySelector('[data-room-complete-toggle]');
 return {viewport:[innerWidth,innerHeight],page:document.documentElement.dataset.roomPage,overflow:document.documentElement.scrollWidth>innerWidth+1,
 summary:summary&&rect(summary),total:total&&rect(total),number:number&&{value:number.getAttribute('aria-label'),rendered:getComputedStyle(number,'::after').content,childrenHidden:[...number.children].every(e=>getComputedStyle(e).display==='none')},
 panel:panel&&{...rect(panel),background:getComputedStyle(panel).backgroundColor},toggle:toggle&&rect(toggle),title:document.querySelector('[data-room-complete-title]')?.textContent,
 summaryText:summary?.innerText,items:document.querySelectorAll('.dropdown_items .tds-mobile-list-row').length,
 listHeight:document.querySelector('.dropdown_list')?.getBoundingClientRect().height};
})()`;
async function touch(selector){const point=await evaluate(`(() => {const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await delay(70);await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(1000);}
try {
 await call('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
 for(const [name,count,unpaid] of (preview?[['unpaid',2,123456]]:[['unpaid',2,123456],['partial-long',10,23456],['paid',2,0]])){
  const items=Array.from({length:count},(_,i)=>({id:`local-${i}`,title:`표시 검증 메뉴 ${i+1}${count>2?' · 긴 상품 이름과 추가 옵션을 포함한 주문':''}`,quantity:i?1:12,selectedOptions:i?[{title:'표시 검증 추가 옵션',quantity:2,price:1000}]:[],chargePrice:{final:i===0?23456:i===count-1?100000-(count-2)*10000:10000}}));
  orders=[{id:'local-order',totalPrice:123456,totalQuantity:items.reduce((n,i)=>n+i.quantity,0),paymentPrice:{paymentUnpaidValue:unpaid},items}];
  await evaluate('window.__completeOld=true');await call('Page.navigate',{url:complete.href});
  await ready(`!window.__completeOld && document.querySelector('[data-room-total] [aria-label="123,456"]')`);
  await delay(5500);
  for(const [width,height] of (preview?[nativeViewport]:[[1112,800],[856,600],[720,480]]))for(const dark of (preview?[process.argv.includes('--dark')]:[false,true])){
   if(width===nativeViewport[0]&&height===nativeViewport[1])await call('Emulation.clearDeviceMetricsOverride');
   else await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
   await evaluate(`window.__roomTheme.setDark(${dark});window.__roomTablet.apply()`);await delay(500);
   const value=await evaluate(measure);results.push({name,dark,...value});
   assert.equal(value.page,'complete');assert.equal(value.overflow,false);assert.equal(value.number.value,'123,456');assert.equal(JSON.parse(value.number.rendered),'123,456');assert.ok(value.number.childrenHidden);
   assert.ok(value.total.x>=value.summary.x && value.total.right<=value.summary.right,'Amount exceeds summary');
   assert.ok(value.toggle.h>=71.9 && value.toggle.y>=0 && value.toggle.bottom<=height,'History toggle clipped');
   assert.ok(value.summary.right<=width&&value.panel.right<=width);
   if(width>=960)assert.ok(Math.abs(value.summary.y-value.panel.y)<2,'Summary and history should be side by side');
   if(dark)assert.equal(value.panel.background,'rgb(27, 34, 45)');
   const listHeight=await evaluate(`document.querySelector('.dropdown_list').getBoundingClientRect().height`);
   if(listHeight<1)await touch('[data-room-complete-toggle]');
   const expanded=await evaluate(measure);assert.ok(expanded.listHeight>0,'Original history touch did not expand');assert.equal(expanded.items,count);
   if(width===1112&&!dark&&name==='unpaid'){
    const fonts=await evaluate(`Array.from(document.querySelectorAll('[data-room-complete-panel] .tds-mobile-paragraph__text')).map(e=>{const s=getComputedStyle(e);let p=e;const ancestors=[];while(p&&p!==document.body){const c=getComputedStyle(p);ancestors.push({tag:p.tagName,css:p.className,transform:c.transform,scale:c.scale,zoom:c.zoom,font:c.font});p=p.parentElement;}return {text:e.textContent,font:s.font,rect:e.getBoundingClientRect().toJSON(),ancestors};})`);
    fs.writeFileSync(output+'/fonts.json',JSON.stringify(fonts,null,2));
   }
   const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`${output}/${name}-${width}-${dark?'dark':'light'}.png`,Buffer.from(shot.data,'base64'));
   if(preview)continue;
   if(count>2){await evaluate(`document.querySelector('.dropdown_items').lastElementChild.scrollIntoView({block:'end'})`);await delay(100);assert.ok(await evaluate(`(() => {const r=document.querySelector('.dropdown_items').lastElementChild.getBoundingClientRect();return r.bottom<=innerHeight+1&&r.bottom>0;})()`),'Last order item unreachable');}
   await evaluate(`document.querySelector('[data-room-complete-toggle]').scrollIntoView({block:'center'})`);await touch('[data-room-complete-toggle]');
   assert.ok((await evaluate(measure)).listHeight<1,'History does not collapse');
   await evaluate('document.querySelector("[data-room-complete-content]").scrollTop=0;window.scrollTo(0,0)');
  }
 }
 if(!preview){
 await evaluate('window.__roomTablet.setEnabled(false)');assert.equal(await evaluate('getComputedStyle(document.querySelector("[data-room-complete-content]")).display'),'block');await evaluate('window.__roomTablet.setEnabled(true)');
 await call('Page.navigate',{url:menu.href});await ready(`document.documentElement.dataset.roomPage==='menu'`);
 assert.equal(await evaluate('document.querySelectorAll("[data-room-complete-summary],[data-room-total]").length'),0);
 assert.equal(mutations,0);assert.ok(fixtures>=3);
 }
 console.log(JSON.stringify({pass:true,screens:results.length,mutations,blockedWrites,fixtureResponses:fixtures}));
}finally{
 fs.writeFileSync(`${output}/results.json`,JSON.stringify({results,mutations,fixtures},null,2));
 await call('Emulation.clearDeviceMetricsOverride').catch(()=>{});if(!preview)await call('Page.navigate',{url:menu.href}).catch(()=>{});await call('Fetch.disable').catch(()=>{});
 for(const p of pending.values())clearTimeout(p.timer);ws.close();
}



