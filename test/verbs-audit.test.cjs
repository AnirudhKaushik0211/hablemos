'use strict';
// Regression tests for the verb data audit: no stem-changing or irregular verb is classed regular.

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const conj = require(path.join(__dirname, '..', 'js', 'conj.js'));
const verbs = require(path.join(__dirname, '..', 'data', 'verbs.js'));

// Independently authored list of stem-changing or irregular infinitives. None may be classed "reg".
const NOT_REGULAR = ['acostarse', 'almorzar', 'cerrar', 'comenzar', 'conseguir', 'contar', 'costar', 'decir', 'despertarse', 'doler', 'dormir',
  'elegir', 'empezar', 'encender', 'encontrar', 'entender', 'jugar', 'llover', 'mostrar', 'mover', 'nevar', 'pedir', 'pensar', 'poder', 'preferir',
  'probar', 'querer', 'recordar', 'repetir', 'resolver', 'seguir', 'sentarse', 'sentir', 'sentirse', 'sugerir', 'vestirse', 'volar', 'volver',
  'tener', 'venir', 'hacer', 'poner', 'salir', 'traer', 'ver', 'ser', 'estar', 'ir', 'dar', 'saber', 'conocer', 'oír', 'reír', 'sonreír'];
// verbs that are regular in the present stem but need a spelling or participle rule
const SPECIAL = { construir: 'construyo', leer: 'leo', creer: 'creo' };

test('verb data: no stem-changing or irregular verb is classed regular', () => {
  NOT_REGULAR.forEach((inf) => {
    const v = verbs.find((x) => x.inf === inf);
    if (v) assert.notStrictEqual(v.cls, 'reg', inf + ' must not be reg');
  });
  ['almorzar', 'sentirse', 'vestirse'].forEach((inf) => assert.ok(verbs.some((x) => x.inf === inf), inf));
});

test('verb data: every regular verb conjugates with plain stem + ending in the present', () => {
  verbs.filter((v) => v.cls === 'reg' && !/uir$/.test(v.inf)).forEach((v) => {
    const core = v.inf.replace(/se$/, '');
    const stem = core.slice(0, -2);
    assert.strictEqual(conj.conjugate(v.inf, 'pres')[0], stem + 'o', v.inf);
    assert.strictEqual(conj.conjugate(v.inf, 'pres')[3], stem + { ar: 'amos', er: 'emos', ir: 'imos' }[core.slice(-2)], v.inf);
  });
});

test('almorzar, sentirse and vestirse use the correct stem changes', () => {
  assert.deepStrictEqual(conj.conjugate('almorzar', 'pres'), ['almuerzo', 'almuerzas', 'almuerza', 'almorzamos', 'almorzáis', 'almuerzan']);
  assert.strictEqual(conj.conjugate('almorzar', 'pret')[0], 'almorcé');
  assert.deepStrictEqual(conj.conjugate('sentirse', 'pres'), ['siento', 'sientes', 'siente', 'sentimos', 'sentís', 'sienten']);
  assert.strictEqual(conj.conjugate('sentirse', 'pret')[2], 'sintió');
  assert.strictEqual(conj.gerund('sentirse'), 'sintiendo');
  assert.deepStrictEqual(conj.conjugate('vestirse', 'pres'), ['visto', 'vistes', 'viste', 'vestimos', 'vestís', 'visten']);
  assert.strictEqual(conj.conjugate('vestirse', 'pret')[5], 'vistieron');
  assert.strictEqual(conj.gerund('vestirse'), 'vistiendo');
  Object.keys(SPECIAL).forEach((inf) => assert.strictEqual(conj.conjugate(inf, 'pres')[0], SPECIAL[inf], inf));
});
