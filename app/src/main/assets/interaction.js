/* Observe original requests and gate user input. Never create, retry or alter an order request. */
(() => {
  if (window !== window.top || location.origin !== 'https://toss-order.tossplace.com' || window.__roomInteraction) return;
  const config = window.__roomConfig || {};
  let busy = true, cover = true, initial = true, navigating = false, requests = 0, epoch = 0, uncertain = '';
  let since = performance.now(), changed = since, earliest = since, timer, router, lastMessage = '';
  const style = document.createElement('style');
  style.textContent = 'html[data-room-busy] body{visibility:hidden!important}html[data-room-busy]::after{content:attr(data-room-busy);position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:var(--room-bg,#f4f6fa);color:var(--room-ink,#192438);font:24px/1.6 sans-serif;white-space:pre-line;text-align:center;padding:32px;box-sizing:border-box}';
  function state() { return {busy, cover, sessionRecoveryAllowed: !busy || (uncertain === 'cart' && !requests && !navigating), phase: uncertain && !requests ? 'uncertain_' + uncertain : performance.now() - since > 8000 ? 'slow' : requests ? 'processing' : 'loading', epoch, href: location.href}; }
  function publish() {
    const html = document.documentElement;
    const current = state();
    if (html) {
      if (!style.isConnected) (document.head || html).appendChild(style);
      if (cover) html.setAttribute('data-room-busy', config[current.phase] || config.loading || '');
      else html.removeAttribute('data-room-busy');
    }
    const message = JSON.stringify(current);
    if (message !== lastMessage) { lastMessage = message; window.RoomUi?.postMessage(message); }
  }
  function begin(showCover = true) {
    if (!busy) { since = performance.now(); epoch++; }
    busy = true; cover = cover || showCover;
    earliest = performance.now() + 600; changed = performance.now(); publish(); schedule();
  }
  function wireRouter() {
    const candidate = window.next?.router;
    if (!candidate?.events || router === candidate) return;
    router = candidate;
    router.events.on('routeChangeStart', url => { navigating = url || true; begin(); });
    const end = url => { if (navigating === url) navigating = false; changed = performance.now(); window.__roomTablet?.apply(); schedule(); };
    router.events.on('routeChangeComplete', end); router.events.on('routeChangeError', (_error, url) => end(url));
  }
  function settle() {
    clearTimeout(timer); wireRouter();
    const now = performance.now();
    if (initial) {
      const ready = document.readyState !== 'loading' && document.body &&
        (router ? router.isReady : document.readyState === 'complete') && window.__roomTablet;
      if (ready) { initial = false; changed = now; }
    }
    if (busy && !initial && !navigating && !uncertain && requests === 0 && now >= earliest && now - changed >= 200) {
      window.__roomTablet?.apply(); busy = false; cover = false; epoch++; publish();
    } else { publish(); if (busy) schedule(); }
  }
  function schedule() { if (!timer) timer = setTimeout(() => { timer = 0; settle(); }, 100); }
  function mutationRequest(input, options) {
    try {
      const url = new URL(input instanceof Request ? input.url : input, location.href);
      const method = String(options?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
      if (![location.origin, 'https://api-public.tossplace.com'].includes(url.origin) || ['GET','HEAD','OPTIONS'].includes(method)) return '';
      if (!/^\/api-public\/table-order\/v\d+\/merchants\/[^/]+\/(cart\/(line-items(?:\/|$)|checkout(?:\/|$))|orders(?:\/|$)|payments\/)/.test(url.pathname)) return '';
      const cart = url.pathname.includes('/cart/line-items');
      // Edits stay on the visible cart. Adds, checkout and orders can change the page.
      return {kind: cart ? 'cart' : 'order', cover: !(cart && ['PATCH', 'DELETE'].includes(method))};
    } catch { return ''; }
  }
  function startRequest(request) {
    requests++; begin(request.cover); let completed = false;
    return success => {
      if (completed) return; completed = true; requests--;
      if (!success) { uncertain = uncertain === 'order' ? uncertain : request.kind; cover = true; }
      changed = performance.now(); earliest = changed + 600; publish(); schedule();
    };
  }
  const originalFetch = window.fetch;
  window.fetch = function(input, options) {
    const kind = mutationRequest(input, options), done = kind ? startRequest(kind) : null;
    let promise;
    try { promise = originalFetch.apply(this, arguments); } catch (error) { done?.(false); throw error; }
    if (done) promise.then(response => {
      // fetch resolves at headers; keep the gate until the response body arrives as well.
      try { response.clone().arrayBuffer().then(() => done(response.ok), () => done(false)); } catch { done(false); }
    }, () => done(false));
    return promise;
  };
  const open = XMLHttpRequest.prototype.open, send = XMLHttpRequest.prototype.send;
  const xhrRequests = new WeakMap();
  XMLHttpRequest.prototype.open = function(method, url) { xhrRequests.set(this, {method, url}); return open.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function() {
    const request = xhrRequests.get(this);
    const kind = request && mutationRequest(request.url, {method: request.method}), done = kind ? startRequest(kind) : null;
    if (done) this.addEventListener('loadend', () => done(this.status >= 200 && this.status < 300), {once: true});
    try { return send.apply(this, arguments); } catch (error) { done?.(false); throw error; }
  };
  function stop(event) { event.preventDefault(); event.stopImmediatePropagation(); }
  // Some Toss controls act on pointer/touch release before a click is dispatched.
  // Keep those handlers gated too while leaving the cart itself visible.
  for (const name of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'keydown', 'keyup']) {
    window.addEventListener(name, event => { if (busy) stop(event); }, {capture: true, passive: false});
  }
  let clickSubmit = false;
  window.addEventListener('click', event => {
    if (busy) { stop(event); return; }
    wireRouter();
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const control = target?.closest('button,[role="button"],a[href]');
    if (control) {
      clickSubmit = control.type === 'submit' && !!control.form;
      setTimeout(() => { clickSubmit = false; }, 0);
      // A local quantity step, selection or delete dialog needs only the input gate.
      // The router/request hooks promote it to a cover when the action needs one.
      begin(false);
    }
  }, true);
  // Keyboard-generated submit can bypass click. A click's matching submit still belongs to that click.
  let lastSubmit = -Infinity;
  window.addEventListener('submit', event => {
    if ((busy && !clickSubmit) || requests || navigating || performance.now() - lastSubmit < 600) { stop(event); return; }
    clickSubmit = false; lastSubmit = performance.now(); begin(false);
  }, true);
  for (const method of ['pushState','replaceState']) {
    const original = history[method];
    history[method] = function() {
      const before = location.href, value = original.apply(this, arguments);
      if (before !== location.href) { begin(); window.__roomTablet?.apply(); }
      return value;
    };
  }
  addEventListener('popstate', () => { begin(); window.__roomTablet?.apply(); });
  new MutationObserver(records => {
    wireRouter();
    if (records.some(record => record.type === 'childList' && record.target instanceof Element && record.target.closest('main,dialog,[role="dialog"],[role="alertdialog"]'))) changed = performance.now();
    publish(); if (busy) schedule();
  }).observe(document, {childList:true, subtree:true});
  window.__roomInteraction = {
    state,
    layoutReady() { if (busy) schedule(); },
    back() { if (busy) return false; wireRouter(); begin(); history.back(); return true; },
    canLeave() { return !busy; },
    review() {
      if (!uncertain || requests || navigating) return false;
      const target = new URL(location.href);
      const base = target.pathname.replace(/\/(menu|cart|checkout|order)(\/.*)?$/, '');
      if (base === target.pathname) return false;
      target.pathname = base + (uncertain === 'cart' ? '/cart' : '/order/history');
      uncertain = ''; begin();
      // Read the latest result from a fresh GET, including when already on the cart.
      // A full URL also avoids Next.js adding its basePath a second time.
      location.assign(target.href);
      return true;
    }
  };
  addEventListener('DOMContentLoaded', schedule); addEventListener('pageshow', schedule);
  publish(); schedule();
})();
