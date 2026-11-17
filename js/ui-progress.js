(function (root) {
  'use strict';
  var H = root.Hablemos, ui = H.ui, h = ui.h, st = ui.state, P = H.progress, O = H.online, U = H.util, SS = H.store;
  var host;

  function stat(label, value) { return h('div', { class: 'hb-stat' }, h('strong', { text: String(value) }), h('span', { class: 'hb-small', text: label })); }

  function calendar() {
    var today = ui.today();
    var start = today - U.weekday(today) - 77;
    var cells = [];
    var active = 0;
    for (var i = 0; i < 84; i++) {
      var d = start + i;
      var n = d > today ? 0 : (st.calendar[String(d)] || 0);
      var lvl = n === 0 ? 0 : (n < st.settings.dailyGoal ? 1 : (n < st.settings.dailyGoal * 2 ? 2 : 3));
      if (n > 0) active++;
      var label = U.dayToString(d) + ': ' + (d > today ? 'in the future' : n + ' answer' + (n === 1 ? '' : 's'));
      cells.push(h('span', { role: 'img', 'aria-label': label, title: label, 'data-l': String(lvl) }));
    }
    return h('div', null, h('div', { class: 'hb-cal', id: 'hb-cal', role: 'group', 'aria-label': 'Activity in the last 12 weeks, one square per day' }, cells),
      h('p', { class: 'hb-small hb-muted', text: 'Active days in the last 12 weeks: ' + active + '. Darker squares mean more answers; reaching your daily goal extends the streak.' }));
  }

  function badges() {
    return h('ul', { class: 'hb-list', id: 'hb-badges' }, P.BADGES.map(function (b) {
      var day = st.progress.badges[b.id];
      return h('li', { class: 'hb-entry' }, h('strong', { text: (day ? '\u2605 ' : '\u2606 ') + b.name }), h('span', { class: 'hb-small', text: ' ' + (day ? 'Earned ' + U.dayToString(day) + '.' : 'Locked: ' + b.desc) }));
    }));
  }

  function download(name, text) {
    var blob = new root.Blob([text], { type: 'application/json' });
    var url = root.URL.createObjectURL(blob);
    var a = h('a', { href: url, download: name });
    root.document.body.appendChild(a);
    a.click();
    root.document.body.removeChild(a);
    root.setTimeout(function () { root.URL.revokeObjectURL(url); }, 2000);
  }

  function exportJson() {
    var snap = { settings: st.settings, progress: st.progress, cards: st.cards, mistakes: st.mistakes, calendar: st.calendar, daily: st.daily };
    var out = SS.buildExport(snap, new root.Date().toISOString());
    download('hablemos-progress.json', JSON.stringify(out, null, 2));
    ui.say('Progress exported. The file does not include your online-limit email.');
  }

  function importFile(file, msgEl) {
    if (!file) return;
    if (file.size > SS.MAX_IMPORT_BYTES) { msgEl.textContent = 'The file is larger than 1 MB, so it was not imported.'; ui.say(msgEl.textContent); return; }
    var fr = new root.FileReader();
    fr.onload = function () {
      var r = SS.parseImport(String(fr.result));
      if (!r.ok) { msgEl.textContent = 'Import failed: ' + r.error + ' Nothing was changed.'; ui.say(msgEl.textContent); return; }
      ui.confirmBox('Replace your progress?', 'Importing replaces your current progress, cards, mistakes and settings on this device (not your saved email). Continue?', 'Replace', function (yes) {
        if (!yes) { msgEl.textContent = 'Import cancelled. Nothing was changed.'; return; }
        SS.applyImport(st.store, r.data);
        var email = st.settings.email;
        ui.load(); st.settings.email = email;
        ui.applySettings();
        msgEl.textContent = 'Progress imported.';
        ui.say('Progress imported.');
        render(host);
      });
    };
    fr.onerror = function () { msgEl.textContent = 'The file could not be read. Nothing was changed.'; ui.say(msgEl.textContent); };
    fr.readAsText(file);
  }

  function select(id, label, value, opts, onChange) {
    var sel = h('select', { id: id }, opts.map(function (o) { return h('option', { value: String(o[0]), text: o[1] }); }));
    sel.value = String(value);
    sel.addEventListener('change', function () { onChange(sel.value); });
    return h('div', null, h('label', { for: id, text: label }), sel);
  }
  function check(id, label, value, onChange) {
    var cb = h('input', { type: 'checkbox', id: id, checked: !!value });
    cb.addEventListener('change', function () { onChange(cb.checked, cb); });
    return h('div', { class: 'hb-row' }, cb, h('label', { class: 'hb-inline-label', for: id, text: label }));
  }
  function setS(key, val) { st.settings[key] = val; ui.save('settings'); ui.applySettings(); if (ui.translatePanel) ui.translatePanel.syncSettings(); }

  function settingsForm() {
    var s = st.settings;
    var emailMsg = h('p', { id: 'hb-set-email-msg', class: 'hb-small', role: 'status' });
    var emailIn = h('input', { type: 'email', id: 'hb-set-email', autocomplete: 'off', spellcheck: 'false', maxlength: '254', value: s.email || '', 'aria-describedby': 'hb-set-email-help' });
    var usage = h('p', { id: 'hb-set-usage', class: 'hb-small', text: '' });
    var updUsage = function () {
      var has = O.validEmail(st.settings.email);
      usage.textContent = 'Characters used today: ' + O.usedToday(st.online, ui.today()).toLocaleString('en-US') + ' of ' + O.limitFor(has).toLocaleString('en-US') + ' (local estimate).';
    };
    updUsage();
    var onlineBox = check('hb-set-online', 'Online translation (off by default; sends text to MyMemory only when you press Translate online)', s.online, function (on, cb) {
      if (on) {
        cb.checked = false;
        ui.translatePanel.consent(function (agreed) {
          if (agreed) { setS('online', true); cb.checked = true; ui.say('Online translation is on. Use the Translate online button on the Translate tab.'); }
          else ui.say('Online translation stays off.');
          ui.translatePanel.refreshOnline();
        });
      } else { setS('online', false); ui.translatePanel.refreshOnline(); ui.say('Online translation is off.'); }
    });
    return h('div', { class: 'hb-card', id: 'hb-settings' }, h('h3', { text: 'Settings' }),
      h('div', { class: 'hb-grid' },
        select('hb-set-variant', 'Spanish variant', s.variant, [['la', 'Latin America'], ['es', 'Spain']], function (v) { setS('variant', v === 'es' ? 'es' : 'la'); }),
        select('hb-set-you', 'You form', s.you, [['tu', 'tú (informal)'], ['usted', 'usted (formal)']], function (v) { setS('you', v === 'usted' ? 'usted' : 'tu'); }),
        select('hb-set-theme', 'Theme', s.theme, [['auto', 'Match my device'], ['light', 'Light'], ['dark', 'Dark']], function (v) { setS('theme', v); }),
        select('hb-set-size', 'Text size', s.textSize, [[0, 'Small'], [1, 'Normal'], [2, 'Large'], [3, 'Extra large']], function (v) { setS('textSize', U.toInt(v, 1, 0, 3)); }),
        select('hb-set-goal', 'Daily goal (answers)', s.dailyGoal, [[10, '10'], [20, '20'], [30, '30'], [50, '50']], function (v) { setS('dailyGoal', U.toInt(v, 20, 10, 50)); }),
        select('hb-set-new', 'New cards per day', s.newPerDay, [5, 10, 15, 20, 30, 40, 50].map(function (n) { return [n, String(n)]; }), function (v) { setS('newPerDay', U.toInt(v, 10, 5, 50)); }),
        select('hb-set-motion', 'Reduced motion', s.reducedMotion, [['auto', 'Follow my device'], ['on', 'Always reduce']], function (v) { setS('reducedMotion', v === 'on' ? 'on' : 'auto'); })),
      check('hb-set-sound', 'Sound and speech (text to speech)', s.sound, function (v) { setS('sound', v); }),
      check('hb-set-slow', 'Slow speech', s.slow, function (v) { setS('slow', v); }),
      check('hb-set-accent', 'Accept answers with missing accents (you still get a hint)', s.accentLoose, function (v) { setS('accentLoose', v); }),
      h('h3', { text: 'Online translation (optional)' }),
      onlineBox,
      h('p', { class: 'hb-small hb-muted', text: 'Provider: MyMemory. Limits published by the provider: 5,000 characters per day anonymously, 50,000 per day with an email.' }),
      h('label', { for: 'hb-set-email', text: 'Email for a higher daily limit (optional)' }), emailIn,
      h('p', { id: 'hb-set-email-help', class: 'hb-small hb-muted', text: 'Stored only on this device. Sent only as the provider\'s "de" parameter when you click Translate online. Never exported.' }),
      h('div', { class: 'hb-row' },
        h('button', { type: 'button', class: 'hb-btn', id: 'hb-set-email-save', text: 'Save email', on: { click: function () {
          var v = ui.field(emailIn, 254);
          if (!v) { emailMsg.textContent = 'Type an email address, or leave this blank to use the anonymous limit.'; return; }
          if (!O.validEmail(v)) { emailMsg.textContent = 'That does not look like an email address, so nothing was saved.'; ui.say('That does not look like an email address, so nothing was saved.'); return; }
          setS('email', v); emailMsg.textContent = 'Saved on this device. Your daily limit counter now uses 50,000.'; updUsage(); if (ui.translatePanel) ui.translatePanel.updateUsage();
        } } }),
        h('button', { type: 'button', class: 'hb-btn', id: 'hb-set-email-clear', text: 'Clear email', on: { click: function () {
          setS('email', ''); emailIn.value = ''; emailMsg.textContent = 'Email removed. The anonymous limit (5,000) applies.'; updUsage(); if (ui.translatePanel) ui.translatePanel.updateUsage();
        } } })),
      emailMsg, usage);
  }

  function render(c) {
    host = c;
    ui.clear(c);
    var li = P.levelInfo(st.progress.xp);
    var today = ui.today();
    var due = Object.keys(st.cards.states).filter(function (id) { return st.cards.states[id].due <= today && st.cards.states[id].last > 0; }).length;
    var bar = h('div', { class: 'hb-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(li.span || 1), 'aria-valuenow': String(li.into), 'aria-label': 'Progress to the next level' }, h('div'));
    bar.firstChild.style.width = (li.span ? Math.min(100, Math.round(100 * li.into / li.span)) : 100) + '%';
    var msg = h('p', { id: 'hb-data-msg', class: 'hb-small', role: 'status' });
    var file = h('input', { type: 'file', id: 'hb-import-file', accept: 'application/json,.json', 'aria-label': 'Choose a progress file to import' });
    file.addEventListener('change', function () { importFile(file.files && file.files[0], msg); file.value = ''; });
    c.appendChild(h('h2', { text: 'Progress and settings' }));
    c.appendChild(h('div', { class: 'hb-card' },
      h('div', { class: 'hb-grid', id: 'hb-stats' }, stat('Level', li.level), stat('XP', st.progress.xp), stat('Streak (days)', P.currentStreak(st.progress, today)), stat('Best streak', st.progress.bestStreak),
        stat('Words learned', st.progress.learned.filter(function (id) { return id.charAt(0) === 'w'; }).length), stat('Cards rated', st.progress.counters.cardsRated || 0), stat('Cards due', due), stat('Answers today', st.calendar[String(today)] || 0)),
      h('p', { class: 'hb-small', text: 'Level ' + li.level + ': ' + li.into + ' of ' + li.span + ' XP to the next level.' }), bar));
    c.appendChild(h('div', { class: 'hb-card' }, h('h3', { text: 'Streak calendar' }), calendar()));
    c.appendChild(h('div', { class: 'hb-card' }, h('h3', { text: 'Badges' }), badges()));
    c.appendChild(h('div', { class: 'hb-card' }, h('h3', { text: 'Your data' }),
      h('p', { class: 'hb-small', text: 'Everything is stored in this browser only. Export a backup file or move progress to another device.' }),
      h('div', { class: 'hb-row' }, h('button', { type: 'button', class: 'hb-btn', id: 'hb-export', text: 'Export progress (JSON)', on: { click: exportJson } }),
        h('label', { class: 'hb-inline-label', for: 'hb-import-file', text: 'Import progress:' }), file,
        h('button', { type: 'button', class: 'hb-btn', id: 'hb-reset', text: 'Reset all progress', on: { click: function () {
          ui.confirmBox('Reset everything?', 'This deletes your progress, flashcards, mistakes and settings on this device. It cannot be undone. Export first if unsure.', 'Delete all', function (yes) {
            if (!yes) return;
            st.store.clearAll(); ui.load(); ui.applySettings(); render(c); ui.say('All progress was reset.');
          });
        } } })), msg));
    c.appendChild(settingsForm());
  }
  ui.register('progress', { render: render, show: function () { render(host); } });
})(typeof self !== 'undefined' ? self : this);
