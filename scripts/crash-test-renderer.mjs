// Deliberately crashes only the renderer of a forwarded DEBUG WebView. Never submit an order.
const pages = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const page = pages.find(p => p.type === 'page' && p.url.startsWith('https://toss-order.tossplace.com/'));
if (!page) throw new Error('No debug Toss WebView');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
console.log('Crashing the selected debug renderer; check RoomRecovery and the new room PID afterward.');
ws.send(JSON.stringify({id: 1, method: 'Page.crash'}));
await new Promise(resolve => {
    const timeout = setTimeout(resolve, 5000);
    ws.onclose = () => { clearTimeout(timeout); resolve(); };
    ws.onmessage = event => {
        const value = JSON.parse(event.data);
        if (value.error) console.log(JSON.stringify(value.error));
    };
});
ws.close();
