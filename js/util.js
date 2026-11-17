(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module && module.exports;
  var api = factory();
  if (isNode) module.exports = api;
  else { root.Hablemos = root.Hablemos || {}; root.Hablemos.util = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function nfc(s) { return typeof s === 'string' ? s.normalize('NFC') : ''; }
  function clean(s) { return nfc(s).replace(/\s+/g, ' ').trim(); }

  // Remove accents but keep the letter n-tilde distinct from n.
  function stripAccents(s) {
    return nfc(s).replace(/ñ/g, '\u0001').replace(/Ñ/g, '\u0002')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0001/g, 'ñ').replace(/\u0002/g, 'Ñ').normalize('NFC');
  }

  // Normalise for answer matching: case, punctuation and spacing; accents optional.
  function norm(s, loose) {
    var t = clean(s).toLowerCase().replace(/[¿?¡!.,;:"“”()]/g, ' ').replace(/\s+/g, ' ').trim();
    return loose ? stripAccents(t) : t;
  }

  // Days since 1970-01-01 for a civil date (no Date object needed).
  function dayNumber(y, m, d) {
    y = m <= 2 ? y - 1 : y;
    var era = Math.floor(y / 400);
    var yoe = y - era * 400;
    var mp = (m + 9) % 12;
    var doy = Math.floor((153 * mp + 2) / 5) + d - 1;
    var doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe - 719468;
  }
  function dayToYMD(n) {
    var z = n + 719468;
    var era = Math.floor(z / 146097);
    var doe = z - era * 146097;
    var yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
    var y = yoe + era * 400;
    var doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    var mp = Math.floor((5 * doy + 2) / 153);
    var d = doy - Math.floor((153 * mp + 2) / 5) + 1;
    var m = mp < 10 ? mp + 3 : mp - 9;
    return { y: m <= 2 ? y + 1 : y, m: m, d: d };
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayToString(n) { var r = dayToYMD(n); return r.y + '-' + pad(r.m) + '-' + pad(r.d); }
  function weekday(n) { return ((n % 7) + 11) % 7; } // 0 = Sunday (1970-01-01 was a Thursday)

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function toInt(v, def, lo, hi) {
    var n = typeof v === 'number' ? v : (typeof v === 'string' && /^-?\d+$/.test(v.trim()) ? parseInt(v, 10) : NaN);
    if (!isFinite(n)) return def;
    return clamp(Math.round(n), lo, hi);
  }

  return {
    nfc: nfc, clean: clean, stripAccents: stripAccents, norm: norm,
    dayNumber: dayNumber, dayToYMD: dayToYMD, dayToString: dayToString, weekday: weekday,
    escapeHtml: escapeHtml, clamp: clamp, toInt: toInt
  };
});
