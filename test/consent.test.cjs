'use strict';
// Online-only translation: consent gate, no request without consent, curated-only fallback, CSP string.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const O = require('../js/online.js');
const C = require('../js/curated.js');
const lexicon = require('../js/lexicon.js');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const uiSrc = fs.readFileSync(path.join(ROOT, 'js', 'ui-translate.js'), 'utf8');
function mockCtx(consent, responses) {
  const urls = [];
  return {
    urls, consent, email: '', onUsed: () => {},
    getJson: async (url) => { urls.push(url); return responses.length ? responses.shift() : { responseStatus: 200, responseData: { translatedText: 'Hola', match: 0.9 } }; }
  };
}
test('consent: translateText sends nothing unless consent is exactly true', async () => {
  for (const c of [false, undefined, null, 'yes', 1, 'true']) {
    const ctx = mockCtx(c, []);
    const r = await O.translateText('Hello there', ctx);
    assert.deepStrictEqual([r.ok, r.reason], [false, 'no_consent']);
    assert.strictEqual(ctx.urls.length, 0, 'request made with consent=' + String(c));
  }
  const r0 = await O.translateText('Hello there', undefined);
  assert.strictEqual(r0.reason, 'no_consent');
});
test('consent: with consent true exactly one mocked request is made for a short text', async () => {
  const ctx = mockCtx(true, []);
  const r = await O.translateText('Hello there', ctx);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(ctx.urls.length, 1);
  assert.ok(ctx.urls[0].startsWith('https://api.mymemory.translated.net/get?q='));
});
test('consent: the UI checks the saved consent flag before calling the network and shows the dialog first', () => {
  const i = uiSrc.indexOf('async function doOnline');
  assert.ok(i > 0);
  const body = uiSrc.slice(i, uiSrc.indexOf('function consentDialog'));
  const gate = body.indexOf('!st.settings.online');
  const dlg = body.indexOf('consentDialog(');
  const send = body.indexOf('sendOnline(');
  assert.ok(gate > 0 && dlg > gate && send > dlg, 'consent dialog must come before the first send');
  assert.ok(/if \(!agreed\) \{ showFailure/.test(body), 'declining must not send');
  assert.ok(/consent: st\.settings\.online === true/.test(uiSrc));
  assert.ok(/third-party/.test(uiSrc) && /not guaranteed/.test(uiSrc));
});
test('fallback: when no request is possible the reasons all say nothing is generated and only exact matches are shown', () => {
  Object.keys(O.REASON_TEXT).forEach((k) => assert.ok(/Hablemos does not generate Spanish|Nothing was sent|nothing was sent/.test(O.REASON_TEXT[k]), k));
  ['rate_limited', 'quota', 'too_long', 'bad_response', 'offline', 'network', 'timeout', 'allowance', 'no_consent'].forEach((k) => assert.ok(O.REASON_TEXT[k], k));
});
test('fallback: curated lookup returns only strings from the data files, and nothing for unmatched text', () => {
  const none = C.lookup('I am going to eat a quokka on Thursday', 'la');
  assert.strictEqual(none.phrase, null);
  assert.deepStrictEqual(none.words, []);
  assert.ok(/does not generate Spanish/.test(none.message));
  assert.strictEqual(C.lookup('', 'la').words.length, 0);
  const allEs = new Set();
  lexicon.words.forEach((w) => lexicon.variantEntries(w).forEach((v) => allEs.add(v.es)));
  lexicon.phrases.forEach((p) => { allEs.add(p.es); Object.keys(p.var || {}).forEach((k) => allEs.add(p.var[k])); });
  const samples = ['house', 'to eat', 'coffee', 'water', 'thank you', 'good morning', 'where is the bathroom'];
  let hits = 0;
  samples.concat(lexicon.phrases.slice(0, 40).map((p) => p.en)).forEach((t) => {
    ['la', 'es'].forEach((v) => {
      const r = C.lookup(t, v);
      if (r.phrase) { hits++; assert.ok(allEs.has(r.phrase.es), 'phrase es not from data: ' + r.phrase.es); }
      r.words.forEach((w) => { hits++; assert.ok(allEs.has(w.es), 'word es not from data: ' + w.es); });
    });
  });
  assert.ok(hits > 10);
  // a sentence built from known words is NOT assembled
  const built = C.lookup('I want two coffees', 'la');
  assert.ok(!built.phrase || lexicon.phrases.some((p) => p.es === built.phrase.es));
  assert.strictEqual(built.words.length, 0);
});
test('fallback: no generator is left in the code base', () => {
  assert.ok(!fs.existsSync(path.join(ROOT, 'js', 'translate.js')));
  assert.ok(!/js\/translate\.js/.test(html));
  assert.ok(!/Hablemos\.translate\b|H\.translate\b|compare with offline/i.test(uiSrc));
});
test('csp: connect-src allows only the MyMemory origin and everything else stays strict', () => {
  const csp = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(html)[1];
  assert.strictEqual(csp, "default-src 'none'; script-src 'self' file:; style-src 'self' file:; img-src 'self' data: blob: file:; connect-src https://api.mymemory.translated.net; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; media-src 'none'");
  assert.strictEqual(/connect-src ([^;]*)/.exec(csp)[1], 'https://api.mymemory.translated.net');
  assert.ok(!/unsafe-|\*/.test(csp));
});
