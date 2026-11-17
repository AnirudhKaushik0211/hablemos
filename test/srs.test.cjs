'use strict';
const test = require('node:test');
const assert = require('node:assert');
const S = require('../js/srs.js');
const P = require('../js/progress.js');

const T = 1000;
const card = (o) => Object.assign(S.newState('w0001'), o);

test('srs: new card start state', () => {
  const s = S.newState('x');
  assert.deepStrictEqual([s.ease, s.interval, s.reps, s.lapses], [2.5, 0, 0, 0]);
});
test('srs: Good on a new card gives interval 1, then 3, then interval * ease', () => {
  let s = S.rate(S.newState('a'), 'good', T);
  assert.deepStrictEqual([s.reps, s.interval, s.due], [1, 1, T + 1]);
  s = S.rate(s, 'good', T + 1);
  assert.deepStrictEqual([s.reps, s.interval], [2, 3]);
  s = S.rate(s, 'good', T + 4);
  assert.deepStrictEqual([s.reps, s.interval], [3, Math.round(3 * 2.5)]);
  assert.strictEqual(s.ease, 2.5);
});
test('srs: Easy intervals 4, 7, then interval * ease * 1.3, ease +0.15 (max 3.0)', () => {
  let s = S.rate(S.newState('a'), 'easy', T);
  assert.strictEqual(s.interval, 4);
  assert.strictEqual(s.ease, 2.65);
  s = S.rate(s, 'easy', T);
  assert.strictEqual(s.interval, 7);
  s = S.rate(s, 'easy', T);
  assert.strictEqual(s.interval, Math.round(7 * 2.8 * 1.3));
  assert.strictEqual(s.ease, 2.95);
  s = S.rate(s, 'easy', T);
  assert.strictEqual(s.ease, 3.0);
  s = S.rate(s, 'easy', T);
  assert.strictEqual(s.ease, 3.0);
});
test('srs: Again resets reps, adds a lapse, lowers ease, due today', () => {
  const s = S.rate(card({ reps: 4, interval: 20, ease: 2.5, last: 5 }), 'again', T);
  assert.deepStrictEqual([s.reps, s.interval, s.lapses, s.ease, s.due], [0, 0, 1, 2.3, T]);
});
test('srs: Hard keeps reps, interval * 1.2 (at least 1), ease -0.15', () => {
  const s = S.rate(card({ reps: 3, interval: 10, ease: 2.5, last: 5 }), 'hard', T);
  assert.deepStrictEqual([s.reps, s.interval, s.ease], [3, 12, 2.35]);
  assert.strictEqual(S.rate(S.newState('a'), 'hard', T).interval, 1);
});
test('srs: ease never below 1.3 and interval capped at 365', () => {
  let s = card({ ease: 1.35, reps: 5, interval: 300, last: 1 });
  s = S.rate(s, 'hard', T);
  assert.strictEqual(s.ease, 1.3);
  const big = S.rate(card({ ease: 3.0, reps: 5, interval: 360, last: 1 }), 'easy', T);
  assert.strictEqual(big.interval, 365);
});
test('srs: rate does not mutate its input and rejects unknown ratings', () => {
  const a = S.newState('a');
  const copy = JSON.stringify(a);
  S.rate(a, 'good', T);
  assert.strictEqual(JSON.stringify(a), copy);
  assert.throws(() => S.rate(a, 'meh', T), RangeError);
});
test('srs: queue puts due reviews oldest first, then new cards up to the allowance', () => {
  const states = { a: card({ id: 'a', due: 990, last: 900 }), b: card({ id: 'b', due: 980, last: 900 }), c: card({ id: 'c', due: 2000, last: 900 }) };
  const q = S.buildQueue(['a', 'b', 'c', 'n1', 'n2', 'n3'], states, T, { newAllowed: 2 });
  assert.deepStrictEqual(q, ['b', 'a', 'n1', 'n2']);
  assert.deepStrictEqual(S.buildQueue(['n1'], {}, T, { newAllowed: 0 }), []);
});
test('srs: Again requeues after four other cards', () => {
  assert.deepStrictEqual(S.requeue(['b', 'c', 'd', 'e', 'f', 'g'], 'a'), ['b', 'c', 'd', 'e', 'a', 'f', 'g']);
  assert.deepStrictEqual(S.requeue(['b'], 'a'), ['b', 'a']);
});
test('progress: levels follow 50*L*(L-1)', () => {
  assert.deepStrictEqual([P.threshold(2), P.threshold(3), P.threshold(4), P.threshold(5)], [100, 300, 600, 1000]);
  assert.strictEqual(P.level(0), 1);
  assert.strictEqual(P.level(99), 1);
  assert.strictEqual(P.level(100), 2);
  assert.strictEqual(P.level(1000), 5);
  assert.strictEqual(P.level(1e9), 50);
});
test('progress: flashcard XP is 1/3/5/6 and capped at 200 per day', () => {
  let p = P.defaults();
  for (const [r, x] of [['again', 1], ['hard', 3], ['good', 5], ['easy', 6]]) assert.strictEqual(P.awardFlash(P.defaults(), r, 10).gained, x, r);
  for (let i = 0; i < 100; i++) p = P.awardFlash(p, 'easy', 10).p;
  assert.strictEqual(p.xp, 200);
  assert.strictEqual(P.awardFlash(p, 'easy', 10).gained, 0);
  assert.strictEqual(P.awardFlash(p, 'easy', 11).gained, 6);
});
test('progress: streak increments on consecutive goal days and resets after a gap', () => {
  let p = P.defaults(), cal = {};
  let r = P.recordActivity(p, cal, 100, 2);
  assert.strictEqual(r.goalReached, false);
  r = P.recordActivity(r.p, r.cal, 100, 2);
  assert.strictEqual(r.goalReached, true);
  assert.strictEqual(r.p.streak, 1);
  r = P.recordActivity(r.p, r.cal, 100, 2);
  assert.strictEqual(r.goalReached, false);
  assert.strictEqual(r.p.streak, 1);
  p = r.p; cal = r.cal;
  r = P.recordActivity(p, cal, 101, 1);
  assert.strictEqual(r.p.streak, 2);
  assert.strictEqual(r.p.bestStreak, 2);
  r = P.recordActivity(r.p, r.cal, 105, 1);
  assert.strictEqual(r.p.streak, 1);
  assert.strictEqual(r.p.bestStreak, 2);
  assert.strictEqual(P.currentStreak(r.p, 105), 1);
  assert.strictEqual(P.currentStreak(r.p, 106), 1);
  assert.strictEqual(P.currentStreak(r.p, 107), 0);
});
test('progress: mistake notebook adds, bumps, and removes after 2 correct in a row', () => {
  let m = P.recordMistake([], 'w0001', 'word', 5);
  m = P.recordMistake(m, 'w0001', 'word', 6);
  assert.deepStrictEqual(m[0], { id: 'w0001', kind: 'word', count: 2, last: 6, ok: 0 });
  m = P.recordCorrectOnMistake(m, 'w0001');
  assert.strictEqual(m[0].ok, 1);
  m = P.recordMistake(m, 'w0001', 'word', 7);
  assert.strictEqual(m[0].ok, 0);
  m = P.recordCorrectOnMistake(P.recordCorrectOnMistake(m, 'w0001'), 'w0001');
  assert.strictEqual(m.length, 0);
});
test('progress: notebook keeps at most 200 entries', () => {
  let m = [];
  for (let i = 0; i < 230; i++) m = P.recordMistake(m, 'w' + String(i).padStart(4, '0'), 'word', i);
  assert.strictEqual(m.length, 200);
  assert.ok(!m.some((x) => x.id === 'w0000'));
});
test('progress: learned words give 2 XP once; badges are awarded once with the day', () => {
  let p = P.defaults();
  let r = P.markLearned(p, 'w0001');
  assert.strictEqual(r.gained, 2);
  assert.strictEqual(P.markLearned(r.p, 'w0001').gained, 0);
  p = P.bump(r.p, 'cardsRated');
  const b = P.checkBadges(p, 77);
  assert.deepStrictEqual(b.earned.map((x) => x.id), ['first-card']);
  assert.strictEqual(b.p.badges['first-card'], 77);
  assert.strictEqual(P.checkBadges(b.p, 78).earned.length, 0);
});

