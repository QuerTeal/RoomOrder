// Resting session keep-alive with local fixtures (about 22 minutes). All network writes are intercepted.
// Set the dev app to 60/80/100 seconds first and pass the same --seconds.
// 1. Cleanup ends at rest (countdown hidden).  2. About 10 minutes later the room QR reopens once, still resting.
// 3. A display-only dialog defers the keep-alive; the first page touch then reopens the QR instead of reaching the page.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const interval=Number(process.argv.find(v=>v.startsWith('--seconds='))?.split('=')[1]??60);
assert.ok([60,80,100].includes(interval),'Use --seconds=60, 80 or 100');
const refreshMs=10*60_000;
const output=process.argv.find(v=>v.startsWith('--output='))?.slice(9)||'captures/session-v261';fs.mkdirSync(output,{recursive:true});
const adb=process.env.LOCALAPPDATA+'/Android/Sdk/platform-tools/adb.exe',serial='emulator-5554';
const run=(...args)=>execFileSync(adb,['-s',serial,...args],{windowsHide:true,timeout:15000});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function nativeUi(){run('shell','uiautomator','dump','/sdcard/keepalive-ui.xml');const xml=run('shell','cat','/sdcard/keepalive-ui.xml').toString();const node=xml.match(/<node\b[^>]*resource-id="[^"]*:id\/idle_countdown"[^>]*>/)?.[0];return {text:node?.match(/text="([^"]*)"/)?.[1]?.replaceAll('&#10;','\n'),xml};}
function secondsLeft(text=''){const mmss=text.match(/(\d+):(\d+)/);return mmss?Number(mmss[1])*60+Number(mmss[2]):Number(text.match(/^(\d+)초 후/)?.[1]??NaN);}
const screenshot=name=>fs.writeFileSync(`${output}/${name}.png`,run('exec-out','screencap','-p'));
const pages=await(await fetch('http://127.0.0.1:9222/json/list')).json();
const page=pages.find(p=>p.type==='page'&&p.url.startsWith('https://toss-order.tossplace.com/'));
assert.ok(page,'No debug WebView');
const menu=new URL(page.url);menu.pathname=menu.pathname.replace(/\/(menu|cart|checkout|order)(\/.*)?$/,'/menu');
const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),qrEntryAt=[],cartAt=[],pageTouches=[],log=[];let id=0,forwardedWrites=0;
function call(method,params={}){return new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error(method));},15000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));});}
const headers=[{name:'Access-Control-Allow-Origin',value:'https://toss-order.tossplace.com'},{name:'Access-Control-Allow-Credentials',value:'true'}];
const fulfillHtml=(requestId,body)=>call('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/html; charset=utf-8'}],body:Buffer.from(body).toString('base64')}).catch(()=>{});
function html(cart){
 const data={props:{pageProps:{_nextI18Next:{initialI18nStore:{ko:{common:{'cart-page':{'empty-cart':'담은 메뉴가 없어요'}}}}}}}};
 return `<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:24px sans-serif;margin:24px}</style></head><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script><main>${cart?'<p>담은 메뉴가 없어요</p>':'<h1>세션 유지 검증 화면</h1><div role="tablist"><button role="tab">로컬 표시 테스트</button></div><p>실제 주문은 발생하지 않습니다.</p>'}</main><script>addEventListener('pointerdown',()=>console.log('qa-page-touch'),true)</script></body></html>`;
}
const note=(event,extra={})=>{const entry={at:new Date().toISOString(),event,...extra};log.push(entry);console.log(JSON.stringify(entry));};
ws.onmessage=e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}
 if(m.method==='Runtime.consoleAPICalled'&&m.params.args?.[0]?.value==='qa-page-touch')pageTouches.push(Date.now());
 if(m.method==='Fetch.requestPaused'){
  const p=m.params,url=new URL(p.request.url);
  if(!['GET','HEAD','OPTIONS'].includes(p.request.method))call('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:204,responseHeaders:headers}).catch(()=>{});
  else if(p.resourceType==='Document'&&url.hostname==='toss.place'){
   qrEntryAt.push(Date.now());note('qr-entry',{count:qrEntryAt.length});
   const target=new URL(menu);target.pathname=target.pathname.replace(/\/menu\/?$/,'');
   fulfillHtml(p.requestId,`<!doctype html><html><body>Local QR redirect test<script>setTimeout(()=>location.replace(${JSON.stringify(target.href)}),3000)</script></body></html>`);
  }else if(p.resourceType==='Document'&&url.hostname==='toss-order.tossplace.com'){
   if(/\/cart\/?$/.test(url.pathname)){cartAt.push(Date.now());fulfillHtml(p.requestId,html(true));}
   else if(!url.pathname.endsWith('/menu'))call('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:302,responseHeaders:[{name:'Location',value:menu.href}]}).catch(()=>{});
   else fulfillHtml(p.requestId,html(false));
  }else call('Fetch.continueRequest',{requestId:p.requestId}).catch(()=>{});
 }
};
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;}
async function menuReady(){for(let n=0;n<60;n++){const s=await evaluate('window.__roomMaintenance?.snapshot()').catch(()=>null);if(s?.safe&&s?.menu)return s;await delay(500);}throw Error('Fixture menu did not become ready');}
async function waitFor(check,ms,label){const until=Date.now()+ms;while(Date.now()<until){if(check())return;await delay(1000);}throw Error('Timed out: '+label);}
const result={intervalSeconds:interval,refreshMinutes:refreshMs/60000};
try{
 await call('Runtime.enable');
 await call('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
 await call('Page.navigate',{url:menu.href});await menuReady();
 // A real touch on the native rail starts a fresh cleanup cycle.
 run('shell','input','tap','80','50');const resetAt=Date.now();note('native-touch');
 await waitFor(()=>qrEntryAt.length>=1,(interval+60)*1000,'cleanup QR entry');
 await menuReady();await delay(2500);
 const rested=nativeUi();assert.equal(rested.text,undefined,'Countdown still visible after cleanup: '+rested.text);
 const entry1=qrEntryAt[0];result.cleanupSeconds=Math.round((entry1-resetAt)/1000);result.cleanupCartReads=cartAt.length;
 note('resting',{cleanupSeconds:result.cleanupSeconds});screenshot('resting');
 // Keep-alive: one quiet reopen about 10 minutes after rest began, no cleanup cycle in between.
 await delay(refreshMs/2);const middle=nativeUi();assert.equal(middle.text,undefined,'Countdown appeared while resting');
 assert.equal(qrEntryAt.length,1,'Reopened the QR early');
 await waitFor(()=>qrEntryAt.length>=2,refreshMs/2+60_000,'keep-alive QR entry');
 const entry2=qrEntryAt[1];result.keepAliveAfterSeconds=Math.round((entry2-entry1)/1000);
 assert.ok(entry2-entry1>=refreshMs&&entry2-entry1<=refreshMs+40_000,'Keep-alive timing: '+result.keepAliveAfterSeconds+'s');
 assert.equal(cartAt.length,result.cleanupCartReads,'A cleanup cycle ran while resting');
 await menuReady();await delay(3000);
 const afterKeepAlive=nativeUi();assert.equal(afterKeepAlive.text,undefined,'Keep-alive ended the rest: '+afterKeepAlive.text);
 const history=await call('Page.getNavigationHistory');result.historyEntriesAfterKeepAlive=history.entries.length;
 assert.equal(history.entries.length,1,'Replaced menu history was not cleared');
 screenshot('after-keepalive');note('keep-alive',{afterSeconds:result.keepAliveAfterSeconds});
 // Fallback: an unsafe page defers the keep-alive; the first page touch after the interval reopens the QR.
 await evaluate(`document.body.insertAdjacentHTML('beforeend','<div role="dialog" style="position:fixed;right:16px;bottom:16px;padding:12px;background:#eef">표시 전용 검증 팝업</div>'),true`);
 await delay(entry2+refreshMs+20_000-Date.now());
 assert.equal(qrEntryAt.length,2,'Reopened the QR while a dialog was visible');
 const deferred=nativeUi();assert.equal(deferred.text,undefined,'Rest ended without a touch');
 const [width,height]=run('shell','wm','size').toString().match(/(\d+)x(\d+)/).slice(1).map(Number);
 const tap=[Math.round(width*0.6),Math.round(height*0.55)];const touchesBefore=pageTouches.length;
 run('shell','input','tap',String(tap[0]),String(tap[1]));const tapAt=Date.now();note('page-touch',{tap});
 await waitFor(()=>qrEntryAt.length>=3,5000,'QR entry after the first touch');
 result.touchReopenMs=qrEntryAt[2]-tapAt;assert.ok(result.touchReopenMs<2000,'Touch reopen was slow: '+result.touchReopenMs);
 result.touchReachedPage=pageTouches.length>touchesBefore;assert.equal(result.touchReachedPage,false,'The stale touch reached the page');
 await menuReady();await delay(2000);
 const cycle=nativeUi();result.countdownAfterTouch=cycle.text;screenshot('after-touch');
 assert.ok(secondsLeft(cycle.text)>=interval-20&&secondsLeft(cycle.text)<=interval,'The touch did not start a new cycle: '+cycle.text);
 result.qrEntries=qrEntryAt.length;result.mutationsForwardedToServer=forwardedWrites;result.pass=true;
 fs.writeFileSync(output+'/keepalive-results.json',JSON.stringify({...result,log},null,2));console.log(JSON.stringify(result,null,2));
}finally{
 if(!result.pass)fs.writeFileSync(output+'/keepalive-results.json',JSON.stringify({...result,qrEntryAt,cartAt,pageTouches,log},null,2));
 await call('Fetch.disable').catch(()=>{});await call('Page.navigate',{url:menu.href}).catch(()=>{});
 for(const p of pending.values())clearTimeout(p.timer);ws.close();
}
