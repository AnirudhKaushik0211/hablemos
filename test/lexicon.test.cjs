'use strict';
// Reverse lookup (Spanish to English) and lexicon form tests. Kept after the offline translator was removed.
const test = require('node:test');
const assert = require('node:assert');
const reverse = require('../js/reverse.js');
const lexicon = require('../js/lexicon.js');
test('reverse lookup: words, conjugated forms, phrases, accent-insensitive', () => {
  const r1 = reverse.lookup('casa', 'la');
  assert.ok(r1.matches.some((m) => m.en === 'house' && m.g === 'f'));
  const r2 = reverse.lookup('Cafe', 'la');
  assert.ok(r2.matches.some((m) => m.es === 'café' && m.en === 'coffee'));
  const r3 = reverse.lookup('tengo', 'la');
  assert.ok(r3.matches.some((m) => m.kind === 'conj' && m.infinitive === 'tener' && m.tense === 'present' && m.person === 'yo'));
  const r4 = reverse.lookup('¿Dónde está el baño?', 'la');
  assert.ok(r4.matches.some((m) => m.kind === 'phrase' && /bathroom/.test(m.en)));
  const r5 = reverse.lookup('fuimos', 'la');
  assert.ok(r5.matches.some((m) => m.kind === 'conj' && m.tense === 'preterite'));
  const r6 = reverse.lookup('xyzzy', 'la');
  assert.strictEqual(r6.matches.length, 0);
  assert.ok(/Not in the dictionary/.test(r6.message));
  assert.ok(reverse.lookup('', 'la').message);
});

test('lexicon: forms of an entry include plural, feminine, apocope and conjugations', () => {
  const w = (es, pos) => lexicon.words.find((x) => x.es === es && (!pos || x.pos === pos));
  assert.ok(lexicon.forms(w('bueno')).includes('buenas'));
  assert.ok(lexicon.forms(w('bueno')).includes('buen'));
  assert.ok(lexicon.forms(w('canción')).includes('canciones'));
  assert.ok(lexicon.forms(w('hablar')).includes('hablamos'));
  assert.ok(lexicon.forms(w('ir')).includes('vamos'));
  assert.ok(lexicon.forms(w('computadora')).includes('ordenador'));
});


test('reverse lookup: gender follows the variant form that was typed', () => {
  const cases = [['ordenador', 'm'], ['banana', 'f'], ['camar\u00f3n', 'm'], ['jud\u00eda', 'f'], ['refrigerador', 'm'], ['computadora', 'f'], ['pl\u00e1tano', 'm'], ['gamba', 'f'], ['frijol', 'm'], ['nevera', 'f']];
  cases.forEach(([w, g]) => {
    const m = reverse.lookup(w, 'la').matches.find((x) => x.kind === 'word' && x.es === w);
    assert.ok(m, w);
    assert.strictEqual(m.g, g, w);
  });
});