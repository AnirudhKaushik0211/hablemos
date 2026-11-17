(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module && module.exports;
  var deps = isNode ? { util: require('./util.js'), store: require('./store.js') } : { util: root.Hablemos.util, store: root.Hablemos.store };
  var api = factory(deps);
  if (isNode) module.exports = api;
  else { root.Hablemos = root.Hablemos || {}; root.Hablemos.progress = api; }
})(typeof self !== 'undefined' ? self : this, function (deps) {
  'use strict';
  var store = deps.store;
  var FLASH_XP = { again: 1, hard: 3, good: 5, easy: 6 };
  var FLASH_XP_CAP = 200;
  var MAX_LEVEL = 50;
  var MAX_MISTAKES = 200;

  var BADGES = [
    { id: 'first-card', name: 'First card', desc: 'Rate your first flashcard.' },
    { id: 'streak-7', name: '7-day streak', desc: 'Reach your daily goal 7 days in a row.' },
    { id: 'streak-30', name: '30-day streak', desc: 'Reach your daily goal 30 days in a row.' },
    { id: 'words-100', name: '100 words learned', desc: 'Mark 100 words as learned.' },
    { id: 'words-500', name: '500 words learned', desc: 'Mark 500 words as learned.' },
    { id: 'perfect-round', name: 'Perfect round', desc: 'Answer every question right in a round of 5 or more.' },
    { id: 'daily-7', name: 'Seven dailies', desc: 'Finish 7 daily challenges.' },
    { id: 'conj-50', name: 'Conjugation gym', desc: 'Get 50 conjugation answers right.' },
    { id: 'scenarios-4', name: 'Conversationalist', desc: 'Finish all four scenarios.' },
    { id: 'level-5', name: 'Level 5', desc: 'Reach level 5.' },
    { id: 'level-10', name: 'Level 10', desc: 'Reach level 10.' },
    { id: 'false-friend-10', name: 'Friend or foe', desc: 'Get 10 false-friend answers right.' }
  ];

  function defaults() { return store.sanitizeProgress({}); }
  function threshold(L) { return 50 * L * (L - 1); }
  function level(xp) {
    var L = 1;
    while (L < MAX_LEVEL && threshold(L + 1) <= xp) L++;
    return L;
  }
  function levelInfo(xp) {
    var L = level(xp);
    var lo = threshold(L), hi = L >= MAX_LEVEL ? lo : threshold(L + 1);
    return { level: L, into: xp - lo, span: hi - lo, next: hi };
  }
  function copy(p) { return JSON.parse(JSON.stringify(p)); }
  function addXp(p, n) { var q = copy(p); q.xp += Math.max(0, Math.floor(n)); return q; }

  var XP_QUIZ = { mc: 10, type: 15, conj: 15, unscramble: 15, match: 15, listen: 12 };
  function xpForAnswer(type) { return XP_QUIZ[type] || 10; }

  // Flashcard XP, capped per day. Returns { p, gained }.
  function awardFlash(p, rating, today) {
    var q = copy(p);
    if (q.flashXp.day !== today) q.flashXp = { day: today, xp: 0 };
    var gain = Math.min(FLASH_XP[rating] || 0, Math.max(0, FLASH_XP_CAP - q.flashXp.xp));
    q.flashXp.xp += gain;
    q.xp += gain;
    return { p: q, gained: gain };
  }

  function bump(p, key, n) {
    var q = copy(p);
    q.counters[key] = (q.counters[key] || 0) + (n === undefined ? 1 : n);
    return q;
  }

  // Count one unit of activity (flashcard rating or quiz answer) and update the streak when the goal is first met.
  // Returns { cal, p, goalReached }.
  function recordActivity(p, cal, today, goal) {
    var c = {};
    Object.keys(cal).forEach(function (k) { c[k] = cal[k]; });
    var before = c[String(today)] || 0;
    c[String(today)] = before + 1;
    var q = copy(p);
    var reached = false;
    if (before < goal && before + 1 >= goal) {
      reached = true;
      if (q.lastGoalDay === today) { /* unchanged */ }
      else if (q.lastGoalDay === today - 1) q.streak += 1;
      else q.streak = 1;
      q.lastGoalDay = today;
      if (q.streak > q.bestStreak) q.bestStreak = q.streak;
    }
    var keys = Object.keys(c).map(Number).sort(function (a, b) { return a - b; });
    var out = {};
    keys.slice(-400).forEach(function (k) { out[String(k)] = c[String(k)]; });
    return { cal: out, p: q, goalReached: reached };
  }

  function currentStreak(p, today) { return p.lastGoalDay >= today - 1 && p.lastGoalDay > 0 ? p.streak : 0; }

  function markLearned(p, id) {
    if (p.learned.indexOf(id) >= 0) return { p: p, gained: 0 };
    var q = copy(p);
    q.learned.push(id);
    q.xp += 2;
    return { p: q, gained: 2 };
  }
  function unmarkLearned(p, id) {
    var q = copy(p);
    q.learned = q.learned.filter(function (x) { return x !== id; });
    return q;
  }

  // Mistake notebook: wrong adds or bumps; 2 consecutive correct answers remove.
  function recordMistake(list, id, kind, today) {
    var out = list.map(function (m) { return { id: m.id, kind: m.kind, count: m.count, last: m.last, ok: m.ok }; });
    var found = null;
    out.forEach(function (m) { if (m.id === id) found = m; });
    if (found) { found.count += 1; found.last = today; found.ok = 0; }
    else {
      out.push({ id: id, kind: kind, count: 1, last: today, ok: 0 });
      if (out.length > MAX_MISTAKES) {
        out.sort(function (a, b) { return a.last - b.last; });
        out.shift();
      }
    }
    return out;
  }
  function recordCorrectOnMistake(list, id) {
    var out = [];
    list.forEach(function (m) {
      if (m.id !== id) { out.push(m); return; }
      var ok = m.ok + 1;
      if (ok < 2) out.push({ id: m.id, kind: m.kind, count: m.count, last: m.last, ok: ok });
    });
    return out;
  }

  // Which badges are newly earned? Returns { p, earned: [badge] } with the day recorded.
  function checkBadges(p, today) {
    var q = copy(p);
    var earned = [];
    var c = q.counters;
    var wordsLearned = q.learned.filter(function (id) { return id.charAt(0) === 'w'; }).length;
    var lvl = level(q.xp);
    var rules = {
      'first-card': (c.cardsRated || 0) >= 1,
      'streak-7': q.bestStreak >= 7,
      'streak-30': q.bestStreak >= 30,
      'words-100': wordsLearned >= 100,
      'words-500': wordsLearned >= 500,
      'perfect-round': (c.perfectRounds || 0) >= 1,
      'daily-7': (c.dailyDone || 0) >= 7,
      'conj-50': (c.conjCorrect || 0) >= 50,
      'scenarios-4': ['s-food', 's-directions', 's-hotel', 's-pharmacy'].every(function (id) { return (c['scen-' + id] || 0) >= 1; }),
      'level-5': lvl >= 5,
      'level-10': lvl >= 10,
      'false-friend-10': (c.ffCorrect || 0) >= 10
    };
    BADGES.forEach(function (b) {
      if (rules[b.id] && !q.badges[b.id]) { q.badges[b.id] = today; earned.push(b); }
    });
    return { p: q, earned: earned };
  }

  return {
    FLASH_XP: FLASH_XP, FLASH_XP_CAP: FLASH_XP_CAP, MAX_LEVEL: MAX_LEVEL, MAX_MISTAKES: MAX_MISTAKES, BADGES: BADGES,
    defaults: defaults, threshold: threshold, level: level, levelInfo: levelInfo, addXp: addXp, xpForAnswer: xpForAnswer,
    awardFlash: awardFlash, bump: bump, recordActivity: recordActivity, currentStreak: currentStreak,
    markLearned: markLearned, unmarkLearned: unmarkLearned, recordMistake: recordMistake,
    recordCorrectOnMistake: recordCorrectOnMistake, checkBadges: checkBadges
  };
});
