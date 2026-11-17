(function (root) {
  'use strict';
  var H = root.Hablemos;
  var U = H.util, store = H.store, P = H.progress;
  var doc = root.document;

  var ui = H.ui = { panels: {}, state: {} };
  var st = ui.state;

  // ---- DOM helper: never uses innerHTML; text goes through textContent ----
  function h(tag, props) {
    var el = doc.createElement(tag);
    var p = props || {};
    Object.keys(p).forEach(function (k) {
      var v = p[k];
      if (v === undefined || v === null || v === false) return;
      if (k === 'text') el.textContent = String(v);
      else if (k === 'class') el.className = v;
      else if (k === 'on') Object.keys(v).forEach(function (ev) { el.addEventListener(ev, v[ev]); });
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'selected') { if (v) el[k] = true; }
      else if (k === 'style' || /^on/i.test(k)) throw new Error('Inline style and on* attributes are not allowed.');
      else el.setAttribute(k, v === true ? '' : String(v));
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, kid) {
    if (kid === undefined || kid === null || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { append(el, k); }); return; }
    el.appendChild(typeof kid === 'string' || typeof kid === 'number' ? doc.createTextNode(String(kid)) : kid);
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  function byId(id) { return doc.getElementById(id); }
  function langAttr() { return st.settings.variant === 'es' ? 'es-ES' : 'es-MX'; }
  function es(text, extra) { return h('span', { lang: langAttr(), class: 'hb-es' + (extra ? ' ' + extra : ''), text: text }); }

  // ---- time ----
  function today() { var d = new Date(); return U.dayNumber(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
  function todayString() { return U.dayToString(today()); }

  // ---- messages (visible + aria-live) ----
  var liveTimer = null;
  function say(msg) {
    var el = byId('hb-live');
    if (!el) return;
    el.textContent = '';
    root.setTimeout(function () { el.textContent = msg; }, 30);
    if (liveTimer) root.clearTimeout(liveTimer);
    liveTimer = root.setTimeout(function () { el.textContent = ''; }, 7000);
  }

  // ---- state ----
  function load() {
    st.store = store.createStore((function () { try { return root.localStorage; } catch (e) { return null; } })());
    st.settings = store.sanitizeSettings(st.store.get('settings', null), true);
    st.progress = store.sanitizeProgress(st.store.get('progress', null));
    st.cards = store.sanitizeCards(st.store.get('cards', null));
    st.mistakes = store.sanitizeMistakes(st.store.get('mistakes', null));
    st.calendar = store.sanitizeCalendar(st.store.get('calendar', null));
    st.daily = store.sanitizeDaily(st.store.get('daily', null));
    st.online = st.store.get('online', { day: 0, used: 0 });
    if (!st.store.persistent()) byId('hb-storage-notice').hidden = false;
  }
  function save(key) {
    if (key === 'settings') st.store.set('settings', st.settings);
    else st.store.set(key, st[key]);
    st.store.set('v', 1);
  }
  function applySettings() {
    var s = st.settings, de = doc.documentElement;
    de.setAttribute('data-theme', s.theme);
    de.setAttribute('data-size', String(s.textSize));
    if (s.reducedMotion === 'on') de.setAttribute('data-motion', 'reduce'); else de.removeAttribute('data-motion');
  }
  function reducedMotion() {
    return st.settings.reducedMotion === 'on' || (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // ---- speech ----
  function speak(text, slowOverride) {
    if (!st.settings.sound) { say('Sound is turned off in Settings.'); return false; }
    var synth = root.speechSynthesis;
    if (!synth || typeof root.SpeechSynthesisUtterance === 'undefined') { say('Speech is not available in this browser. The Spanish text is shown instead.'); return false; }
    try {
      var lang = langAttr();
      var u = new root.SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = (slowOverride || st.settings.slow) ? 0.7 : 0.9;
      var voices = synth.getVoices ? synth.getVoices() : [];
      var v = voices.filter(function (x) { return x.lang === lang; })[0] || voices.filter(function (x) { return /^es/i.test(x.lang); })[0];
      if (v) u.voice = v; else say('No Spanish voice was found on this device, so the sound may be missing. The text is shown.');
      synth.cancel();
      synth.speak(u);
      return true;
    } catch (e) { say('Speech did not work on this device.'); return false; }
  }
  function speakButton(text, label) {
    return h('button', { type: 'button', class: 'hb-btn hb-btn-small', 'aria-label': 'Speak: ' + (label || text), on: { click: function () { speak(text); } } }, speakIcon(), ' Speak');
  }
  function speakIcon() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = doc.createElementNS(ns, 'svg');
    svg.setAttribute('width', '16'); svg.setAttribute('height', '16'); svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('aria-hidden', 'true');
    var path = doc.createElementNS(ns, 'path');
    path.setAttribute('d', 'M2 6h3l4-3v10l-4-3H2z M11 5a4 4 0 0 1 0 6');
    path.setAttribute('fill', 'currentColor'); path.setAttribute('stroke', 'currentColor');
    svg.appendChild(path);
    return svg;
  }

  // ---- modal dialog with focus trap ----
  var modalState = null;
  function closeModal(result) {
    var ov = byId('hb-overlay');
    if (!modalState) return;
    var m = modalState; modalState = null;
    ov.hidden = true; clear(ov);
    doc.removeEventListener('keydown', m.keyHandler, true);
    if (m.prev && m.prev.focus) m.prev.focus();
    if (m.onClose) m.onClose(result);
  }
  function modal(opts) {
    var ov = byId('hb-overlay');
    clear(ov);
    var titleId = 'hb-dialog-title';
    var btns = opts.buttons.map(function (b) {
      return h('button', { type: 'button', class: 'hb-btn' + (b.primary ? ' hb-btn-primary' : ''), id: b.id, on: { click: function () { closeModal(b.value); } } }, b.label);
    });
    var dlg = h('div', { class: 'hb-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, id: 'hb-dialog' },
      h('h2', { id: titleId, text: opts.title }), opts.body, h('div', { class: 'hb-row' }, btns));
    ov.appendChild(dlg);
    ov.hidden = false;
    var keyHandler = function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closeModal(opts.cancelValue); return; }
      if (e.key !== 'Tab') return;
      var f = dlg.querySelectorAll('button, a[href], input, select, textarea');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    modalState = { prev: doc.activeElement, keyHandler: keyHandler, onClose: opts.onClose };
    doc.addEventListener('keydown', keyHandler, true);
    (btns[opts.focusIndex || 0] || btns[0]).focus();
  }
  function confirmBox(title, text, okLabel, cb) {
    modal({ title: title, body: h('p', { text: text }), buttons: [{ label: 'Cancel', value: false, id: 'hb-confirm-cancel' }, { label: okLabel, value: true, primary: true, id: 'hb-confirm-ok' }], cancelValue: false, onClose: cb });
  }

  // ---- items (words, phrases, custom cards) ----
  var customIndex = null;
  function itemInfo(id) {
    var it = H.quiz.itemOf(id);
    var v = st.settings.variant;
    if (it && it.pos) {
      var r = H.lexicon.resolve(it, v);
      return { id: id, kind: 'word', es: r.es, en: it.en, pos: it.pos, g: r.g || it.g || null, ex: it.ex, note: it.note || '', tier: it.tier, cat: it.cat };
    }
    if (it) return { id: id, kind: 'phrase', es: H.lexicon.phraseEs(it, v), en: it.en, pos: 'phrase', ex: null, note: it.note || '', tier: it.tier, cat: it.cat };
    var c = st.cards.custom.filter(function (x) { return x.id === id; })[0];
    if (c) return { id: id, kind: 'custom', es: c.es, en: c.en, pos: '', ex: null, note: c.note || '' };
    return null;
  }
  function addCustom(esText, enText, note) {
    var e = U.clean(esText).slice(0, 200), n = U.clean(enText).slice(0, 200);
    if (!e || !n) { say('Both Spanish and English are needed to make a card.'); return false; }
    var key = 'c-' + H.rng.fnv1a(e + '|' + n).toString(36);
    if (st.cards.custom.some(function (c) { return c.id === key; })) { say('That card is already in My cards.'); return true; }
    if (st.cards.custom.length >= 500) { say('My cards is full (500 cards).'); return false; }
    var item = { id: key, es: e, en: n };
    if (note) item.note = U.clean(note).slice(0, 200);
    st.cards.custom.push(item);
    save('cards');
    say('Added to My cards.');
    return true;
  }
  function addItemToCards(id) {
    var info = itemInfo(id);
    if (!info) return;
    var key = 'c-' + id;
    if (st.cards.custom.some(function (c) { return c.id === key; })) { say('Already in My cards.'); return; }
    if (st.cards.custom.length >= 500) { say('My cards is full (500 cards).'); return; }
    st.cards.custom.push({ id: key, es: info.es, en: info.en });
    save('cards');
    say('Added to My cards.');
  }

  // ---- progress side effects ----
  function afterActivity() {
    var r = P.recordActivity(st.progress, st.calendar, today(), st.settings.dailyGoal);
    st.progress = r.p; st.calendar = r.cal;
    if (r.goalReached) say('Daily goal reached. Streak: ' + st.progress.streak + ' day' + (st.progress.streak === 1 ? '' : 's') + '.');
    return r.goalReached;
  }
  function gainXp(n) { st.progress = P.addXp(st.progress, n); }
  function checkBadges() {
    var before = P.level(st.progress.xp);
    var r = P.checkBadges(st.progress, today());
    st.progress = r.p;
    var msgs = r.earned.map(function (b) { return 'Badge earned: ' + b.name + '.'; });
    var after = P.level(st.progress.xp);
    if (after > before) msgs.push('Level up! You are level ' + after + '.');
    if (msgs.length) say(msgs.join(' '));
    return r.earned;
  }
  function saveAll() { ['progress', 'calendar', 'mistakes', 'cards', 'daily'].forEach(save); }
  function mistake(id, kind) { st.mistakes = P.recordMistake(st.mistakes, id, kind, today()); }
  function correctOn(id) { st.mistakes = P.recordCorrectOnMistake(st.mistakes, id); }

  function register(name, mod) { ui.panels[name] = mod; }

  ui.h = h; ui.clear = clear; ui.byId = byId; ui.es = es; ui.langAttr = langAttr; ui.today = today; ui.todayString = todayString;
  ui.say = say; ui.load = load; ui.save = save; ui.saveAll = saveAll; ui.applySettings = applySettings; ui.reducedMotion = reducedMotion;
  ui.speak = speak; ui.speakButton = speakButton; ui.modal = modal; ui.closeModal = closeModal; ui.confirmBox = confirmBox;
  ui.itemInfo = itemInfo; ui.addCustom = addCustom; ui.addItemToCards = addItemToCards; ui.afterActivity = afterActivity;
  ui.gainXp = gainXp; ui.checkBadges = checkBadges; ui.mistake = mistake; ui.correctOn = correctOn; ui.register = register;
  ui.field = function (el, max) { return el && typeof el.value === 'string' ? U.clean(el.value).slice(0, max || 1000) : ''; };
  ui.dateLabel = function (n) { return U.dayToString(n); };
  void customIndex;
})(typeof self !== 'undefined' ? self : this);
