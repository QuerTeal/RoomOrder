import fs from 'node:fs';
const pages = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const page = pages.find(p => p.type === 'page' && p.url.startsWith('https://toss-order.tossplace.com/'));
if (!page) throw new Error('No Toss WebView target');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let nextId=0; const pending=new Map();
ws.onmessage = e => {const m=JSON.parse(e.data); if(pending.has(m.id)){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);m.error?reject(m.error):resolve(m.result);}};
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
function call(method,params={}) {return new Promise((resolve,reject)=>{const id=++nextId;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
try {
 const expression=fs.readFileSync(process.argv[2],'utf8');
 const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 if(result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
 console.log(JSON.stringify(result.result.value,null,2));
} finally {ws.close();}
