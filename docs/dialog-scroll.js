/* Keep the document still while the native dialog and its inner panes scroll. */
(function (root, create) {
  if (typeof module === 'object' && module.exports) module.exports = {create};
  if (root && root.document) root.StudyDialogScroll = create(root);
})(typeof window === 'undefined' ? null : window, function (host) {
  'use strict';
  const doc = host.document, bound = new WeakSet();
  const bodyKeys = ['position', 'top', 'left', 'width', 'overflow'];
  const rootKeys = ['overflow', 'overscroll-behavior', 'scroll-behavior'];
  let lock = null, touch = null;
  const route = () => host.location.href;
  const snapshot = (style, keys) => keys.map(key => [key, style.getPropertyValue(key), style.getPropertyPriority(key)]);
  const restore = (style, values) => values.forEach(([key, value, priority]) => value ? style.setProperty(key, value, priority) : style.removeProperty(key));
  const set = (style, key, value) => style.setProperty(key, value, 'important');

  if (!doc.getElementById('study-dialog-scroll-style')) {
    const style = doc.createElement('style'); style.id = 'study-dialog-scroll-style';
    style.textContent = '#detail-dialog{overscroll-behavior:contain}#detail-dialog .dialog-body{overscroll-behavior:contain;-webkit-overflow-scrolling:touch}';
    doc.head.append(style);
  }

  function startTouch(event) {
    touch = event.touches.length === 1 ? {x: event.touches[0].clientX, y: event.touches[0].clientY} : null;
  }
  function moveTouch(event) {
    if (!lock || !touch || event.touches.length !== 1) return; // Keep pinch zoom available.
    const point = event.touches[0], dx = point.clientX - touch.x, dy = point.clientY - touch.y;
    touch = {x: point.clientX, y: point.clientY};
    if (!dx && !dy) return;
    let element = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
    if (element && lock.dialog.contains(element)) {
      for (; element; element = element.parentElement) {
        const css = host.getComputedStyle(element);
        if (Math.abs(dx) > Math.abs(dy)) {
          // Formula panes can scroll horizontally, including in an RTL document.
          if (/(auto|scroll)/.test(css.overflowX) && element.scrollWidth > element.clientWidth + 1) return;
        } else if (/(auto|scroll)/.test(css.overflowY) && element.scrollHeight > element.clientHeight + 1) {
          if (dy > 0 && element.scrollTop > 0 || dy < 0 && element.scrollTop + element.clientHeight < element.scrollHeight - 1) return;
        }
        if (element === lock.dialog) break;
      }
    }
    // Fixed body prevents background movement; this also stops iOS boundary bounce.
    if (event.cancelable) event.preventDefault();
  }
  function release(options = {}) {
    if (!lock) return;
    const saved = lock; lock = null; touch = null;
    doc.removeEventListener('touchstart', startTouch, true);
    doc.removeEventListener('touchmove', moveTouch, true);
    restore(doc.body.style, saved.body);
    restore(doc.documentElement.style, saved.root.filter(([key]) => key !== 'scroll-behavior'));
    // Keep restoration instant even when the page normally uses smooth scrolling.
    try {
      if (options.restore !== false && saved.restore && saved.route === route()) host.scrollTo(saved.x, saved.y);
    } finally {
      restore(doc.documentElement.style, saved.root.filter(([key]) => key === 'scroll-behavior'));
    }
  }
  function acquire(dialog) {
    if (lock) {
      if (lock.dialog !== dialog) throw new Error('כבר פתוח חלון אחר.');
      return;
    }
    const x = Number.isFinite(host.scrollX) ? host.scrollX : host.pageXOffset || 0;
    const y = Number.isFinite(host.scrollY) ? host.scrollY : host.pageYOffset || 0;
    lock = {dialog, x, y, route: route(), restore: true, body: snapshot(doc.body.style, bodyKeys), root: snapshot(doc.documentElement.style, rootKeys)};
    set(doc.documentElement.style, 'scroll-behavior', 'auto');
    set(doc.documentElement.style, 'overflow', 'hidden');
    set(doc.documentElement.style, 'overscroll-behavior', 'none');
    set(doc.body.style, 'position', 'fixed');
    set(doc.body.style, 'top', `${-y}px`);
    set(doc.body.style, 'left', `${-x}px`);
    set(doc.body.style, 'width', '100%');
    set(doc.body.style, 'overflow', 'hidden');
    doc.addEventListener('touchstart', startTouch, {passive: true, capture: true});
    doc.addEventListener('touchmove', moveTouch, {passive: false, capture: true});
  }
  function open(dialog) {
    if (!bound.has(dialog)) {
      bound.add(dialog);
      dialog.addEventListener('close', () => {
        // close events are queued: an earlier close must not unlock a reopened dialog.
        if (!dialog.open && lock?.dialog === dialog) release();
      });
    }
    acquire(dialog);
    try {if (!dialog.open) dialog.showModal();}
    catch (error) {release(); throw error;}
  }
  function close(dialog, options = {}) {
    if (lock?.dialog === dialog && options.restore === false) lock.restore = false;
    if (dialog.open) dialog.close();
    // Restore synchronously for callers that immediately navigate or open a new pane.
    if (lock?.dialog === dialog && !dialog.open) release(options);
  }
  return {open, close, isLocked: () => lock !== null};
});
