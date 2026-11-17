(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module && module.exports;
  var api = factory();
  if (isNode) module.exports = api;
  else { root.Hablemos = root.Hablemos || {}; root.Hablemos.numbers = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var UNITS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
  var TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  var HUNDREDS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
  var ORDINALS = ['', 'primero', 'segundo', 'tercero', 'cuarto', 'quinto', 'sexto', 'séptimo', 'octavo', 'noveno', 'décimo'];
  var DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  // opts: { gender: 'm'|'f', noun: true } ; noun true means a noun follows, so uno -> un/una
  function below1000(n, opts) {
    var g = opts && opts.gender === 'f' ? 'f' : 'm';
    var noun = !!(opts && opts.noun);
    var out = [];
    if (n === 100) return 'cien';
    var h = Math.floor(n / 100);
    var r = n % 100;
    if (h) {
      var hw = HUNDREDS[h];
      if (g === 'f') hw = hw.replace(/ientos$/, 'ientas');
      out.push(hw);
    }
    if (r === 0) return out.join(' ');
    if (r < 30) {
      var w = UNITS[r];
      if (noun) {
        if (r === 1) w = g === 'f' ? 'una' : 'un';
        if (r === 21) w = g === 'f' ? 'veintiuna' : 'veintiún';
      }
      out.push(w);
    } else {
      var t = Math.floor(r / 10);
      var u = r % 10;
      var tw = TENS[t];
      if (u === 0) out.push(tw);
      else {
        var uw = UNITS[u];
        if (noun && u === 1) uw = g === 'f' ? 'una' : 'un';
        out.push(tw + ' y ' + uw);
      }
    }
    return out.join(' ');
  }

  function toWords(n, opts) {
    n = Math.floor(Number(n));
    if (!isFinite(n) || n < 0 || n > 999999) return null;
    if (n === 0) return 'cero';
    var thousands = Math.floor(n / 1000);
    var rest = n % 1000;
    var parts = [];
    if (thousands) {
      if (thousands === 1) parts.push('mil');
      else parts.push(below1000(thousands, { gender: opts && opts.gender, noun: true }) + ' mil');
    }
    if (rest) parts.push(below1000(rest, opts));
    return parts.join(' ');
  }

  function ordinal(n, gender) {
    var w = ORDINALS[n];
    if (!w) return null;
    return gender === 'f' ? w.replace(/o$/, 'a') : w;
  }

  function hourWord(h) {
    var x = h % 12;
    if (x === 0) x = 12;
    return x === 1 ? 'una' : UNITS[x] || String(x);
  }

  // clock phrase: { h: 0-23, m: 0-59 } -> 'Son las cuatro y media'
  function clock(h, m) {
    var next = (h + 1) % 24;
    var lead, hourBase = h, tail = '';
    if (m > 30) { hourBase = next; }
    var hw = hourWord(hourBase);
    var singular = ((hourBase % 12) === 1);
    lead = singular ? 'Es la ' : 'Son las ';
    if (m === 0) tail = '';
    else if (m === 15) tail = ' y cuarto';
    else if (m === 30) tail = ' y media';
    else if (m === 45) tail = ' menos cuarto';
    else if (m < 30) tail = ' y ' + toWords(m);
    else tail = ' menos ' + toWords(60 - m);
    if (m > 30 && m !== 45) { /* menos N */ }
    return lead + hw + tail;
  }

  // "a las cinco de la tarde" style phrase for 'at 5 pm'; minutes 15, 30, 45 or any other minute
  function atTime(h, m, period) {
    var hh = h;
    var tail = '';
    if (m > 30) {
      hh = h + 1;
      tail = m === 45 ? ' menos cuarto' : ' menos ' + toWords(60 - m);
    } else if (m === 15) tail = ' y cuarto';
    else if (m === 30) tail = ' y media';
    else if (m > 0) tail = ' y ' + toWords(m);
    var hw = hourWord(hh);
    var article = (hh % 12 === 1) ? 'a la ' : 'a las ';
    var part = '';
    if (period === 'am') part = ' de la mañana';
    else if (period === 'pm') part = (hh % 12 >= 7 && hh % 12 !== 12) ? ' de la noche' : ' de la tarde';
    return article + hw + tail + part;
  }

  return {
    toWords: toWords,
    ordinal: ordinal,
    clock: clock,
    atTime: atTime,
    hourWord: hourWord,
    DAYS: DAYS,
    MONTHS: MONTHS,
    UNITS: UNITS
  };
});
