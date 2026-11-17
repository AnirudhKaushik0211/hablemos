(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module && module.exports;
  var deps = isNode ? { rng: require('./rng.js'), quiz: require('./quiz.js'), words: require('../data/words.js') } : { rng: root.Hablemos.rng, quiz: root.Hablemos.quiz, words: root.Hablemos.data.words };
  var api = factory(deps);
  if (isNode) module.exports = api;
  else { root.Hablemos = root.Hablemos || {}; root.Hablemos.daily = api; }
})(typeof self !== 'undefined' ? self : this, function (deps) {
  'use strict';
  function wordOfTheDay(dateStr) { return deps.words[deps.rng.fnv1a('wotd:' + dateStr) % deps.words.length]; }
  function dailyChallenge(dateStr, opts) { return deps.quiz.daily(dateStr, opts); }
  return { wordOfTheDay: wordOfTheDay, dailyChallenge: dailyChallenge };
});
