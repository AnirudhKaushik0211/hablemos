(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module && module.exports;
  var deps = isNode ? {
    rng: require('./rng.js'), lexicon: require('./lexicon.js'), conj: require('./conj.js'), nouns: require('./nouns.js'), util: require('./util.js'),
    falsefriends: require('../data/falsefriends.js')
  } : {
    rng: root.Hablemos.rng, lexicon: root.Hablemos.lexicon, conj: root.Hablemos.conj, nouns: root.Hablemos.nouns, util: root.Hablemos.util,
    falsefriends: root.Hablemos.data.falsefriends
  };
  var api = factory(deps);
  if (isNode) module.exports = api;
  else { root.Hablemos = root.Hablemos || {}; root.Hablemos.quiz = api; }
})(typeof self !== 'undefined' ? self : this, function (deps) {
  'use strict';
  var R = deps.rng, lex = deps.lexicon, conj = deps.conj, U = deps.util;
  var WORDS = lex.words, PHRASES = lex.phrases;
  var TYPES = ['mc', 'type', 'listen', 'match', 'conj', 'unscramble', 'ff'];
  var TENSE_LABEL = { pres: 'present', pret: 'preterite', impf: 'imperfect', fut: 'future', cmd: 'command' };
  var PERSON_LABEL = ['yo', 'tú', 'él/ella/usted', 'nosotros', 'vosotros', 'ellos/ellas/ustedes'];
  var CMD_LABEL = ['tú', 'usted', 'nosotros', 'vosotros', 'ustedes'];
  var DAILY_TYPES = ['mc', 'type', 'listen', 'conj', 'unscramble'];

  var WORD_BY_ID = {}, PHRASE_BY_ID = {}, BY_POS = {};
  WORDS.forEach(function (w) { WORD_BY_ID[w.id] = w; (BY_POS[w.pos] = BY_POS[w.pos] || []).push(w); });
  PHRASES.forEach(function (p) { PHRASE_BY_ID[p.id] = p; });
  var COMMON_VERBS = conj.list.filter(function (v) { return !/se$/.test(v.inf) && ['nevar', 'llover', 'gustar', 'doler', 'parecer'].indexOf(v.inf) < 0 && lex.wordsByEs(v.inf).length > 0; });

  function wordEs(w, variant) { return lex.resolve(w, variant).es; }
  function nk(s) { return U.norm(s, false); }

  function pool(opts) {
    var o = opts || {};
    var list = WORDS;
    if (o.ids && o.ids.length) {
      var idset = {};
      o.ids.forEach(function (i) { idset[i] = 1; });
      list = WORDS.filter(function (w) { return idset[w.id]; });
    }
    if (o.tier) list = list.filter(function (w) { return w.tier === o.tier; });
    if (o.cat) list = list.filter(function (w) { return w.cat === o.cat; });
    return list;
  }

  function pickDistractors(rng, target, dir, variant, count) {
    var cands = (BY_POS[target.pos] || []).filter(function (w) { return w.id !== target.id; });
    var shuffled = rng.shuffle(cands);
    shuffled.sort(function (a, b) { return (a.tier === target.tier ? 0 : 1) - (b.tier === target.tier ? 0 : 1); });
    // keep the shuffle's randomness within each tier group by a stable pass already done above
    var out = [], seen = {};
    var tEs = nk(wordEs(target, variant)), tEn = nk(target.en);
    seen[dir === 'en-es' ? tEs : tEn] = 1;
    for (var i = 0; i < shuffled.length && out.length < count; i++) {
      var w = shuffled[i];
      var es = wordEs(w, variant), en = w.en;
      if (nk(es) === tEs || nk(en) === tEn) continue;
      var key = dir === 'en-es' ? nk(es) : nk(en);
      if (seen[key]) continue;
      seen[key] = 1;
      out.push(dir === 'en-es' ? es : en);
    }
    return out;
  }

  function mc(seed, opts) {
    var o = opts || {}, variant = o.variant || 'la';
    var rng = R.make(seed);
    var list = pool(o);
    if (!list.length) list = WORDS;
    var w = rng.pick(list);
    var dir = o.dir || (rng.next() < 0.5 ? 'en-es' : 'es-en');
    var es = wordEs(w, variant);
    var answer = dir === 'en-es' ? es : w.en;
    var options = rng.shuffle([answer].concat(pickDistractors(rng, w, dir, variant, 3)));
    return {
      id: 'mc:' + seed, type: 'mc', dir: dir, itemId: w.id, answer: answer, accept: [answer], options: options,
      prompt: dir === 'en-es' ? 'What is the Spanish for "' + w.en + '"? (' + w.pos + ')' : 'What does "' + es + '" mean? (' + w.pos + ')',
      lang: dir === 'en-es' ? 'es' : 'en', speak: es
    };
  }

  function typeQ(seed, opts) {
    var o = opts || {}, variant = o.variant || 'la';
    var rng = R.make(seed);
    var list = pool(o);
    if (!list.length) list = WORDS;
    var w = rng.pick(list);
    var dir = o.dir || 'en-es';
    var es = wordEs(w, variant);
    var accept = [];
    if (dir === 'en-es') {
      accept.push(es);
      if (w.pos === 'noun' && w.g) {
        ['el', 'la', 'un', 'una'].forEach(function (a) { accept.push(a + ' ' + es); });
      }
    } else accept.push(w.en);
    return {
      id: 'type:' + seed, type: 'type', dir: dir, itemId: w.id, answer: dir === 'en-es' ? es : w.en, accept: accept,
      prompt: dir === 'en-es' ? 'Type the Spanish for "' + w.en + '" (' + w.pos + ')' : 'Type the English for "' + es + '"',
      lang: dir === 'en-es' ? 'es' : 'en', speak: es
    };
  }

  function listen(seed, opts) {
    var q = mc(seed, { dir: 'es-en', variant: (opts && opts.variant) || 'la', tier: opts && opts.tier, cat: opts && opts.cat, ids: opts && opts.ids });
    q.id = 'listen:' + seed; q.type = 'listen';
    q.prompt = 'Listen, then choose the English meaning.';
    q.reveal = q.speak;
    return q;
  }

  function match(seed, opts) {
    var o = opts || {}, variant = o.variant || 'la';
    var rng = R.make(seed);
    var list = pool(o);
    if (list.length < 6) list = WORDS;
    var chosen = [], seenEs = {}, seenEn = {};
    var shuffled = rng.shuffle(list);
    for (var i = 0; i < shuffled.length && chosen.length < 6; i++) {
      var w = shuffled[i], es = wordEs(w, variant);
      if (seenEs[nk(es)] || seenEn[nk(w.en)]) continue;
      seenEs[nk(es)] = 1; seenEn[nk(w.en)] = 1;
      chosen.push({ id: w.id, es: es, en: w.en });
    }
    return { id: 'match:' + seed, type: 'match', itemId: chosen[0].id, pairs: chosen, prompt: 'Match each Spanish word with its English meaning.', answer: '', accept: [], right: rng.shuffle(chosen.map(function (p) { return p.en; })) };
  }

  function verbPool() { return COMMON_VERBS; }
  function conjQ(seed, opts) {
    var o = opts || {}, variant = o.variant || 'la';
    var rng = R.make(seed);
    var v = rng.pick(o.verbs && o.verbs.length ? o.verbs : verbPool());
    var tenses = o.tenses && o.tenses.length ? o.tenses : ['pres', 'pret', 'impf', 'fut', 'cmd'];
    var tense = rng.pick(tenses);
    var forms = conj.conjugate(v.inf, tense);
    var idxs = [];
    var n = tense === 'cmd' ? 5 : 6;
    for (var i = 0; i < n; i++) {
      if (i === (tense === 'cmd' ? 3 : 4) && variant !== 'es') continue; // vosotros only with Spain
      idxs.push(i);
    }
    var idx = rng.pick(idxs);
    var label = tense === 'cmd' ? CMD_LABEL[idx] : PERSON_LABEL[idx];
    var answer = forms[idx];
    return {
      id: 'conj:' + seed, type: 'conj', itemId: 'conj:' + v.inf + ':' + tense + ':' + idx, answer: answer, accept: [answer],
      verb: v.inf, tense: tense, person: idx, speak: answer, lang: 'es',
      prompt: 'Conjugate "' + v.inf + '" (' + v.en + ') in the ' + TENSE_LABEL[tense] + ': ' + label
    };
  }

  function sentenceSources(opts, variant) {
    var out = [];
    WORDS.forEach(function (w) { out.push({ id: w.id, es: w.ex.es, en: w.ex.en }); });
    PHRASES.forEach(function (p) { out.push({ id: p.id, es: lex.phraseEs(p, variant), en: p.en }); });
    var ids = opts && opts.ids && opts.ids.length ? opts.ids : null;
    if (ids) {
      var set = {};
      ids.forEach(function (i) { set[i] = 1; });
      var f = out.filter(function (s) { return set[s.id]; });
      if (f.length) return f;
    }
    return out.filter(function (s) { var n = s.es.split(' ').length; return n >= 4 && n <= 8; });
  }
  function unscramble(seed, opts) {
    var variant = (opts && opts.variant) || 'la';
    var rng = R.make(seed);
    var list = sentenceSources(opts, variant).filter(function (s) { var n = s.es.split(' ').length; return n >= 4 && n <= 8; });
    var s = rng.pick(list);
    var tokens = s.es.split(' ');
    var shuffled = tokens, tries = 0;
    while (tries < 30) {
      shuffled = rng.shuffle(tokens);
      if (shuffled.join(' ') !== tokens.join(' ')) break;
      tries++;
    }
    if (shuffled.join(' ') === tokens.join(' ')) shuffled = tokens.slice(1).concat(tokens.slice(0, 1));
    return { id: 'unscramble:' + seed, type: 'unscramble', itemId: s.id, answer: s.es, accept: [s.es], tokens: shuffled, prompt: 'Put the words in order: "' + s.en + '"', speak: s.es, lang: 'es' };
  }

  // False-friend quiz: what does the Spanish word really mean?
  function ff(seed, opts) {
    var rng = R.make(seed);
    var list = deps.falsefriends;
    var f = rng.pick(list);
    var others = rng.shuffle(list.filter(function (x) { return x.id !== f.id && nk(x.actually) !== nk(f.actually); })).slice(0, 2).map(function (x) { return x.actually; });
    var options = rng.shuffle([f.actually, f.looksLike].concat(others).filter(function (v, i, a) { return a.map(nk).indexOf(nk(v)) === i; }));
    return { id: 'ff:' + seed, type: 'ff', itemId: f.id, answer: f.actually, accept: [f.actually], options: options, prompt: 'What does "' + f.es + '" really mean? (It looks like "' + f.looksLike + '".)', speak: f.es, lang: 'en' };
  }

  function make(type, seed, opts) {
    var fn = { mc: mc, type: typeQ, listen: listen, match: match, conj: conjQ, unscramble: unscramble, ff: ff }[type];
    if (!fn) throw new RangeError('Unknown quiz type: ' + type);
    return fn(seed, opts);
  }
  function round(type, seed, count, opts) {
    var out = [];
    for (var i = 0; i < count; i++) out.push(make(type, R.deriveSeed(seed, type + i), opts));
    return out;
  }
  function sprint(seed, count, opts) { return round('mc', seed, count || 60, opts); }
  function daily(dateStr, opts) {
    var seed = R.fnv1a('daily:' + dateStr);
    var out = [];
    for (var i = 0; i < 10; i++) out.push(make(DAILY_TYPES[i % DAILY_TYPES.length], R.deriveSeed(seed, 'q' + i), { variant: 'la', tier: opts && opts.tier }));
    return out;
  }

  // Check an answer. For choice questions `input` is the chosen option text. Returns { ok, hint }.
  function check(q, input, accentLoose) {
    var given = typeof input === 'string' ? input : '';
    if (q.type === 'mc' || q.type === 'listen' || q.type === 'ff') {
      return { ok: nk(given) === nk(q.answer), hint: '' };
    }
    var strictSet = q.accept.map(function (a) { return U.norm(a, false); });
    var looseSet = q.accept.map(function (a) { return U.norm(a, true); });
    if (strictSet.indexOf(U.norm(given, false)) >= 0) return { ok: true, hint: '' };
    if (looseSet.indexOf(U.norm(given, true)) >= 0) {
      return { ok: !!accentLoose, hint: 'Right word, mind the accent: ' + q.answer };
    }
    return { ok: false, hint: '' };
  }

  function itemOf(id) { return WORD_BY_ID[id] || PHRASE_BY_ID[id] || null; }

  return {
    TYPES: TYPES, TENSE_LABEL: TENSE_LABEL, PERSON_LABEL: PERSON_LABEL, CMD_LABEL: CMD_LABEL, DAILY_TYPES: DAILY_TYPES,
    make: make, round: round, sprint: sprint, daily: daily, check: check, itemOf: itemOf, commonVerbs: verbPool
  };
});
