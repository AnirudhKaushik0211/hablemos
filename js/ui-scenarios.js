(function (root) {
  'use strict';
  var H = root.Hablemos, ui = H.ui, h = ui.h, st = ui.state, S = H.scenario, P = H.progress, D = H.data;
  var host, cur = null; // { sc, state, last }

  function menu() {
    cur = null;
    ui.clear(host);
    host.appendChild(h('h2', { text: 'Scenarios' }));
    host.appendChild(h('p', { text: 'Short conversations. Read what the other person says, then pick the best Spanish reply or type your own.' }));
    var grid = h('div', { class: 'hb-grid' });
    D.scenarios.forEach(function (sc) {
      var done = (st.progress.counters['scen-' + sc.id] || 0);
      grid.appendChild(h('div', { class: 'hb-card' }, h('h3', { text: sc.title }), h('p', { class: 'hb-small hb-muted', text: sc.setting + ' Level ' + sc.level + '.' + (done ? ' Finished ' + done + ' time(s).' : '') }),
        h('button', { type: 'button', class: 'hb-btn hb-btn-primary', id: 'hb-sc-' + sc.id, text: 'Start', 'aria-label': 'Start ' + sc.title, on: { click: function () { cur = { sc: sc, state: S.begin(sc), last: null }; step(); } } })));
    });
    host.appendChild(grid);
  }

  function step() {
    ui.clear(host);
    var sc = cur.sc, state = cur.state;
    host.appendChild(h('h2', { text: sc.title }));
    host.appendChild(h('p', { class: 'hb-muted', text: sc.setting }));
    var s = S.current(sc, state);
    if (!s) { finish(); return; }
    var card = h('div', { class: 'hb-card', id: 'hb-sc-card' });
    card.appendChild(h('p', { class: 'hb-small hb-muted', text: 'Step ' + (state.taken + 1) }));
    card.appendChild(h('div', { class: 'hb-result', id: 'hb-sc-npc' }, ui.es(s.npc.es), h('div', { class: 'hb-small hb-muted', lang: 'en', text: s.npc.en })));
    card.appendChild(h('div', { class: 'hb-row' }, ui.speakButton(s.npc.es, 'what they said')));
    card.appendChild(h('p', { id: 'hb-sc-prompt', text: s.prompt }));
    var fb = h('div', { id: 'hb-sc-fb', role: 'status', 'aria-live': 'polite' });
    var box = h('div', { class: 'hb-options', role: 'group', 'aria-label': 'Your reply' });
    var locked = false;
    s.choices.forEach(function (c, i) {
      box.appendChild(h('button', { type: 'button', class: 'hb-btn hb-option', 'data-c': String(i), on: { click: function () {
        if (locked) return; locked = true;
        result(S.choose(sc, state, i), fb, box, c);
      } } }, ui.es(c.es), h('span', { class: 'hb-small hb-muted', lang: 'en', text: ' (' + c.en + ')' })));
    });
    card.appendChild(box);
    var inp = h('input', { type: 'text', id: 'hb-sc-input', lang: 'es', maxlength: '120', autocomplete: 'off', 'aria-label': 'Or type your own reply in Spanish' });
    var go = h('button', { type: 'button', class: 'hb-btn', id: 'hb-sc-send', text: 'Send typed reply', on: { click: function () {
      if (locked) return;
      var val = ui.field(inp, 120);
      if (!val) { fb.textContent = 'Type a reply first, or pick one above.'; ui.say('Type a reply first, or pick one above.'); return; }
      locked = true;
      result(S.typed(sc, state, val), fb, box, null);
    } } });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go.click(); } });
    card.appendChild(h('div', { class: 'hb-row' }, h('label', { class: 'hb-inline-label', for: 'hb-sc-input', text: 'Or type:' }), inp, go));
    card.appendChild(fb);
    host.appendChild(card);
    host.appendChild(h('button', { type: 'button', class: 'hb-btn', id: 'hb-sc-quit', text: 'Leave scenario', on: { click: menu } }));
  }

  function result(r, fb, box, choice) {
    if (!r) return;
    Array.prototype.forEach.call(box.querySelectorAll('button'), function (b) { b.disabled = true; });
    void choice;
    ui.clear(fb);
    fb.className = 'hb-feedback ' + (r.ok ? 'hb-is-ok' : 'hb-is-bad');
    var msg = (r.ok ? '\u2714 Good reply. ' : '\u2716 Not the best reply. ') + r.fb;
    fb.appendChild(h('strong', { text: msg }));
    ui.say(msg);
    cur.state = r.state;
    ui.afterActivity();
    ui.saveAll();
    var said = r.state.history[r.state.history.length - 1].said;
    var next = h('button', { type: 'button', class: 'hb-btn hb-btn-primary', id: 'hb-sc-next', text: r.state.done ? 'Finish' : 'Continue', on: { click: step } });
    fb.appendChild(h('div', { class: 'hb-row' }, ui.speakButton(said, 'your reply (say it again)'), next));
    next.focus();
  }

  function finish() {
    var sc = cur.sc, state = cur.state;
    var xp = S.xpFor(state);
    ui.gainXp(xp);
    st.progress = P.bump(st.progress, 'scen-' + sc.id);
    ui.checkBadges();
    ui.saveAll();
    var sco = S.score(state);
    ui.clear(host);
    host.appendChild(h('h2', { text: sc.title + ': finished' }));
    host.appendChild(h('div', { class: 'hb-card', id: 'hb-sc-done' }, h('p', { class: 'hb-result', text: 'You gave ' + sco.correct + ' good repl' + (sco.correct === 1 ? 'y' : 'ies') + ' out of ' + sco.total + '.' }),
      h('p', { text: '+' + xp + ' XP.' }),
      h('ul', { class: 'hb-list' }, state.history.map(function (x) { return h('li', { class: 'hb-entry' }, (x.ok ? '\u2714 ' : '\u2716 '), ui.es(x.said)); })),
      h('div', { class: 'hb-row' }, h('button', { type: 'button', class: 'hb-btn hb-btn-primary', id: 'hb-sc-again', text: 'Try again', on: { click: function () { cur = { sc: sc, state: S.begin(sc) }; step(); } } }),
        h('button', { type: 'button', class: 'hb-btn', id: 'hb-sc-menu', text: 'All scenarios', on: { click: menu } }))));
    ui.say('Scenario finished. ' + xp + ' XP.');
  }

  function render(c) { host = c; menu(); }
  ui.register('scenarios', { render: render, show: function () { if (!cur) menu(); } });
})(typeof self !== 'undefined' ? self : this);
