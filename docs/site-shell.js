'use strict';

// Move the existing controls, keeping a single navigation tree, IDs and listeners.
(() => {
  const byId = id => document.getElementById(id);
  const menu = byId('site-menu'), button = byId('site-menu-button');
  const nav = byId('nav'), theme = document.querySelector('.theme-control');
  const settings = byId('settings-button'), desktopControls = document.querySelector('.topbar-actions');
  const mobile = window.matchMedia('(max-width:700px)');
  if (!menu || !button || !nav || !theme || !settings) return;

  function closeMenu({restoreFocus = true} = {}) {
    if (!menu.open) return;
    if (window.StudyDialogScroll) window.StudyDialogScroll.close(menu);
    else menu.close();
    document.documentElement.classList.remove('site-menu-open');
    button.setAttribute('aria-expanded', 'false');
    if (restoreFocus && mobile.matches) button.focus({preventScroll:true});
  }

  function placeControls() {
    const focus = document.activeElement;
    const wasOpen = menu.open;
    closeMenu({restoreFocus:false});
    (mobile.matches ? byId('mobile-nav-slot') : byId('desktop-nav-slot')).append(nav);
    (mobile.matches ? byId('mobile-controls-slot') : desktopControls).append(theme, settings);
    document.documentElement.classList.add('site-shell-ready');
    if (mobile.matches && (nav.contains(focus) || theme.contains(focus) || focus === settings)) {
      button.focus({preventScroll:true});
    } else if (!mobile.matches && (wasOpen || focus === button)) {
      (nav.querySelector('[aria-current="page"]') || nav.querySelector('a'))?.focus({preventScroll:true});
    }
  }

  button.addEventListener('click', () => {
    if (!mobile.matches) return;
    if (window.StudyDialogScroll) window.StudyDialogScroll.open(menu);
    else menu.showModal();
    button.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('site-menu-open');
  });
  byId('site-menu-close').addEventListener('click', () => closeMenu());
  menu.addEventListener('cancel', event => {event.preventDefault();closeMenu();});
  menu.addEventListener('click', event => {
    // A backdrop click targets the dialog, but whitespace inside it also does.
    if (event.target !== menu) return;
    const r = menu.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeMenu();
  });
  nav.addEventListener('click', event => {
    if (!menu.open || !event.target.closest('a[href]') || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    closeMenu({restoreFocus:false});
    // Covers the current-page link too; a new route handles its own focus afterward.
    byId('main').focus({preventScroll:true});
  });
  settings.addEventListener('click', () => {
    // Close this modal before the settings handler opens the next one.
    // The settings dialog then returns focus to the visible menu button.
    closeMenu();
  }, {capture:true});
  window.addEventListener('hashchange', () => closeMenu({restoreFocus:false}));
  mobile.addEventListener('change', placeControls);
  placeControls();
  window.StudyShell = {closeMenu};
})();
