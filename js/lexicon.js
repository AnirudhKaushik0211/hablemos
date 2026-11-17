(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module && module.exports;
  var deps = isNode ? {
    nouns: require('./nouns.js'), conj: require('./conj.js'),
    words: require('../data/words.js'), phrases: require('../data/phrases.js'), entext: require('../data/entext.js')
  } : {
    nouns: root.Hablemos.nouns, conj: root.Hablemos.conj,
    words: root.Hablemos.data.words, phrases: root.Hablemos.data.phrases, entext: root.Hablemos.data.entext
  };
  var api = factory(deps);
  if (isNode) module.exports = api;
  else { root.Hablemos = root.Hablemos || {}; root.Hablemos.lexicon = api; }
})(typeof self !== 'undefined' ? self : this, function (deps) {
  'use strict';

  var nouns = deps.nouns, conj = deps.conj, WORDS = deps.words, PHRASES = deps.phrases, EN = deps.entext;
  var TIER_RANK = { A1: 0, A2: 1, B1: 2 };

  function strip(s) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC'); }
  function normEs(s) {
    return strip(String(s).normalize('NFC').toLowerCase()).replace(/[¿?¡!.,;:"“”()]/g, '').replace(/\s+/g, ' ').trim();
  }
  function normEn(s) {
    return String(s).normalize('NFC').toLowerCase().replace(/[.,;:!?"“”()]/g, '').replace(/\s+/g, ' ').trim();
  }

  // ---- surface forms of an entry (used by the data-integrity test and reverse lookup) ----
  function variantEntries(entry) {
    var list = [{ es: entry.es, g: entry.g }];
    if (entry.var) {
      Object.keys(entry.var).forEach(function (k) {
        var v = entry.var[k];
        list.push({ es: v.es, g: v.g || entry.g });
      });
    }
    return list;
  }

  function forms(entry) {
    var out = [];
    function add(f) { if (f && out.indexOf(f) < 0) out.push(f); }
    if (entry.pos === 'verb') {
      conj.allForms(entry.es).forEach(add);
      add(entry.es);
      return out;
    }
    variantEntries(entry).forEach(function (v) {
      var e = { es: v.es, pl: entry.pl, fem: entry.fem, inv: entry.inv, art: entry.art, g: v.g };
      if (entry.pos === 'noun') {
        add(v.es);
        add(nouns.nounForm({ es: v.es, g: v.g, pl: v.es === entry.es ? entry.pl : undefined, fem: entry.fem }, 'pl'));
        if (entry.fem) {
          add(entry.fem);
          add(nouns.nounForm({ es: entry.fem, g: 'f' }, 'pl'));
        }
        if (entry.g === 'mf' || entry.fem) {
          add(nouns.pluralize(v.es));
        }
      } else if (entry.pos === 'adj' || entry.pos === 'num') {
        ['m', 'f'].forEach(function (g) {
          ['sg', 'pl'].forEach(function (n) {
            add(nouns.agree(e, g, n));
            add(nouns.agree(e, g, n, { beforeNoun: true }));
          });
        });
        if (entry.pl) add(entry.pl);
      } else {
        add(v.es);
      }
    });
    if (entry.forms) entry.forms.forEach(add);
    if (entry.pos === 'det' && entry.forms) entry.forms.forEach(add);
    if (entry.pos === 'det') {
      ['m', 'f'].forEach(function (g) { ['sg', 'pl'].forEach(function (n) { add(nouns.det(entry.es, g, n)); }); });
    }
    if (entry.pos === 'noun' && entry.pers === undefined && entry.art === 'el') add('las ' + entry.es);
    return out;
  }

  // ---- English-side index ----
  var EN_INDEX = {};
  function addEn(key, entry, rank) {
    key = normEn(key);
    if (!key || /\(/.test(key)) return;
    (EN_INDEX[key] = EN_INDEX[key] || []).push({ entry: entry, rank: rank });
  }
  WORDS.forEach(function (w, i) {
    var base = TIER_RANK[w.tier] * 1000 + i;
    addEn(w.en, w, base);
    (w.en2 || []).forEach(function (x) { addEn(x, w, 10000 + base); });
  });
  Object.keys(EN_INDEX).forEach(function (k) {
    EN_INDEX[k].sort(function (a, b) { return a.rank - b.rank; });
  });

  function enLookup(key) {
    var l = EN_INDEX[normEn(key)];
    return l ? l.map(function (x) { return x.entry; }) : [];
  }

  // phrases indexed by canonical English (and alias en2), whole-sentence match
  var PHRASE_INDEX = {};
  PHRASES.forEach(function (p) {
    var k = normEn(p.en.replace(/\s*\((formal)\)\s*/, ' '));
    if (/\(/.test(p.en)) return;
    if (!PHRASE_INDEX[k]) PHRASE_INDEX[k] = p;
    (p.en2 || []).forEach(function (a) { var kk = normEn(a); if (!PHRASE_INDEX[kk]) PHRASE_INDEX[kk] = p; });
  });
  function phraseLookup(en) { return PHRASE_INDEX[normEn(en)] || null; }

  // ---- Spanish-side index for reverse lookup ----
  var ES_INDEX = null;
  function buildEsIndex() {
    ES_INDEX = {};
    function put(f, rec) {
      var k = normEs(f);
      (ES_INDEX[k] = ES_INDEX[k] || []).push(rec);
    }
    WORDS.forEach(function (w) {
      if (w.pos === 'verb') {
        var core = conj.coreOf(w.es);
        put(w.es, { kind: 'word', entry: w, form: w.es, exact: w.es });
        var names = { pres: 'present', pret: 'preterite', impf: 'imperfect', fut: 'future', cmd: 'command' };
        ['pres', 'pret', 'impf', 'fut', 'cmd'].forEach(function (t) {
          var arr = conj.conjugate(w.es, t) || [];
          var persons = t === 'cmd' ? conj.CMD_PERSONS : conj.PERSONS;
          arr.forEach(function (f, i) { put(f, { kind: 'conj', entry: w, form: f, exact: f, tense: names[t], person: persons[i] }); });
        });
        put(conj.gerund(w.es), { kind: 'conj', entry: w, form: conj.gerund(w.es), exact: conj.gerund(w.es), tense: 'gerund', person: '' });
        put(conj.participle(w.es), { kind: 'conj', entry: w, form: conj.participle(w.es), exact: conj.participle(w.es), tense: 'past participle', person: '' });
        void core;
      } else {
        forms(w).forEach(function (f) { put(f, { kind: 'word', entry: w, form: f, exact: f }); });
      }
    });
    PHRASES.forEach(function (p) {
      put(p.es, { kind: 'phrase', phrase: p, form: p.es, exact: p.es });
      if (p.var) Object.keys(p.var).forEach(function (k) { put(p.var[k], { kind: 'phrase', phrase: p, form: p.var[k], exact: p.var[k] }); });
    });
  }
  function esLookup(text) {
    if (!ES_INDEX) buildEsIndex();
    return ES_INDEX[normEs(text)] || [];
  }

  // resolve a word entry for the variant: returns { es, g }
  function resolve(entry, variant) {
    if (entry.var && entry.var[variant]) {
      var v = entry.var[variant];
      return { es: v.es, g: v.g || entry.g };
    }
    // when only the other variant is defined, the base form is used for this variant
    return { es: entry.es, g: entry.g };
  }

  function phraseEs(p, variant) {
    if (p.var && p.var[variant]) return p.var[variant];
    return p.es;
  }

  // English lemmatiser. Returns candidates: [{ lemma, form }] where form in base|pl|3sg|ing|past|comp
  function lemmas(tok) {
    var out = [];
    function add(lemma, form) {
      for (var i = 0; i < out.length; i++) if (out[i].lemma === lemma && out[i].form === form) return;
      out.push({ lemma: lemma, form: form });
    }
    if (EN_INDEX[tok]) add(tok, 'base');
    if (EN.irregularVerbs[tok]) {
      var iv = EN.irregularVerbs[tok];
      add(iv[0], iv[1].replace('?', ''));
      if (/\?$/.test(iv[1]) && EN_INDEX[tok]) add(tok, 'base');
    }
    if (EN.irregularPlurals[tok]) add(EN.irregularPlurals[tok], 'pl');
    var m;
    if (/ies$/.test(tok) && tok.length > 4) { add(tok.slice(0, -3) + 'y', 'pl'); add(tok.slice(0, -3) + 'y', '3sg'); }
    if (/ves$/.test(tok)) { add(tok.slice(0, -3) + 'f', 'pl'); add(tok.slice(0, -3) + 'fe', 'pl'); }
    if (/(s|x|z|ch|sh|o)es$/.test(tok)) { add(tok.slice(0, -2), 'pl'); add(tok.slice(0, -2), '3sg'); }
    if (/s$/.test(tok) && !/ss$/.test(tok)) { add(tok.slice(0, -1), 'pl'); add(tok.slice(0, -1), '3sg'); }
    if (/ing$/.test(tok) && tok.length > 4) {
      var st = tok.slice(0, -3);
      add(st, 'ing'); add(st + 'e', 'ing');
      if (/(.)\1$/.test(st)) add(st.slice(0, -1), 'ing');
      if (/y$/.test(st) === false && /ie$/.test(st + 'e')) { /* dying */ }
    }
    if (/ed$/.test(tok) && tok.length > 3) {
      m = tok.slice(0, -2);
      add(m, 'past'); add(m + 'e', 'past'); add(tok.slice(0, -1), 'past');
      if (/(.)\1$/.test(m)) add(m.slice(0, -1), 'past');
      if (/ied$/.test(tok)) add(tok.slice(0, -3) + 'y', 'past');
    }
    if (/(er|est)$/.test(tok) && tok.length > 4) { add(tok.replace(/(er|est)$/, ''), 'comp'); }
    return out.filter(function (c) {
      return EN_INDEX[c.lemma] || c.lemma === 'be' || c.lemma === 'have' || c.lemma === 'do' || c.lemma === 'go';
    });
  }

  function wordsByEs(es) { return WORDS.filter(function (w) { return w.es === es; }); }

  return {
    words: WORDS,
    phrases: PHRASES,
    entext: EN,
    normEs: normEs,
    normEn: normEn,
    strip: strip,
    forms: forms,
    enLookup: enLookup,
    phraseLookup: phraseLookup,
    esLookup: esLookup,
    resolve: resolve,
    phraseEs: phraseEs,
    lemmas: lemmas,
    wordsByEs: wordsByEs,
    variantEntries: variantEntries
  };
});
