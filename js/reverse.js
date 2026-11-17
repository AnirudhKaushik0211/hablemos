(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module && module.exports;
  var deps = isNode ? { lexicon: require('./lexicon.js'), conj: require('./conj.js') } : { lexicon: root.Hablemos.lexicon, conj: root.Hablemos.conj };
  var api = factory(deps);
  if (isNode) module.exports = api;
  else { root.Hablemos = root.Hablemos || {}; root.Hablemos.reverse = api; }
})(typeof self !== 'undefined' ? self : this, function (deps) {
  'use strict';

  var lex = deps.lexicon;
  var MAX_LEN = 200;

  function describe(rec, variant) {
    if (rec.kind === 'phrase') {
      var p = rec.phrase;
      return { kind: 'phrase', es: lex.phraseEs(p, variant), en: p.en, pos: 'phrase', g: null, note: p.note || '', id: p.id };
    }
    var w = rec.entry;
    var r = lex.resolve(w, variant);
    var g = w.g || null;
    if (rec.kind === 'word' && w.var && w.es !== rec.form) {
      Object.keys(w.var).forEach(function (k) {
        if (w.var[k] && w.var[k].es === rec.form && w.var[k].g) g = w.var[k].g;
      });
    }
    var out = { kind: rec.kind, es: rec.form, en: w.en, pos: w.pos, g: g, note: w.note || '', id: w.id };
    if (rec.kind === 'conj') {
      out.tense = rec.tense;
      out.person = rec.person;
      out.infinitive = w.es;
    }
    if (rec.kind === 'word' && r.es !== w.es && w.var && w.var[variant]) out.variantForm = r.es;
    return out;
  }

  // lookup(text, variant) -> { query, matches: [...], message }
  function lookup(text, variant) {
    var q = typeof text === 'string' ? text.normalize('NFC').trim() : '';
    var res = { query: q, matches: [], message: '' };
    if (!q) { res.message = 'Type a Spanish word or phrase to look up.'; return res; }
    if (q.length > MAX_LEN) { res.message = 'Text is too long for a lookup (limit ' + MAX_LEN + ' characters).'; return res; }
    var v = variant === 'es' ? 'es' : 'la';
    var seen = {};
    function add(list) {
      list.forEach(function (rec) {
        var d = describe(rec, v);
        var key = d.kind + '|' + d.id + '|' + d.es + '|' + (d.tense || '') + '|' + (d.person || '');
        if (seen[key]) return;
        seen[key] = 1;
        res.matches.push(d);
      });
    }
    var found = lex.esLookup(q);
    // exact-accent matches first
    found = found.slice().sort(function (a, b) {
      var ae = a.exact.toLowerCase() === q.toLowerCase() ? 0 : 1;
      var be = b.exact.toLowerCase() === q.toLowerCase() ? 0 : 1;
      if (ae !== be) return ae - be;
      var order = { phrase: 0, word: 1, conj: 2 };
      return order[a.kind] - order[b.kind];
    });
    add(found);
    if (!res.matches.length && /\s/.test(q)) {
      // not a known phrase: look up each word separately
      var parts = q.split(/\s+/).filter(Boolean);
      parts.forEach(function (p) { add(lex.esLookup(p).slice(0, 3)); });
    }
    if (!res.matches.length) res.message = 'Not in the dictionary. This is a lookup of known words and phrases, not a translator.';
    return res;
  }

  return { lookup: lookup, MAX_LEN: MAX_LEN };
});
