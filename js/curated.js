(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module && module.exports;
  var deps = isNode ? { lexicon: require('./lexicon.js') } : { lexicon: root.Hablemos.lexicon };
  var api = factory(deps);
  if (isNode) module.exports = api;
  else { root.Hablemos = root.Hablemos || {}; root.Hablemos.curated = api; }
})(typeof self !== 'undefined' ? self : this, function (deps) {
  'use strict';
  // Exact-match lookup in the authored word list and phrase library. It never builds Spanish:
  // every string it returns was written by hand in data/words.js or data/phrases.js.
  var lex = deps.lexicon;
  var MAX_LEN = 200;
  var MAX_WORDS = 8;
  var NONE = 'No exact match in the built-in word list or phrase library. Hablemos does not generate Spanish by itself.';
  function lookup(text, variant) {
    var out = { phrase: null, words: [], message: '' };
    var t = typeof text === 'string' ? text.normalize('NFC').trim() : '';
    if (!t || t.length > MAX_LEN) { out.message = NONE; return out; }
    var p = lex.phraseLookup(t);
    if (p) out.phrase = { id: p.id, en: p.en, es: lex.phraseEs(p, variant), note: p.note || '' };
    var entries = lex.enLookup(t);
    if (!entries.length && /^to\s+/i.test(t)) entries = lex.enLookup(t.replace(/^to\s+/i, ''));
    entries.slice(0, MAX_WORDS).forEach(function (e) {
      var r = lex.resolve(e, variant);
      out.words.push({ en: e.en, es: r.es, g: r.g || null, pos: e.pos });
    });
    if (!out.phrase && !out.words.length) out.message = NONE;
    return out;
  }
  return { lookup: lookup, NONE: NONE, MAX_LEN: MAX_LEN };
});
