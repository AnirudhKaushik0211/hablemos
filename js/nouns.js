(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module && module.exports;
  var api = factory();
  if (isNode) module.exports = api;
  else { root.Hablemos = root.Hablemos || {}; root.Hablemos.nouns = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ACCENT_ADD = { examen: 'exámenes', joven: 'jóvenes', origen: 'orígenes', imagen: 'imágenes', margen: 'márgenes', volumen: 'volúmenes', resumen: 'resúmenes', crimen: 'crímenes', orden: 'órdenes', virgen: 'vírgenes', régimen: 'regímenes', carácter: 'caracteres' };
  var NO_FEM = { mejor: 1, peor: 1, mayor: 1, menor: 1, superior: 1, inferior: 1, exterior: 1, interior: 1, mucho: 0 };
  var NO_PLURAL_ADJ = { cada: 1, gratis: 1 };
  var STRIP = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u' };

  function stripLastAccent(w) {
    // remove the accent from the last accented vowel
    return w.replace(/[áéíóú](?=[^áéíóú]*$)/, function (m) { return STRIP[m]; });
  }

  function vowelGroups(w) {
    var m = w.replace(/[^aeiouáéíóúü]+/gi, ' ').trim();
    return m ? m.split(' ').length : 0;
  }

  function pluralizeWord(w) {
    var low = w.toLowerCase();
    if (ACCENT_ADD[low]) return ACCENT_ADD[low];
    var last = w.slice(-1);
    var prev = w.slice(-2, -1);
    if (/[aeiouáéó]$/.test(w)) return w + 's';
    if (/[íú]$/.test(w)) return w + 'es';
    if (last === 'z') return w.slice(0, -1) + 'ces';
    if (last === 's') {
      if (/[áéíóú]s$/.test(w)) return stripLastAccent(w) + 'es';
      if (vowelGroups(w) <= 1) return w + 'es';
      return w; // lunes, paraguas, cumpleaños, crisis
    }
    if (last === 'x') return w;
    if (/(ión|án|én|ín|ún|ón)$/.test(w) && /[áéíóú]/.test(w.slice(-3, -1))) return stripLastAccent(w) + 'es';
    if (/(ón|án|én|ín|ún)$/.test(w)) return stripLastAccent(w) + 'es';
    if (/[^aeiou]$/.test(w)) return w + 'es';
    return w + 's';
  }

  function pluralize(w, override) {
    if (override) return override;
    if (/ /.test(w)) {
      var parts = w.split(' ');
      if (parts.indexOf('de') > 0) {
        var i = parts.indexOf('de');
        var head = parts.slice(0, i).map(function (p) { return pluralizeWord(p); });
        return head.concat(parts.slice(i)).join(' ');
      }
      return parts.map(function (p) { return pluralizeWord(p); }).join(' ');
    }
    return pluralizeWord(w);
  }

  function feminize(w, override) {
    if (override) return override;
    if (NO_FEM[w]) return w;
    if (/o$/.test(w)) return w.slice(0, -1) + 'a';
    if (/(és|án|ón|ín)$/.test(w)) return stripLastAccent(w) + 'a';
    if (/ol$/.test(w)) return w + 'a';
    if (/(or|ador|edor|idor)$/.test(w)) return w + 'a';
    if (/^(un)$/.test(w)) return 'una';
    return w;
  }

  // adjective (or noun with gender forms) agreement. e is a word entry or a plain string.
  function agree(e, g, n, opts) {
    var entry = typeof e === 'string' ? { es: e } : e;
    var base = entry.es;
    var form = base;
    var isFem = g === 'f';
    if (isFem && !entry.inv) form = feminize(base, entry.fem);
    else if (isFem && entry.inv && entry.fem) form = entry.fem;
    if (n === 'pl') {
      if (NO_PLURAL_ADJ[base]) return form;
      if (entry.plForm && !isFem && entry.plForm) return entry.plForm;
      form = pluralize(form);
    } else if (opts && opts.beforeNoun) {
      form = apocope(form, g, n);
    }
    return form;
  }

  function apocope(form, g, n) {
    if (n === 'pl') return form;
    if (g === 'm') {
      if (form === 'bueno') return 'buen';
      if (form === 'malo') return 'mal';
      if (form === 'primero') return 'primer';
      if (form === 'tercero') return 'tercer';
      if (form === 'alguno') return 'algún';
      if (form === 'ninguno') return 'ningún';
      if (form === 'uno') return 'un';
    }
    if (form === 'grande') return 'gran';
    return form;
  }

  function article(g, n, definite, noun) {
    // g: 'm' | 'f'; noun: optional entry for el-agua rule
    if (n === 'pl') return definite ? (g === 'f' ? 'las' : 'los') : (g === 'f' ? 'unas' : 'unos');
    if (g === 'f' && noun && noun.art === 'el') return definite ? 'el' : 'un';
    return definite ? (g === 'f' ? 'la' : 'el') : (g === 'f' ? 'una' : 'un');
  }

  function nounGender(entry, hint) {
    if (entry.g === 'mf') return hint === 'f' ? 'f' : 'm';
    return entry.g;
  }

  function nounForm(entry, n, hintGender) {
    var form = entry.es;
    if (entry.g === 'mf' && hintGender === 'f' && entry.fem) form = entry.fem;
    else if (entry.g === 'm' && hintGender === 'f' && entry.fem) form = entry.fem;
    if (n === 'pl') {
      if (entry.pl && form === entry.es) return entry.pl;
      return pluralize(form);
    }
    return form;
  }

  // possessives and demonstratives: base is the masculine singular lemma
  var DET_TABLE = {
    mi: ['mi', 'mi', 'mis', 'mis'], tu: ['tu', 'tu', 'tus', 'tus'], su: ['su', 'su', 'sus', 'sus'],
    nuestro: ['nuestro', 'nuestra', 'nuestros', 'nuestras'], vuestro: ['vuestro', 'vuestra', 'vuestros', 'vuestras'],
    este: ['este', 'esta', 'estos', 'estas'], ese: ['ese', 'esa', 'esos', 'esas'], aquel: ['aquel', 'aquella', 'aquellos', 'aquellas']
  };
  function det(base, g, n) {
    var row = DET_TABLE[base];
    if (!row) return base;
    return row[(n === 'pl' ? 2 : 0) + (g === 'f' ? 1 : 0)];
  }

  function contract(prep, art) {
    if (art === 'el' && prep === 'a') return 'al';
    if (art === 'el' && prep === 'de') return 'del';
    return null;
  }

  return {
    pluralize: pluralize,
    feminize: feminize,
    agree: agree,
    apocope: apocope,
    article: article,
    nounGender: nounGender,
    nounForm: nounForm,
    det: det,
    contract: contract,
    stripLastAccent: stripLastAccent
  };
});
