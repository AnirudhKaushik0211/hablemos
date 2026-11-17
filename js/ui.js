(function (root) {
  'use strict';
  var H = root.Hablemos, ui = H.ui, st = ui.state, doc = root.document;
  var TABS = H.store.TABS;
  var rendered = {};
  var current = null;

  function tabEls() { return TABS.map(function (t) { return ui.byId('hb-tab-' + t); }); }

  function show(tab, focusTab) {
    if (TABS.indexOf(tab) < 0) tab = 'help';
    var prev = current;
    if (prev && ui.panels[prev] && ui.panels[prev].leave) ui.panels[prev].leave();
    current = tab;
    TABS.forEach(function (t) {
      var sel = t === tab;
      var b = ui.byId('hb-tab-' + t);
      b.setAttribute('aria-selected', sel ? 'true' : 'false');
      b.setAttribute('tabindex', sel ? '0' : '-1');
      ui.byId('hb-panel-' + t).hidden = !sel;
    });
    if (tab !== 'help' && ui.panels[tab]) {
      var el = ui.byId('hb-panel-' + tab);
      if (!rendered[tab]) { ui.panels[tab].render(el); rendered[tab] = true; }
      else if (ui.panels[tab].show) ui.panels[tab].show();
    }
    if (st.settings.lastTab !== tab) { st.settings.lastTab = tab; ui.save('settings'); }
    try { if (root.location.hash !== '#/' + tab) root.history.replaceState(null, '', '#/' + tab); } catch (e) { /* file:// or sandbox */ }
    if (focusTab) ui.byId('hb-tab-' + tab).focus();
    if (prev === 'help' && tab !== 'help') markHelpSeen();
  }
  function markHelpSeen() { if (!st.store.get('helpSeen', false)) st.store.set('helpSeen', true); }

  function onTabKey(e) {
    var idx = TABS.indexOf(current);
    var n = TABS.length, next = -1;
    if (e.key === 'ArrowRight') next = (idx + 1) % n;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    if (next < 0) return;
    e.preventDefault();
    show(TABS[next], true);
  }

  function routeFromHash() {
    var m = /^#\/([a-z]+)$/.exec(root.location.hash || '');
    return m && TABS.indexOf(m[1]) >= 0 ? m[1] : null;
  }

  function init() {
    ui.load();
    ui.applySettings();
    var evalEl = ui.byId('hb-help-eval');
    evalEl.textContent = 'Accuracy: the word list, phrases, idioms and scenarios were written and checked by hand. Online translations come from a third party (MyMemory), are not checked by Hablemos and are not covered by that check.';
    tabEls().forEach(function (b) {
      b.addEventListener('click', function () { show(b.getAttribute('data-tab'), false); });
      b.addEventListener('keydown', onTabKey);
    });
    ui.byId('hb-help-start').addEventListener('click', function () { show('translate', true); });
    root.addEventListener('hashchange', function () { var r = routeFromHash(); if (r && r !== current) show(r, false); });
    var seen = st.store.get('helpSeen', false);
    var start = seen ? (routeFromHash() || st.settings.lastTab || 'help') : 'help';
    show(start, false);
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(typeof self !== 'undefined' ? self : this);

