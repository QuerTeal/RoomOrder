/* Read-only main-frame inspection. Never submit, click, clear storage or replay requests. */
((fallbackTitles, expiredTitles) => {
  const result = {href:location.href, ended:false, ready:false};
  if (location.protocol !== 'https:' || location.hostname !== 'toss-order.tossplace.com') return result;
  const interaction = window.__roomInteraction?.state();
  if (interaction?.busy && !interaction.sessionRecoveryAllowed) return result;
  // A failed cart request can cover the QR-expired page. Inspect its layout without
  // removing the cover or unlocking input; uncertain orders must remain protected.
  const covered = interaction?.cover && interaction.sessionRecoveryAllowed && document.documentElement.hasAttribute('data-room-busy');
  const visible = e => {
    if (!e || !e.getClientRects().length || e.closest('[hidden],[aria-hidden="true"]')) return false;
    if (getComputedStyle(e).visibility !== 'hidden') return true;
    if (!covered) return false;
    for (let node = e; node; node = node.parentElement) if (node.style.visibility === 'hidden' || node.style.visibility === 'collapse') return false;
    return true;
  };
  const anyVisible = selector => Array.from(document.querySelectorAll(selector)).some(visible);
  if (anyVisible('dialog[open],[role="dialog"],[role="alertdialog"]')) return result;
  result.ready = /\/menu\/?$/.test(location.pathname) && anyVisible('main [role="tablist"]');
  if (result.ready || anyVisible('main form,main .tds-mobile-list-row,main [role="tablist"]')) return result;
  const normalize = s => String(s).replace(/[\s!?！？。.]+/gu, '').toLocaleLowerCase();
  const titles = new Set(fallbackTitles.map(normalize));
  const qrTitles = new Set(expiredTitles.map(normalize));
  try {
    const data = JSON.parse(document.getElementById('__NEXT_DATA__')?.textContent || '{}');
    const locales = data.props?.pageProps?._nextI18Next?.initialI18nStore || {};
    for (const locale of Object.values(locales)) {
      const title = locale.common?.['checkout-complete-page']?.title;
      if (typeof title === 'string' && title.trim()) titles.add(normalize(title));
    }
  } catch (_) { /* Legacy page can still use the resource-backed terminal titles. */ }
  const candidates = Array.from(document.querySelectorAll('h1,h2,h3,p,span,[role="heading"],.tds-mobile-paragraph__text')).filter(visible);
  const terminalTitle = candidates.some(e => titles.has(normalize(e.textContent)));
  const qrTitle = candidates.some(e => qrTitles.has(normalize(e.textContent)));
  const cookies = document.cookie.split(';').map(c => c.trim());
  const expired = cookies.includes('error-code=CHECKOUT_SESSION_EXPIRED');
  const qrExpired = cookies.includes('error-code=TABLE_SESSION_AUTHENTICATION_FAILED');
  const checkoutComplete = /\/checkout\/complete\/?$/.test(location.pathname);
  const controls = anyVisible('button,a[href],[role="button"],input,select,textarea');
  result.ended = (qrTitle && (qrExpired || !controls)) || (terminalTitle && (expired || checkoutComplete || !controls));
  return result;
})(__ROOM_TERMINAL_TITLES__, __ROOM_EXPIRED_TITLES__)
