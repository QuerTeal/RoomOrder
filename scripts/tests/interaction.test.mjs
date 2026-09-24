import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
let now = 1000, timerId = 0;
const timers = new Map(), listeners = new Map(), calls = [], routes = new Map();
class Element {
  isConnected = false; attributes = new Map();
  appendChild(child) { child.isConnected = true; }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  closest() { return this; }
}
class Xhr {
  listeners = new Map();
  open(method, url) { this.method = method; this.url = url; }
  send(body) { this.body = body; }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
}
const context = {
  Element, Request, URL, XMLHttpRequest: Xhr, Promise,
  MutationObserver: class { observe() {} },
  document: {documentElement:new Element(),head:new Element(),body:new Element(),readyState:'complete',createElement:()=>new Element()},
  location: new URL('https://toss-order.tossplace.com/table/test/menu'),
  history: {pushState(){},replaceState(){},back(){context.history.backCalls++;},backCalls:0},
  performance: {now:()=>now},
  setTimeout(callback, delay) { const id=++timerId;timers.set(id,{at:now+delay,callback});return id; },
  clearTimeout(id) { timers.delete(id); },
  addEventListener(name, callback) { listeners.set(name, callback); },
  fetch(...args) { return new Promise((resolve,reject)=>calls.push({args,resolve,reject})); },
  __roomTablet: {apply(){}}, next: {router:{isReady:true,basePath:'/table',push(){throw Error('Result review must reload with a GET, not duplicate the router base path');},events:{on(name, callback){routes.set(name,callback);}}}}
};
context.window=context; context.top=context;
context.location.assign = url => { context.location.href=url; };
vm.runInNewContext(fs.readFileSync('app/src/main/assets/interaction.js','utf8'), context);
function advance(ms) {
  const end=now+ms;
  while (true) {
    const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];
    if (!next || next[1].at>end) break;
    now=next[1].at; timers.delete(next[0]); next[1].callback();
  }
  now=end;
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function event(name, target=new Element()) {
  const event={target,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};
  listeners.get(name)(event); return !event.prevented;
}
const click=target=>event('click',target);
function covered(expected) {
  assert.equal(context.__roomInteraction.state().cover,expected,'Native bridge cover');
  assert.equal(context.document.documentElement.attributes.has('data-room-busy'),expected,'Web cover');
}
covered(true);
assert.equal(context.__roomInteraction.state().sessionRecoveryAllowed,false);
advance(1000); assert.equal(context.__roomInteraction.state().busy,false);
assert.equal(context.__roomInteraction.state().sessionRecoveryAllowed,true);
covered(false);
// Local quantity steps and opening/closing a delete dialog must never hide the page.
for(let n=0;n<3;n++) {
  assert.equal(click(),true); covered(false); assert.equal(click(),false);
  advance(1000); covered(false); assert.equal(context.__roomInteraction.state().busy,false);
}
const submitButton=Object.assign(new Element(),{type:'submit',form:{}});
assert.equal(click(submitButton),true);assert.equal(event('submit'),true);covered(false);
assert.equal(event('submit'),false);advance(1000);
// A delayed route start promotes the silent gate; completion is required to uncover.
assert.equal(click(),true);covered(false);
routes.get('routeChangeStart')('/table/test/cart');covered(true);
advance(10000);covered(true);assert.equal(context.__roomInteraction.back(),false);
routes.get('routeChangeComplete')('/table/test/cart');advance(1000);covered(false);
assert.equal(click(),true);
const request=new Request('https://api-public.tossplace.com/api-public/table-order/v1/merchants/test/cart/line-items',{method:'POST',body:'test-body'});
const promise=context.fetch(request);
covered(true);
assert.equal(context.__roomInteraction.state().sessionRecoveryAllowed,false);
advance(12000);
assert.equal(context.__roomInteraction.state().phase,'slow');
for(let i=0;i<20;i++) assert.equal(click(),false);
assert.equal(context.__roomInteraction.back(),false); assert.equal(context.history.backCalls,0);
assert.equal(calls.length,1); assert.equal(calls[0].args[0],request);
let finishBody;
const response={ok:true,clone:()=>({arrayBuffer:()=>new Promise(resolve=>{finishBody=resolve;})})};
calls[0].resolve(response); assert.equal(await promise,response); await flush();
advance(10000); assert.equal(context.__roomInteraction.state().busy,true,'Headers alone must not unlock input');
finishBody(); await flush(); advance(1000); assert.equal(context.__roomInteraction.state().busy,false);
assert.equal(context.__roomInteraction.back(),true); assert.equal(context.__roomInteraction.back(),false);
advance(1000); assert.equal(context.history.backCalls,1);
const xhr=new context.XMLHttpRequest(); xhr.open('PATCH','https://api-public.tossplace.com/api-public/table-order/v1/merchants/test/cart/line-items/one');xhr.send('unaltered');
covered(false);advance(15000);covered(false);assert.equal(click(),false);assert.equal(xhr.body,'unaltered');
for(const name of ['pointerdown','pointerup','touchstart','touchend','mousedown','mouseup','keydown','keyup'])assert.equal(event(name),false,'Blocked busy '+name);
xhr.status=200; xhr.listeners.get('loadend')(); advance(1000);assert.equal(context.__roomInteraction.state().busy,false);
for(const name of ['pointerdown','pointerup','touchstart','touchend','mousedown','mouseup','keydown','keyup'])assert.equal(event(name),true,'Restored '+name);
assert.equal(click(),true);
const deletion=context.fetch('https://api-public.tossplace.com/api-public/table-order/v1/merchants/test/cart/line-items/one',{method:'DELETE'});
covered(false);advance(12000);covered(false);assert.equal(click(),false);
calls.at(-1).resolve({ok:true,clone:()=>({arrayBuffer:async()=>new ArrayBuffer(0)})});
await deletion;await flush();advance(1000);covered(false);assert.equal(context.__roomInteraction.state().busy,false);
const uncertainEdit=context.fetch('https://api-public.tossplace.com/api-public/table-order/v1/merchants/test/cart/line-items/one',{method:'PATCH'}).catch(error=>error);
covered(false);calls.at(-1).reject(new Error('offline'));await uncertainEdit;await flush();
covered(true);assert.equal(context.__roomInteraction.state().phase,'uncertain_cart');
assert.equal(context.__roomInteraction.state().sessionRecoveryAllowed,true);
assert.equal(context.__roomInteraction.review(),true);assert.equal(context.location.pathname,'/table/test/cart');advance(1000);covered(false);
const rejected=context.fetch('https://api-public.tossplace.com/api-public/table-order/v2/merchants/test/orders',{method:'POST'}).catch(error=>error);
covered(true);
const failure=new Error('offline');calls.at(-1).reject(failure);assert.equal(await rejected,failure);
await flush();advance(30000);assert.equal(context.__roomInteraction.state().busy,true);
assert.equal(context.__roomInteraction.state().phase,'uncertain_order');assert.equal(click(),false);
assert.equal(context.__roomInteraction.state().sessionRecoveryAllowed,false);
assert.equal(context.__roomInteraction.review(),true);assert.equal(context.location.pathname,'/table/test/order/history');
assert.equal(calls.length,4,'The guard must not replay a failed request');
console.log('PASS: local controls and cart PATCH/DELETE stay visible; navigation/add/order and uncertain results are covered; slow requests, duplicate input, response body wait, unchanged requests and no retries');
