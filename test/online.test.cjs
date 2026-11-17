'use strict';
const test = require('node:test');
const assert = require('node:assert');
const O = require('../js/online.js');
const A = require('../js/api.js');

const EMAIL = 'user@example.invalid';

test('online: constants match the owner decision', () => {
  assert.strictEqual(O.ONLINE_ORIGIN, 'https://api.mymemory.translated.net');
  assert.strictEqual(O.LIMIT_ANON, 5000);
  assert.strictEqual(O.LIMIT_EMAIL, 50000);
  assert.ok(O.CHUNK_CHARS <= 200);
});
test('online: request builder without and with the de parameter', () => {
  const a = O.buildRequest('I want two coffees', '');
  assert.strictEqual(a.method, 'GET');
  assert.strictEqual(a.url, 'https://api.mymemory.translated.net/get?q=I%20want%20two%20coffees&langpair=en%7Ces');
  const b = O.buildRequest('Hello, friend & co', EMAIL);
  assert.ok(b.url.startsWith('https://api.mymemory.translated.net/get?q=Hello%2C%20friend%20%26%20co&langpair=en%7Ces&de='));
  assert.ok(b.url.endsWith('&de=user%40example.invalid'));
  assert.ok(!O.buildRequest('x', 'not an email').url.includes('de='));
  assert.ok(!O.buildRequest('x', undefined).url.includes('de='));
  assert.strictEqual(A.buildOnlineRequest('hi', '').url, O.buildRequest('hi', '').url);
});
test('online: request builder rejects empty and over-long text', () => {
  assert.throws(() => O.buildRequest('', ''), RangeError);
  assert.throws(() => O.buildRequest('   ', ''), RangeError);
  assert.throws(() => O.buildRequest('a'.repeat(501), ''), RangeError);
  assert.doesNotThrow(() => O.buildRequest('a'.repeat(500), ''));
  assert.throws(() => O.buildRequest(42, ''), RangeError);
});
test('online: email validation', () => {
  for (const ok of [EMAIL, 'a.b+c@sub.example.invalid']) assert.strictEqual(O.validEmail(ok), true, ok);
  for (const bad of ['', 'a', 'a@b', 'a b@c.d', '@x.y', 'a@@x.y', 'a@x..y', 'a@.x.y', 'a'.repeat(250) + '@x.y', null, 5]) assert.strictEqual(O.validEmail(bad), false, String(bad));
});
const good = { responseData: { translatedText: 'Quiero dos caf&eacute;s &amp; &quot;t&eacute;&quot;', match: 0.93 }, responseStatus: 200, matches: [] };
test('online: parser reads a good response and decodes entities', () => {
  const r = O.parseResponse({ responseData: { translatedText: 'Dijo &quot;hola&quot; &amp; &#39;adi&oacute;s&#39; &lt;3 &gt;', match: 0.93 }, responseStatus: 200 });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.text, 'Dijo "hola" & \'adi&oacute;s\' <3 >');
  assert.strictEqual(r.match, 0.93);
  assert.strictEqual(r.lowConfidence, false);
  assert.strictEqual(O.parseResponse(Object.assign({}, good, { responseStatus: '200' })).ok, true);
});
test('online: low match gives the low-confidence flag; quality fallback; none means no badge', () => {
  assert.strictEqual(O.parseResponse({ responseData: { translatedText: 'x', match: 0.3 }, responseStatus: 200 }).lowConfidence, true);
  assert.strictEqual(O.parseResponse({ responseData: { translatedText: 'x', match: 0.5 }, responseStatus: 200 }).lowConfidence, false);
  assert.strictEqual(O.parseResponse({ responseData: { translatedText: 'x' }, responseStatus: 200, matches: [{ quality: '30' }, { quality: 40 }] }).lowConfidence, true);
  assert.strictEqual(O.parseResponse({ responseData: { translatedText: 'x' }, responseStatus: 200, matches: [{ quality: '74' }] }).lowConfidence, false);
  const none = O.parseResponse({ responseData: { translatedText: 'x' }, responseStatus: 200 });
  assert.strictEqual(none.lowConfidence, false);
  assert.strictEqual(none.match, null);
  assert.strictEqual(O.parseResponse({ responseData: { translatedText: 'x', match: 7 }, responseStatus: 200 }).match, null);
});
test('online: quota, rate limit, too long, error and malformed responses', () => {
  assert.deepStrictEqual(O.parseResponse({ responseStatus: 429, responseData: {} }), { ok: false, reason: 'rate_limited' });
  assert.strictEqual(O.parseResponse({ responseStatus: 403, responseDetails: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN 05 HOURS', responseData: { translatedText: 'MYMEMORY WARNING: ...' } }).reason, 'quota');
  assert.strictEqual(O.parseResponse({ responseStatus: 200, responseData: { translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY.' } }).reason, 'quota');
  assert.strictEqual(O.parseResponse({ responseStatus: 403, responseDetails: 'QUERY LENGTH LIMIT EXCEEDED. MAX 500 CHARS ALLOWED' }).reason, 'too_long');
  assert.strictEqual(O.parseResponse({ responseStatus: 500, responseDetails: 'internal error' }).reason, 'bad_response');
  for (const bad of [null, undefined, 'text', 5, [], {}, { responseStatus: 200 }, { responseStatus: 200, responseData: {} }, { responseStatus: 200, responseData: { translatedText: '  ' } }, { responseStatus: 200, responseData: { translatedText: 5 } }]) {
    assert.strictEqual(O.parseResponse(bad).ok, false, JSON.stringify(bad));
    assert.strictEqual(O.parseResponse(bad).reason, 'bad_response');
  }
  assert.strictEqual(A.parseOnlineResponse(good).ok, true);
});
test('online counter: remaining, limit switch with email, boundary, day rollover', () => {
  assert.strictEqual(O.remaining(null, 10, false), 5000);
  let rec = O.add(null, 10, 1200);
  assert.deepStrictEqual(rec, { day: 10, used: 1200 });
  assert.strictEqual(O.remaining(rec, 10, false), 3800);
  assert.strictEqual(O.remaining(rec, 10, true), 48800);
  assert.strictEqual(O.canSend(rec, 10, false, 3800), true);
  assert.strictEqual(O.canSend(rec, 10, false, 3801), false);
  assert.strictEqual(O.canSend(rec, 10, true, 3801), true);
  assert.strictEqual(O.remaining(rec, 11, false), 5000);
  assert.deepStrictEqual(O.add(rec, 11, 5), { day: 11, used: 5 });
  rec = O.add(rec, 10, 3800);
  assert.strictEqual(O.remaining(rec, 10, false), 0);
  assert.strictEqual(O.canSend(rec, 10, false, 1), false);
  assert.strictEqual(O.remaining({ day: 10, used: 'x' }, 10, false), 5000);
  assert.strictEqual(O.limitFor(true), 50000);
  assert.strictEqual(O.limitFor(false), 5000);
});
test('online chunking: sentence packing, round trip, long sentences, limits', () => {
  assert.deepStrictEqual(O.chunk('  '), []);
  assert.deepStrictEqual(O.chunk('I want coffee.'), ['I want coffee.']);
  const text = 'I want two coffees. Where is the bathroom? My brother has a red car! We are going to eat now; then we will walk home. ' + 'This is another sentence with more words in it. '.repeat(6);
  const chunks = O.chunk(text);
  assert.ok(chunks.length > 1);
  chunks.forEach((c) => assert.ok(c.length <= O.CHUNK_CHARS, c.length));
  assert.strictEqual(chunks.join(' '), text.replace(/\s+/g, ' ').trim());
  const long = 'word '.repeat(120).trim();
  const lc = O.chunk(long);
  assert.ok(lc.every((c) => c.length <= O.CHUNK_CHARS));
  assert.strictEqual(lc.join(' '), long);
  const commas = ('alpha beta gamma delta epsilon, ').repeat(12).trim();
  const cc = O.chunk(commas);
  assert.ok(cc.every((c) => c.length <= O.CHUNK_CHARS));
  assert.strictEqual(cc.join(' '), commas);
  assert.strictEqual(O.chunk('a'.repeat(350)).length, 2);
});
test('online chunking: splitHalf respects the minimum half size', () => {
  const s = 'this sentence has enough words to be split into two reasonable halves right here and then some more words follow';
  const h = O.splitHalf(s);
  assert.ok(h && h.length === 2 && h[0].length >= O.CHUNK_MIN && h[1].length >= O.CHUNK_MIN);
  assert.strictEqual(h.join(' '), s);
  assert.strictEqual(O.splitHalf('too short to split here'), null);
  assert.strictEqual(O.splitHalf('x'.repeat(200)), null);
});
test('online wordDiff: identical, substitution, insertion, empty, punctuation and case', () => {
  const same = O.wordDiff('Quiero dos cafés.', 'quiero dos cafés');
  assert.ok(same.a.every((t) => t.same) && same.b.every((t) => t.same));
  const sub = O.wordDiff('Quiero dos cafés', 'Quiero tres cafés');
  assert.deepStrictEqual(sub.a.map((t) => t.same), [true, false, true]);
  assert.deepStrictEqual(sub.b.map((t) => t.same), [true, false, true]);
  const ins = O.wordDiff('Quiero dos cafés', 'Yo quiero dos cafés');
  assert.deepStrictEqual(ins.a.map((t) => t.same), [true, true, true]);
  assert.deepStrictEqual(ins.b.map((t) => t.same), [false, true, true, true]);
  assert.deepStrictEqual(O.wordDiff('', ''), { a: [], b: [] });
  assert.deepStrictEqual(O.wordDiff('', 'hola').b, [{ text: 'hola', same: false }]);
  assert.strictEqual(O.wordDiff('café', 'cafe').a[0].same, false);
});
function ctxWith(responses, used) {
  const urls = [];
  return {
    urls, usedLog: used,
    email: '', consent: true,
    getJson: async (url) => { urls.push(url); const r = responses.shift(); if (r instanceof Error) throw { reason: r.message }; return typeof r === 'function' ? r(url) : r; },
    onUsed: (n) => used.push(n)
  };
}
const okJson = (t, m) => ({ responseStatus: 200, responseData: { translatedText: t, match: m === undefined ? 0.9 : m } });
test('online translateText: sequential chunks reassembled in order and usage counted per chunk', async () => {
  const text = 'First sentence is here. ' + 'Second sentence is a little longer than the first one is. '.repeat(4) + 'Last one.';
  const chunks = O.chunk(text);
  assert.ok(chunks.length >= 2);
  const used = [];
  const ctx = ctxWith(chunks.map((c, i) => okJson('T' + i)), used);
  const r = await O.translateText(text, ctx);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.text, chunks.map((c, i) => 'T' + i).join(' '));
  assert.deepStrictEqual(used, chunks.map((c) => c.length));
  assert.strictEqual(ctx.urls.length, chunks.length);
});
test('online translateText: low confidence is reported; the email goes only into de', async () => {
  const used = [];
  const ctx = ctxWith([okJson('x', 0.1)], used);
  ctx.email = EMAIL;
  const r = await O.translateText('Hello there', ctx);
  assert.strictEqual(r.lowConfidence, true);
  assert.ok(ctx.urls[0].endsWith('&de=user%40example.invalid'));
  assert.ok(!ctx.urls[0].slice(0, ctx.urls[0].indexOf('&de=')).includes('example'));
});
test('online translateText: too_long splits the chunk in halves and retries', async () => {
  const s = 'this sentence has enough words to be split into two reasonable halves right here and then some more words follow';
  const used = [];
  const ctx = ctxWith([{ responseStatus: 403, responseDetails: 'QUERY LENGTH LIMIT EXCEEDED. MAX 500 CHARS ALLOWED' }, okJson('A'), okJson('B')], used);
  const r = await O.translateText(s, ctx);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.text, 'A B');
  assert.strictEqual(ctx.urls.length, 3);
  assert.strictEqual(used.length, 2);
});
test('online translateText: failures stop the sequence, keep earlier usage, and report the reason', async () => {
  const text = 'One sentence here. ' + 'Another fairly long sentence goes here to fill a chunk. '.repeat(6);
  const used = [];
  const ctx = ctxWith([okJson('A'), { responseStatus: 429 }], used);
  const r = await O.translateText(text, ctx);
  assert.deepStrictEqual([r.ok, r.reason, r.partial], [false, 'rate_limited', 'A']);
  assert.strictEqual(used.length, 1);
  const r2 = await O.translateText('Hello there', ctxWith([new Error('offline')], []));
  assert.strictEqual(r2.reason, 'offline');
  const r3 = await O.translateText('Hello there', ctxWith([null], []));
  assert.strictEqual(r3.reason, 'bad_response');
  const r4 = await O.translateText('x'.repeat(10), ctxWith([{ responseStatus: 403, responseDetails: 'QUERY LENGTH LIMIT EXCEEDED' }], []));
  assert.strictEqual(r4.reason, 'too_long');
  Object.keys(O.REASON_TEXT).forEach((k) => assert.ok(/does not generate Spanish|nothing was sent|Nothing was sent/i.test(O.REASON_TEXT[k]), k));
});

