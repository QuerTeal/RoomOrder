// Exercises existing menu/detail navigation in a forwarded DEBUG WebView; never adds or orders.
import assert from 'node:assert/strict';
const pages = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const page = pages.find(p => p.type === 'page' && p.url.startsWith('https://toss-order.tossplace.com/'));
assert.ok(page, 'No debug Toss WebView');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map(), mutations = [];
ws.onmessage = event => {
    const value = JSON.parse(event.data);
    if (value.method === 'Network.requestWillBeSent') {
        const request = value.params.request;
        if (request.method !== 'GET' && /\/api-public\/.*\/(cart\/checkout|orders|cart\/line-items)/.test(request.url)) mutations.push(request.url);
    }
    const entry = pending.get(value.id);
    if (entry) { clearTimeout(entry.timer); pending.delete(value.id); value.error ? entry.reject(Error(JSON.stringify(value.error))) : entry.resolve(value.result); }
};
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
function call(method, params = {}) {
    return new Promise((resolve, reject) => {
        const key = ++id, timer = setTimeout(() => { pending.delete(key); reject(Error('Timeout: ' + method)); }, 10000);
        pending.set(key, {resolve, reject, timer}); ws.send(JSON.stringify({id: key, method, params}));
    });
}
async function evaluate(expression) {
    const result = await call('Runtime.evaluate', {expression, returnByValue: true});
    assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails)); return result.result.value;
}
async function waitPage(kind) {
    for (let attempt = 0; attempt < 40; attempt++) {
        if (await evaluate(`document.documentElement.dataset.roomPage === ${JSON.stringify(kind)} && !window.__roomInteraction?.state().busy`)) return;
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw Error('Page did not become ' + kind);
}
try {
    await call('Network.enable'); await waitPage('menu');
    const initial = await evaluate('location.href');
    const started = Date.now();
    for (let round = 1; round <= 20; round++) {
        assert.equal(await evaluate(`(() => { if (document.documentElement.dataset.roomPage !== 'menu') return false; const button = document.querySelector('[data-room-card] > li.tds-mobile-list-row button[aria-labelledby]'); if (!button) return false; button.click(); return true; })()`), true);
        await waitPage('detail');
        await new Promise(resolve => setTimeout(resolve, 400));
        await evaluate('history.back()'); await waitPage('menu');
        await new Promise(resolve => setTimeout(resolve, 400));
        if (round % 5 === 0) console.error('Verified menu/detail round ' + round);
    }
    assert.equal(await evaluate('location.href'), initial); assert.equal(mutations.length, 0);
    console.log(JSON.stringify({pass: true, rounds: 20, elapsedMs: Date.now() - started, sameRoom: true, orderMutations: 0}, null, 2));
} finally { for (const entry of pending.values()) clearTimeout(entry.timer); ws.close(); }
