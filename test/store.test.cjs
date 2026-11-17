'use strict';
const test = require('node:test');
const assert = require('node:assert');
const S = require('../js/store.js');
const P = require('../js/progress.js');

function fakeStorage(opts) {
  const m = new Map();
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (opts && opts.throws) throw new Error('quota'); m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); }
  };
}
const EMAIL = 'user@example.invalid';
function sample() {
  const progress = P.defaults();
  progress.xp = 345; progress.streak = 3; progress.bestStreak = 5; progress.lastGoalDay = 20000; progress.learned = ['w0001', 'p002'];
  progress.badges = { 'first-card': 19999 }; progress.counters = { cardsRated: 7, 'scen-s-food': 1 }; progress.flashXp = { day: 20000, xp: 30 };
  return {
    settings: Object.assign({}, S.DEFAULT_SETTINGS, { theme: 'dark', dailyGoal: 30, email: EMAIL, online: true, lastTab: 'cards' }),
    progress,
    cards: { states: { w0001: { id: 'w0001', ease: 2.35, interval: 4, reps: 2, lapses: 1, due: 20004, last: 20000 } }, custom: [{ id: 'c-abc', es: 'hola', en: 'hello' }], newDay: { day: 20000, n: 3 } },
    mistakes: [{ id: 'w0002', kind: 'word', count: 2, last: 20000, ok: 1 }],
    calendar: { '19999': 12, '20000': 22 },
    daily: { '2026-01-02': { score: 7, total: 10 } }
  };
}

test('store: wrapper falls back to memory when storage throws', () => {
  const st = S.createStore(fakeStorage({ throws: true }));
  assert.strictEqual(st.persistent(), false);
  st.set('x', { a: 1 });
  assert.deepStrictEqual(st.get('x', null), { a: 1 });
  assert.strictEqual(st.get('missing', 'd'), 'd');
  const none = S.createStore(null);
  assert.strictEqual(none.persistent(), false);
  none.set('k', 5);
  assert.strictEqual(none.get('k', 0), 5);
});
test('store: reads survive corrupt JSON and keys carry the hb. prefix', () => {
  const fs = fakeStorage();
  const st = S.createStore(fs);
  st.set('settings', { a: 1 });
  assert.ok(fs.m.has('hb.settings'));
  fs.m.set('hb.progress', '{broken');
  assert.deepStrictEqual(st.get('progress', 'fallback'), 'fallback');
  st.clearAll();
  assert.strictEqual(fs.m.has('hb.settings'), false);
});
test('store: sanitisers clamp, drop unknown keys and are idempotent', () => {
  const dirty = { variant: 'xx', you: 5, theme: 'blue', textSize: 99, dailyGoal: 7, newPerDay: -3, reducedMotion: 'maybe', online: 'yes', lastTab: '../x', extra: 1 };
  const s = S.sanitizeSettings(dirty, false);
  assert.deepStrictEqual(s, { variant: 'la', you: 'tu', theme: 'auto', textSize: 3, sound: true, slow: false, accentLoose: true, dailyGoal: 20, newPerDay: 5, reducedMotion: 'auto', online: false, lastTab: 'help' });
  assert.deepStrictEqual(S.sanitizeSettings(s, false), s);
  const p = S.sanitizeProgress({ xp: -5, learned: ['w1', 'w1', '<script>', 7], counters: { 'bad key!': 1, ok: 2.7 }, badges: [] });
  assert.deepStrictEqual([p.xp, p.learned, p.counters], [0, ['w1'], { ok: 3 }]);
  assert.deepStrictEqual(S.sanitizeProgress(p), p);
  const c = S.sanitizeCards({ states: { w1: { ease: 99, interval: 1000, reps: 'x' }, '<bad>': {} }, custom: [{ id: 'c1', es: ' a  b ', en: 'x' }, { id: 'c1', es: 'dup', en: 'dup' }, { id: 'c2', es: '', en: 'x' }] });
  assert.deepStrictEqual(Object.keys(c.states), ['w1']);
  assert.deepStrictEqual([c.states.w1.ease, c.states.w1.interval, c.states.w1.reps], [3, 365, 0]);
  assert.deepStrictEqual(c.custom, [{ id: 'c1', es: 'a b', en: 'x' }]);
  assert.deepStrictEqual(S.sanitizeCards(c), c);
});
test('export: the email, online mode counter and unknown keys never appear', () => {
  const out = S.buildExport(Object.assign(sample(), { online: { day: 1, used: 4000 } }), '2026-01-01T00:00:00.000Z');
  const text = JSON.stringify(out);
  assert.ok(!text.includes('example.invalid'));
  assert.ok(!text.includes('"email"'));
  assert.ok(!text.includes('4000'));
  assert.deepStrictEqual(Object.keys(out.data), ['settings', 'progress', 'cards', 'mistakes', 'calendar', 'daily']);
  assert.strictEqual(out.app, 'hablemos');
  assert.strictEqual(out.schema, 1);
});
test('export -> import -> export is identical apart from exportedAt', () => {
  const a = S.buildExport(sample(), '2026-01-01T00:00:00.000Z');
  const text = JSON.stringify(a, null, 2);
  const r = S.parseImport(text);
  assert.strictEqual(r.ok, true);
  const b = S.buildExport(r.data, '2026-02-02T00:00:00.000Z');
  b.exportedAt = a.exportedAt;
  assert.strictEqual(JSON.stringify(b, null, 2), text);
  assert.strictEqual(r.data.progress.xp, 345);
  assert.strictEqual(r.data.cards.custom[0].es, 'hola');
});
test('import: rejects bad input and changes nothing', () => {
  assert.match(S.parseImport('not json').error, /not valid JSON/);
  assert.match(S.parseImport('{}').error, /not a Hablemos/);
  assert.match(S.parseImport(JSON.stringify({ app: 'hablemos', schema: 2, data: {} })).error, /version/);
  assert.match(S.parseImport(JSON.stringify({ app: 'hablemos', schema: 1 })).error, /no data/);
  assert.match(S.parseImport('x'.repeat(S.MAX_IMPORT_BYTES + 1)).error, /1 MB/);
  assert.strictEqual(S.parseImport(null).ok, false);
  const clamp = S.parseImport(JSON.stringify({ app: 'hablemos', schema: 1, data: { progress: { xp: 'many', streak: 1e12 }, settings: { email: EMAIL, __proto__: { x: 1 } }, extra: { a: 1 } } }));
  assert.strictEqual(clamp.ok, true);
  assert.strictEqual(clamp.data.progress.xp, 0);
  assert.ok(!('extra' in clamp.data));
  assert.ok(!JSON.stringify(clamp.data).includes('example.invalid'));
});
test('import: apply replaces data but keeps the on-device email', () => {
  const st = S.createStore(fakeStorage());
  st.set('settings', Object.assign({}, S.DEFAULT_SETTINGS, { email: EMAIL }));
  st.set('progress', Object.assign(P.defaults(), { xp: 5 }));
  const imp = S.parseImport(JSON.stringify(S.buildExport(sample(), 'x')));
  S.applyImport(st, imp.data);
  assert.strictEqual(st.get('progress', null).xp, 345);
  assert.strictEqual(st.get('settings', null).email, EMAIL);
  assert.strictEqual(st.get('settings', null).theme, 'dark');
  assert.strictEqual(st.get('v', 0), 1);
});
test('snapshot reads every exported key', () => {
  const st = S.createStore(fakeStorage());
  st.set('progress', P.defaults());
  const snap = S.snapshot(st);
  assert.deepStrictEqual(Object.keys(snap), ['settings', 'progress', 'cards', 'mistakes', 'calendar', 'daily']);
});
