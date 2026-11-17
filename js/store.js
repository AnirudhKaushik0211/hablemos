(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module && module.exports;
  var deps = isNode ? { util: require('./util.js') } : { util: root.Hablemos.util };
  var api = factory(deps);
  if (isNode) module.exports = api;
  else { root.Hablemos = root.Hablemos || {}; root.Hablemos.store = api; }
})(typeof self !== 'undefined' ? self : this, function (deps) {
  'use strict';
  var U = deps.util;
  var PREFIX = 'hb.';
  var MAX_IMPORT_BYTES = 1048576;
  var ID_RE = /^[A-Za-z0-9_:.\-]{1,48}$/;
  var TABS = ['help', 'translate', 'learn', 'cards', 'quiz', 'scenarios', 'progress'];

  var DEFAULT_SETTINGS = {
    variant: 'la', you: 'tu', theme: 'auto', textSize: 1, sound: true, slow: false,
    accentLoose: true, dailyGoal: 20, newPerDay: 10, reducedMotion: 'auto',
    online: false, email: '', lastTab: 'help'
  };

  // ---- storage wrapper ----
  function createStore(storage) {
    var mem = {};
    var ok = false;
    try {
      if (storage) {
        storage.setItem('hb.__probe', '1');
        storage.removeItem('hb.__probe');
        ok = true;
      }
    } catch (e) { ok = false; }
    var s = {
      persistent: function () { return ok; },
      get: function (key, def) {
        var raw = null;
        try { raw = ok ? storage.getItem(PREFIX + key) : (key in mem ? mem[key] : null); } catch (e) { raw = null; }
        if (raw === null || raw === undefined) return def;
        try { return JSON.parse(raw); } catch (e) { return def; }
      },
      set: function (key, val) {
        var raw = JSON.stringify(val);
        try {
          if (ok) storage.setItem(PREFIX + key, raw); else mem[key] = raw;
          return true;
        } catch (e) { mem[key] = raw; ok = false; return false; }
      },
      remove: function (key) {
        try { if (ok) storage.removeItem(PREFIX + key); } catch (e) { /* ignore */ }
        delete mem[key];
      },
      clearAll: function () {
        ['v', 'helpSeen', 'settings', 'online', 'progress', 'cards', 'mistakes', 'calendar', 'daily'].forEach(function (k) { s.remove(k); });
      }
    };
    return s;
  }

  // ---- sanitizers (idempotent) ----
  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function str(v, max) { return typeof v === 'string' ? U.clean(v).slice(0, max) : ''; }
  function oneOf(v, list, def) { return list.indexOf(v) >= 0 ? v : def; }
  function bool(v, def) { return typeof v === 'boolean' ? v : def; }

  function sanitizeSettings(v, keepEmail) {
    var d = DEFAULT_SETTINGS;
    var o = isObj(v) ? v : {};
    var out = {
      variant: oneOf(o.variant, ['la', 'es'], d.variant),
      you: oneOf(o.you, ['tu', 'usted'], d.you),
      theme: oneOf(o.theme, ['auto', 'light', 'dark'], d.theme),
      textSize: U.toInt(o.textSize, d.textSize, 0, 3),
      sound: bool(o.sound, d.sound),
      slow: bool(o.slow, d.slow),
      accentLoose: bool(o.accentLoose, d.accentLoose),
      dailyGoal: oneOf(U.toInt(o.dailyGoal, 0, 0, 1000), [10, 20, 30, 50], d.dailyGoal),
      newPerDay: U.toInt(o.newPerDay, d.newPerDay, 5, 50),
      reducedMotion: oneOf(o.reducedMotion, ['auto', 'on'], d.reducedMotion),
      online: bool(o.online, d.online),
      email: keepEmail && typeof o.email === 'string' ? o.email.trim().slice(0, 254) : '',
      lastTab: oneOf(o.lastTab, TABS, d.lastTab)
    };
    if (!keepEmail) delete out.email;
    return out;
  }

  function sanitizeProgress(v) {
    var o = isObj(v) ? v : {};
    var learned = [];
    var seen = {};
    (Array.isArray(o.learned) ? o.learned : []).forEach(function (id) {
      if (typeof id === 'string' && ID_RE.test(id) && !seen[id] && learned.length < 5000) { seen[id] = 1; learned.push(id); }
    });
    var badges = {};
    if (isObj(o.badges)) Object.keys(o.badges).slice(0, 60).forEach(function (k) {
      if (ID_RE.test(k)) badges[k] = U.toInt(o.badges[k], 0, 0, 1000000);
    });
    var counters = {};
    if (isObj(o.counters)) Object.keys(o.counters).slice(0, 80).forEach(function (k) {
      if (ID_RE.test(k)) counters[k] = U.toInt(o.counters[k], 0, 0, 100000000);
    });
    var fx = isObj(o.flashXp) ? o.flashXp : {};
    return {
      xp: U.toInt(o.xp, 0, 0, 100000000),
      streak: U.toInt(o.streak, 0, 0, 100000),
      bestStreak: U.toInt(o.bestStreak, 0, 0, 100000),
      lastGoalDay: U.toInt(o.lastGoalDay, 0, 0, 1000000),
      learned: learned,
      badges: badges,
      counters: counters,
      flashXp: { day: U.toInt(fx.day, 0, 0, 1000000), xp: U.toInt(fx.xp, 0, 0, 100000) }
    };
  }

  function sanitizeCards(v) {
    var o = isObj(v) ? v : {};
    var states = {};
    if (isObj(o.states)) Object.keys(o.states).slice(0, 6000).forEach(function (id) {
      var c = o.states[id];
      if (!ID_RE.test(id) || !isObj(c)) return;
      var ease = typeof c.ease === 'number' && isFinite(c.ease) ? Math.round(U.clamp(c.ease, 1.3, 3.0) * 100) / 100 : 2.5;
      states[id] = {
        id: id, ease: ease, interval: U.toInt(c.interval, 0, 0, 365), reps: U.toInt(c.reps, 0, 0, 10000),
        lapses: U.toInt(c.lapses, 0, 0, 10000), due: U.toInt(c.due, 0, 0, 1000000), last: U.toInt(c.last, 0, 0, 1000000)
      };
    });
    var custom = [];
    var seen = {};
    (Array.isArray(o.custom) ? o.custom : []).forEach(function (c) {
      if (!isObj(c) || custom.length >= 500 || typeof c.id !== 'string' || !ID_RE.test(c.id) || seen[c.id]) return;
      var es = str(c.es, 200), en = str(c.en, 200);
      if (!es || !en) return;
      seen[c.id] = 1;
      var item = { id: c.id, es: es, en: en };
      var note = str(c.note, 200);
      if (note) item.note = note;
      custom.push(item);
    });
    var nd = isObj(o.newDay) ? o.newDay : {};
    return { states: states, custom: custom, newDay: { day: U.toInt(nd.day, 0, 0, 1000000), n: U.toInt(nd.n, 0, 0, 10000) } };
  }

  function sanitizeMistakes(v) {
    var out = [];
    var seen = {};
    (Array.isArray(v) ? v : []).forEach(function (m) {
      if (!isObj(m) || typeof m.id !== 'string' || !ID_RE.test(m.id) || seen[m.id] || out.length >= 200) return;
      seen[m.id] = 1;
      out.push({ id: m.id, kind: oneOf(m.kind, ['word', 'phrase', 'conj', 'other'], 'other'), count: U.toInt(m.count, 1, 1, 100000), last: U.toInt(m.last, 0, 0, 1000000), ok: U.toInt(m.ok, 0, 0, 2) });
    });
    return out;
  }

  function sanitizeCalendar(v) {
    var out = {};
    if (isObj(v)) {
      var keys = Object.keys(v).filter(function (k) { return /^\d{1,7}$/.test(k); }).map(Number).sort(function (a, b) { return a - b; });
      keys.slice(-400).forEach(function (k) { out[String(k)] = U.toInt(v[k], 0, 0, 100000); });
    }
    return out;
  }

  function sanitizeDaily(v) {
    var out = {};
    if (isObj(v)) Object.keys(v).filter(function (k) { return /^\d{4}-\d{2}-\d{2}$/.test(k); }).sort().slice(-400).forEach(function (k) {
      var e = v[k];
      if (isObj(e)) out[k] = { score: U.toInt(e.score, 0, 0, 1000), total: U.toInt(e.total, 0, 0, 1000) };
    });
    return out;
  }

  // ---- export / import ----
  function buildExport(snapshot, exportedAt) {
    var s = snapshot || {};
    return {
      app: 'hablemos', schema: 1, exportedAt: exportedAt || '',
      data: {
        settings: sanitizeSettings(s.settings, false),
        progress: sanitizeProgress(s.progress),
        cards: sanitizeCards(s.cards),
        mistakes: sanitizeMistakes(s.mistakes),
        calendar: sanitizeCalendar(s.calendar),
        daily: sanitizeDaily(s.daily)
      }
    };
  }

  // Returns { ok: true, data } or { ok: false, error }. Never throws.
  function parseImport(text) {
    if (typeof text !== 'string') return { ok: false, error: 'The file could not be read.' };
    if (text.length > MAX_IMPORT_BYTES) return { ok: false, error: 'The file is larger than 1 MB, so it was not imported.' };
    var j;
    try { j = JSON.parse(text); } catch (e) { return { ok: false, error: 'The file is not valid JSON.' }; }
    if (!isObj(j) || j.app !== 'hablemos') return { ok: false, error: 'This is not a Hablemos progress file.' };
    if (j.schema !== 1) return { ok: false, error: 'Unsupported progress file version.' };
    if (!isObj(j.data)) return { ok: false, error: 'The progress file has no data.' };
    return { ok: true, data: buildExport(j.data, '').data };
  }

  function snapshot(store) {
    return {
      settings: store.get('settings', null), progress: store.get('progress', null), cards: store.get('cards', null),
      mistakes: store.get('mistakes', null), calendar: store.get('calendar', null), daily: store.get('daily', null)
    };
  }

  // Replace stored data with imported data; the saved email is kept as it is on this device.
  function applyImport(store, data) {
    var old = sanitizeSettings(store.get('settings', null), true);
    var settings = sanitizeSettings(data.settings, false);
    settings.email = old.email;
    store.set('settings', settings);
    store.set('progress', data.progress);
    store.set('cards', data.cards);
    store.set('mistakes', data.mistakes);
    store.set('calendar', data.calendar);
    store.set('daily', data.daily);
    store.set('v', 1);
  }

  return {
    PREFIX: PREFIX, TABS: TABS, MAX_IMPORT_BYTES: MAX_IMPORT_BYTES, DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    createStore: createStore, sanitizeSettings: sanitizeSettings, sanitizeProgress: sanitizeProgress,
    sanitizeCards: sanitizeCards, sanitizeMistakes: sanitizeMistakes, sanitizeCalendar: sanitizeCalendar,
    sanitizeDaily: sanitizeDaily, buildExport: buildExport, parseImport: parseImport, snapshot: snapshot,
    applyImport: applyImport
  };
});
