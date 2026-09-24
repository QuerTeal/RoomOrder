/* Use the page's semantic theme tokens. Never filter/invert menu photos or rebuild controls. */
(() => {
  if (window !== window.top || location.origin !== 'https://toss-order.tossplace.com') return;
  if (window.__roomTheme) { window.__roomTheme.setDark(!!window.__roomConfig?.dark); return; }
  let dark = !!window.__roomConfig?.dark;
  const style = document.createElement('style');
  style.id = 'room-theme-style';
  style.textContent = `
    html[data-room-theme="light"] {color-scheme:light;}
    html[data-room-theme="dark"] {
      color-scheme:dark; background:#11151c; color:#f3f6fc;
      --room-bg:#11151c; --room-surface:#1b222d; --room-ink:#f3f6fc;
      --room-muted:#b5c1d2; --room-accent:#91baff; --room-border:#3b485a;
    }
    html[data-room-theme="dark"] [data-tds-color-scheme] {
      --color-semantic-background-default:var(--room-bg) !important;
      --color-semantic-text-primary:var(--room-ink) !important;
      --color-semantic-text-secondary:#d4deec !important;
      --color-semantic-text-tertiary:var(--room-muted) !important;
      --color-semantic-text-quaternary:var(--room-muted) !important;
      --color-semantic-icon-primary:var(--room-ink) !important;
      --color-semantic-icon-secondary:#d4deec !important;
      --color-semantic-icon-tertiary:var(--room-muted) !important;
      --color-semantic-icon-quaternary:var(--room-muted) !important;
    }
    html[data-room-theme="dark"] body {background:var(--room-bg) !important; color:var(--room-ink);}
    html[data-room-theme="dark"] .tds-mobile-text-button {
      --text-color:var(--room-accent) !important; --icon-color:var(--room-accent) !important;
    }
    html[data-room-theme="dark"] [style*="--numeric-spinner-number-color"] {
      --numeric-spinner-number-color:var(--room-ink) !important;
    }
    /* Some TDS controls resolve light tokens in JavaScript and keep literal inline values. */
    html[data-room-theme="dark"] .tds-mobile-button[style*="--button-color: rgba(28, 31, 39"] {
      --button-color:var(--room-ink) !important; --button-background-color:#303b4b !important;
    }
    html[data-room-theme="dark"] [data-room-dialog] {background:var(--room-surface) !important;}
    html[data-room-theme="dark"] [data-room-category-fade] {
      background:linear-gradient(to left,var(--room-bg) 80%,transparent 100%) !important;
    }
    html[data-room-theme="dark"] [data-room-complete-summary] [style*="--tds-paragraph-color: #F04452"] {
      --tds-paragraph-color:#ff9a9f !important;
    }
    html[data-room-theme="dark"] [data-room-complete-shell] > :not(main) .tds-mobile-paragraph__text {
      --tds-paragraph-color:var(--room-muted) !important;
    }
  `;
  function scheme(element) {
    const value = dark ? 'dark' : 'light';
    if (element && element.getAttribute('data-tds-color-scheme') !== value) element.setAttribute('data-tds-color-scheme', value);
  }
  function apply() {
    const html = document.documentElement;
    if (!html) return;
    const value = dark ? 'dark' : 'light';
    if (html.getAttribute('data-room-theme') !== value) html.setAttribute('data-room-theme', value);
    if (!style.isConnected) (document.head || html).appendChild(style);
    scheme(html); scheme(document.body);
    // Portal dialogs and freshly mounted pages can carry their own explicit light scope.
    document.querySelectorAll('[data-tds-color-scheme]').forEach(scheme);
  }
  const observer = new MutationObserver(apply);
  observer.observe(document, {subtree:true, childList:true, attributes:true, attributeFilter:['data-tds-color-scheme']});
  window.__roomTheme = Object.freeze({setDark(value) { dark = !!value; apply(); }});
  apply();
})();
