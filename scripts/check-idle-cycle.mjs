// Native seconds countdown + local cart fixture. All network writes are intercepted.
// --start=menu|cart|external|checkout-external  where the visitor leaves the tablet
// --delay-cart=ms                               slow cart documents (the previous page must not be probed)
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const arg=(name,fallback)=>process.argv.find(v=>v.startsWith(`--${name}=`))?.split('=')[1]??fallback;
const interval=Number(arg('seconds',100)),start=arg('start','menu'),cartDelay=Number(arg('delay-cart',0));
assert.ok([60,80,100].includes(interval),'Use --seconds=60, 80 or 100');
assert.ok(['menu','cart','external','checkout-external'].includes(start),'Unknown --start');
const output=`captures/idle-v252/cycle-${interval}-${start}${cartDelay?'-slow':''}`;fs.mkdirSync(output,{recursive:true});
const adb=process.env.LOCALAPPDATA+'/Android/Sdk/platform-tools/adb.exe',serial='emulator-5554';
const run=(...args)=>execFileSync(adb,['-s',serial,...args],{windowsHide:true,timeout:15000});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function nativeUi(){run('shell','uiautomator','dump','/sdcard/idle-ui.xml');const xml=run('shell','cat','/sdcard/idle-ui.xml').toString();fs.writeFileSync(output+'/current-ui.xml',xml);const node=xml.match(/<node\b[^>]*resource-id="[^"]*:id\/idle_countdown"[^>]*>/)?.[0];const text=node?.match(/text="([^"]*)"/)?.[1]?.replaceAll('&#10;','\n');return {text,continueVisible:xml.includes(':id/idle_continue')||xml.includes('계속 사용'),xml};}
const screenshot=name=>fs.writeFileSync(`${output}/${name}.png`,run('exec-out','screencap','-p'));
let page;
for(let attempt=0;attempt<30&&!page;attempt++){
 try{const pages=await(await fetch('http://127.0.0.1:9222/json/list')).json();page=pages.find(p=>p.type==='page'&&p.url.startsWith('https://toss-order.tossplace.com/'));}catch{}
 if(!page)await delay(1000);
}
assert.ok(page,'Ordering WebView did not become ready within 30 seconds');
const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map();let id=0,qrReads=0,qrEntryReads=0,forwardedWrites=0;
let items=[1,2,3],deletions=[],firstDeleteAt=0,resetAt=0;const traces=[],cartDocs=[],qrEntryAt=[];
function secondsLeft(text=''){const mmss=text.match(/(\d+):(\d+)/);return mmss?Number(mmss[1])*60+Number(mmss[2]):Number(text.match(/^(\d+)초 후/)?.[1]??NaN);}
const menu=new URL(page.url);menu.pathname=menu.pathname.replace(/\/(menu|cart|checkout|order)(\/.*)?$/,'/menu');
const cartUrl=new URL(menu);cartUrl.pathname=cartUrl.pathname.replace(/\/menu$/,'/cart');
const checkoutUrl=new URL(menu);checkoutUrl.pathname=checkoutUrl.pathname.replace(/\/menu$/,'/checkout');
const external='https://example.com/room-idle-external';
// Cart documents requested after the native reset belong to the cleanup cycle.
const cycleCarts=()=>cartDocs.filter(d=>d.requestedAt>=resetAt);
function call(method,params={}){return new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error(method));},15000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));});}
const headers=[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'https://toss-order.tossplace.com'},{name:'Access-Control-Allow-Credentials',value:'true'}];
const htmlHeaders=[{name:'Content-Type',value:'text/html; charset=utf-8'}];
const fulfillHtml=(requestId,body)=>call('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:htmlHeaders,body:Buffer.from(body).toString('base64')}).catch(()=>{});
function html(cart){
 const data={props:{pageProps:{_nextI18Next:{initialI18nStore:{ko:{common:{'cart-page':{'empty-cart':'담은 메뉴가 없어요'}}}}}}}};
 return `<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:24px sans-serif;margin:24px}li{padding:24px;border-bottom:1px solid #ccd}button{font:24px sans-serif;padding:20px}</style></head><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script><main>${cart?'':'<h1>자동 정리 검증 화면</h1><div role="tablist"><button role="tab">로컬 표시 테스트</button></div><p>실제 주문은 발생하지 않습니다.</p>'}</main>${cart?`<script>let items=${JSON.stringify(items)};function render(){const main=document.querySelector('main');main.innerHTML=items.length?'<article>'+items.map(id=>'<div><li class="tds-mobile-list-row"><span>검증 메뉴 '+id+'</span><span data-tds-mobile-component="ListRowRight"><button data-id="'+id+'">삭제</button></span></li></div>').join('')+'</article>':'<p>담은 메뉴가 없어요</p>';for(const b of main.querySelectorAll('button'))b.parentElement.onclick=async()=>{const id=Number(b.dataset.id),r=await fetch('https://api-public.tossplace.com/api-public/table-order/v1/merchants/codex-idle-test/cart/line-items/'+id,{method:'DELETE'});if(r.ok){items=items.filter(n=>n!==id);render();}};}render();</script>`:''}</body></html>`;
}
ws.onmessage=e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}
 if(m.method==='Fetch.requestPaused'){
  const p=m.params,url=new URL(p.request.url),method=p.request.method;
  if(method==='DELETE'&&url.pathname.startsWith('/api-public/table-order/v1/merchants/codex-idle-test/cart/line-items/')){
   if(!firstDeleteAt)firstDeleteAt=Date.now();
   const item=Number(url.pathname.split('/').at(-1));deletions.push(item);items=items.filter(n=>n!==item);
   call('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:200,responseHeaders:headers,body:Buffer.from('{}').toString('base64')}).catch(()=>{});
  }else if(!['GET','HEAD','OPTIONS'].includes(method))call('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:204,responseHeaders:headers}).catch(()=>{});
  else if(p.resourceType==='Document'&&url.hostname==='example.com'){
   traces.push(url.href);fulfillHtml(p.requestId,'<!doctype html><html lang="ko"><body><h1>외부 페이지 검증</h1><a href="https://example.com/next">다음</a></body></html>');
  }else if(p.resourceType==='Document'&&url.hostname==='toss.place'){
   qrEntryReads++;qrEntryAt.push(Date.now());
   const target=new URL(menu);target.pathname=target.pathname.replace(/\/menu\/?$/,'');
   fulfillHtml(p.requestId,`<!doctype html><html><body>Local QR redirect test<script>setTimeout(()=>location.replace(${JSON.stringify(target.href)}),3000)</script></body></html>`);
  }else if(p.resourceType==='Document'&&url.hostname==='toss-order.tossplace.com'){
   traces.push(url.pathname);const cart=/\/cart\/?$/.test(url.pathname);
   if(cart){
    // Render the rows as they are when the response arrives, like a server would.
    const doc={requestedAt:Date.now(),fulfilledAt:0};cartDocs.push(doc);
    setTimeout(()=>{doc.fulfilledAt=Date.now();fulfillHtml(p.requestId,html(true));},cartDelay);
   }else if(/\/checkout\/?$/.test(url.pathname))fulfillHtml(p.requestId,'<!doctype html><html lang="ko"><body><main><h1>결제 단계 검증</h1><p>실제 결제는 발생하지 않습니다.</p></main></body></html>');
   else if(!url.pathname.endsWith('/menu')){qrReads++;call('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:302,responseHeaders:[{name:'Location',value:menu.href}]}).catch(()=>{});}
   else fulfillHtml(p.requestId,html(false));
  }else call('Fetch.continueRequest',{requestId:p.requestId}).catch(()=>{});
 }
};
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;}
async function navigate(url){await call('Page.navigate',{url});await delay(2500);}
let warning=false,complete=false,backChecked=false,rested=false,rearmed=false;
try{
 await call('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
 await navigate(menu.href);
 if(start==='cart')await navigate(cartUrl.href);
 if(start==='checkout-external')await navigate(checkoutUrl.href);
 if(start.endsWith('external')){await navigate(external);assert.equal((await call('Runtime.evaluate',{expression:'location.href',returnByValue:true})).result.value,external);}
 // A real Android touch (outside WebView) must reset the native clock too.
 const before=nativeUi();run('shell','input','tap','80','50');resetAt=Date.now();await delay(1500);const after=nativeUi();
 assert.ok(!after.continueVisible,'The continue button must not be shown');
 // A checkout that continued elsewhere shows the waiting state instead of a countdown.
 if(start==='checkout-external')assert.ok(after.text?.includes('대기'),'Expected waiting after checkout: '+after.text);
 else assert.ok(secondsLeft(after.text)>=interval-7&&secondsLeft(after.text)<=interval,'Native touch did not reset the seconds timer: '+after.text);
 fs.writeFileSync(output+'/native-touch-reset.json',JSON.stringify({before:before.text,after:after.text},null,2));screenshot('countdown');
 if(start==='checkout-external'){
  // A checkout that continued to another site may be a payment. Never leave it automatically.
  await delay((interval+15)*1000);const ui=nativeUi();screenshot('checkout-external-waiting');
  const result={pass:cycleCarts().length===0&&deletions.length===0&&qrEntryReads===0&&ui.text?.includes('대기'),intervalSeconds:interval,start,countdown:ui.text,cartReads:cycleCarts().length,deletions,qrEntryReads,traces};
  fs.writeFileSync(output+'/native-cycle-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
  assert.ok(result.pass,'Left a checkout that continued to another site');
 }else{
  const started=Date.now();let lastLog=-1;
  while(Date.now()-started<(interval+40)*1000){
   // Avoid repeatedly blocking CDP interception with synchronous accessibility dumps.
   // Inspect the actual warning once; let the event loop service cart responses between polls.
   const elapsed=Date.now()-started;
   if(!warning&&elapsed>=Math.max(3000,(interval-60)*1000+3000)){const ui=nativeUi();assert.ok(ui.text?.includes('초 후'),ui.text);assert.ok(!ui.continueVisible,'The continue button must not be shown');warning=true;screenshot('warning');fs.writeFileSync(output+'/warning-ui.xml',ui.xml);console.log('Native 60-second warning is visible');}
   if(!backChecked&&cycleCarts().length===1&&deletions.length>0&&deletions.length<3){
    const state=await evaluate('window.__roomMaintenance?.snapshot()');
    if(state?.safe&&state?.cart){
     for(let n=0;n<3;n++)run('shell','input','keyevent','4');
     fs.writeFileSync(output+'/back-check.json',JSON.stringify({before:state,after:await evaluate('window.__roomMaintenance?.snapshot()'),traces},null,2));
     backChecked=true;
    }
   }
   if(cycleCarts().length>=2&&qrReads>=1&&deletions.length===3){
    const state=await evaluate('window.__roomMaintenance?.snapshot()');
    // After a clean menu the countdown is hidden until the next touch.
    if(state?.safe&&state?.menu){await delay(1500);const ui=nativeUi();if(ui.text===undefined){complete=true;screenshot('refresh-complete');break;}if(ui.text?.includes('중단'))break;}
   }
   const minute=Math.floor(elapsed/60000);if(minute!==lastLog){lastLog=minute;const progress={minute,cartReads:cycleCarts().length,deletions:deletions.length,qrReads};fs.writeFileSync(output+'/cycle-progress.json',JSON.stringify(progress));console.log(JSON.stringify(progress));}
   await delay(cycleCarts().length>0?200:3500);
  }
  fs.writeFileSync(output+'/latest-cycle-observation.json',JSON.stringify({warning,complete,backChecked,cartDocs,deletions,qrReads,qrEntryAt,traces,state:await evaluate('window.__roomMaintenance?.snapshot()')},null,2));
  assert.ok(warning,'No warning observed');assert.ok(complete,'Native cycle did not finish at rest');assert.ok(backChecked,'Back navigation during cleanup was not tested');
  assert.deepEqual(deletions,[1,2,3]);assert.equal(cycleCarts().length,2);assert.equal(qrEntryReads,1);assert.equal(forwardedWrites,0);
  const [deleteDoc,verifyDoc]=cycleCarts();
  // Only the freshly loaded documents may be acted on, however slow they arrive.
  assert.ok(firstDeleteAt>deleteDoc.fulfilledAt,'Deleted on the previous page before the fresh cart arrived');
  assert.ok(qrEntryAt[0]>verifyDoc.fulfilledAt,'Verified the previous page before the fresh cart arrived');
  const firstDeletionSeconds=(firstDeleteAt-resetAt)/1000;
  assert.ok(firstDeletionSeconds>=interval-1&&firstDeletionSeconds<=interval+15,'Cleanup did not run at the selected seconds deadline: '+firstDeletionSeconds);
  // Unattended: no second cycle, no further QR entry.
  const restFrom={carts:cartDocs.length,qr:qrEntryReads};await delay((interval+10)*1000);
  const restUi=nativeUi();rested=cartDocs.length===restFrom.carts&&qrEntryReads===restFrom.qr&&restUi.text===undefined;
  assert.ok(rested,'Repeated cleanup without a touch: '+JSON.stringify({restFrom,carts:cartDocs.length,qrEntryReads,countdown:restUi.text}));
  run('shell','input','tap','80','50');await delay(1500);const again=nativeUi();screenshot('rearmed');
  rearmed=secondsLeft(again.text)>=interval-7&&secondsLeft(again.text)<=interval;
  assert.ok(rearmed,'A touch did not start the next cycle: '+again.text);
  const result={pass:true,intervalSeconds:interval,start,cartDelayMs:cartDelay,firstDeletionSeconds,warning,touchReset:true,backDuringCleanupBlocked:backChecked,
   freshDeleteAfterMs:firstDeleteAt-deleteDoc.fulfilledAt,freshVerifyBeforeQrMs:qrEntryAt[0]-verifyDoc.fulfilledAt,restedSeconds:interval+10,rearmed,
   cartReads:cycleCarts().length,deletions,qrEntryReads,qrRedirectDelayMs:3000,qrReads,traces,mutationsForwardedToServer:forwardedWrites};
  fs.writeFileSync(output+'/native-cycle-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }
}finally{
 await call('Fetch.disable').catch(()=>{});await call('Page.navigate',{url:menu.href}).catch(()=>{});
 for(const p of pending.values())clearTimeout(p.timer);ws.close();
}
