// Executed in a disposable iframe of the debug WebView by check-webview.mjs.
async function checkSessionDom(script) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;inset:0;width:1000px;height:600px;z-index:2147483647;background:white';
  document.body.append(frame);
  const doc = frame.contentDocument;
  const inspect = new Function('document', 'location', 'getComputedStyle', 'window', `return (${script});`);
  const style=doc.createElement('style');style.textContent='html[data-room-busy] body{visibility:hidden!important}';doc.head.append(style);
  const cases = [
    {name:'legacy goodbye after deletion', html:'<main><h1>안녕히가세요</h1></main>', ended:true},
    {name:'localized checkout complete', path:'/table/store/checkout/complete', html:'<h2>See you again!</h2>', title:'See you again!', ended:true},
    {name:'expired session on existing route', cookie:'error-code=CHECKOUT_SESSION_EXPIRED', html:'<span class="tds-mobile-paragraph__text">다음에 또 만나요!</span>', ended:true},
    {name:'ordinary order complete remains', path:'/table/store/order/complete', html:'<h1>총 3개 주문 완료!</h1><button>추가 주문하기</button>', ended:false},
    {name:'menu item named goodbye', html:'<main><div role="tablist">menu</div><h2>안녕히 가세요</h2></main>', ended:false,ready:true},
    {name:'active cart with stale expiration cookie', path:'/table/store/cart', cookie:'error-code=CHECKOUT_SESSION_EXPIRED',html:'<main><li class="tds-mobile-list-row">안녕히 가세요</li><button>주문하기</button></main>',ended:false},
    {name:'payment form remains', html:'<main><form><h1>다음에 또 만나요!</h1><input></form></main>',ended:false},
    {name:'hidden end title ignored', html:'<h1 style="display:none">안녕히 가세요</h1>',ended:false},
    {name:'aria-hidden title ignored', html:'<div aria-hidden="true"><h1>안녕히 가세요</h1></div>',ended:false},
    {name:'native dialog blocks navigation',html:'<h1>안녕히 가세요</h1><dialog open><h3>이대로 주문할까요?</h3></dialog>',ended:false},
    {name:'role dialog blocks navigation',html:'<h1>안녕히 가세요</h1><div role="dialog">confirm</div>',ended:false},
    {name:'other host ignored',host:'example.org',html:'<h1>안녕히 가세요</h1>',ended:false},
    {name:'http ignored',protocol:'http:',html:'<h1>안녕히 가세요</h1>',ended:false},
    {name:'generic connection error is not a session end',html:'<h1>지금은 이용할 수 없어요</h1>',ended:false,unavailable:true},
    {name:'Toss error screen on detail is reloadable',path:'/table/store/menu/123',html:'<span class="tds-mobile-paragraph__text">지금은 이용할 수 없어요</span><p>문제를 해결하고 있어요</p>',ended:false,unavailable:true},
    {name:'Toss error screen on cart is reloadable',path:'/table/store/cart',html:'<p>지금은 이용할 수 없어요!</p>',ended:false,unavailable:true},
    {name:'translated error title is reloadable',html:'<h1>Temporarily unavailable</h1>',errorTitle:'Temporarily unavailable',ended:false,unavailable:true},
    {name:'error screen in checkout stays manual',path:'/table/store/checkout',html:'<h1>지금은 이용할 수 없어요</h1>',ended:false,unavailable:false},
    {name:'error text with controls is not stuck',html:'<h1>지금은 이용할 수 없어요</h1><button>다시 시도</button>',ended:false,unavailable:false},
    {name:'error text inside a menu is ignored',html:'<main><div role="tablist">menu</div><p>지금은 이용할 수 없어요</p></main>',ended:false,unavailable:false,ready:true},
    {name:'hidden error title ignored',html:'<h1 style="display:none">지금은 이용할 수 없어요</h1>',ended:false,unavailable:false},
    {name:'error screen behind a dialog waits',html:'<h1>지금은 이용할 수 없어요</h1><div role="dialog">confirm</div>',ended:false,unavailable:false},
    {name:'error screen during an order request waits',busy:true,cover:true,allowed:false,html:'<h1>지금은 이용할 수 없어요</h1>',ended:false,unavailable:false},
    {name:'blank page is not a menu',html:'',ended:false,ready:false},
    {name:'QR expired page without cookie',html:'<span class="tds-mobile-paragraph__text">QR을 다시 인식해주세요</span><p>접속 가능한 시간이 지났어요</p>',ended:true},
    {name:'QR expired auth error page',path:'/table/404',cookie:'error-code=TABLE_SESSION_AUTHENTICATION_FAILED',html:'<h1>QR을 다시 인식해 주세요!</h1><button>다시 접속</button>',ended:true},
    {name:'QR expired on cart route',path:'/table/store/cart',html:'<h1>QR을 다시 인식해주세요</h1>',ended:true},
    {name:'QR expired on detail route',path:'/table/store/menu/123',html:'<h1>QR을 다시 인식해주세요</h1>',ended:true},
    {name:'QR text in active menu ignored',cookie:'error-code=TABLE_SESSION_AUTHENTICATION_FAILED',html:'<main><div role="tablist">menu</div><h2>QR을 다시 인식해주세요</h2></main>',ended:false,ready:true},
    {name:'QR text in active cart ignored',path:'/table/store/cart',cookie:'error-code=TABLE_SESSION_AUTHENTICATION_FAILED',html:'<main><li class="tds-mobile-list-row">QR을 다시 인식해주세요</li></main>',ended:false},
    {name:'QR stale cookie in empty cart ignored',path:'/table/store/cart',cookie:'error-code=TABLE_SESSION_AUTHENTICATION_FAILED',html:'<h1>장바구니</h1><p>담은 메뉴가 없어요</p><button>메뉴 추가하기</button>',ended:false},
    {name:'QR text in payment form ignored',html:'<main><form><h1>QR을 다시 인식해주세요</h1><input></form></main>',ended:false},
    {name:'QR error dialog is not dismissed',html:'<div role="dialog"><h1>QR을 다시 인식해주세요</h1></div>',ended:false},
    {name:'QR hidden text ignored',html:'<h1 style="visibility:hidden">QR을 다시 인식해주세요</h1>',ended:false},
    {name:'QR during cart mutation waits',busy:true,cover:true,allowed:false,html:'<h1>QR을 다시 인식해주세요</h1>',ended:false},
    {name:'QR during navigation waits',busy:true,cover:true,allowed:false,html:'<h1>QR을 다시 인식해주세요</h1>',ended:false},
    {name:'QR under failed cart cover recovers',busy:true,cover:true,allowed:true,html:'<h1>QR을 다시 인식해주세요</h1>',ended:true},
    {name:'QR under uncertain order cover waits for review',busy:true,cover:true,allowed:false,html:'<h1>QR을 다시 인식해주세요</h1>',ended:false},
    {name:'QR hidden title under failed cart cover ignored',busy:true,cover:true,allowed:true,html:'<h1 style="visibility:hidden">QR을 다시 인식해주세요</h1>',ended:false},
    {name:'active cart under failed edit cover preserved',busy:true,cover:true,allowed:true,path:'/table/store/cart',html:'<main><li class="tds-mobile-list-row">QR을 다시 인식해주세요</li></main>',ended:false},
    {name:'generic authentication error not reloaded',cookie:'error-code=TABLE_SESSION_AUTHENTICATION_FAILED',html:'<h1>다시 접속 해주세요</h1>',ended:false},
  ];
  try {
    for (const c of cases) {
      doc.body.innerHTML = c.html;
      if(c.cover)doc.documentElement.setAttribute('data-room-busy','');else doc.documentElement.removeAttribute('data-room-busy');
      const data = doc.createElement('script'); data.id='__NEXT_DATA__'; data.type='application/json';
      data.textContent=JSON.stringify({props:{pageProps:{_nextI18Next:{initialI18nStore:{en:{common:{'checkout-complete-page':{title:c.title||'See you again!'},error:{unexpected:{title:c.errorTitle||'Something went wrong'}}}}}}}}});doc.body.append(data);
      const location = {protocol:c.protocol||'https:',hostname:c.host||'toss-order.tossplace.com',pathname:c.path||'/table/store/menu',href:'https://toss-order.tossplace.com/table/store/menu?tid=fixture'};
      const documentView = new Proxy(doc,{get(target,key){if(key==='cookie')return c.cookie||'';const v=Reflect.get(target,key,target);return typeof v==='function'?v.bind(target):v;}});
      const windowView={__roomInteraction:{state:()=>({busy:!!c.busy,cover:!!c.cover,sessionRecoveryAllowed:c.allowed??!c.busy})}};
      const actual=inspect(documentView,location,frame.contentWindow.getComputedStyle.bind(frame.contentWindow),windowView);
      if(actual.ended!==c.ended || (c.ready!==undefined&&actual.ready!==c.ready) || actual.unavailable!==!!c.unavailable)throw Error(c.name+': '+JSON.stringify(actual));
    }
    return cases.map(c=>({name:c.name,pass:true}));
  } finally { frame.remove(); }
}
