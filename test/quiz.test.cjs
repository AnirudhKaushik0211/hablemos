'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Q = require('../js/quiz.js');
const U = require('../js/util.js');
const R = require('../js/rng.js');
const D = require('../js/daily.js');
const SC = require('../js/scenario.js');
const scenarios = require('../data/scenarios.js');
const words = require('../data/words.js');

const seeds = Array.from({ length: 150 }, (_, i) => i * 7919 + 3);

test('quiz mc: the answer is always among 4 distinct options, both directions, both variants', () => {
  for (const s of seeds) for (const variant of ['la', 'es']) for (const dir of ['en-es', 'es-en']) {
    const q = Q.make('mc', s, { variant, dir });
    assert.strictEqual(q.options.length, 4, 'seed ' + s);
    assert.ok(q.options.includes(q.answer), 'answer missing for seed ' + s);
    assert.strictEqual(new Set(q.options.map((o) => U.norm(o))).size, 4, 'duplicate options for seed ' + s);
  }
});
test('quiz: every generator is deterministic for a seed', () => {
  for (const t of Q.TYPES) for (const s of [1, 2, 99]) assert.deepStrictEqual(Q.make(t, s, { variant: 'la' }), Q.make(t, s, { variant: 'la' }), t);
});
test('quiz: listen and ff questions have the answer among distinct options', () => {
  for (const s of seeds.slice(0, 60)) for (const t of ['listen', 'ff']) {
    const q = Q.make(t, s);
    assert.ok(q.options.includes(q.answer));
    assert.strictEqual(new Set(q.options.map((o) => U.norm(o))).size, q.options.length);
  }
});
test('quiz match: 6 pairs distinct on both sides', () => {
  for (const s of seeds.slice(0, 40)) {
    const q = Q.make('match', s);
    assert.strictEqual(q.pairs.length, 6);
    assert.strictEqual(new Set(q.pairs.map((p) => U.norm(p.es))).size, 6);
    assert.strictEqual(new Set(q.pairs.map((p) => U.norm(p.en))).size, 6);
    assert.deepStrictEqual(q.right.slice().sort(), q.pairs.map((p) => p.en).sort());
  }
});
test('quiz unscramble: 4-8 tokens, order differs, original accepted', () => {
  for (const s of seeds.slice(0, 80)) {
    const q = Q.make('unscramble', s);
    assert.ok(q.tokens.length >= 4 && q.tokens.length <= 8, q.answer);
    assert.notStrictEqual(q.tokens.join(' '), q.answer);
    assert.ok(Q.check(q, q.answer, true).ok);
    assert.strictEqual(q.tokens.slice().sort().join('|'), q.answer.split(' ').sort().join('|'));
  }
});
test('quiz conj: answer comes from the conjugation tables; vosotros only for Spain', () => {
  const conj = require('../js/conj.js');
  for (const s of seeds.slice(0, 120)) {
    const q = Q.make('conj', s, { variant: 'la' });
    assert.strictEqual(conj.conjugate(q.verb, q.tense)[q.person], q.answer);
    assert.notStrictEqual(q.tense === 'cmd' ? q.person : q.person, q.tense === 'cmd' ? 3 : 4);
  }
  const seen = new Set();
  for (const s of seeds) seen.add(Q.make('conj', s, { variant: 'es', tenses: ['pres'] }).person);
  assert.ok(seen.has(4));
});
test('typing: accent-insensitive matching with a hint, strict mode rejects', () => {
  const q = { type: 'type', answer: 'está', accept: ['está'] };
  assert.deepStrictEqual(Q.check(q, 'está', true), { ok: true, hint: '' });
  assert.deepStrictEqual(Q.check(q, ' ESTÁ. ', false), { ok: true, hint: '' });
  const loose = Q.check(q, 'esta', true);
  assert.strictEqual(loose.ok, true);
  assert.match(loose.hint, /mind the accent: está/);
  const strict = Q.check(q, 'esta', false);
  assert.strictEqual(strict.ok, false);
  assert.match(strict.hint, /mind the accent/);
  assert.strictEqual(Q.check(q, 'estoy', true).ok, false);
});
test('typing: n-tilde is not treated as n', () => {
  const q = { type: 'type', answer: 'año', accept: ['año'] };
  assert.strictEqual(Q.check(q, 'ano', true).ok, false);
  assert.strictEqual(Q.check(q, 'año', true).ok, true);
});
test('daily challenge: deterministic per date, differs across dates, 10 mixed questions', () => {
  const a = Q.daily('2026-03-04'), b = Q.daily('2026-03-04'), c = Q.daily('2026-03-05');
  assert.deepStrictEqual(a, b);
  assert.notDeepStrictEqual(a.map((x) => x.id), c.map((x) => x.id));
  assert.strictEqual(a.length, 10);
  assert.deepStrictEqual(new Set(a.map((x) => x.type)), new Set(['mc', 'type', 'listen', 'conj', 'unscramble']));
  assert.deepStrictEqual(D.dailyChallenge('2026-03-04'), a);
});
test('word of the day: deterministic by date, defined by the fnv1a rule', () => {
  const w = D.wordOfTheDay('2026-03-04');
  assert.strictEqual(w, words[R.fnv1a('wotd:2026-03-04') % words.length]);
  assert.strictEqual(D.wordOfTheDay('2026-03-04'), w);
});
test('rng: seeded sequences are stable', () => {
  const a = R.make(5), b = R.make(5);
  assert.deepStrictEqual([a.next(), a.next()], [b.next(), b.next()]);
  assert.strictEqual(R.fnv1a(''), 0x811c9dc5);
  assert.strictEqual(R.fnv1a('a'), 0xe40c292c);
});
test('util: day numbers round trip and weekday', () => {
  assert.strictEqual(U.dayNumber(1970, 1, 1), 0);
  assert.strictEqual(U.dayToString(U.dayNumber(2026, 2, 28) + 1), '2026-03-01');
  assert.strictEqual(U.dayToString(U.dayNumber(2024, 2, 28) + 1), '2024-02-29');
  assert.strictEqual(U.weekday(0), 4);
  assert.strictEqual(U.weekday(U.dayNumber(2026, 1, 4)), 0);
  for (let n = -400; n < 30000; n += 37) { const r = U.dayToYMD(n); assert.strictEqual(U.dayNumber(r.y, r.m, r.d), n); }
});
test('scenarios: every path ends, choosing correct replies finishes with full score, typed replies work', () => {
  assert.strictEqual(scenarios.length, 4);
  for (const sc of scenarios) {
    assert.ok(SC.pathsTerminate(sc), sc.id);
    let st = SC.begin(sc);
    let guard = 0;
    while (!st.done && guard++ < 50) {
      const step = SC.current(sc, st);
      const idx = step.choices.findIndex((c) => c.ok);
      assert.ok(idx >= 0);
      st = SC.choose(sc, st, idx).state;
    }
    assert.ok(st.done, sc.id);
    assert.strictEqual(SC.score(st).pct, 100, sc.id);
    assert.strictEqual(SC.xpFor(st), 30 + 5 * st.correct);
  }
  const food = scenarios[0];
  const st0 = SC.begin(food);
  const r = SC.typed(food, st0, 'Un cafe por favor');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(SC.typed(food, st0, 'xyz').ok, false);
  assert.strictEqual(SC.typed(food, st0, '   ').empty, true);
  assert.strictEqual(SC.choose(food, st0, 99), null);
});
