import fs from 'node:fs';
import assert from 'node:assert/strict';

// Debug WebView only. Forward the selected process socket to localhost:9222 first.
const pages = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const page = pages.find(p => p.type==='page' && p.url.startsWith('https://toss-order.tossplace.com/'));
assert.ok(page,'No Toss debug WebView');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id=0;const pending=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
function call(method,params={}){return new Promise((resolve,reject)=>{const key=++id;const timer=setTimeout(()=>{pending.delete(key);reject(Error('Timed out: '+method));},15000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));});}
try {
  const resources=fs.readFileSync('app/src/main/res/values/strings.xml','utf8');
  const titles=name=>[...resources.match(new RegExp(`<string-array name="${name}">([\\s\\S]*?)<\\/string-array>`))[1].matchAll(/<item>(.*?)<\/item>/g)].map(m=>m[1]);
  const script=fs.readFileSync('app/src/main/assets/session-state.js','utf8')
    .replace('__ROOM_TERMINAL_TITLES__',JSON.stringify(titles('session_ended_titles')))
    .replace('__ROOM_EXPIRED_TITLES__',JSON.stringify(titles('session_expired_titles')))
    .replace('__ROOM_UNAVAILABLE_TITLES__',JSON.stringify(titles('page_unavailable_titles')));
  const cases=fs.readFileSync('scripts/tests/session-dom-cases.js','utf8');
  const r=await call('Runtime.evaluate',{expression:`${cases}\ncheckSessionDom(${JSON.stringify(script)})`,awaitPromise:true,returnByValue:true});
  assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));
  console.log(JSON.stringify({sessionDom:r.result.value},null,2));
} finally {for(const p of pending.values())clearTimeout(p.timer);ws.close();}
