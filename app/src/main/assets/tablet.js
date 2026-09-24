/* Progressive enhancement: preserve original text, controls and order handlers. */
(() => {
  if (window !== window.top || location.origin !== 'https://toss-order.tossplace.com') return;
  if (window.__roomTablet) { window.__roomTablet.apply(); return; }
  const style = document.createElement('style');
  style.id = 'room-tablet-style';
  style.textContent = `
    @media (min-width: 720px) and (orientation: landscape) {
      html[data-room-tablet="on"] [data-room-wide] {max-width:100% !important; width:100% !important;}
      html[data-room-tablet="on"] main {min-width:0; padding-bottom:20px;}
      html[data-room-tablet="on"] .tds-mobile-paragraph,
      html[data-room-tablet="on"] .tds-mobile-paragraph__text {
        font-size:max(18px,var(--tds-paragraph-text-font-size,18px)) !important;
        /* TDS line-height tokens can be unitless. Mixing them with em in max() is invalid. */
        line-height:1.5 !important;
        overflow-wrap:anywhere;
      }
      html[data-room-tablet="on"] :is(button,[role="button"],[role="tab"]) {
        min-height:56px !important; min-width:56px; touch-action:manipulation;
      }
      html[data-room-tablet="on"] [role="tab"] {padding-inline:20px !important; font-size:20px !important;}
      html[data-room-tablet="on"][data-room-page="menu"] [data-tds-top-component="tds-top-right-wrapper"] {flex-shrink:0;}
      html[data-room-tablet="on"][data-room-page="menu"] [data-tds-top-component="tds-top-right-wrapper"] > span {max-width:none !important; white-space:nowrap;}
      html[data-room-tablet="on"] :is(button,[role="button"],[role="tab"],input):focus-visible {
        outline:3px solid var(--room-accent,#205bd3) !important; outline-offset:3px;
      }
      html[data-room-tablet="on"] [data-room-grid] {
        display:grid !important; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; padding:12px 24px 24px;
      }
      html[data-room-tablet="on"] [data-room-grid] > :not([data-room-card]) {grid-column:1 / -1;}
      html[data-room-tablet="on"] [data-room-card] {
        min-width:0; border:1px solid var(--room-border,#d7dee8); border-radius:16px; min-height:144px; background:var(--room-surface,#fff);
      }
      html[data-room-tablet="on"] [data-room-card] > hr {display:none;}
      html[data-room-tablet="on"] [data-room-detail] {
        display:grid; grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr); column-gap:24px;
        align-items:start; padding:24px; box-sizing:border-box;
      }
      html[data-room-tablet="on"] [data-room-detail] > :not(img) {grid-column:2; min-width:0;}
      html[data-room-tablet="on"] [data-room-detail] > img {
        grid-column:1; grid-row:1 / span 2; width:100% !important; max-width:100% !important;
        height:clamp(220px,48vh,420px) !important; object-fit:contain !important; border-radius:20px; background:var(--room-bg,#f4f6fa);
      }
      html[data-room-tablet="on"] [data-room-detail] label {min-height:64px; padding-block:12px; box-sizing:border-box;}
      html[data-room-tablet="on"] [data-room-detail] > .tds-mobile-bottom-cta__spacer {grid-column:1 / -1;}
      html[data-room-tablet="on"] [data-room-detail] > div:has([style*="--numeric-spinner-layout-padding"]) {
        flex-wrap:wrap; align-items:center; gap:16px; box-sizing:border-box;
      }
      html[data-room-tablet="on"] [data-room-detail] > div:has([style*="--numeric-spinner-layout-padding"]) > :first-child {
        flex-shrink:0; white-space:nowrap;
      }
      html[data-room-tablet="on"] [data-room-detail] > div:has([style*="--numeric-spinner-layout-padding"]) > :last-child {
        flex-shrink:0; margin-inline-start:auto !important;
      }
      html[data-room-tablet="on"][data-room-page="cart"] [data-room-card] {padding-bottom:16px; display:flex !important; flex-direction:column;}
      html[data-room-tablet="on"][data-room-page="cart"] [data-room-card] > div {
        flex-wrap:wrap; gap:12px; margin-top:auto !important; padding-top:12px;
      }
      html[data-room-tablet="on"][data-room-page="cart"] [data-room-card] > div > * {margin-left:0 !important;}
      html[data-room-tablet="on"][data-room-page="cart"] [data-room-card] [data-tds-mobile-component="ListRowRight"] {
        min-width:56px; min-height:56px; display:flex; align-items:center; justify-content:center;
      }
      html[data-room-tablet="on"][data-room-page="cart"] [data-room-card] [data-tds-mobile-component="ListRowRight"] > div,
      html[data-room-tablet="on"][data-room-page="cart"] [data-room-card] [data-tds-mobile-component="ListRowRight"] > div > div {
        min-width:56px; min-height:56px; display:flex; align-items:center; justify-content:center;
      }
      html[data-room-tablet="on"] [data-room-cta] {width:100% !important; max-width:100% !important;}
      html[data-room-tablet="on"] [data-room-cta] button {
        min-height:72px !important; --button-font-size:22px !important; font-size:22px !important;
      }
      /* Also keeps the quantity badge's rolling digit inside its box at larger text sizes. */
      html[data-room-tablet="on"] [data-room-cta] .tds-mobile-paragraph__text {line-height:1.5 !important; width:auto !important; height:auto !important; min-width:28px;}
      html[data-room-tablet="on"] main .tds-mobile-bottom-cta__spacer {height:140px !important;}
      html[data-room-tablet="on"] [data-room-dialog] {
        width:min(560px,calc(100vw - 48px)) !important; max-width:calc(100vw - 48px) !important;
        max-height:calc(100dvh - 40px) !important; box-sizing:border-box;
        display:flex !important; flex-direction:column; overflow:hidden;
      }
      html[data-room-tablet="on"] [data-room-dialog-body] {
        min-height:0; overflow-y:auto !important; overscroll-behavior:contain;
        padding:24px 28px 8px !important; gap:16px !important;
      }
      html[data-room-tablet="on"] [data-room-dialog-body] > * {flex-shrink:0; margin:0 !important;}
      html[data-room-tablet="on"] [data-room-dialog-body] :is(h1,h2,h3,[role="heading"]) {
        --tds-paragraph-text-font-size:24px !important;
      }
      html[data-room-tablet="on"] [data-room-dialog-actions] {
        display:flex; flex-wrap:wrap; gap:12px !important; flex-shrink:0;
        margin:16px 24px 24px !important;
      }
      html[data-room-tablet="on"] [data-room-dialog-actions] > button {
        flex:1 1 160px !important; min-width:0 !important; min-height:64px !important;
        --button-font-size:20px !important; height:auto !important;
      }
      html[data-room-tablet="on"] [data-room-dialog-actions] .tds-mobile-button__content {
        white-space:normal !important; overflow-wrap:anywhere; line-height:1.5; padding-block:10px;
      }
      /* The 1280x800 tablet leaves 1112x800 CSS px beside the native rail at mdpi.
         Keep two readable columns at that size, including larger text settings. */
      html[data-room-tablet="on"] [data-room-complete-shell],
      html[data-room-tablet="on"] [data-room-complete] {
        background:var(--room-bg,#f4f6fa) !important; padding-bottom:0;
      }
      html[data-room-tablet="on"] [data-room-complete-content] {
        display:grid !important; grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);
        align-content:start; align-items:start; gap:24px; padding:32px 24px !important;
        box-sizing:border-box; background:var(--room-bg,#f4f6fa) !important;
      }
      html[data-room-tablet="on"] [data-room-complete-content] > * {min-width:0; grid-column:1 / -1;}
      html[data-room-tablet="on"] [data-room-complete-summary] {
        grid-column:1; grid-row:1; padding:36px 20px; border-radius:20px;
        background:var(--room-surface,#fff); border:1px solid var(--room-border,#d7dee8); box-sizing:border-box;
      }
      html[data-room-tablet="on"] [data-room-complete-title] {
        --tds-paragraph-text-font-size:26px !important; --tds-paragraph-font-weight:700 !important;
        --tds-paragraph-color:var(--room-ink,#191f28) !important; color:var(--room-ink,#191f28) !important;
      }
      html[data-room-tablet="on"] [data-room-total] {
        font-size:clamp(28px,3.4vw,40px) !important; line-height:1.4 !important;
        color:var(--room-ink,#191f28) !important; white-space:nowrap;
      }
      html[data-room-tablet="on"] [data-room-complete-history] {grid-column:2; grid-row:1;}
      html[data-room-tablet="on"] [data-room-complete-history] > div {padding:0 !important;}
      html[data-room-tablet="on"] [data-room-complete-panel] {
        background:var(--room-surface,#fff) !important; border:1px solid var(--room-border,#d7dee8); border-radius:20px;
      }
      html[data-room-tablet="on"] [data-room-complete-toggle] {min-height:72px; padding:16px 20px !important; box-sizing:border-box;}
      html[data-room-tablet="on"] [data-room-complete-toggle] .tds-mobile-paragraph__text {
        --tds-paragraph-color:var(--room-ink,#191f28) !important;
      }
      html[data-room-tablet="on"] [data-room-complete-spacer] {display:none !important;}
      html[data-room-tablet="on"] [data-room-complete-fade] {display:none !important;}
    }
    @media (min-width: 960px) and (max-width: 1200px) and (min-height: 640px) and (orientation: landscape) {
      html[data-room-tablet="on"] [data-room-grid] {gap:12px; padding:8px 24px 24px;}
      html[data-room-tablet="on"][data-room-page="menu"] [data-room-card] {min-height:128px;}
      html[data-room-tablet="on"] [data-room-detail] {grid-template-columns:minmax(0,.75fr) minmax(0,1.25fr);}
      html[data-room-tablet="on"] [data-room-detail] > img {height:clamp(240px,42vh,336px) !important;}
    }
    @media (min-width: 720px) and (max-width: 959px) and (orientation: landscape) {
      html[data-room-tablet="on"] [data-room-complete-content] {grid-template-columns:minmax(0,1fr); padding:20px !important; gap:16px;}
      html[data-room-tablet="on"] [data-room-complete-summary] {grid-column:1; padding:20px;}
      html[data-room-tablet="on"] [data-room-complete-history] {grid-column:1; grid-row:2;}
    }
    /* Administrator animation settings, in either layout. Off shows the page's current value at rest. */
    html[data-room-motion-bounce="off"] [data-room-cta] button {animation:none !important;}
    html[data-room-motion-number="off"] [data-room-number] {width:auto !important; min-width:1ch; font:inherit; line-height:inherit;}
    html[data-room-motion-number="off"] [data-room-number] > * {display:none !important;}
    html[data-room-motion-number="off"] [data-room-number]::after {content:attr(aria-label); font:inherit; line-height:inherit; white-space:nowrap;}
    html[data-room-motion-number="off"] [data-room-total] > div {width:auto !important;}
    html[data-room-motion-number="off"] [data-room-total] > div > div {display:flex; align-items:baseline; gap:.12em;}
    html[data-room-motion-number="off"] [data-room-total] [data-room-number] {height:auto !important; mask-image:none !important;}
    html[data-room-motion-number="off"] [data-room-total] [data-room-number] ~ * {
      position:static !important; transform:none !important; font:inherit; color:inherit;
    }
    html[data-room-motion-complete="off"] [data-room-complete-summary],
    html[data-room-motion-complete="off"] [data-room-complete-history] {opacity:1 !important; transform:none !important;}
    html[data-room-motion-complete="off"] [data-room-complete-summary] :is(.order_complete,.amount,.description) {
      opacity:1 !important; transform:none !important; scale:none !important;
    }
    html[data-room-motion-complete="off"] [data-room-complete-intro] {display:none !important;}
    html[data-room-motion-complete="off"] [data-room-complete-shell] > :not(main),
    html[data-room-motion-complete="off"] [data-room-complete-panel],
    html[data-room-motion-complete="off"] [data-room-complete-panel] :is(.dropdown_list,.dropdown_items) {
      transform:none !important; scale:none !important;
    }
  `;
  let enabled = window.__roomConfig?.wide !== false;
  // Keep the page's own bounce timing and easing; only its vertical travel follows the setting.
  const travel = new WeakMap(), lift = /translateY\((-?[\d.]+)px\)/;
  function scaleBounce(button, size) {
    for (const animation of button.getAnimations()) {
      if (!(animation instanceof CSSAnimation)) continue;
      let entry = travel.get(animation);
      if (!entry) {
        const frames = animation.effect.getKeyframes().map(({offset, easing, transform}) => transform ? {offset, easing, transform} : {offset, easing});
        const peak = Math.max(0, ...frames.map(f => Math.abs(parseFloat(lift.exec(f.transform || '')?.[1]) || 0)));
        entry = {frames, peak, size: peak}; travel.set(animation, entry);
      }
      if (!entry.peak || entry.size === size) continue;
      entry.size = size;
      animation.effect.setKeyframes(entry.frames.map(f => f.transform ? {...f, transform: f.transform.replace(lift, (_, v) => `translateY(${v * size / entry.peak}px)`)} : f));
    }
  }
  const marks = ['data-room-wide','data-room-grid','data-room-card','data-room-detail','data-room-cta',
    'data-room-dialog','data-room-dialog-body','data-room-dialog-actions','data-room-category-fade','data-room-number',
    'data-room-complete','data-room-complete-content','data-room-complete-summary','data-room-complete-title',
    'data-room-complete-history','data-room-complete-panel','data-room-complete-toggle','data-room-complete-spacer','data-room-total',
    'data-room-complete-shell','data-room-complete-fade','data-room-complete-intro'];
  function apply() {
    const html = document.documentElement, main = document.querySelector('main');
    if (!html) return;
    if (!style.isConnected) (document.head || html).appendChild(style);
    const desired = new Map(marks.map(name => [name, new Set()]));
    const mark = (element, name) => { desired.get(name).add(element); if (!element.hasAttribute(name)) element.setAttribute(name, ''); };
    let page = '';
    // During a route change the URL may change before React replaces the previous page.
    // Keep styling the DOM that is actually present instead of exposing its phone layout.
    if (main?.querySelector('[role="tablist"]')) page = 'menu';
    else if (main?.querySelector(':scope > form [role="heading"]')) page = 'detail';
    else if (main && /\/cart\/?$/.test(location.pathname)) page = 'cart';
    else if (main && /\/(order|checkout)\/complete\/?$/.test(location.pathname) && main.querySelector('.dropdown_list')) page = 'complete';
    html.setAttribute('data-room-page', page);
    for (const tabs of document.querySelectorAll('[role="tablist"]')) {
      const fade = tabs.closest('.tab__scroll-wrapper')?.parentElement?.nextElementSibling;
      if (fade?.querySelector(':scope > button') && getComputedStyle(fade).backgroundImage.includes('linear-gradient')) mark(fade, 'data-room-category-fade');
    }
    // Native <dialog> has an implicit role and is not matched by [role="dialog"].
    for (const dialog of document.querySelectorAll('dialog[open],[role="dialog"],[role="alertdialog"]')) {
      const title = document.getElementById(dialog.getAttribute('aria-labelledby')) || dialog.querySelector('h1,h2,h3');
      if (!title || !dialog.contains(title)) continue;
      const body = title.parentElement, panel = body.parentElement;
      if (!panel || panel === dialog || !panel.querySelector('button')) continue;
      mark(panel, 'data-room-dialog'); mark(body, 'data-room-dialog-body');
      for (const child of panel.children) if (child !== body && child.querySelector(':scope > button')) mark(child, 'data-room-dialog-actions');
    }
    for (let p = main; p && p !== document.body; p = p.parentElement) {
      const width = parseFloat(getComputedStyle(p).maxWidth);
      if (p.hasAttribute('data-room-wide') || (width >= 590 && width <= 610)) mark(p, 'data-room-wide');
    }
    const markCards = (container, predicate) => {
      const cards = Array.from(container.children).filter(predicate);
      if (cards.length) { mark(container, 'data-room-grid'); for (const card of cards) mark(card, 'data-room-card'); }
    };
    if (page === 'menu') for (const section of main.querySelectorAll('article > section')) {
      markCards(section, e => e.matches('div') && e.querySelector(':scope > li.tds-mobile-list-row button[aria-labelledby]'));
    }
    if (page === 'detail') {
      const form = main.querySelector(':scope > form');
      if (form.querySelector(':scope > img')) mark(form, 'data-room-detail');
    }
    if (page === 'cart') for (const article of main.querySelectorAll(':scope > article')) {
      markCards(article, e => e.matches('div') && e.querySelector(':scope > li.tds-mobile-list-row'));
    }
    if (page === 'complete') {
      const list = main.querySelector('.dropdown_list'), content = main.firstElementChild;
      const branch = element => {
        while (element && element.parentElement !== content) element = element.parentElement;
        return element;
      };
      const history = branch(list);
      // Recognize the amount in the first summary, never a promotional coupon amount.
      const summary = content?.firstElementChild, number = summary?.querySelector('[role="text"][aria-label]');
      const total = number?.closest('.tds-mobile-paragraph__text');
      if (history && summary !== history && total && /^[\d,.\s]+$/.test(number.getAttribute('aria-label'))) {
        mark(main, 'data-room-complete'); mark(content, 'data-room-complete-content');
        mark(main.parentElement, 'data-room-complete-shell');
        for (const child of main.children) if (child !== content && !child.childElementCount && !child.textContent.trim()
          && getComputedStyle(child).backgroundImage.includes('linear-gradient')) mark(child, 'data-room-complete-fade');
        mark(summary, 'data-room-complete-summary'); mark(history, 'data-room-complete-history');
        mark(list.parentElement, 'data-room-complete-panel');
        if (list.previousElementSibling) mark(list.previousElementSibling, 'data-room-complete-toggle');
        const title = summary.querySelector('.tds-mobile-paragraph__text');
        if (title && title !== total) mark(title, 'data-room-complete-title');
        mark(total, 'data-room-total'); mark(number, 'data-room-number');
        for (const child of content.children) if (child !== summary && child !== history && !child.childElementCount && !child.textContent.trim()) mark(child, 'data-room-complete-spacer');
        // The transient intro (illustration, check and coupon teaser) floats over the results.
        for (const child of content.children) if (child !== summary && child !== history && child.querySelector('img')
          && getComputedStyle(child).position === 'absolute') mark(child, 'data-room-complete-intro');
      }
    }
    for (const button of document.querySelectorAll('.tds-mobile-bottom-cta__button')) {
      if (button.closest('dialog,[role="dialog"],[role="alertdialog"]')) continue;
      const fixed = button.closest('[style*="position: fixed"]');
      if (fixed) {
        mark(fixed, 'data-room-cta');
        for (const number of fixed.querySelectorAll('[aria-label]')) {
          if (/^[\d,.\s+-]+$/.test(number.getAttribute('aria-label')) && number.querySelector('[style*="translateZ"]')) mark(number, 'data-room-number');
        }
      }
    }
    for (const name of marks) for (const element of document.querySelectorAll(`[${name}]`))
      if (!desired.get(name).has(element)) element.removeAttribute(name);
    html.setAttribute('data-room-tablet', enabled ? 'on' : 'off');
    // The app replaces __roomConfig whenever the administrator saves.
    const motion = window.__roomConfig?.motion || {}, bounce = Number.isFinite(motion.bounce) ? motion.bounce : 20;
    html.setAttribute('data-room-motion-number', motion.number === false ? 'off' : 'on');
    html.setAttribute('data-room-motion-complete', motion.complete === false ? 'off' : 'on');
    html.setAttribute('data-room-motion-bounce', bounce > 0 ? 'on' : 'off');
    for (const button of document.querySelectorAll('[data-room-cta] button')) scaleBounce(button, bounce);
    window.__roomInteraction?.layoutReady();
  }
  window.__roomTablet = { apply, setEnabled(value) { enabled = !!value; apply(); } };
  // MutationObserver runs before paint; deferring to rAF could expose an unstyled SPA frame.
  new MutationObserver(apply).observe(document, {childList:true, subtree:true, attributes:true, attributeFilter:['open','class','style']});
  addEventListener('popstate', apply);
  addEventListener('resize', apply);
  apply();
})();
