'use strict';
const test = require('node:test');
const assert = require('node:assert');
const words = require('../data/words.js');
const phrases = require('../data/phrases.js');
const verbs = require('../data/verbs.js');
const ff = require('../data/falsefriends.js');
const idioms = require('../data/idioms.js');
const pron = require('../data/pronunciation.js');
const scenarios = require('../data/scenarios.js');
const entext = require('../data/entext.js');
const why = require('../data/why.js');
const lexicon = require('../js/lexicon.js');

const WORD_CATS = ['greetings', 'people', 'family', 'body', 'health', 'food', 'drink', 'home', 'clothes', 'colours', 'numbers', 'time', 'weather', 'nature', 'animals', 'travel', 'places', 'shopping', 'work', 'school', 'feelings', 'actions', 'descriptions', 'grammar', 'tech', 'hobbies'];
const PHRASE_CATS = ['greetings', 'travel', 'restaurant', 'shopping', 'directions', 'health', 'social', 'work'];
const POS = ['noun', 'verb', 'adj', 'adv', 'prep', 'conj', 'pron', 'det', 'interj', 'num'];
const TIERS = ['A1', 'A2', 'B1'];

function clean(s) { return typeof s === 'string' && s.length > 0 && s === s.normalize('NFC') && s === s.trim() && !/\s{2,}/.test(s) && !/[\t\n\r]/.test(s); }
function walkStrings(o, cb, p) {
  if (typeof o === 'string') cb(o, p);
  else if (Array.isArray(o)) o.forEach((x, i) => walkStrings(x, cb, p + '[' + i + ']'));
  else if (o && typeof o === 'object') Object.keys(o).forEach((k) => walkStrings(o[k], cb, p + '.' + k));
}
function tokens(s) { return (s.toLowerCase().match(/[a-záéíóúüñ]+/g) || []); }

test('all strings in data are NFC without stray whitespace', () => {
  [['words', words], ['phrases', phrases], ['verbs', verbs], ['falsefriends', ff], ['idioms', idioms], ['pronunciation', pron], ['scenarios', scenarios], ['why', why]].forEach(([name, d]) => {
    walkStrings(d, (s, p) => assert.ok(clean(s), name + p + ' has stray whitespace or is not NFC: ' + JSON.stringify(s)), name);
  });
});

test('words: required fields, valid values, unique ids and keys', () => {
  const ids = {}; const keys = {};
  words.forEach((w) => {
    assert.ok(/^w\d{4}$/.test(w.id), 'id ' + w.id);
    assert.ok(!ids[w.id], 'dup id ' + w.id); ids[w.id] = 1;
    assert.ok(POS.includes(w.pos), w.id + ' pos ' + w.pos);
    if (w.pos === 'noun') assert.ok(['m', 'f', 'mf'].includes(w.g), w.id + ' needs gender');
    else assert.strictEqual(w.g, undefined, w.id + ' must not have gender');
    assert.ok(TIERS.includes(w.tier), w.id + ' tier');
    assert.ok(WORD_CATS.includes(w.cat), w.id + ' cat ' + w.cat);
    assert.ok(clean(w.es) && clean(w.en), w.id + ' es/en');
    assert.ok(w.ex && clean(w.ex.es) && clean(w.ex.en), w.id + ' example');
    const key = w.es + '|' + w.pos + '|' + (w.sense || '');
    assert.ok(!keys[key], 'duplicate key ' + key); keys[key] = 1;
  });
});

test('words: every example contains a form of its word', () => {
  words.forEach((w) => {
    const toks = tokens(w.ex.es);
    const text = ' ' + toks.join(' ') + ' ';
    const found = lexicon.forms(w).some((f) => text.indexOf(' ' + f.toLowerCase().replace(/[¿?¡!.,]/g, '') + ' ') >= 0);
    assert.ok(found, w.id + ' ' + w.es + ' not found in example: ' + w.ex.es);
  });
});

test('words: counts meet the minimums', () => {
  assert.ok(words.length >= 950, 'words ' + words.length);
  const t = { A1: 0, A2: 0, B1: 0 };
  words.forEach((w) => t[w.tier]++);
  assert.ok(t.A1 > 0 && t.A2 > 0 && t.B1 > 0);
  assert.ok(words.filter((w) => w.cog).length >= 80, 'cognates');
  WORD_CATS.forEach((c) => assert.ok(words.some((w) => w.cat === c), 'category ' + c + ' empty'));
});

test('words: every verb word exists in verbs and has a conjugation', () => {
  const set = new Set(verbs.map((v) => v.inf));
  words.filter((w) => w.pos === 'verb').forEach((w) => assert.ok(set.has(w.es), 'verb missing ' + w.es));
});

test('words: variants and optional fields are well formed', () => {
  words.forEach((w) => {
    if (w.var) Object.keys(w.var).forEach((k) => { assert.ok(k === 'es' || k === 'la', w.id + ' var key'); assert.ok(clean(w.var[k].es), w.id + ' var es'); });
    if (w.st) assert.ok(['ser', 'estar', 'both'].includes(w.st), w.id + ' st');
    if (w.en2) w.en2.forEach((x) => assert.ok(clean(x), w.id + ' en2'));
    if (w.art) assert.strictEqual(w.art, 'el');
    if (w.inv || w.fem || w.st || w.pre) assert.ok(w.pos === 'adj' || w.pos === 'noun' || w.pos === 'num' || w.pos === 'det', w.id + ' adjective field on ' + w.pos);
  });
});

test('phrases: schema, categories, minimum per category', () => {
  const ids = {}; const cnt = {};
  phrases.forEach((p) => {
    assert.ok(/^p\d{3}$/.test(p.id)); assert.ok(!ids[p.id]); ids[p.id] = 1;
    assert.ok(clean(p.es) && clean(p.en), p.id);
    assert.ok(PHRASE_CATS.includes(p.cat), p.id + ' cat');
    assert.ok(TIERS.includes(p.tier), p.id + ' tier');
    cnt[p.cat] = (cnt[p.cat] || 0) + 1;
    if (p.var) Object.keys(p.var).forEach((k) => assert.ok(clean(p.var[k])));
    assert.ok(/[.!?]$/.test(p.es) || /^[A-ZÁÉÍÓÚ]/.test(p.es), p.id);
  });
  PHRASE_CATS.forEach((c) => assert.ok(cnt[c] >= 25, c + ' has ' + cnt[c]));
  assert.ok(phrases.length >= 300, 'phrases ' + phrases.length);
  const seen = {};
  phrases.forEach((p) => { const k = p.es + '|' + p.en; assert.ok(!seen[k], 'dup phrase ' + k); seen[k] = 1; });
});

test('verbs: at least 40, unique, valid class, reference tables for 30 exist in conj test', () => {
  assert.ok(verbs.length >= 40);
  const s = new Set();
  verbs.forEach((v) => {
    assert.ok(!s.has(v.inf), 'dup verb ' + v.inf); s.add(v.inf);
    assert.ok(['reg', 'stem', 'irr'].includes(v.cls), v.inf);
    assert.ok(clean(v.inf) && typeof v.en === 'string');
    assert.ok(/(ar|er|ir|ír)(se)?$/.test(v.inf), v.inf);
  });
});

test('false friends, idioms, pronunciation tips', () => {
  assert.ok(ff.length >= 25);
  ff.forEach((f) => { ['id', 'es', 'looksLike', 'actually', 'say'].forEach((k) => assert.ok(clean(f[k]), f.id + k)); assert.ok(clean(f.ex.es) && clean(f.ex.en)); });
  assert.strictEqual(new Set(ff.map((f) => f.id)).size, ff.length);
  assert.ok(idioms.length >= 30);
  idioms.forEach((i) => { ['id', 'es', 'literal', 'meaning'].forEach((k) => assert.ok(clean(i[k]), i.id + k)); assert.ok(TIERS.includes(i.tier)); assert.ok(clean(i.ex.es) && clean(i.ex.en)); });
  assert.strictEqual(new Set(idioms.map((i) => i.id)).size, idioms.length);
  assert.ok(pron.length >= 12);
  const topics = pron.map((p) => p.topic.toLowerCase()).join(' | ');
  ['rr', 'ñ', 'll', 'v and b', 'silent h', 'j and g', 'c and z', 'qu and gu', 'vowels', 'stress', 'accent'].forEach((t) => assert.ok(topics.includes(t), 'missing tip: ' + t));
  pron.forEach((p) => { assert.ok(clean(p.rule) && p.examples.length >= 2); p.examples.forEach((e) => assert.ok(clean(e.es) && clean(e.say) && clean(e.en))); });
});

test('scenarios: exactly four, valid ids, every path terminates', () => {
  assert.deepStrictEqual(scenarios.map((s) => s.id), ['s-food', 's-directions', 's-hotel', 's-pharmacy']);
  scenarios.forEach((sc) => {
    assert.ok(sc.steps.length >= 5 && sc.steps.length <= 8, sc.id + ' steps ' + sc.steps.length);
    const byId = {}; sc.steps.forEach((s) => { assert.ok(!byId[s.id]); byId[s.id] = s; });
    assert.ok(byId[sc.start]);
    let branches = 0;
    sc.steps.forEach((s) => {
      assert.ok(s.choices.length >= 2 && s.choices.length <= 4, s.id);
      assert.ok(s.choices.some((c) => c.ok === true), s.id + ' needs an ok choice');
      assert.ok(clean(s.npc.es) && clean(s.npc.en) && clean(s.prompt));
      const nexts = new Set(s.choices.map((c) => c.next));
      if (nexts.size > 1) branches++;
      s.choices.forEach((c) => { assert.ok(clean(c.es) && clean(c.en) && clean(c.fb)); assert.ok(c.next === 'end' || byId[c.next], 'bad next ' + c.next); });
    });
    assert.ok(branches >= 1, sc.id + ' needs a branch');
    // every step reachable and every path ends: depth-first with a visited set (graph must be acyclic)
    const visiting = {}; const done = {};
    function dfs(id) {
      if (id === 'end') return;
      assert.ok(!visiting[id], 'cycle at ' + id);
      if (done[id]) return;
      visiting[id] = 1;
      byId[id].choices.forEach((c) => dfs(c.next));
      visiting[id] = 0; done[id] = 1;
    }
    dfs(sc.start);
    sc.steps.forEach((s) => assert.ok(done[s.id], sc.id + ' unreachable step ' + s.id));
  });
});

test('why table covers every required key', () => {
  ['agree-gender', 'agree-number', 'order-noun-adj', 'pre-adj', 'apocope', 'drop-subject', 'keep-subject', 'ser', 'estar', 'ser-estar-unsure', 'tener-state', 'a-personal', 'contraction', 'article-el', 'plural-rule', 'gustar', 'neg', 'double-neg', 'question-inversion', 'question-marks', 'future-ir-a', 'progressive', 'imperative', 'variant', 'number-word', 'time-phrase', 'por-para', 'name', 'unknown', 'unsupported'].forEach((k) => assert.ok(clean(why[k]), 'why ' + k));
});

test('entext has the required tables', () => {
  ['pronSubj', 'pronObj', 'determiners', 'possessives', 'prepositions', 'conjunctions', 'whWords', 'irregularPlurals', 'irregularVerbs', 'numberWords', 'frags', 'contractions', 'days', 'months'].forEach((k) => assert.ok(entext[k], k));
  entext.frags.forEach((f) => assert.ok(clean(f.en) && clean(f.es)));
});
