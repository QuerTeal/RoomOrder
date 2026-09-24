// Administrator animation settings on the original pages. Real detail page (read-only) and a local
// order GET fixture for the completion page. Every write is answered locally; nothing is ordered.
// --expect=number,complete,bounce  settings saved in the app (checked in the page before any override)
import fs from 'node:fs';
import assert from 'node:assert/strict';
const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9)||'captures/motion-v260/web';fs.mkdirSync(output,{recursive:true});
const expect=process.argv.find(a=>a.startsWith('--expect='))?.slice(9)?.split(',');
const pages=await(await fetch('http://127.0.0.1:9222/json/list')).json();
const page=pages.find(p=>p.type==='page'&&p.url.startsWith('https://toss-order.tossplace.com/'));assert.ok(page,'No development WebView');
const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),results=[];let id=0,mutations=0,fixtures=0;
const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error(method));},20000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));});
const headers=[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'https://toss-order.tossplace.com'},{name:'Access-Control-Allow-Credentials',value:'true'}];
const items=[0,1].map(i=>({id:`local-${i}`,title:`표시 검증 메뉴 ${i+1}`,quantity:i?1:2,selectedOptions:[],chargePrice:{final:i?10000:113456}}));
const orders=[{id:'local-order',totalPrice:123456,totalQuantity:3,paymentPrice:{paymentUnpaidValue:123456},items}];
ws.onmessage=e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}
 if(m.method==='Fetch.requestPaused'){const q=m.params,url=new URL(q.request.url);
  if(!['GET','HEAD','OPTIONS'].includes(q.request.method)){if(url.pathname.startsWith('/api-public/')&&!url.pathname.endsWith('/activity-events'))mutations++;call('Fetch.fulfillRequest',{requestId:q.requestId,responseCode:204,responseHeaders:headers}).catch(()=>{});}
  else if(url.pathname.endsWith('/orders')){fixtures++;call('Fetch.fulfillRequest',{requestId:q.requestId,responseCode:200,responseHeaders:headers,body:Buffer.from(JSON.stringify({resultType:'SUCCESS',error:null,success:{orders}})).toString('base64')}).catch(()=>{});}
  else call('Fetch.continueRequest',{requestId:q.requestId}).catch(()=>{});}};
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;}
// A query sent while the old document unloads can be dropped; poll again instead of failing.
async function ready(condition='true'){for(let n=0;n<100;n++){try{if(await evaluate(`!!window.__roomTablet && !window.__roomInteraction.state().busy && !!(${condition})`))return;}catch(error){results.push({step:'ready-retry',error:String(error.message).slice(0,80)});}await delay(200);}throw Error('Not ready: '+condition);}
async function navigate(url,condition){await evaluate('window.__qaOld=true');await call('Page.navigate',{url});await ready(`!window.__qaOld && (${condition})`);}
// What the app would send after an administrator saves, applied to the open page.
const motion=async(value,wide=true)=>{await evaluate(`window.__roomConfig={...window.__roomConfig,motion:${JSON.stringify(value)}};window.__roomTablet.setEnabled(${wide})`);await delay(300);};
const travel=`new Promise(done => {const b=document.querySelector('[data-room-cta] button'),ys=[];const t0=performance.now();
 const tick=()=>{ys.push(b.getBoundingClientRect().y);if(performance.now()-t0<2300)setTimeout(tick,40);else done({range:Math.round((Math.max(...ys)-Math.min(...ys))*10)/10,animation:getComputedStyle(b).animationName});};tick();})`;
const numbers=`[...document.querySelectorAll('[data-room-cta] [data-room-number]')].map(e=>({label:e.getAttribute('aria-label'),after:getComputedStyle(e,'::after').content,
 rolling:[...e.querySelectorAll('*')].some(c=>getComputedStyle(c).maskImage?.includes('gradient')&&c.checkVisibility()),hidden:[...e.children].every(c=>getComputedStyle(c).display==='none')}))`;
async function tap(label){const p=await evaluate(`(() => {const r=document.querySelector('button[aria-label="${label}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(1500);}
const completeState=`(() => {
 const t=document.querySelector('[data-room-total]'),n=t?.querySelector('[data-room-number]'),s=document.querySelector('[data-room-complete-summary]');
 const r=e=>{const b=e.getBoundingClientRect();return {x:b.x,right:b.right,y:b.y,bottom:b.bottom};};
 const range=document.createRange();range.selectNodeContents(t);const g=[...range.getClientRects()].filter(b=>b.width>0);
 const unit=[...t.querySelectorAll('*')].find(e=>!e.childElementCount&&/^[^\\d\\s.,]+$/.test(e.textContent.trim()));
 const intro=document.querySelector('[data-room-complete-intro]');
 return {total:r(t),summary:r(s),ink:{x:Math.min(...g.map(b=>b.left),r(n).x),right:Math.max(...g.map(b=>b.right),r(n).right)},unit:unit&&r(unit),label:n.getAttribute('aria-label'),after:getComputedStyle(n,'::after').content,
  rolling:[...n.querySelectorAll('*')].some(c=>getComputedStyle(c).maskImage?.includes('gradient')&&c.checkVisibility()),
  opacity:getComputedStyle(s).opacity,transform:getComputedStyle(s).transform,intro:intro?(intro.checkVisibility()?'visible':'hidden'):'absent',
  overflow:document.documentElement.scrollWidth>innerWidth+1,width:innerWidth};
})()`;
try{
 await call('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
 const menu=new URL(page.url);menu.pathname=menu.pathname.replace(/\/(menu|cart|checkout|order)(\/.*)?$/,'/menu');
 await navigate(menu.href,`!!document.querySelector('[data-room-card]')`);
 if(expect){
  const saved=await evaluate(`({config:window.__roomConfig.motion,number:document.documentElement.dataset.roomMotionNumber,complete:document.documentElement.dataset.roomMotionComplete,bounce:document.documentElement.dataset.roomMotionBounce})`);
  results.push({step:'saved-settings',...saved});
  assert.deepEqual(saved.config,{number:expect[0]==='true',complete:expect[1]==='true',bounce:Number(expect[2])},'App settings did not reach the page');
  assert.equal(saved.number,expect[0]==='true'?'on':'off');assert.equal(saved.complete,expect[1]==='true'?'on':'off');assert.equal(saved.bounce,Number(expect[2])>0?'on':'off');
 }
 await evaluate(`document.querySelectorAll('[data-room-card] > li button[aria-labelledby]')[11].click()`);await ready(`document.documentElement.dataset.roomPage==='detail'`);await delay(500);
 for(const wide of [true,false]){
  for(const size of [20,10,5,0]){
   await motion({number:true,complete:true,bounce:size},wide);
   const t=await evaluate(travel);results.push({step:'bounce',wide,size,...t});
   assert.ok(Math.abs(t.range-size)<=1,`Bounce travel ${t.range}px for ${size}px`);
   if(!size)assert.equal(t.animation,'none');
  }
  await motion({number:true,complete:true,bounce:0},wide);
  const on=await evaluate(numbers);results.push({step:'number-on',wide,on});
  assert.equal(on.length,2);assert.ok(on.every(v=>v.rolling&&v.after==='none'),'Rolling digits should show');
  await motion({number:false,complete:true,bounce:0},wide);
  const off=await evaluate(numbers);results.push({step:'number-off',wide,off});
  assert.ok(off.every(v=>v.hidden&&!v.rolling&&JSON.parse(v.after)===v.label),'Still number should show the page value');
  await tap('더하기');const plus=await evaluate(numbers);results.push({step:'number-off-plus',wide,plus});
  assert.equal(plus[0].label,String(Number(off[0].label)+1));assert.ok(plus.every(v=>v.hidden&&JSON.parse(v.after)===v.label),'Still number did not follow the page');
  await tap('빼기');
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`${output}/detail-number-off-${wide?'wide':'original'}.png`,Buffer.from(shot.data,'base64'));
 }
 const complete=new URL(menu);complete.pathname=complete.pathname.replace(/\/menu$/,'/order/complete');
 await navigate(complete.href,`document.querySelector('[data-room-total] [aria-label="123,456"]')`);
 // The intro plays once per load: sample it under the settings saved in the app.
 const intro=[];for(let n=0;n<16;n++){intro.push(await evaluate(`(() => {const e=document.querySelector('[data-room-complete-intro]');return e?(e.checkVisibility()?'visible':'hidden'):'absent';})()`));await delay(200);}
 results.push({step:'intro',intro});
 if(expect){if(expect[1]==='true')assert.ok(intro.includes('visible'),'Intro should play');else assert.ok(intro.includes('hidden')&&!intro.includes('visible'),'Intro should be skipped');}
 await delay(3000);
 for(const wide of [true,false])for(const [number,done] of [[false,false],[true,true],[false,true],[true,false]]){
  await motion({number,complete:done,bounce:20},wide);await delay(200);
  const v=await evaluate(completeState);results.push({step:'complete',wide,number,complete:done,...v});
  assert.equal(v.overflow,false);assert.equal(v.label,'123,456');
  if(number)assert.ok(v.rolling&&v.after==='none','Rolling amount should show');else assert.ok(!v.rolling&&JSON.parse(v.after)==='123,456','Still amount should show the page value');
  assert.ok(v.unit&&v.unit.right>=v.ink.right-1&&v.unit.y>=v.total.y-2&&v.unit.bottom<=v.total.bottom+2,'Currency unit left the amount line');
  if(wide)assert.ok(v.ink.x>=v.summary.x&&v.ink.right<=v.summary.right,'Amount exceeds summary');
  if(!done){assert.equal(v.opacity,'1');assert.equal(v.transform,'none');assert.notEqual(v.intro,'visible','Intro shown with effects off');}
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`${output}/complete-${wide?'wide':'original'}-number-${number?'on':'off'}-effect-${done?'on':'off'}.png`,Buffer.from(shot.data,'base64'));
 }
 await navigate(menu.href,`!!document.querySelector('[data-room-card]')`);
 assert.equal(mutations,0);
 console.log(JSON.stringify({pass:true,checks:results.length,mutations,fixtures}));
}finally{
 fs.writeFileSync(`${output}/results.json`,JSON.stringify({results,mutations,fixtures},null,2));
 await call('Fetch.disable').catch(()=>{});for(const p of pending.values())clearTimeout(p.timer);ws.close();
}
