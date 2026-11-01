// A stopped cleanup retries by itself, a bounded number of times. All network traffic stays local.
// --blank=n|all  cart documents that never draw their contents, so cleanup stops on them
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const arg=(name,fallback)=>process.argv.find(v=>v.startsWith(`--${name}=`))?.split('=')[1]??fallback;
const interval=Number(arg('seconds',60)),blankArg=arg('blank','1'),maxRetries=3;
let blanks=blankArg==='all'?Infinity:Number(blankArg);
const output=`captures/idle-retry/blank-${blankArg}`;fs.mkdirSync(output,{recursive:true});
const adb=process.env.LOCALAPPDATA+'/Android/Sdk/platform-tools/adb.exe',serial='emulator-5554';
const run=(...args)=>execFileSync(adb,['-s',serial,...args],{windowsHide:true,timeout:15000});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function countdown(){run('shell','uiautomator','dump','/sdcard/idle-ui.xml');const xml=run('shell','cat','/sdcard/idle-ui.xml').toString();return xml.match(/<node\b[^>]*resource-id="[^"]*:id\/idle_countdown"[^>]*>/)?.[0]?.match(/text="([^"]*)"/)?.[1]?.replaceAll('&#10;','\n');}
let page;
for(let attempt=0;attempt<30&&!page;attempt++){
 try{const pages=await(await fetch('http://127.0.0.1:9222/json/list')).json();page=pages.find(p=>p.type==='page'&&p.url.startsWith('https://toss-order.tossplace.com/'));}catch{}
 if(!page)await delay(1000);
}
assert.ok(page,'Ordering WebView did not become ready within 30 seconds');
const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map();let id=0,items=[1,2,3];const deletions=[],carts=[],log=[];
const menu=new URL(page.url);menu.pathname=menu.pathname.replace(/\/(menu|cart|checkout|order)(\/.*)?$/,'/menu');
function call(method,params={}){return new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error(method));},15000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));});}
const api=[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'https://toss-order.tossplace.com'},{name:'Access-Control-Allow-Credentials',value:'true'}];
const fulfillHtml=(requestId,body)=>call('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/html; charset=utf-8'}],body:Buffer.from(body).toString('base64')}).catch(()=>{});
function html(kind){
 const data={props:{pageProps:{_nextI18Next:{initialI18nStore:{ko:{common:{'cart-page':{'empty-cart':'담은 메뉴가 없어요'}}}}}}}};
 const head=`<!doctype html><html lang="ko"><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>`;
 if(kind==='menu')return head+'<main><h1>자동 정리 재시도 검증</h1><div role="tablist"><button role="tab">로컬</button></div></main></body></html>';
 if(kind==='blank')return head+'<main></main></body></html>';
 return head+`<main></main><script>let items=${JSON.stringify(items)};function render(){const main=document.querySelector('main');main.innerHTML=items.length?'<article>'+items.map(id=>'<div><li class="tds-mobile-list-row"><span>검증 '+id+'</span><span data-tds-mobile-component="ListRowRight"><button data-id="'+id+'">삭제</button></span></li></div>').join('')+'</article>':'<p>담은 메뉴가 없어요</p>';for(const b of main.querySelectorAll('button'))b.parentElement.onclick=async()=>{const id=Number(b.dataset.id),r=await fetch('https://api-public.tossplace.com/api-public/table-order/v1/merchants/codex-idle-test/cart/line-items/'+id,{method:'DELETE'});if(r.ok){items=items.filter(n=>n!==id);render();}};}render();</script></body></html>`;
}
ws.onmessage=e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}
 if(m.method!=='Fetch.requestPaused')return;
 const q=m.params,url=new URL(q.request.url),method=q.request.method;
 if(method==='DELETE'&&url.pathname.includes('/merchants/codex-idle-test/cart/line-items/')){
  const item=Number(url.pathname.split('/').at(-1));deletions.push(item);items=items.filter(n=>n!==item);
  call('Fetch.fulfillRequest',{requestId:q.requestId,responseCode:200,responseHeaders:api,body:Buffer.from('{}').toString('base64')}).catch(()=>{});
 }else if(!['GET','HEAD','OPTIONS'].includes(method))call('Fetch.fulfillRequest',{requestId:q.requestId,responseCode:204,responseHeaders:api}).catch(()=>{});
 else if(q.resourceType==='Document'&&url.hostname==='toss.place'){
  const target=new URL(menu);target.pathname=target.pathname.replace(/\/menu\/?$/,'');
  fulfillHtml(q.requestId,`<!doctype html><html><body><script>location.replace(${JSON.stringify(target.href)})</script></body></html>`);
 }else if(q.resourceType==='Document'&&url.hostname==='toss-order.tossplace.com'){
  if(/\/cart\/?$/.test(url.pathname)){const blank=blanks>0;if(blank)blanks--;carts.push({at:Date.now(),blank});fulfillHtml(q.requestId,html(blank?'blank':'cart'));}
  else if(!url.pathname.endsWith('/menu'))call('Fetch.fulfillRequest',{requestId:q.requestId,responseCode:302,responseHeaders:[{name:'Location',value:menu.href}]}).catch(()=>{});
  else fulfillHtml(q.requestId,html('menu'));
 }else call('Fetch.continueRequest',{requestId:q.requestId}).catch(()=>{});
};
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
try{
 await call('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
 await call('Page.navigate',{url:menu.href});await delay(2500);
 run('shell','input','tap','80','50');
 const started=Date.now(),limit=blankArg==='all'?(interval+30)*(maxRetries+1)+interval+30:(interval+30)*2+30;
 let stopped=0,last='',rested=false,restedAt=0;
 while(Date.now()-started<limit*1000){
  await delay(2000);const text=countdown();
  if(text!==last&&!/^\d+:\d+|\d+초 후|자동 정리 \d/.test(text??'')){log.push({second:Math.round((Date.now()-started)/1000),text:text??null});}
  if(text?.includes('중단')&&!last?.includes('중단'))stopped++;
  last=text;
  if(blankArg!=='all'&&text===undefined&&deletions.length===3){rested=true;restedAt=Date.now();break;}
 }
 const result={blank:blankArg,stopped,rested,deletions,cartDocuments:carts.length,blankDocuments:carts.filter(c=>c.blank).length,finalText:last??null,log};
 if(blankArg==='all'){
  // Out of retries: stays stopped and leaves the page alone until a touch.
  assert.equal(carts.length,maxRetries+1,'Expected the first cycle and '+maxRetries+' retries');assert.ok(last?.includes('중단'),'Expected the stopped label: '+last);assert.equal(deletions.length,0);
  run('shell','input','tap','80','50');await delay(2500);result.afterTouch=countdown();assert.ok(/자동 정리 \d|\d+초 후/.test(result.afterTouch??''),'A touch did not start a new cycle: '+result.afterTouch);
 }else{
  assert.ok(stopped>=1,'Cleanup never stopped, nothing was retried');assert.ok(rested,'Retry did not reach rest: '+JSON.stringify(result));assert.deepEqual(deletions,[1,2,3]);
  await delay((interval+10)*1000);const carried=carts.length;result.restCountdown=countdown()??null;assert.equal(result.restCountdown,null,'Repeated after rest');assert.equal(carts.length,carried);
 }
 result.pass=true;fs.writeFileSync(output+'/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{
 await call('Fetch.disable').catch(()=>{});await call('Page.navigate',{url:menu.href}).catch(()=>{});
 for(const p of pending.values())clearTimeout(p.timer);ws.close();
}
