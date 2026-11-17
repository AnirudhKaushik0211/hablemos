(function (root) {
  'use strict';
  var H = root.Hablemos, ui = H.ui, h = ui.h, st = ui.state, Q = H.quiz, P = H.progress, U = H.util;
  var host, run = null, timer = null, counter = 0;
  var TYPES = [
    ['mc', 'Multiple choice', 'Pick the right word from four options.'],
    ['type', 'Typing', 'Type the Spanish word.'],
    ['listen', 'Listening', 'Hear a word, choose its meaning.'],
    ['match', 'Matching pairs', 'Match six Spanish and English pairs.'],
    ['conj', 'Conjugation gym', 'Fill in the verb form.'],
    ['unscramble', 'Sentence unscramble', 'Put the words in order.'],
    ['ff', 'False friends', 'Is it really what it looks like?'],
    ['sprint', '60-second sprint', 'As many right as you can in a minute.'],
    ['daily', 'Daily challenge', 'Ten mixed questions, the same for everyone today.']
  ];
  var TENSES = [['all', 'All tenses'], ['pres', 'Present'], ['pret', 'Preterite'], ['impf', 'Imperfect'], ['fut', 'Future'], ['cmd', 'Commands']];
  var convTense = 'all', convMode = 'all';

  function seedNow() { return (root.Date.now() ^ (++counter * 2654435761)) >>> 0; }
  function kindOf(id) { return id.indexOf('conj:') === 0 ? 'conj' : (id.charAt(0) === 'w' ? 'word' : (id.charAt(0) === 'p' ? 'phrase' : 'other')); }

  // ---- menu ----
  function renderMenu() {
    stopTimer();
    run = null;
    ui.clear(host);
    host.appendChild(h('h2', { text: 'Quizzes' }));
    var li = P.levelInfo(st.progress.xp);
    host.appendChild(h('div', { class: 'hb-card' }, h('p', { id: 'hb-qz-xp', text: 'Level ' + li.level + ' with ' + st.progress.xp + ' XP. Next level at ' + li.next + ' XP. Mistakes in the notebook: ' + st.mistakes.length + '.' })));
    var tenseSel = h('select', { id: 'hb-conj-tense', 'aria-label': 'Conjugation tense' }, TENSES.map(function (t) { return h('option', { value: t[0], text: t[1] }); }));
    tenseSel.value = convTense;
    tenseSel.addEventListener('change', function () { convTense = tenseSel.value; });
    var grid = h('div', { class: 'hb-grid' });
    TYPES.forEach(function (t) {
      var extra = null;
      if (t[0] === 'conj') extra = h('div', { class: 'hb-row' }, h('label', { class: 'hb-inline-label', for: 'hb-conj-tense', text: 'Tense' }), tenseSel);
      grid.appendChild(h('div', { class: 'hb-card' }, h('h3', { text: t[1] }), h('p', { class: 'hb-small hb-muted', text: t[2] }), extra,
        h('button', { type: 'button', class: 'hb-btn hb-btn-primary', id: 'hb-qz-' + t[0], text: 'Start', 'aria-label': 'Start ' + t[1], on: { click: function () { start(t[0]); } } })));
    });
    host.appendChild(grid);
    host.appendChild(h('h3', { text: 'Mistake notebook' }));
    host.appendChild(mistakeBook());
  }

  function mistakeBook() {
    var box = h('div', { class: 'hb-card', id: 'hb-mistakes' });
    if (!st.mistakes.length) { box.appendChild(h('p', { text: 'No mistakes yet. Wrong answers are saved here and also become a flashcard deck called Mistakes. An item leaves the notebook after two right answers in a row.' })); return box; }
    var ul = h('ul', { class: 'hb-list' });
    st.mistakes.slice().sort(function (a, b) { return b.last - a.last; }).slice(0, 30).forEach(function (m) {
      var info = ui.itemInfo(m.id);
      var label = info ? info.es + ' = ' + info.en : (m.id.indexOf('conj:') === 0 ? 'Conjugation: ' + m.id.split(':').slice(1).join(' ') : m.id);
      ul.appendChild(h('li', { class: 'hb-entry' }, h('span', { lang: info ? ui.langAttr() : null, text: label }), h('span', { class: 'hb-muted', text: ' (missed ' + m.count + ' time' + (m.count === 1 ? '' : 's') + ')' })));
    });
    box.appendChild(ul);
    var ids = st.mistakes.map(function (m) { return m.id; }).filter(function (id) { return id.charAt(0) === 'w'; });
    box.appendChild(h('button', { type: 'button', class: 'hb-btn', id: 'hb-qz-mistakes', text: 'Practise mistakes', disabled: !ids.length, on: { click: function () { start('mc', { ids: ids }); } } }));
    return box;
  }

  // ---- run ----
  function start(type, extra) {
    var opts = { variant: st.settings.variant };
    var qs, title = (TYPES.filter(function (t) { return t[0] === type; })[0] || [0, 'Quiz'])[1];
    var seed = seedNow();
    if (extra && extra.ids) { opts.ids = extra.ids; title = 'Mistakes practice'; }
    if (type === 'daily') qs = Q.daily(ui.todayString());
    else if (type === 'sprint') qs = Q.sprint(seed, 60, opts);
    else if (type === 'conj') { if (convTense !== 'all') opts.tenses = [convTense]; qs = Q.round('conj', seed, 10, opts); }
    else if (type === 'match') qs = Q.round('match', seed, 3, opts);
    else qs = Q.round(type, seed, 10, opts);
    run = { type: type, title: title, qs: qs, i: 0, right: 0, answered: 0, xp: 0, left: 60, done: false, locked: false, mistakesFound: 0 };
    if (type === 'daily' && st.daily[ui.todayString()]) run.replay = true;
    if (type === 'sprint') startTimer();
    renderQuestion();
  }

  function startTimer() {
    stopTimer();
    run.left = 60;
    timer = root.setInterval(function () {
      if (!run || run.type !== 'sprint') { stopTimer(); return; }
      run.left--;
      var el = ui.byId('hb-timer');
      if (el) el.textContent = run.left + ' s';
      if (run.left === 30 || run.left === 10) ui.say(run.left + ' seconds left.');
      if (run.left <= 0) { stopTimer(); finish(); }
    }, 1000);
  }
  function stopTimer() { if (timer) { root.clearInterval(timer); timer = null; } }

  function renderQuestion() {
    ui.clear(host);
    var q = run.qs[run.i];
    if (!q) { finish(); return; }
    run.locked = false;
    host.appendChild(h('h2', { text: run.title }));
    host.appendChild(h('p', { id: 'hb-qz-count' }, run.type === 'sprint' ? ['Score: ' + run.right + '. Time left: ', h('span', { id: 'hb-timer', text: run.left + ' s' })] : 'Question ' + (run.i + 1) + ' of ' + run.qs.length));
    var card = h('div', { class: 'hb-card', id: 'hb-qz-card' });
    card.appendChild(h('p', { class: 'hb-result', id: 'hb-qz-prompt', text: q.prompt }));
    var fb = h('div', { id: 'hb-qz-fb', role: 'status', 'aria-live': 'polite' });
    var ansHost = h('div', { id: 'hb-qz-ans' });
    card.appendChild(ansHost);
    card.appendChild(fb);
    host.appendChild(card);
    host.appendChild(h('div', { class: 'hb-row' }, h('button', { type: 'button', class: 'hb-btn', id: 'hb-qz-quit', text: 'Quit round', on: { click: function () { renderMenu(); ui.say('Left the round.'); } } })));
    if (q.type === 'mc' || q.type === 'listen' || q.type === 'ff') choiceUI(q, ansHost, fb);
    else if (q.type === 'type' || q.type === 'conj') typeUI(q, ansHost, fb);
    else if (q.type === 'unscramble') scrambleUI(q, ansHost, fb);
    else if (q.type === 'match') matchUI(q, ansHost, fb);
  }

  function ttsAvailable() { return !!(root.speechSynthesis && typeof root.SpeechSynthesisUtterance !== 'undefined') && st.settings.sound; }

  function choiceUI(q, hostEl, fb) {
    if (q.type === 'listen') {
      hostEl.appendChild(h('div', { class: 'hb-row' }, ui.speakButton(q.speak, 'the word')));
      if (!ttsAvailable()) hostEl.appendChild(h('p', { class: 'hb-note hb-note-warn', id: 'hb-qz-notts', text: 'Audio is not available (off or unsupported), so here is the Spanish text: ' + q.speak }));
      else ui.speak(q.speak);
    }
    var box = h('div', { class: 'hb-options', role: 'group', 'aria-label': 'Answer options' });
    q.options.forEach(function (opt, i) {
      box.appendChild(h('button', { type: 'button', class: 'hb-btn hb-option', 'data-opt': String(i), on: { click: function (e) { pickOption(q, opt, e.currentTarget, box, fb); } } },
        h('span', { class: 'hb-muted', text: (i + 1) + '. ' }), h('span', { lang: q.lang === 'es' && q.type === 'mc' && q.dir === 'en-es' ? ui.langAttr() : 'en', text: opt })));
    });
    hostEl.appendChild(box);
  }

  function pickOption(q, opt, btn, box, fb) {
    if (run.locked) return;
    var r = Q.check(q, opt, st.settings.accentLoose);
    run.locked = true;
    Array.prototype.forEach.call(box.querySelectorAll('button'), function (b) {
      b.disabled = true;
      var txt = b.textContent.replace(/^\d+\.\s*/, '');
      if (Q.check(q, txt, true).ok) b.classList.add('hb-correct');
    });
    if (!r.ok) btn.classList.add('hb-wrong');
    answered(q, r.ok, r.hint, fb, q.answer);
  }

  function typeUI(q, hostEl, fb) {
    var inp = h('input', { type: 'text', id: 'hb-qz-input', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', 'aria-label': 'Your answer', lang: q.lang || 'es', maxlength: '120' });
    var go = h('button', { type: 'button', class: 'hb-btn hb-btn-primary', id: 'hb-qz-check', text: 'Check', on: { click: submit } });
    function submit() {
      if (run.locked) return;
      var val = ui.field(inp, 120);
      if (!val) { fb.textContent = 'Type an answer first.'; ui.say('Type an answer first.'); return; }
      var r = Q.check(q, val, st.settings.accentLoose);
      run.locked = true; inp.disabled = true; go.disabled = true;
      answered(q, r.ok, r.hint, fb, q.answer);
    }
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    hostEl.appendChild(h('div', { class: 'hb-row' }, h('label', { class: 'hb-sr', for: 'hb-qz-input', text: 'Your answer' }), inp, go));
    inp.focus();
  }

  function scrambleUI(q, hostEl, fb) {
    var chosen = [];
    var avail = h('div', { class: 'hb-tokens', id: 'hb-qz-avail', role: 'group', 'aria-label': 'Available words' });
    var out = h('div', { class: 'hb-tokens', id: 'hb-qz-built', role: 'group', 'aria-label': 'Your sentence' });
    var check = h('button', { type: 'button', class: 'hb-btn hb-btn-primary', id: 'hb-qz-check', text: 'Check', on: { click: function () {
      if (run.locked) return;
      if (!chosen.length) { fb.textContent = 'Pick the words in order first.'; ui.say('Pick the words in order first.'); return; }
      var r = Q.check(q, chosen.map(function (c) { return q.tokens[c]; }).join(' '), st.settings.accentLoose);
      run.locked = true; check.disabled = true;
      answered(q, r.ok, r.hint, fb, q.answer);
    } } });
    function draw() {
      ui.clear(avail); ui.clear(out);
      q.tokens.forEach(function (tk, i) {
        if (chosen.indexOf(i) >= 0) return;
        avail.appendChild(h('button', { type: 'button', class: 'hb-chip', lang: 'es', text: tk, on: { click: function () { if (run.locked) return; chosen.push(i); draw(); } } }));
      });
      chosen.forEach(function (i, pos) {
        out.appendChild(h('button', { type: 'button', class: 'hb-chip', lang: 'es', 'aria-label': 'Remove ' + q.tokens[i], text: q.tokens[i], on: { click: function () { if (run.locked) return; chosen.splice(pos, 1); draw(); } } }));
      });
    }
    draw();
    hostEl.appendChild(h('p', { class: 'hb-small hb-muted', text: 'Tap the words in order. Tap a placed word to take it back.' }));
    hostEl.appendChild(avail); hostEl.appendChild(out); hostEl.appendChild(check);
  }

  function matchUI(q, hostEl, fb) {
    var selEs = null, matched = {}, errors = 0;
    var left = h('div', { class: 'hb-options', role: 'group', 'aria-label': 'Spanish words' });
    var right = h('div', { class: 'hb-options', role: 'group', 'aria-label': 'English meanings' });
    var rightMap = {};
    q.pairs.forEach(function (p) {
      var lb = h('button', { type: 'button', class: 'hb-btn hb-option', lang: ui.langAttr(), 'data-es': p.es, text: p.es, on: { click: function () {
        if (run.locked || matched[p.es]) return;
        Array.prototype.forEach.call(left.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', 'false'); });
        lb.setAttribute('aria-pressed', 'true'); selEs = p;
      } } });
      left.appendChild(lb);
    });
    q.right.forEach(function (en) {
      var rb = h('button', { type: 'button', class: 'hb-btn hb-option', lang: 'en', text: en, on: { click: function () {
        if (run.locked || rightMap[en]) return;
        if (!selEs) { fb.textContent = 'Pick a Spanish word first.'; ui.say('Pick a Spanish word first.'); return; }
        if (selEs.en === en) {
          matched[selEs.es] = true; rightMap[en] = true;
          rb.classList.add('hb-correct'); rb.disabled = true;
          var lbtn = left.querySelector('[data-es="' + selEs.es.replace(/"/g, '') + '"]');
          if (lbtn) { lbtn.classList.add('hb-correct'); lbtn.disabled = true; lbtn.setAttribute('aria-pressed', 'false'); }
          fb.textContent = 'Match: ' + selEs.es + ' = ' + en + '.'; ui.say(fb.textContent);
          selEs = null;
          if (Object.keys(matched).length === q.pairs.length) { run.locked = true; answered(q, errors === 0, errors ? errors + ' wrong tries.' : '', fb, ''); }
        } else {
          errors++; fb.textContent = 'Not a match. Try again.'; ui.say('Not a match. Try again.');
          ui.mistake(q.pairs.filter(function (p) { return p.es === selEs.es; })[0].id, 'word');
        }
      } } });
      right.appendChild(rb);
    });
    hostEl.appendChild(h('div', { class: 'hb-two' }, left, right));
  }

  function answered(q, ok, hint, fb, answer) {
    run.answered++;
    var xp = 0;
    if (ok) {
      run.right++;
      xp = run.type === 'sprint' ? 2 : P.xpForAnswer(q.type === 'ff' ? 'mc' : q.type);
      if (q.type === 'conj') st.progress = P.bump(st.progress, 'conjCorrect');
      if (q.type === 'ff') st.progress = P.bump(st.progress, 'ffCorrect');
      if (q.type !== 'match') ui.correctOn(q.itemId);
    } else if (q.type !== 'match') ui.mistake(q.itemId, kindOf(q.itemId));
    if (run.replay) xp = 0;
    run.xp += xp;
    ui.gainXp(xp);
    ui.afterActivity();
    ui.checkBadges();
    ui.saveAll();
    var msg = ok ? 'Correct!' + (xp ? ' +' + xp + ' XP.' : '') : 'Not quite.' + (answer ? ' The answer is: ' + answer + '.' : '');
    if (hint) msg += ' ' + hint;
    ui.clear(fb);
    fb.className = 'hb-feedback ' + (ok ? 'hb-is-ok' : 'hb-is-bad');
    fb.appendChild(h('strong', { text: (ok ? '\u2714 ' : '\u2716 ') + msg }));
    ui.say(msg);
    if (run.type === 'sprint') {
      root.setTimeout(function () { if (run && !run.done && run.type === 'sprint') { run.i++; renderQuestion(); } }, 350);
      return;
    }
    var last = run.i + 1 >= run.qs.length;
    var next = h('button', { type: 'button', class: 'hb-btn hb-btn-primary', id: 'hb-qz-next', text: last ? 'See results' : 'Next', on: { click: function () { run.i++; renderQuestion(); } } });
    fb.appendChild(h('div', { class: 'hb-row' }, ui.speakButton(q.speak || q.answer || '', 'the answer'), next));
    next.focus();
  }

  function finish() {
    if (!run || run.done) return;
    run.done = true;
    stopTimer();
    var total = run.type === 'sprint' ? run.answered : run.qs.length;
    var bonus = 0;
    if (run.type !== 'sprint' && total >= 5 && run.right === total) { bonus += 20; st.progress = P.bump(st.progress, 'perfectRounds'); }
    if (run.type === 'daily' && !run.replay) {
      bonus += 50; st.progress = P.bump(st.progress, 'dailyDone');
      st.daily[ui.todayString()] = { score: run.right, total: total };
    }
    run.xp += bonus;
    ui.gainXp(bonus);
    ui.checkBadges();
    ui.saveAll();
    ui.clear(host);
    host.appendChild(h('h2', { text: run.title + ': results' }));
    host.appendChild(h('div', { class: 'hb-card', id: 'hb-qz-results' },
      h('p', { class: 'hb-result', id: 'hb-qz-score', text: 'You got ' + run.right + ' of ' + total + ' right.' }),
      h('p', { text: 'XP earned: ' + run.xp + (bonus ? ' (including a ' + bonus + ' XP bonus)' : '') + (run.replay ? '. Practice replay: no XP for the daily challenge twice.' : '.') }),
      h('div', { class: 'hb-row' },
        h('button', { type: 'button', class: 'hb-btn hb-btn-primary', id: 'hb-qz-again', text: 'Play again', on: { click: function () { start(run.type); } } }),
        h('button', { type: 'button', class: 'hb-btn', id: 'hb-qz-menu', text: 'Back to quizzes', on: { click: renderMenu } }))));
    ui.say('Round finished: ' + run.right + ' of ' + total + ' right. ' + run.xp + ' XP.');
  }

  function onKey(e) {
    if (!run || run.done || ui.byId('hb-panel-quiz').hidden) return;
    var tag = (e.target && e.target.tagName) || '';
    if (/INPUT|SELECT|TEXTAREA/.test(tag) || e.ctrlKey || e.metaKey || e.altKey) return;
    var q = run.qs[run.i];
    if (q && (q.type === 'mc' || q.type === 'listen' || q.type === 'ff') && e.key >= '1' && e.key <= '4') {
      var btn = ui.byId('hb-qz-ans').querySelector('[data-opt="' + (Number(e.key) - 1) + '"]');
      if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
    }
  }

  function render(c) { host = c; root.document.addEventListener('keydown', onKey); renderMenu(); }
  ui.register('quiz', { render: render, show: function () { if (!run || run.done) renderMenu(); }, leave: function () { if (run && run.type === 'sprint' && !run.done) { stopTimer(); renderMenu(); } } });
  void U;
})(typeof self !== 'undefined' ? self : this);

