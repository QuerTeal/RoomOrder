/* Scheduled, user-authorized cart cleanup. Use original delete controls only.
   Never submit an order, clear cookies/storage, or retry a failed deletion. */
(() => {
  if (window !== window.top || location.origin !== 'https://toss-order.tossplace.com' || window.__roomMaintenance) return;
  let pending = null, failure = '', removed = 0;
  const visible = e => e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden'
    && !e.closest('[hidden],[aria-hidden="true"]');
  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
  function inspect() {
    const interaction = window.__roomInteraction?.state();
    const main = document.querySelector('main');
    const dialog = [...document.querySelectorAll('dialog[open],[role="dialog"],[role="alertdialog"]')].some(visible);
    const uncertain = interaction?.phase?.startsWith('uncertain_');
    const allowed = /\/(menu(?:\/[^/]+)?|cart|order\/(history|complete))\/?$/.test(location.pathname);
    const safe = !!main && !!interaction && !interaction.busy && !uncertain && !dialog && allowed;
    const cart = /\/cart\/?$/.test(location.pathname);
    // Match the same direct cart rows as tablet.js, independent of wide mode.
    const rows = cart && main ? [...main.querySelectorAll(':scope > article > div > li.tds-mobile-list-row')] : [];
    let emptyText = '';
    try {
      const locales = JSON.parse(document.getElementById('__NEXT_DATA__')?.textContent || '{}').props?.pageProps?._nextI18Next?.initialI18nStore;
      const lang = document.documentElement.lang?.split('-')[0] || 'ko';
      emptyText = locales?.[lang]?.common?.['cart-page']?.['empty-cart'] || '';
    } catch (_) { /* Unknown structure must not be interpreted as an empty cart. */ }
    const empty = !!emptyText && rows.length === 0 && !!main && [...main.querySelectorAll('p,span,h1,h2,[role="heading"]')]
      .some(e => visible(e) && normalize(e.textContent) === normalize(emptyText));
    const menu = /\/menu\/?$/.test(location.pathname) && !!main?.querySelector('[role="tablist"]');
    return {href:location.href, safe, cart, menu, empty, count:rows.length, uncertain:!!uncertain, dialog,
      failure, removed, rows};
  }
  function snapshot() { const {rows, ...value} = inspect(); return value; }
  function step() {
    const state = inspect();
    const result = (status, reason = '') => ({...snapshot(), status, reason});
    const fail = reason => { failure = reason; return result('failed', reason); };
    if (failure) return result('failed', failure);
    if (!state.cart || state.uncertain || state.dialog) return fail('unsafe_page');
    if (pending) {
      if (performance.now() - pending.since > 20_000) return fail('delete_timeout');
      if (!state.safe) return result('waiting');
      if (state.rows.includes(pending.row) || state.count >= pending.count) return result('waiting');
      pending = null; removed++;
      // Wait one more native tick before touching another original control.
      return result('removed');
    }
    if (!state.safe) return result('waiting');
    if (state.empty) return result('empty');
    if (!state.count || removed >= 100) return fail('unrecognized_cart');
    const row = state.rows[0];
    const control = row.querySelector('[data-tds-mobile-component="ListRowRight"]');
    if (!visible(control) || control.closest('[aria-disabled="true"]') || control.querySelector('button:disabled')) return fail('missing_delete_control');
    pending = {row, count:state.count, since:performance.now()};
    const target = control.querySelector('svg') || control.querySelector('div') || control;
    target.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true}));
    return result('removing');
  }
  window.__roomMaintenance = Object.freeze({snapshot, step});
})();
