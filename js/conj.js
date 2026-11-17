(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module && module.exports;
  var deps = isNode ? { verbs: require('../data/verbs.js') } : { verbs: root.Hablemos.data.verbs };
  var api = factory(deps);
  if (isNode) module.exports = api;
  else { root.Hablemos = root.Hablemos || {}; root.Hablemos.conj = api; }
})(typeof self !== 'undefined' ? self : this, function (deps) {
  'use strict';

  var VERBS = deps.verbs;
  var BY_INF = {};
  VERBS.forEach(function (v) { BY_INF[v.inf] = v; });

  var TENSES = ['pres', 'pret', 'impf', 'fut', 'cmd'];
  var PERSONS = ['yo', 'tú', 'él/ella/usted', 'nosotros', 'vosotros', 'ellos/ellas/ustedes'];
  var CMD_PERSONS = ['tú', 'usted', 'nosotros', 'vosotros', 'ustedes'];

  var END = {
    ar: { pres: ['o', 'as', 'a', 'amos', 'áis', 'an'], pret: ['é', 'aste', 'ó', 'amos', 'asteis', 'aron'], impf: ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'], subj: ['e', 'es', 'e', 'emos', 'éis', 'en'] },
    er: { pres: ['o', 'es', 'e', 'emos', 'éis', 'en'], pret: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'], impf: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'], subj: ['a', 'as', 'a', 'amos', 'áis', 'an'] },
    ir: { pres: ['o', 'es', 'e', 'imos', 'ís', 'en'], pret: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'], impf: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'], subj: ['a', 'as', 'a', 'amos', 'áis', 'an'] }
  };
  var FUT_END = ['é', 'ás', 'á', 'emos', 'éis', 'án'];
  var PS_END = ['e', 'iste', 'o', 'imos', 'isteis', 'ieron'];

  function isVowel(c) { return 'aeiouáéíóú'.indexOf(c) >= 0; }

  function lookup(inf) {
    var v = BY_INF[inf];
    return v || null;
  }

  function coreOf(inf) { return /se$/.test(inf) ? inf.slice(0, -2) : inf; }

  function kindOf(core) {
    var e = core.slice(-2);
    if (e === 'ar') return 'ar';
    if (e === 'er') return 'er';
    return 'ir'; // ir, ír
  }

  function applyStem(stem, change) {
    // change like 'e>ie'; replace the last occurrence of the vowel
    var parts = change.split('>');
    var from = parts[0], to = parts[1];
    var i = stem.lastIndexOf(from);
    if (i < 0) return stem;
    return stem.slice(0, i) + to + stem.slice(i + from.length);
  }

  // stem change used by -ir verbs in the preterite 3rd person, nosotros subjunctive and gerund
  function irShift(change) {
    if (change === 'o>ue') return 'o>u';
    if (change === 'e>ie') return 'e>i';
    return change;
  }

  // spelling changes for a stem before a vowel ending that starts with e (c->qu, g->gu, z->c)
  function spellE(stem) {
    var last = stem.slice(-1);
    if (last === 'c') return stem.slice(0, -1) + 'qu';
    if (last === 'g') return stem.slice(0, -1) + 'gu';
    if (last === 'z') return stem.slice(0, -1) + 'c';
    return stem;
  }

  function stemOf(core) { return core.slice(0, -2); }

  function presAll(v, core) {
    var kind = kindOf(core);
    var stem = stemOf(core);
    var forms = v && v.forms && v.forms.pres;
    if (forms) return forms.slice();
    var out = [];
    var e = END[kind].pres;
    var i;
    var changed = v && v.stem ? applyStem(stem, v.stem) : stem;
    var hasUir = /uir$/.test(core) && !/guir$|quir$/.test(core);
    for (i = 0; i < 6; i++) {
      var st = (i === 3 || i === 4) ? stem : changed;
      if (hasUir && i !== 3 && i !== 4) out.push(st + 'y' + e[i]);
      else out.push(st + e[i]);
    }
    if (v && v.yo) out[0] = v.yo;
    else if (/g[ei]r$/.test(core) && kind === 'ir') out[0] = changed.replace(/g$/, 'j') + 'o';
    else if (/guir$/.test(core)) out[0] = changed.slice(0, -1) + 'o';
    return out;
  }

  function pretAll(v, core) {
    var kind = kindOf(core);
    var stem = stemOf(core);
    if (v && v.forms && v.forms.pret) return v.forms.pret.slice();
    var i;
    var out = [];
    if (v && v.ps) {
      var ps = v.ps;
      var end = PS_END.slice();
      if (/j$/.test(ps)) end[5] = 'eron';
      for (i = 0; i < 6; i++) out.push(ps + end[i]);
      if (ps === 'hic') out[2] = 'hizo';
      return out;
    }
    var e = END[kind].pret;
    for (i = 0; i < 6; i++) out.push(stem + e[i]);
    if (kind === 'ar') {
      out[0] = spellE(stem) + 'é';
    } else {
      var last = stem.slice(-1);
      var hiatus = isVowel(last) && !(/[gq]u$/.test(stem));
      if (hiatus) {
        var accent = last !== 'u';
        out[0] = stem + 'í';
        out[1] = stem + (accent ? 'íste' : 'iste');
        out[2] = stem + 'yó';
        out[3] = stem + (accent ? 'ímos' : 'imos');
        out[4] = stem + (accent ? 'ísteis' : 'isteis');
        out[5] = stem + 'yeron';
      }
    }
    if (kind === 'ir' && v && v.stem) {
      var sh = applyStem(stem, irShift(v.stem));
      out[2] = sh + 'ió';
      out[5] = sh + 'ieron';
    }
    return out;
  }

  function impfAll(v, core) {
    if (v && v.forms && v.forms.impf) return v.forms.impf.slice();
    var kind = kindOf(core);
    var stem = stemOf(core);
    return END[kind].impf.map(function (e) { return stem + e; });
  }

  function futAll(v, core) {
    if (v && v.forms && v.forms.fut) return v.forms.fut.slice();
    var base = v && v.fs ? v.fs : core;
    return FUT_END.map(function (e) { return base + e; });
  }

  // present subjunctive (internal; used for commands)
  function subjAll(v, core) {
    if (v && v.forms && v.forms.subj) return v.forms.subj.slice();
    var kind = kindOf(core);
    var stem = stemOf(core);
    var pr = presAll(v, core);
    var yo = pr[0];
    var e = END[kind].subj;
    var out = [];
    var special = !!(v && v.yo) || /g[ei]r$/.test(core) || /guir$/.test(core) || /uir$/.test(core) || /[aeiou]cer$|[aeiou]cir$/.test(core);
    var i;
    var base;
    for (i = 0; i < 6; i++) {
      if (special) {
        base = yo.slice(0, -1);
        if (kind === 'ar') base = spellE(base);
      } else {
        var st = stem;
        if (v && v.stem && (i === 0 || i === 1 || i === 2 || i === 5)) st = applyStem(stem, v.stem);
        else if (v && v.stem && kind === 'ir') st = applyStem(stem, irShift(v.stem));
        base = kind === 'ar' ? spellE(st) : st;
      }
      out.push(base + e[i]);
    }
    return out;
  }

  function ger(v, core) {
    if (v && v.ger) return v.ger;
    var kind = kindOf(core);
    var stem = stemOf(core);
    if (kind === 'ar') return stem + 'ando';
    var last = stem.slice(-1);
    if (isVowel(last) && !(/[gq]u$/.test(stem))) return stem + 'yendo';
    if (kind === 'ir' && v && v.stem) return applyStem(stem, irShift(v.stem)) + 'iendo';
    return stem + 'iendo';
  }

  function pp(v, core) {
    if (v && v.pp) return v.pp;
    var kind = kindOf(core);
    var stem = stemOf(core);
    if (kind === 'ar') return stem + 'ado';
    var last = stem.slice(-1);
    if (isVowel(last) && last !== 'u') return stem + 'ído';
    if (/[gq]u$/.test(stem)) return stem + 'ido';
    return stem + 'ido';
  }

  function cmdAll(v, core) {
    if (v && v.forms && v.forms.cmd) return v.forms.cmd.slice();
    var pr = presAll(v, core);
    var sj = subjAll(v, core);
    var tu = v && v.tu ? v.tu : pr[2];
    var vos = core.slice(0, -1) + 'd';
    return [tu, sj[2], sj[3], vos, sj[5]];
  }

  function cmdNeg(v, core) {
    var sj = subjAll(v, core);
    return [sj[1], sj[4]];
  }

  function inferVerb(inf) {
    // unknown verb: treat as regular if it ends in ar/er/ir
    if (/(ar|er|ir|ír)(se)?$/.test(inf)) return { inf: inf, en: '', cls: 'reg' };
    return null;
  }

  function conjugate(inf, tense) {
    var v = lookup(inf) || inferVerb(inf);
    if (!v) return null;
    var core = coreOf(inf);
    switch (tense) {
      case 'pres': return presAll(v, core);
      case 'pret': return pretAll(v, core);
      case 'impf': return impfAll(v, core);
      case 'fut': return futAll(v, core);
      case 'cmd': return cmdAll(v, core);
      case 'cmdNeg': return cmdNeg(v, core);
      case 'subj': return subjAll(v, core);
      case 'ger': return [ger(v, core)];
      case 'pp': return [pp(v, core)];
      default: return null;
    }
  }

  function gerund(inf) { var r = conjugate(inf, 'ger'); return r ? r[0] : null; }
  function participle(inf) { var r = conjugate(inf, 'pp'); return r ? r[0] : null; }

  // every surface form of a verb (for example checks and reverse lookup)
  function allForms(inf) {
    var out = [];
    var core = coreOf(inf);
    out.push(core);
    ['pres', 'pret', 'impf', 'fut', 'cmd', 'cmdNeg', 'subj'].forEach(function (t) {
      var r = conjugate(inf, t);
      if (r) r.forEach(function (f) { if (out.indexOf(f) < 0) out.push(f); });
    });
    out.push(gerund(inf));
    out.push(participle(inf));
    return out;
  }

  function hasVerb(inf) { return !!lookup(inf); }

  return {
    TENSES: TENSES,
    PERSONS: PERSONS,
    CMD_PERSONS: CMD_PERSONS,
    conjugate: conjugate,
    gerund: gerund,
    participle: participle,
    allForms: allForms,
    hasVerb: hasVerb,
    lookup: lookup,
    coreOf: coreOf,
    list: VERBS
  };
});
