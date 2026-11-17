(function (root) {
  'use strict';
  var H = root.Hablemos, ui = H.ui, h = ui.h, st = ui.state, U = H.util, lex = H.lexicon, D = H.data;
  var SECTIONS = [['words', 'Words'], ['phrases', 'Phrases'], ['ff', 'False friends'], ['idioms', 'Idioms'], ['pron', 'Pronunciation'], ['nums', 'Numbers, dates, time'], ['cog', 'Cognates'], ['wotd', 'Word of the day']];
  var sub = 'words';
  var f = { cat: '', tier: '', q: '', learned: '', shown: 50 };
  var body, nav, container;
  var WORD_CATS = ['greetings', 'people', 'family', 'body', 'health', 'food', 'drink', 'home', 'clothes', 'colours', 'numbers', 'time', 'weather', 'nature', 'animals', 'travel', 'places', 'shopping', 'work', 'school', 'feelings', 'actions', 'descriptions', 'grammar', 'tech', 'hobbies'];
  var PHRASE_CATS = ['greetings', 'travel', 'restaurant', 'shopping', 'directions', 'health', 'social', 'work'];

  function art(w) {
    if (w.pos !== 'noun') return '';
    if (w.art) return w.art + ' ';
    return w.g === 'm' ? 'el ' : (w.g === 'f' ? 'la ' : 'el/la ');
  }
  function learnedSet() { var s = {}; st.progress.learned.forEach(function (id) { s[id] = 1; }); return s; }

  function toggleLearned(id, on) {
    var P = H.progress;
    if (on) {
      var r = P.markLearned(st.progress, id);
      st.progress = r.p;
      if (r.gained) ui.say('Marked as learned. +2 XP.');
    } else { st.progress = P.unmarkLearned(st.progress, id); ui.say('Removed from learned.'); }
    ui.checkBadges();
    ui.save('progress');
  }

  function entryRow(info, id, learned) {
    var cbId = 'hb-learned-' + id;
    return h('li', { class: 'hb-entry' },
      h('div', { class: 'hb-row' }, ui.es((info.kind === 'word' && info.pos === 'noun' ? art(H.quiz.itemOf(id)) : '') + info.es),
        h('span', { lang: 'en', text: '= ' + info.en }),
        h('span', { class: 'hb-badge', text: info.pos + (info.g ? ' ' + info.g : '') + (info.tier ? ' ' + info.tier : '') })),
      info.ex ? h('div', { class: 'hb-small' }, ui.es(info.ex.es), h('span', { class: 'hb-muted', lang: 'en', text: ' (' + info.ex.en + ')' })) : null,
      info.note ? h('div', { class: 'hb-small hb-muted', text: info.note }) : null,
      h('div', { class: 'hb-row' },
        ui.speakButton(info.es),
        h('input', { type: 'checkbox', id: cbId, checked: !!learned[id], on: { change: function (e) { toggleLearned(id, e.target.checked); } } }),
        h('label', { class: 'hb-inline-label', for: cbId, text: 'Learned' }),
        h('button', { type: 'button', class: 'hb-btn hb-btn-small', text: 'Add to flashcards', 'aria-label': 'Add ' + info.es + ' to flashcards', on: { click: function () { ui.addItemToCards(id); } } })));
  }

  function filterBar(cats, showLearned) {
    var catSel = h('select', { id: 'hb-learn-cat', 'aria-label': 'Category' }, h('option', { value: '', text: 'All categories' }), cats.map(function (c) { return h('option', { value: c, text: c }); }));
    catSel.value = f.cat;
    var tierSel = h('select', { id: 'hb-learn-tier', 'aria-label': 'Tier' }, h('option', { value: '', text: 'All tiers' }), ['A1', 'A2', 'B1'].map(function (t) { return h('option', { value: t, text: t }); }));
    tierSel.value = f.tier;
    var q = h('input', { type: 'search', id: 'hb-learn-search', 'aria-label': 'Search Spanish or English (accents optional)', placeholder: 'Search (accents optional)', value: f.q });
    var lrn = h('select', { id: 'hb-learn-lf', 'aria-label': 'Learned filter' }, h('option', { value: '', text: 'All' }), h('option', { value: 'yes', text: 'Learned' }), h('option', { value: 'no', text: 'Not learned' }));
    lrn.value = f.learned;
    var upd = function () { f.cat = catSel.value; f.tier = tierSel.value; f.q = U.clean(q.value).slice(0, 60); f.learned = lrn.value; f.shown = 50; };
    catSel.addEventListener('change', function () { upd(); renderBody(); });
    tierSel.addEventListener('change', function () { upd(); renderBody(); });
    lrn.addEventListener('change', function () { upd(); renderBody(); });
    q.addEventListener('input', function () { upd(); renderList(); });
    return h('div', { class: 'hb-row' }, catSel, tierSel, q, lrn);
  }

  var listHost;
  function matches(list, kind) {
    var ql = U.norm(f.q, true), ls = learnedSet();
    return list.filter(function (x) {
      if (f.cat && x.cat !== f.cat) return false;
      if (f.tier && x.tier !== f.tier) return false;
      if (f.learned === 'yes' && !ls[x.id]) return false;
      if (f.learned === 'no' && ls[x.id]) return false;
      if (!ql) return true;
      return U.norm(x.es, true).indexOf(ql) >= 0 || U.norm(x.en, true).indexOf(ql) >= 0;
    });
  }
  function renderList() {
    if (!listHost) return;
    ui.clear(listHost);
    var src = sub === 'words' ? D.words : D.phrases;
    var res = matches(src);
    var ls = learnedSet();
    listHost.appendChild(h('p', { class: 'hb-small hb-muted', id: 'hb-learn-count', text: res.length + ' of ' + src.length + ' shown' + (res.length > f.shown ? ' (first ' + f.shown + ')' : '') }));
    var ul = h('ul', { class: 'hb-list', id: 'hb-learn-list' });
    res.slice(0, f.shown).forEach(function (x) { var info = ui.itemInfo(x.id); if (info) ul.appendChild(entryRow(info, x.id, ls)); });
    listHost.appendChild(ul);
    if (res.length > f.shown) listHost.appendChild(h('button', { type: 'button', class: 'hb-btn', text: 'Show more', on: { click: function () { f.shown += 50; renderList(); } } }));
    if (!res.length) listHost.appendChild(h('p', { class: 'hb-note', text: 'Nothing matches. Clear the search or change a filter.' }));
  }

  function simpleList(items, render) { return h('ul', { class: 'hb-list' }, items.map(function (x) { return h('li', { class: 'hb-entry' }, render(x)); })); }

  function secFF() {
    return [h('p', { text: 'False friends look like an English word but mean something else.' }), simpleList(D.falsefriends, function (x) {
      return [ui.es(x.es), h('span', { text: ' looks like "' + x.looksLike + '" but means "' + x.actually + '".' }),
        h('div', { class: 'hb-small' }, 'To say "' + x.looksLike + '", say ', ui.es(x.say), '. '), h('div', { class: 'hb-small' }, ui.es(x.ex.es), h('span', { class: 'hb-muted', text: ' (' + x.ex.en + ')' })),
        x.note ? h('div', { class: 'hb-small hb-muted', text: x.note }) : null, ui.speakButton(x.es)];
    })];
  }
  function secIdioms() {
    return [h('p', { text: 'Idioms rarely work word for word. Here is the literal version and the real meaning.' }), simpleList(D.idioms, function (x) {
      return [ui.es(x.es), h('div', { class: 'hb-small', text: 'Literally: ' + x.literal }), h('div', { class: 'hb-small', text: 'Means: ' + x.meaning }),
        h('div', { class: 'hb-small' }, ui.es(x.ex.es), h('span', { class: 'hb-muted', text: ' (' + x.ex.en + ')' })), ui.speakButton(x.es)];
    })];
  }
  function secPron() {
    return simpleList(D.pronunciation, function (x) {
      return [h('strong', { text: x.topic }), h('p', { text: x.rule }),
        h('ul', null, x.examples.map(function (e) { return h('li', null, ui.es(e.es), h('span', { text: ' (say: ' + e.say + ') ' + e.en })); }))];
    });
  }
  function secNums() {
    var N = H.numbers;
    var numIn = h('input', { type: 'number', id: 'hb-num-in', min: '0', max: '999999', value: '42', 'aria-label': 'Number from 0 to 999999' });
    var numOut = h('p', { id: 'hb-num-out', 'aria-live': 'polite' });
    var upd = function () {
      var n = U.toInt(numIn.value, -1, -1, 999999);
      ui.clear(numOut);
      if (n < 0) { numOut.appendChild(h('span', { class: 'hb-bad', text: 'Enter a whole number from 0 to 999999.' })); return; }
      numOut.appendChild(ui.es(N.toWords(n)));
    };
    numIn.addEventListener('input', upd);
    var hr = h('input', { type: 'number', id: 'hb-time-h', min: '1', max: '12', value: '3', 'aria-label': 'Hour 1 to 12' });
    var mn = h('select', { id: 'hb-time-m', 'aria-label': 'Minutes' }, [0, 5, 10, 15, 20, 30, 45].map(function (m) { return h('option', { value: String(m), text: (m < 10 ? '0' : '') + m }); }));
    var tOut = h('p', { id: 'hb-time-out', 'aria-live': 'polite' });
    var updT = function () {
      var hh = U.toInt(hr.value, 0, 0, 12), mm = U.toInt(mn.value, 0, 0, 59);
      ui.clear(tOut);
      if (hh < 1) { tOut.appendChild(h('span', { class: 'hb-bad', text: 'Enter an hour from 1 to 12.' })); return; }
      tOut.appendChild(ui.es(N.clock(hh, mm)));
    };
    hr.addEventListener('input', updT); mn.addEventListener('change', updT);
    upd(); updT();
    var pad = function (list) { return h('p', null, list.map(function (x, i) { return [i ? ', ' : '', ui.es(x)]; })); };
    return [h('h3', { text: 'Number to words' }), h('label', { for: 'hb-num-in', text: 'Number' }), numIn, numOut,
      h('h3', { text: 'Telling the time' }), h('div', { class: 'hb-row' }, h('label', { class: 'hb-inline-label', for: 'hb-time-h', text: 'Hour' }), hr, h('label', { class: 'hb-inline-label', for: 'hb-time-m', text: 'Minutes' }), mn), tOut,
      h('h3', { text: 'Days of the week' }), pad(N.DAYS.slice(1).concat([N.DAYS[0]])),
      h('h3', { text: 'Months' }), pad(N.MONTHS), h('p', { class: 'hb-small hb-muted', text: 'Days and months are written in lowercase in Spanish.' })];
  }
  function secCog() {
    var list = D.words.filter(function (w) { return w.cog; });
    var same = list.filter(function (w) { return w.same; });
    return [h('p', { text: list.length + ' words that look like English (cognates), including ' + same.length + ' spelled exactly the same. Watch the pronunciation and gender.' }),
      simpleList(list.slice(0, 120), function (w) { return [ui.es(art(w) + w.es), h('span', { text: ' = ' + w.en + (w.same ? ' (spelled the same)' : '') }), ui.speakButton(w.es)]; }),
      list.length > 120 ? h('p', { class: 'hb-small hb-muted', text: 'Showing the first 120. Search in Words for the rest.' }) : null];
  }
  function secWotd() {
    var w = H.daily.wordOfTheDay(ui.todayString());
    var info = ui.itemInfo(w.id);
    return [h('p', { class: 'hb-muted', text: 'Same word all day, chosen by the date.' }), h('div', { class: 'hb-card', id: 'hb-wotd' }, h('p', { class: 'hb-result' }, ui.es(art(w) + info.es), ' = ', h('span', { lang: 'en', text: info.en })),
      info.ex ? h('p', null, ui.es(info.ex.es), h('span', { class: 'hb-muted', text: ' (' + info.ex.en + ')' })) : null,
      h('div', { class: 'hb-row' }, ui.speakButton(info.es), h('button', { type: 'button', class: 'hb-btn hb-btn-small', text: 'Add to flashcards', on: { click: function () { ui.addItemToCards(w.id); } } })))];
  }

  function renderBody() {
    ui.clear(body);
    listHost = null;
    if (sub === 'words' || sub === 'phrases') {
      body.appendChild(filterBar(sub === 'words' ? WORD_CATS : PHRASE_CATS));
      listHost = h('div', { id: 'hb-learn-listhost' });
      body.appendChild(listHost);
      renderList();
    } else {
      var fn = { ff: secFF, idioms: secIdioms, pron: secPron, nums: secNums, cog: secCog, wotd: secWotd }[sub];
      body.appendChild(h('div', null, fn()));
    }
  }

  function renderNav() {
    ui.clear(nav);
    SECTIONS.forEach(function (s) {
      nav.appendChild(h('button', { type: 'button', class: 'hb-chip', id: 'hb-learn-' + s[0], 'aria-pressed': sub === s[0] ? 'true' : 'false', text: s[1], on: { click: function () { sub = s[0]; f.cat = ''; f.shown = 50; renderNav(); renderBody(); } } }));
    });
  }

  function render(c) {
    container = c;
    c.appendChild(h('h2', { text: 'Learn' }));
    nav = h('div', { class: 'hb-row', role: 'group', 'aria-label': 'Learn sections' });
    body = h('div', { id: 'hb-learn-body' });
    c.appendChild(nav); c.appendChild(body);
    renderNav(); renderBody();
  }
  ui.register('learn', { render: render, show: function () { renderBody(); } });
  void container;
})(typeof self !== 'undefined' ? self : this);
