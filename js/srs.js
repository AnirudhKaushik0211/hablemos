(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module && module.exports;
  var api = factory();
  if (isNode) module.exports = api;
  else { root.Hablemos = root.Hablemos || {}; root.Hablemos.srs = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var EASE_MIN = 1.3, EASE_MAX = 3.0, EASE_START = 2.5, MAX_INTERVAL = 365, REVIEWS_PER_DAY = 100, REQUEUE_AFTER = 4;
  var RATINGS = ['again', 'hard', 'good', 'easy'];

  function newState(id) { return { id: id, ease: EASE_START, interval: 0, reps: 0, lapses: 0, due: 0, last: 0 }; }
  function round2(x) { return Math.round(x * 100) / 100; }
  function clampEase(e) { return round2(Math.max(EASE_MIN, Math.min(EASE_MAX, e))); }

  // Pure: rate(state, rating, today) -> new state
  function rate(state, rating, today) {
    var s = { id: state.id, ease: state.ease, interval: state.interval, reps: state.reps, lapses: state.lapses, due: state.due, last: state.last };
    var interval;
    if (rating === 'again') {
      s.reps = 0; s.lapses += 1; s.ease = clampEase(s.ease - 0.20); interval = 0;
    } else if (rating === 'hard') {
      s.ease = clampEase(s.ease - 0.15); interval = Math.max(1, Math.round(s.interval * 1.2));
    } else if (rating === 'good') {
      s.reps += 1;
      interval = s.reps === 1 ? 1 : (s.reps === 2 ? 3 : Math.round(s.interval * s.ease));
    } else if (rating === 'easy') {
      s.reps += 1;
      interval = s.reps === 1 ? 4 : (s.reps === 2 ? 7 : Math.round(s.interval * s.ease * 1.3));
      s.ease = clampEase(s.ease + 0.15);
    } else {
      throw new RangeError('Unknown rating: ' + rating);
    }
    s.interval = Math.min(MAX_INTERVAL, interval);
    s.due = today + s.interval;
    s.last = today;
    return s;
  }

  function isDue(state, today) { return !!state && state.due <= today && state.last > 0; }

  // Build a session queue. ids: deck order. states: map id -> state. newAllowed: how many new cards may still be introduced today.
  function buildQueue(ids, states, today, opts) {
    var o = opts || {};
    var newAllowed = typeof o.newAllowed === 'number' ? o.newAllowed : 10;
    var reviewLimit = typeof o.reviewLimit === 'number' ? o.reviewLimit : REVIEWS_PER_DAY;
    var due = [], fresh = [];
    ids.forEach(function (id) {
      var s = states[id];
      if (!s || !s.last) fresh.push(id);
      else if (s.due <= today) due.push(s);
    });
    due.sort(function (a, b) { return a.due - b.due || (a.id < b.id ? -1 : 1); });
    var q = due.slice(0, reviewLimit).map(function (s) { return s.id; });
    return q.concat(fresh.slice(0, Math.max(0, newAllowed)));
  }

  // After "Again" the card returns in the same session after 4 other cards.
  function requeue(queue, id) {
    var q = queue.slice();
    q.splice(Math.min(REQUEUE_AFTER, q.length), 0, id);
    return q;
  }

  return {
    EASE_MIN: EASE_MIN, EASE_MAX: EASE_MAX, EASE_START: EASE_START, MAX_INTERVAL: MAX_INTERVAL,
    REVIEWS_PER_DAY: REVIEWS_PER_DAY, REQUEUE_AFTER: REQUEUE_AFTER, RATINGS: RATINGS,
    newState: newState, rate: rate, isDue: isDue, buildQueue: buildQueue, requeue: requeue
  };
});
