// Toss renumbers its webpack modules on every deploy, so display fixtures find them by exported shape.
// Only factories whose source contains the hint are required, then checked by shape.
export const tossModules=`(() => {
 if(window.__qaToss)return;let require;window.webpackChunk_N_E.push([['room-qa-modules'],{},r=>require=r]);
 const source=f=>Function.prototype.toString.call(f),found={},lookups={
  React:[/\\.useState=function/,e=>typeof e.createElement==='function'&&typeof e.useState==='function'&&e],
  ReactDOM:[/\\.createRoot=/,e=>typeof e.createRoot==='function'&&e],
  useDialog:[/openConfirm:/,e=>Object.values(e).find(v=>typeof v==='function'&&!v.length&&/openAlert:/.test(source(v))&&/openConfirm:/.test(source(v)))],
  Cart:[/FixedBottomCTA/,e=>Object.values(e).find(v=>v?.Item&&v.FixedBottomCTA)],
  NumericSpinner:[/onNumberChange/,e=>Object.values(e).find(v=>v?.$$typeof===Symbol.for('react.forward_ref')&&/onNumberChange/.test(source(v.render)))],
  QrExpired:[/QR을 다시 인식해주세요/,e=>Object.values(e).find(v=>typeof v==='function'&&/QR을 다시 인식해주세요/.test(source(v)))]};
 window.__qaToss=name=>found[name]||=(()=>{const [hint,pick]=lookups[name];
  for(const [id,factory] of Object.entries(require.m))if(hint.test(source(factory)))try{const value=pick(require(id));if(value)return value;}catch(_){}
  throw Error('Toss module not found: '+name);})();
})()`;

// Original Toss confirmation dialog with no order handlers; window.__qaRoot.unmount() closes it.
export const openConfirmDialog=`(() => {
 const t=window.__qaToss,React=t('React'),dom=t('ReactDOM'),useDialog=t('useDialog');
 const host=document.createElement('div');document.body.append(host);window.__qaRoot=dom.createRoot(host);
 function Fixture(){const api=useDialog();React.useEffect(()=>{const p=api.openConfirm({title:'이대로 주문할까요?',description:'함께 주문하는 메뉴와 수량을 확인해 주세요.',cancelButton:{text:'취소'},confirmButton:{text:'확인'}});p.catch(()=>{});return()=>p.close();},[]);return null;}
 window.__qaRoot.render(React.createElement(Fixture));return 'Opened display-only original Toss dialog; no order handlers attached';
})()`;
