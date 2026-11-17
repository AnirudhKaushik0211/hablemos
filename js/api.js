(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module && module.exports;
  var deps = isNode ? {
    util: require('./util.js'), rng: require('./rng.js'), store: require('./store.js'), nouns: require('./nouns.js'), numbers: require('./numbers.js'),
    conj: require('./conj.js'), lexicon: require('./lexicon.js'), curated: require('./curated.js'), reverse: require('./reverse.js'),
    online: require('./online.js'), srs: require('./srs.js'), progress: require('./progress.js'), quiz: require('./quiz.js'),
    scenario: require('./scenario.js'), daily: require('./daily.js'),
    data: {
      words: require('../data/words.js'), phrases: require('../data/phrases.js'), verbs: require('../data/verbs.js'),
      falsefriends: require('../data/falsefriends.js'), idioms: require('../data/idioms.js'), pronunciation: require('../data/pronunciation.js'),
      scenarios: require('../data/scenarios.js'), why: require('../data/why.js')
    }
  } : {
    util: root.Hablemos.util, rng: root.Hablemos.rng, store: root.Hablemos.store, nouns: root.Hablemos.nouns, numbers: root.Hablemos.numbers,
    conj: root.Hablemos.conj, lexicon: root.Hablemos.lexicon, curated: root.Hablemos.curated, reverse: root.Hablemos.reverse,
    online: root.Hablemos.online, srs: root.Hablemos.srs, progress: root.Hablemos.progress, quiz: root.Hablemos.quiz,
    scenario: root.Hablemos.scenario, daily: root.Hablemos.daily, data: root.Hablemos.data
  };
  var api = factory(deps);
  if (isNode) module.exports = api;
  else { root.Hablemos = root.Hablemos || {}; root.Hablemos.api = api; }
})(typeof self !== 'undefined' ? self : this, function (d) {
  'use strict';
  // Set to false (and remove the CSP meta tag from index.html) only if a browser blocks the app's own files under file://.
  var CSP_META = true;
  var VERSION = '1.0.0';

  return {
    CSP_META: CSP_META, VERSION: VERSION,
    curatedLookup: function (text, variant) { return d.curated.lookup(text, variant); },
    reverseLookup: function (text, variant) { return d.reverse.lookup(text, variant); },
    conjugate: function (inf, tense) { return d.conj.conjugate(inf, tense); },
    pluralize: function (w, override) { return d.nouns.pluralize(w, override); },
    agree: function () { return d.nouns.agree.apply(d.nouns, arguments); },
    numberToWords: function (n, opts) { return d.numbers.toWords(n, opts); },
    rate: function (state, rating, today) { return d.srs.rate(state, rating, today); },
    makeQuiz: function (type, opts) { var o = opts || {}; return d.quiz.make(type, o.seed === undefined ? 1 : o.seed, o); },
    dailyChallenge: function (date) { return d.daily.dailyChallenge(date); },
    wordOfTheDay: function (date) { return d.daily.wordOfTheDay(date); },
    buildOnlineRequest: function (text, email) { return d.online.buildRequest(text, email); },
    parseOnlineResponse: function (json) { return d.online.parseResponse(json); },
    data: d.data
  };
});
