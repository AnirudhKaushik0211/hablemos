(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module && module.exports;
  var deps = isNode ? { util: require('./util.js') } : { util: root.Hablemos.util };
  var api = factory(deps);
  if (isNode) module.exports = api;
  else { root.Hablemos = root.Hablemos || {}; root.Hablemos.online = api; }
})(typeof self !== 'undefined' ? self : this, function (deps) {
  'use strict';
  var U = deps.util;

  // ---- constants (the one place to change them; documented in the README) ----
  var ONLINE_ORIGIN = 'https://api.mymemory.translated.net';
  var TERMS_URL = 'https://mymemory.translated.net/doc/spec.php';
  var LIMIT_ANON = 5000;     // characters per local calendar day, anonymous use (provider's published limit)
  var LIMIT_EMAIL = 50000;   // characters per local calendar day with an email in the `de` parameter
  var CHUNK_CHARS = 200;     // implementation choice, deliberately conservative; no provider cap is claimed
  var CHUNK_MIN = 40;
  var MAX_ONLINE_INPUT = 1000;
  var MAX_REQUEST_CHARS = 500;
  var LOW_MATCH = 0.5;       // implementation choice
  var LOW_QUALITY = 50;      // implementation choice
  var TIMEOUT_MS = 10000;
  var MAX_SPLIT_LEVELS = 3;

  // ---- request builder ----
  function validEmail(s) {
    if (typeof s !== 'string' || s.length > 254) return false;
    return /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/.test(s);
  }
  function buildRequest(text, email) {
    var t = typeof text === 'string' ? U.clean(text) : '';
    if (t.length < 1 || t.length > MAX_REQUEST_CHARS) throw new RangeError('Text must be 1-' + MAX_REQUEST_CHARS + ' characters.');
    var url = ONLINE_ORIGIN + '/get?q=' + encodeURIComponent(t) + '&langpair=en%7Ces';
    if (validEmail(email)) url += '&de=' + encodeURIComponent(email);
    return { url: url, method: 'GET' };
  }

  // ---- response parser ----
  function decodeEntities(s) {
    return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  }
  function messageOf(json) {
    var parts = [];
    if (json && typeof json.responseDetails === 'string') parts.push(json.responseDetails);
    if (json && json.responseData && typeof json.responseData.translatedText === 'string') parts.push(json.responseData.translatedText);
    return parts.join(' ');
  }
  function parseResponse(json) {
    if (!json || typeof json !== 'object' || Array.isArray(json)) return { ok: false, reason: 'bad_response' };
    var status = json.responseStatus;
    var code = typeof status === 'number' ? status : (typeof status === 'string' && /^\d+$/.test(status) ? parseInt(status, 10) : NaN);
    if (code === 200) {
      var rd = json.responseData;
      var tt = rd && typeof rd.translatedText === 'string' ? rd.translatedText : '';
      if (!tt.trim()) return { ok: false, reason: 'bad_response' };
      var text = U.clean(decodeEntities(tt));
      if (/MYMEMORY WARNING|YOU USED ALL AVAILABLE FREE TRANSLATIONS/i.test(tt)) return { ok: false, reason: 'quota' };
      var match = typeof rd.match === 'number' && rd.match >= 0 && rd.match <= 1 ? rd.match : null;
      var low = false;
      if (match !== null) low = match < LOW_MATCH;
      else if (Array.isArray(json.matches) && json.matches.length) {
        var best = null;
        json.matches.forEach(function (m) {
          var q = m && (typeof m.quality === 'number' ? m.quality : (typeof m.quality === 'string' && /^\d+(\.\d+)?$/.test(m.quality) ? parseFloat(m.quality) : null));
          if (q !== null && (best === null || q > best)) best = q;
        });
        if (best !== null) low = best < LOW_QUALITY;
      }
      return { ok: true, text: text, match: match, lowConfidence: low };
    }
    if (code === 429) return { ok: false, reason: 'rate_limited' };
    var msg = messageOf(json);
    if (/query length|too long|max(imum)? \d+ char/i.test(msg)) return { ok: false, reason: 'too_long' };
    if (/daily|usage|quota|free translations|next available|used all/i.test(msg)) return { ok: false, reason: 'quota' };
    return { ok: false, reason: 'bad_response' };
  }

  var FALLBACK = ' Only exact matches from the word list and phrase library are shown. Hablemos does not generate Spanish.';
  var REASON_TEXT = {
    no_consent: 'Online translation is off until you agree to send your text to MyMemory. Nothing was sent.' + FALLBACK,
    rate_limited: 'The online service is limiting requests right now. Try again later.' + FALLBACK,
    quota: 'The online service reports that its daily limit is used up.' + FALLBACK,
    too_long: 'The online service rejected the text as too long.' + FALLBACK,
    bad_response: 'The online service sent a reply Hablemos could not read.' + FALLBACK,
    offline: 'You appear to be offline, so nothing was sent.' + FALLBACK,
    network: 'The online request failed (network error).' + FALLBACK,
    timeout: 'The online service did not answer within 10 seconds.' + FALLBACK,
    allowance: 'This text is longer than your remaining online allowance for today, so nothing was sent.' + FALLBACK
  };

  // ---- daily usage counter: record { day, used } ----
  function limitFor(hasEmail) { return hasEmail ? LIMIT_EMAIL : LIMIT_ANON; }
  function usedToday(record, today) {
    return record && typeof record === 'object' && record.day === today && typeof record.used === 'number' && record.used > 0 ? record.used : 0;
  }
  function remaining(record, today, hasEmail) { return Math.max(0, limitFor(hasEmail) - usedToday(record, today)); }
  function canSend(record, today, hasEmail, length) { return length >= 0 && length <= remaining(record, today, hasEmail); }
  function add(record, today, length) { return { day: today, used: usedToday(record, today) + Math.max(0, Math.floor(length)) }; }

  // ---- chunking ----
  function splitLong(s, max) {
    var out = [];
    var rest = s;
    while (rest.length > max) {
      var cut = rest.lastIndexOf(',', max - 1);
      var atComma = cut > 0;
      if (!atComma) cut = rest.lastIndexOf(' ', max);
      if (cut <= 0) { out.push(rest.slice(0, max)); rest = rest.slice(max); continue; }
      out.push(atComma ? rest.slice(0, cut + 1) : rest.slice(0, cut));
      rest = rest.slice(atComma ? cut + 1 : cut + 1).replace(/^\s+/, '');
    }
    if (rest) out.push(rest);
    return out;
  }
  function chunk(text, max) {
    var limit = max || CHUNK_CHARS;
    var t = U.clean(text);
    if (!t) return [];
    var sentences = t.match(/[^.!?;]+(?:[.!?;]+|$)\s*/g) || [t];
    var parts = [];
    sentences.forEach(function (s) {
      s = s.trim();
      if (!s) return;
      if (s.length > limit) splitLong(s, limit).forEach(function (p) { parts.push(p); });
      else parts.push(s);
    });
    var chunks = [];
    var cur = '';
    parts.forEach(function (p) {
      if (!cur) cur = p;
      else if ((cur + ' ' + p).length <= limit) cur += ' ' + p;
      else { chunks.push(cur); cur = p; }
    });
    if (cur) chunks.push(cur);
    return chunks;
  }
  // Split one chunk in two near the middle at a space; null when a half would be under CHUNK_MIN.
  function splitHalf(s) {
    var mid = Math.floor(s.length / 2);
    var left = s.lastIndexOf(' ', mid);
    var right = s.indexOf(' ', mid);
    var cut = left > 0 && (right < 0 || mid - left <= right - mid) ? left : right;
    if (cut <= 0) return null;
    var a = s.slice(0, cut).trim(), b = s.slice(cut + 1).trim();
    if (a.length < CHUNK_MIN || b.length < CHUNK_MIN) return null;
    return [a, b];
  }

  // ---- word diff (LCS on normalised tokens) ----
  function tokens(s) { return U.clean(s).split(' ').filter(Boolean); }
  function tokKey(t) { return t.toLowerCase().replace(/[¿?¡!.,;:"“”()]/g, ''); }
  function wordDiff(a, b) {
    var ta = tokens(a), tb = tokens(b);
    var ka = ta.map(tokKey), kb = tb.map(tokKey);
    var n = ka.length, m = kb.length;
    var dp = [];
    for (var i = 0; i <= n; i++) { dp.push(new Array(m + 1).fill(0)); }
    for (i = n - 1; i >= 0; i--) for (var j = m - 1; j >= 0; j--) {
      dp[i][j] = ka[i] === kb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
    var ra = ta.map(function (t) { return { text: t, same: false }; });
    var rb = tb.map(function (t) { return { text: t, same: false }; });
    i = 0; j = 0;
    while (i < n && j < m) {
      if (ka[i] === kb[j]) { ra[i].same = true; rb[j].same = true; i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
      else j++;
    }
    return { a: ra, b: rb };
  }

  // ---- network (the only place that uses fetch) ----
  function fetchJson(url, timeoutMs) {
    if (typeof fetch !== 'function') return Promise.reject({ reason: 'network' });
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.reject({ reason: 'offline' });
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, timeoutMs || TIMEOUT_MS) : null;
    return fetch(url, { method: 'GET', signal: ctl ? ctl.signal : undefined, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' })
      .then(function (r) {
        if (timer) clearTimeout(timer);
        return r.json().catch(function () { return null; });
      })
      .catch(function (e) {
        if (timer) clearTimeout(timer);
        if (e && e.reason) throw e;
        throw { reason: e && e.name === 'AbortError' ? 'timeout' : 'network' };
      });
  }

  // Translate text chunk by chunk, sequentially. ctx: { email, getJson(url) -> Promise, onUsed(len) }.
  // ctx.consent must be true. Resolves { ok, text, lowConfidence } or { ok: false, reason, partial }.
  async function translateText(text, ctx) {
    // consent gate: no request of any kind is built or sent unless the caller passes consent === true
    if (!ctx || ctx.consent !== true) return { ok: false, reason: 'no_consent', partial: '' };
    var queue = chunk(text).map(function (c) { return { s: c, level: 0 }; });
    var outs = [];
    var low = false;
    while (queue.length) {
      var item = queue.shift();
      var res;
      try {
        var req = buildRequest(item.s, ctx.email);
        var json = await ctx.getJson(req.url);
        res = parseResponse(json);
      } catch (e) {
        return { ok: false, reason: e && e.reason ? e.reason : 'network', partial: outs.join(' ') };
      }
      if (res.ok) {
        ctx.onUsed(item.s.length);
        outs.push(res.text);
        if (res.lowConfidence) low = true;
      } else if (res.reason === 'too_long' && item.level < MAX_SPLIT_LEVELS) {
        var halves = splitHalf(item.s);
        if (!halves) return { ok: false, reason: 'too_long', partial: outs.join(' ') };
        queue.unshift({ s: halves[0], level: item.level + 1 }, { s: halves[1], level: item.level + 1 });
      } else {
        return { ok: false, reason: res.reason, partial: outs.join(' ') };
      }
    }
    return { ok: true, text: outs.join(' '), lowConfidence: low };
  }

  return {
    ONLINE_ORIGIN: ONLINE_ORIGIN, TERMS_URL: TERMS_URL, LIMIT_ANON: LIMIT_ANON, LIMIT_EMAIL: LIMIT_EMAIL,
    CHUNK_CHARS: CHUNK_CHARS, CHUNK_MIN: CHUNK_MIN, MAX_ONLINE_INPUT: MAX_ONLINE_INPUT, MAX_REQUEST_CHARS: MAX_REQUEST_CHARS,
    LOW_MATCH: LOW_MATCH, LOW_QUALITY: LOW_QUALITY, TIMEOUT_MS: TIMEOUT_MS, MAX_SPLIT_LEVELS: MAX_SPLIT_LEVELS,
    REASON_TEXT: REASON_TEXT, validEmail: validEmail, buildRequest: buildRequest, parseResponse: parseResponse,
    limitFor: limitFor, usedToday: usedToday, remaining: remaining, canSend: canSend, add: add,
    chunk: chunk, splitHalf: splitHalf, wordDiff: wordDiff, fetchJson: fetchJson, translateText: translateText
  };
});
