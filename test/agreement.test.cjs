'use strict';
const test = require('node:test');
const assert = require('node:assert');
const nouns = require('../js/nouns.js');
const numbers = require('../js/numbers.js');
const words = require('../data/words.js');

test('plural rules', () => {
  const cases = {
    casa: 'casas', libro: 'libros', café: 'cafés', sofá: 'sofás', canción: 'canciones', jardín: 'jardines', francés: 'franceses', autobús: 'autobuses',
    lápiz: 'lápices', pez: 'peces', nuez: 'nueces', mes: 'meses', lunes: 'lunes', paraguas: 'paraguas', cumpleaños: 'cumpleaños', árbol: 'árboles',
    mujer: 'mujeres', reloj: 'relojes', corazón: 'corazones', pantalón: 'pantalones', joven: 'jóvenes', examen: 'exámenes', ciudad: 'ciudades', tren: 'trenes',
    arroz: 'arroces', ratón: 'ratones', televisión: 'televisiones', limón: 'limones', inglés: 'ingleses'
  };
  Object.keys(cases).forEach((k) => assert.strictEqual(nouns.pluralize(k), cases[k], k));
});

test('multi-word plurals', () => {
  assert.strictEqual(nouns.pluralize('fin de semana'), 'fines de semana');
  assert.strictEqual(nouns.pluralize('agua mineral'), 'aguas minerales');
  assert.strictEqual(nouns.pluralize('correo electrónico'), 'correos electrónicos');
  assert.strictEqual(nouns.pluralize('habitación doble'), 'habitaciones dobles');
});

test('plural override is honoured', () => {
  assert.strictEqual(nouns.pluralize('país', 'países'), 'países');
  assert.strictEqual(nouns.nounForm({ es: 'país', g: 'm', pl: 'países' }, 'pl'), 'países');
});

test('adjective gender and number agreement', () => {
  assert.strictEqual(nouns.agree({ es: 'bueno' }, 'f', 'sg'), 'buena');
  assert.strictEqual(nouns.agree({ es: 'bueno' }, 'm', 'pl'), 'buenos');
  assert.strictEqual(nouns.agree({ es: 'bueno' }, 'f', 'pl'), 'buenas');
  assert.strictEqual(nouns.agree({ es: 'grande' }, 'f', 'pl'), 'grandes');
  assert.strictEqual(nouns.agree({ es: 'azul' }, 'f', 'pl'), 'azules');
  assert.strictEqual(nouns.agree({ es: 'feliz' }, 'm', 'pl'), 'felices');
  assert.strictEqual(nouns.agree({ es: 'español' }, 'f', 'sg'), 'española');
  assert.strictEqual(nouns.agree({ es: 'español' }, 'f', 'pl'), 'españolas');
  assert.strictEqual(nouns.agree({ es: 'francés' }, 'f', 'sg'), 'francesa');
  assert.strictEqual(nouns.agree({ es: 'francés' }, 'm', 'pl'), 'franceses');
  assert.strictEqual(nouns.agree({ es: 'alemán' }, 'f', 'pl'), 'alemanas');
  assert.strictEqual(nouns.agree({ es: 'trabajador' }, 'f', 'sg'), 'trabajadora');
  assert.strictEqual(nouns.agree({ es: 'rosa', inv: true }, 'f', 'pl'), 'rosas');
  assert.strictEqual(nouns.agree({ es: 'marrón', inv: true }, 'f', 'pl'), 'marrones');
  assert.strictEqual(nouns.agree({ es: 'mejor', inv: true }, 'f', 'pl'), 'mejores');
  assert.strictEqual(nouns.agree({ es: 'joven' }, 'f', 'sg'), 'joven');
  assert.strictEqual(nouns.agree({ es: 'amarillo' }, 'f', 'sg'), 'amarilla');
  assert.strictEqual(nouns.agree({ es: 'cada', inv: true }, 'f', 'pl'), 'cada');
});

test('apocope: buen, mal, gran, primer, tercer', () => {
  assert.strictEqual(nouns.agree({ es: 'bueno' }, 'm', 'sg', { beforeNoun: true }), 'buen');
  assert.strictEqual(nouns.agree({ es: 'malo' }, 'm', 'sg', { beforeNoun: true }), 'mal');
  assert.strictEqual(nouns.agree({ es: 'grande' }, 'm', 'sg', { beforeNoun: true }), 'gran');
  assert.strictEqual(nouns.agree({ es: 'grande' }, 'f', 'sg', { beforeNoun: true }), 'gran');
  assert.strictEqual(nouns.agree({ es: 'primero' }, 'm', 'sg', { beforeNoun: true }), 'primer');
  assert.strictEqual(nouns.agree({ es: 'tercero' }, 'm', 'sg', { beforeNoun: true }), 'tercer');
  // no apocope for feminine bueno/malo, or in the plural, or after the noun
  assert.strictEqual(nouns.agree({ es: 'bueno' }, 'f', 'sg', { beforeNoun: true }), 'buena');
  assert.strictEqual(nouns.agree({ es: 'bueno' }, 'm', 'pl', { beforeNoun: true }), 'buenos');
  assert.strictEqual(nouns.agree({ es: 'bueno' }, 'm', 'sg'), 'bueno');
  assert.strictEqual(nouns.agree({ es: 'grande' }, 'm', 'pl', { beforeNoun: true }), 'grandes');
});

test('articles including el agua and agreement of the noun phrase', () => {
  assert.strictEqual(nouns.article('m', 'sg', true), 'el');
  assert.strictEqual(nouns.article('f', 'sg', true), 'la');
  assert.strictEqual(nouns.article('m', 'pl', true), 'los');
  assert.strictEqual(nouns.article('f', 'pl', true), 'las');
  assert.strictEqual(nouns.article('m', 'sg', false), 'un');
  assert.strictEqual(nouns.article('f', 'sg', false), 'una');
  assert.strictEqual(nouns.article('m', 'pl', false), 'unos');
  assert.strictEqual(nouns.article('f', 'pl', false), 'unas');
  const agua = words.find((w) => w.es === 'agua');
  assert.strictEqual(agua.g, 'f');
  assert.strictEqual(nouns.article('f', 'sg', true, agua), 'el');
  assert.strictEqual(nouns.article('f', 'pl', true, agua), 'las');
  assert.strictEqual(nouns.article('f', 'sg', false, agua), 'un');
  // feminine nouns that take el also appear in the data
  ['águila', 'hambre'].forEach((es) => { const w = words.find((x) => x.es === es); assert.ok(w && w.art === 'el', es); });
});

test('contractions al and del', () => {
  assert.strictEqual(nouns.contract('a', 'el'), 'al');
  assert.strictEqual(nouns.contract('de', 'el'), 'del');
  assert.strictEqual(nouns.contract('a', 'la'), null);
  assert.strictEqual(nouns.contract('en', 'el'), null);
});

test('possessives and demonstratives', () => {
  assert.strictEqual(nouns.det('mi', 'f', 'pl'), 'mis');
  assert.strictEqual(nouns.det('nuestro', 'f', 'sg'), 'nuestra');
  assert.strictEqual(nouns.det('nuestro', 'm', 'pl'), 'nuestros');
  assert.strictEqual(nouns.det('este', 'f', 'pl'), 'estas');
  assert.strictEqual(nouns.det('ese', 'm', 'sg'), 'ese');
  assert.strictEqual(nouns.det('aquel', 'f', 'sg'), 'aquella');
});

test('genders of tricky nouns in the data', () => {
  const g = { mapa: 'm', mano: 'f', día: 'm', agua: 'f', problema: 'm', idioma: 'm', programa: 'm', foto: 'f', radio: 'f', sofá: 'm', sal: 'f', leche: 'f', tema: 'm', canción: 'f', ciudad: 'f', nariz: 'f', pie: 'm', piel: 'f', sartén: 'f' };
  Object.keys(g).forEach((es) => { const w = words.find((x) => x.es === es && x.pos === 'noun'); assert.ok(w, es + ' missing'); assert.strictEqual(w.g, g[es], es); });
});

test('number words 0 to 999999', () => {
  const t = { 0: 'cero', 1: 'uno', 10: 'diez', 15: 'quince', 16: 'dieciséis', 20: 'veinte', 21: 'veintiuno', 22: 'veintidós', 23: 'veintitrés', 26: 'veintiséis', 30: 'treinta', 31: 'treinta y uno', 45: 'cuarenta y cinco', 99: 'noventa y nueve', 100: 'cien', 101: 'ciento uno', 115: 'ciento quince', 200: 'doscientos', 500: 'quinientos', 555: 'quinientos cincuenta y cinco', 999: 'novecientos noventa y nueve', 1000: 'mil', 1001: 'mil uno', 2000: 'dos mil', 2021: 'dos mil veintiuno', 10000: 'diez mil', 21000: 'veintiún mil', 100000: 'cien mil', 101000: 'ciento un mil', 999999: 'novecientos noventa y nueve mil novecientos noventa y nueve' };
  Object.keys(t).forEach((n) => assert.strictEqual(numbers.toWords(Number(n), n === '21000' || n === '101000' ? { noun: true } : undefined), t[n], n));
  assert.strictEqual(numbers.toWords(1000000), null);
  assert.strictEqual(numbers.toWords(-1), null);
});

test('uno becomes un/una before a noun, veintiuno becomes veintiún/veintiuna', () => {
  assert.strictEqual(numbers.toWords(1, { noun: true }), 'un');
  assert.strictEqual(numbers.toWords(1, { noun: true, gender: 'f' }), 'una');
  assert.strictEqual(numbers.toWords(21, { noun: true }), 'veintiún');
  assert.strictEqual(numbers.toWords(21, { noun: true, gender: 'f' }), 'veintiuna');
  assert.strictEqual(numbers.toWords(31, { noun: true }), 'treinta y un');
  assert.strictEqual(numbers.toWords(200, { gender: 'f' }), 'doscientas');
  assert.strictEqual(numbers.toWords(555, { gender: 'f' }), 'quinientas cincuenta y cinco');
});

test('ordinals 1 to 10', () => {
  assert.strictEqual(numbers.ordinal(1), 'primero');
  assert.strictEqual(numbers.ordinal(3, 'f'), 'tercera');
  assert.strictEqual(numbers.ordinal(10), 'décimo');
  assert.strictEqual(numbers.ordinal(11), null);
});

test('clock phrases', () => {
  assert.strictEqual(numbers.clock(1, 0), 'Es la una');
  assert.strictEqual(numbers.clock(13, 0), 'Es la una');
  assert.strictEqual(numbers.clock(3, 0), 'Son las tres');
  assert.strictEqual(numbers.clock(4, 30), 'Son las cuatro y media');
  assert.strictEqual(numbers.clock(6, 15), 'Son las seis y cuarto');
  assert.strictEqual(numbers.clock(6, 45), 'Son las siete menos cuarto');
  assert.strictEqual(numbers.clock(6, 10), 'Son las seis y diez');
  assert.strictEqual(numbers.clock(6, 50), 'Son las siete menos diez');
  assert.strictEqual(numbers.clock(12, 0), 'Son las doce');
  assert.strictEqual(numbers.atTime(5, 0, 'pm'), 'a las cinco de la tarde');
  assert.strictEqual(numbers.atTime(9, 0, 'am'), 'a las nueve de la mañana');
  assert.strictEqual(numbers.atTime(1, 0, null), 'a la una');
  assert.strictEqual(numbers.atTime(2, 30, null), 'a las dos y media');
  assert.strictEqual(numbers.atTime(2, 45, null), 'a las tres menos cuarto');
});

test('days and months are lowercase Spanish', () => {
  assert.deepStrictEqual(numbers.DAYS, ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']);
  assert.strictEqual(numbers.MONTHS.length, 12);
  numbers.MONTHS.forEach((m) => assert.strictEqual(m, m.toLowerCase()));
});
