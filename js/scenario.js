(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module && module.exports;
  var deps = isNode ? { util: require('./util.js') } : { util: root.Hablemos.util };
  var api = factory(deps);
  if (isNode) module.exports = api;
  else { root.Hablemos = root.Hablemos || {}; root.Hablemos.scenario = api; }
})(typeof self !== 'undefined' ? self : this, function (deps) {
  'use strict';
  var U = deps.util;
  var MAX_STEPS = 40;

  function stepOf(sc, id) {
    for (var i = 0; i < sc.steps.length; i++) if (sc.steps[i].id === id) return sc.steps[i];
    return null;
  }
  function begin(sc) { return { id: sc.id, step: sc.start, taken: 0, correct: 0, done: false, history: [] }; }
  function current(sc, state) { return state.done ? null : stepOf(sc, state.step); }

  function advance(sc, state, ok, choice, said, fb) {
    var step = stepOf(sc, state.step);
    var next = choice && choice.next ? choice.next : 'end';
    var taken = state.taken + 1;
    var done = next === 'end' || !stepOf(sc, next) || taken >= MAX_STEPS;
    return {
      state: {
        id: state.id, step: done ? state.step : next, taken: taken, correct: state.correct + (ok ? 1 : 0), done: done,
        history: state.history.concat([{ step: step.id, said: said, ok: ok }])
      },
      ok: ok, fb: fb
    };
  }

  // Pick one of the offered replies by index.
  function choose(sc, state, idx) {
    var step = current(sc, state);
    if (!step || typeof idx !== 'number' || idx < 0 || idx >= step.choices.length) return null;
    var c = step.choices[idx];
    return advance(sc, state, !!c.ok, c, c.es, c.fb || '');
  }

  // Type a reply. Accept normalised (accent-insensitive) answers from `accept` or any correct choice.
  function typed(sc, state, text) {
    var step = current(sc, state);
    if (!step) return null;
    var t = U.norm(text, true);
    if (!t) return { empty: true };
    var good = (step.accept || []).map(function (a) { return U.norm(a, true); });
    var okChoice = null;
    step.choices.forEach(function (c) { if (c.ok) { good.push(U.norm(c.es, true)); if (!okChoice) okChoice = c; } });
    var okAny = good.indexOf(t) >= 0;
    if (okAny) {
      var match = step.choices.filter(function (c) { return c.ok && U.norm(c.es, true) === t; })[0] || okChoice;
      return advance(sc, state, true, match, text, match.fb || 'Good reply.');
    }
    var wrong = step.choices.filter(function (c) { return !c.ok && U.norm(c.es, true) === t; })[0];
    if (wrong) return advance(sc, state, false, wrong, text, wrong.fb || '');
    var fallback = okChoice || step.choices[0];
    return advance(sc, state, false, fallback, text, 'Not quite. A good reply here is: ' + okChoice.es);
  }

  function score(state) { return { correct: state.correct, total: state.taken, pct: state.taken ? Math.round(100 * state.correct / state.taken) : 0 }; }
  function xpFor(state) { return 30 + 5 * state.correct; }

  // All reachable paths terminate at 'end' (no cycles through ok-only loops are required; any cycle is reported).
  function pathsTerminate(sc) {
    var seen = {};
    var ok = true;
    function walk(id, trail) {
      if (id === 'end') return;
      var s = stepOf(sc, id);
      if (!s) { ok = false; return; }
      if (trail.indexOf(id) >= 0) { ok = false; return; }
      if (seen[id]) return;
      seen[id] = 1;
      s.choices.forEach(function (c) { walk(c.next, trail.concat([id])); });
    }
    walk(sc.start, []);
    return ok;
  }

  return { begin: begin, current: current, choose: choose, typed: typed, score: score, xpFor: xpFor, stepOf: stepOf, pathsTerminate: pathsTerminate };
});
