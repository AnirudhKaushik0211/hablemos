(function (root) {
  'use strict';
  var H = root.Hablemos, ui = H.ui, h = ui.h, st = ui.state, S = H.srs, P = H.progress, D = H.data;
  var host, session = null, pickState = { kind: 'cat', sub: 'greetings', mode: 'en-es' };
  var CATS = ['greetings', 'people', 'family', 'body', 'health', 'food', 'drink', 'home', 'clothes', 'colours', 'numbers', 'time', 'weather', 'nature', 'animals', 'travel', 'places', 'shopping', 'work', 'school', 'feelings', 'actions', 'descriptions', 'grammar', 'tech', 'hobbies'];

  function deckIds(kind, sub) {
    var today = ui.today();
    if (kind === 'mine') return st.cards.custom.map(function (c) { return c.id; });
    if (kind === 'mistakes') return st.mistakes.map(function (m) { return m.id; }).filter(function (id) { return !!ui.itemInfo(id); });
    if (kind === 'due') return Object.keys(st.cards.states).filter(function (id) { return st.cards.states[id].due <= today && st.cards.states[id].last > 0 && ui.itemInfo(id); });
    if (kind === 'tier') return D.words.filter(function (w) { return w.tier === sub; }).map(function (w) { return w.id; });
    return D.words.filter(function (w) { return w.cat === sub; }).map(function (w) { return w.id; });
  }
  function newAllowed() {
    var nd = st.cards.newDay;
    var used = nd.day === ui.today() ? nd.n : 0;
    return Math.max(0, st.settings.newPerDay - used);
  }

  function goalBar() {
    var n = st.calendar[String(ui.today())] || 0, goal = st.settings.dailyGoal;
    var pct = Math.min(100, Math.round(100 * n / goal));
    var bar = h('div', { class: 'hb-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(goal), 'aria-valuenow': String(Math.min(n, goal)), 'aria-label': 'Daily goal' }, h('div', { id: 'hb-goal-fill' }));
    bar.firstChild.style.width = pct + '%';
    return h('div', null, h('p', { id: 'hb-goal-text', text: 'Daily goal: ' + n + ' of ' + goal + ' answers. Streak: ' + P.currentStreak(st.progress, ui.today()) + ' day(s).' }), bar);
  }

  function renderPicker() {
    ui.clear(host);
    session = null;
    host.appendChild(h('h2', { text: 'Flashcards' }));
    host.appendChild(h('div', { class: 'hb-card' }, goalBar()));
    var kind = h('select', { id: 'hb-deck-kind', 'aria-label': 'Deck' },
      [['cat', 'A topic (category)'], ['tier', 'A level (tier)'], ['mine', 'My cards'], ['mistakes', 'Mistakes'], ['due', 'Due today']].map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
    kind.value = pickState.kind;
    var sub = h('select', { id: 'hb-deck-sub', 'aria-label': 'Topic or level' });
    var fillSub = function () {
      ui.clear(sub);
      var k = kind.value;
      var opts = k === 'cat' ? CATS : (k === 'tier' ? ['A1', 'A2', 'B1'] : []);
      sub.hidden = !opts.length;
      opts.forEach(function (o) { sub.appendChild(h('option', { value: o, text: o })); });
      if (opts.indexOf(pickState.sub) >= 0) sub.value = pickState.sub;
      info.textContent = deckInfo();
    };
    var mode = h('select', { id: 'hb-deck-mode', 'aria-label': 'Mode' }, [['en-es', 'English to Spanish'], ['es-en', 'Spanish to English'], ['audio', 'Audio first']].map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
    mode.value = pickState.mode;
    var info = h('p', { id: 'hb-deck-info', class: 'hb-muted', 'aria-live': 'polite' });
    var deckInfo = function () {
      var ids = deckIds(kind.value, sub.value || '');
      var q = S.buildQueue(ids, st.cards.states, ui.today(), { newAllowed: newAllowed() });
      return ids.length + ' cards in this deck; ' + q.length + ' ready for this session (new cards left today: ' + newAllowed() + ').';
    };
    kind.addEventListener('change', function () { pickState.kind = kind.value; fillSub(); });
    sub.addEventListener('change', function () { pickState.sub = sub.value; info.textContent = deckInfo(); });
    mode.addEventListener('change', function () { pickState.mode = mode.value; });
    var start = h('button', { type: 'button', class: 'hb-btn hb-btn-primary', id: 'hb-deck-start', text: 'Start', on: { click: function () {
      pickState.kind = kind.value; pickState.sub = sub.value || ''; pickState.mode = mode.value;
      startSession(kind.value, sub.value || '', mode.value);
    } } });
    host.appendChild(h('div', { class: 'hb-card' },
      h('div', { class: 'hb-row' }, h('label', { class: 'hb-inline-label', for: 'hb-deck-kind', text: 'Deck' }), kind, sub,
        h('label', { class: 'hb-inline-label', for: 'hb-deck-mode', text: 'Mode' }), mode, start), info,
      h('p', { class: 'hb-small hb-muted', text: 'Keys during a card: Space or Enter flips, 1 Again, 2 Hard, 3 Good, 4 Easy, S speaks, Esc leaves.' })));
    host.appendChild(h('div', { id: 'hb-deck-msg', class: 'hb-note', hidden: true }));
    fillSub();
  }

  function startSession(kind, sub, mode) {
    var ids = deckIds(kind, sub);
    var q = S.buildQueue(ids, st.cards.states, ui.today(), { newAllowed: newAllowed() });
    var msg = ui.byId('hb-deck-msg');
    if (!q.length) {
      var t = !ids.length ? 'This deck is empty. Add cards from Learn or Translate, or pick another deck.' : 'Nothing is due in this deck right now. Come back later or pick another deck.';
      msg.textContent = t; msg.hidden = false; ui.say(t);
      return;
    }
    session = { queue: q, total: q.length, done: 0, mode: mode, flipped: false, again: 0, good: 0 };
    renderCard();
  }

  function face(info, side, mode) {
    // side: 'front' | 'back'
    var front = mode === 'es-en' ? 'es' : (mode === 'audio' ? 'audio' : 'en');
    if (side === 'front') {
      if (front === 'audio') return [h('p', { class: 'hb-muted', text: 'Listen' }), ui.speakButton(info.es, 'the card')];
      return front === 'es' ? [ui.es(info.es), h('span', { class: 'hb-small hb-muted', text: info.pos + (info.g ? ' (' + info.g + ')' : '') })] : [h('span', { lang: 'en', text: info.en }), h('span', { class: 'hb-small hb-muted', text: info.pos })];
    }
    return [ui.es(info.es), h('span', { lang: 'en', text: info.en }),
      info.ex ? h('span', { class: 'hb-small' }, ui.es(info.ex.es), ' (' + info.ex.en + ')') : null,
      info.note ? h('span', { class: 'hb-small hb-muted', text: info.note }) : null];
  }

  function renderCard() {
    ui.clear(host);
    if (!session.queue.length) { renderDone(); return; }
    var id = session.queue[0];
    var info = ui.itemInfo(id);
    if (!info) { session.queue.shift(); renderCard(); return; }
    session.flipped = false;
    host.appendChild(h('h2', { text: 'Flashcards' }));
    host.appendChild(h('p', { id: 'hb-card-count', text: 'Card ' + (session.done + 1) + ' of ' + session.total + ' (' + session.queue.length + ' left)' }));
    var inner = h('div', { class: 'hb-flip-inner', id: 'hb-flip-inner' },
      h('div', { class: 'hb-face hb-face-front', id: 'hb-face-front' }, face(info, 'front', session.mode)),
      h('div', { class: 'hb-face hb-face-back', id: 'hb-face-back', 'aria-hidden': 'true' }, face(info, 'back', session.mode)));
    var flipBtn = h('button', { type: 'button', class: 'hb-btn hb-btn-primary', id: 'hb-flip', text: 'Flip (Space)', 'aria-pressed': 'false', on: { click: flip } });
    var rate = h('div', { class: 'hb-rate', id: 'hb-rate', hidden: true }, [['again', 'Again', '1'], ['hard', 'Hard', '2'], ['good', 'Good', '3'], ['easy', 'Easy', '4']].map(function (r) {
      return h('button', { type: 'button', class: 'hb-btn', id: 'hb-rate-' + r[0], text: r[1] + ' (' + r[2] + ')', on: { click: function () { rateCard(r[0]); } } });
    }));
    host.appendChild(h('div', { class: 'hb-flip' }, inner));
    host.appendChild(h('div', { class: 'hb-row' }, flipBtn, ui.speakButton(info.es), h('button', { type: 'button', class: 'hb-btn', id: 'hb-leave', text: 'Leave deck (Esc)', on: { click: leave } })));
    host.appendChild(rate);
    host.appendChild(h('p', { class: 'hb-small hb-muted', text: 'Again returns this card after four others.' }));
    flipBtn.focus();
    if (session.mode === 'audio' && st.settings.sound) ui.speak(info.es);
  }

  function flip() {
    if (!session) return;
    session.flipped = !session.flipped;
    var inner = ui.byId('hb-flip-inner');
    if (!inner) return;
    inner.classList.toggle('hb-flipped', session.flipped);
    ui.byId('hb-face-back').setAttribute('aria-hidden', session.flipped ? 'false' : 'true');
    ui.byId('hb-face-front').setAttribute('aria-hidden', session.flipped && ui.reducedMotion() ? 'true' : 'false');
    ui.byId('hb-flip').setAttribute('aria-pressed', session.flipped ? 'true' : 'false');
    ui.byId('hb-rate').hidden = !session.flipped;
    if (session.flipped) {
      var info = ui.itemInfo(session.queue[0]);
      ui.say(info.es + ' means ' + info.en + '. Rate the card.');
      ui.byId('hb-rate-good').focus();
    }
  }

  function rateCard(rating) {
    if (!session || !session.flipped) { ui.say('Flip the card first.'); return; }
    var id = session.queue.shift();
    var today = ui.today();
    var prev = st.cards.states[id];
    var isNew = !prev || !prev.last;
    var next = S.rate(prev || S.newState(id), rating, today);
    st.cards.states[id] = next;
    if (isNew) { var nd = st.cards.newDay; st.cards.newDay = { day: today, n: (nd.day === today ? nd.n : 0) + 1 }; }
    var a = P.awardFlash(st.progress, rating, today);
    st.progress = P.bump(a.p, 'cardsRated');
    if (rating === 'again') { session.again++; session.queue = S.requeue(session.queue, id); ui.mistake(id, id.charAt(0) === 'w' ? 'word' : (id.charAt(0) === 'p' ? 'phrase' : 'other')); }
    else { session.good++; if (ui.itemInfo(id)) ui.correctOn(id); }
    session.done = Math.min(session.total, session.done + (rating === 'again' ? 0 : 1));
    ui.afterActivity();
    ui.checkBadges();
    ui.saveAll();
    ui.say(rating === 'again' ? 'Again: you will see it soon.' : 'Next review in ' + next.interval + ' day' + (next.interval === 1 ? '' : 's') + '.');
    renderCard();
  }

  function renderDone() {
    ui.clear(host);
    host.appendChild(h('h2', { text: 'Flashcards' }));
    host.appendChild(h('div', { class: 'hb-card', id: 'hb-session-done' }, h('h3', { text: 'Session complete' }),
      h('p', { text: 'You reviewed ' + session.total + ' card(s). Cards you rated Again will come back sooner.' }), goalBar(),
      h('button', { type: 'button', class: 'hb-btn hb-btn-primary', id: 'hb-deck-back', text: 'Back to decks', on: { click: renderPicker } })));
    ui.say('Session complete.');
    session = null;
  }
  function leave() { renderPicker(); ui.say('Left the deck. Progress is saved.'); }

  function onKey(e) {
    if (!session) return;
    var panel = ui.byId('hb-panel-cards');
    if (panel.hidden) return;
    var tag = (e.target && e.target.tagName) || '';
    if (/INPUT|SELECT|TEXTAREA/.test(tag)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') { e.preventDefault(); leave(); return; }
    if ((e.key === ' ' || e.key === 'Enter') && tag !== 'BUTTON') { e.preventDefault(); flip(); return; }
    if (e.key >= '1' && e.key <= '4') { e.preventDefault(); rateCard(['again', 'hard', 'good', 'easy'][Number(e.key) - 1]); return; }
    if (e.key === 's' || e.key === 'S') { var info = ui.itemInfo(session.queue[0]); if (info) ui.speak(info.es); }
  }

  function render(c) { host = c; root.document.addEventListener('keydown', onKey); renderPicker(); }
  ui.register('cards', { render: render, show: function () { if (!session) renderPicker(); } });
})(typeof self !== 'undefined' ? self : this);
