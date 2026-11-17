'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const html = read('index.html');
const API = require('../js/api.js');

const ORDER = ['js/util.js', 'js/rng.js', 'data/words.js', 'data/phrases.js', 'data/verbs.js', 'data/falsefriends.js', 'data/idioms.js', 'data/pronunciation.js', 'data/scenarios.js', 'data/entext.js', 'data/why.js',
  'js/store.js', 'js/nouns.js', 'js/numbers.js', 'js/conj.js', 'js/lexicon.js', 'js/curated.js', 'js/reverse.js', 'js/online.js', 'js/srs.js', 'js/progress.js', 'js/quiz.js', 'js/scenario.js', 'js/daily.js', 'js/api.js',
  'js/ui-core.js', 'js/ui-translate.js', 'js/ui-learn.js', 'js/ui-cards.js', 'js/ui-quiz.js', 'js/ui-scenarios.js', 'js/ui-progress.js', 'js/ui.js'];
const PURE = ['util', 'rng', 'store', 'nouns', 'numbers', 'conj', 'lexicon', 'curated', 'reverse', 'online', 'srs', 'progress', 'quiz', 'scenario', 'daily', 'api'].map((n) => 'js/' + n + '.js');
const DATA = fs.readdirSync(path.join(ROOT, 'data')).map((f) => 'data/' + f);
const UI = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => /^ui/.test(f)).map((f) => 'js/' + f);
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');

test('static: CSP meta is present, exact and first after the charset when CSP_META is true', () => {
  assert.strictEqual(API.CSP_META, true);
  const expected = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\' file:; style-src \'self\' file:; img-src \'self\' data: blob: file:; connect-src https://api.mymemory.translated.net; font-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'; media-src \'none\'">';
  assert.ok(html.includes(expected));
  const head = html.slice(html.indexOf('<head>'));
  assert.ok(head.replace(/\s+/g, ' ').startsWith('<head> <meta charset="utf-8"> <meta http-equiv="Content-Security-Policy"'));
  assert.strictEqual((html.match(/connect-src ([^;"]*)/)[1]), 'https://api.mymemory.translated.net');
});
test('static: no inline script, inline style, event attributes, modules or external URLs in index.html', () => {
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), 'inline script');
  assert.ok(!/<script[^>]*type=["']module/i.test(html));
  assert.ok(!/\sstyle\s*=/i.test(html), 'style attribute');
  assert.ok(!/\son[a-z]+\s*=/i.test(html), 'on* attribute');
  const urls = (html.match(/(?:src|href)="(https?:)?\/\/[^"]+/g) || []);
  assert.deepStrictEqual(urls, []);
  assert.ok(!/<link[^>]+(fonts|cdn)/i.test(html));
});
test('static: scripts are classic deferred files in the specified load order and none is missing', () => {
  const tags = [...html.matchAll(/<script defer src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  assert.deepStrictEqual(tags, ORDER);
  const all = fs.readdirSync(path.join(ROOT, 'js')).map((f) => 'js/' + f).concat(DATA);
  assert.deepStrictEqual(all.slice().sort(), ORDER.slice().sort());
  ORDER.forEach((f) => assert.ok(fs.existsSync(path.join(ROOT, f)), f));
});
test('static: every script parses as a classic script', () => {
  ORDER.forEach((f) => assert.doesNotThrow(() => new vm.Script(read(f), { filename: f }), f));
});
test('static: ES2018 syntax only in js/ and data/ (no ?., ??, import, export, class fields)', () => {
  ORDER.forEach((f) => {
    const s = strip(read(f)).replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, "''");
    assert.ok(!/\?\./.test(s.replace(/\?\.\d/g, '')), f + ' optional chaining');
    assert.ok(!/\?\?/.test(s), f + ' nullish');
    assert.ok(!/^\s*(import|export)\s/m.test(s), f + ' module syntax');
    assert.ok(!/`/.test(s), f + ' template literal');
    assert.ok(!/\bcatch\s*\{/.test(s), f + ' optional catch binding');
  });
});
test('static: pure modules avoid Math.random, Date, DOM, console and direct storage', () => {
  PURE.forEach((f) => {
    const s = strip(read(f));
    assert.ok(!/\bMath\.random\b/.test(s), f + ' Math.random');
    assert.ok(!/\bnew Date\b|\bDate\.(now|UTC)/.test(s), f + ' Date');
    assert.ok(!/\bwindow\b|\bdocument\b/.test(s), f + ' DOM');
    assert.ok(!/\bconsole\./.test(s), f + ' console');
    assert.ok(!/\blocalStorage\b|\bsessionStorage\b/.test(s), f + ' storage');
  });
});
test('static: fetch is used only in js/online.js', () => {
  ORDER.concat(['scripts/ui-smoke.cjs']).forEach((f) => {
    if (f === 'js/online.js' || f === 'scripts/ui-smoke.cjs') return;
    assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource/.test(strip(read(f))), f);
  });
  assert.ok(/fetch\(url/.test(read('js/online.js')));
});
test('static: UI code never uses innerHTML, eval, document.write or inline styles', () => {
  UI.forEach((f) => {
    const s = strip(read(f));
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\s*\(|new Function|setAttribute\(\s*['"]style/.test(s), f);
    assert.ok(!/Math\.random/.test(s), f);
  });
});
test('static: element ids are prefixed hb- (markup and code)', () => {
  [...html.matchAll(/\bid="([^"]+)"/g)].forEach((m) => assert.ok(m[1].startsWith('hb-'), m[1]));
  UI.forEach((f) => {
    const s = read(f);
    [...s.matchAll(/\bid:\s*'([^']+)'/g)].forEach((m) => assert.ok(m[1].startsWith('hb-'), f + ' ' + m[1]));
    [...s.matchAll(/getElementById\('([^']+)'\)/g)].forEach((m) => assert.ok(m[1].startsWith('hb-'), f + ' ' + m[1]));
    [...s.matchAll(/byId\('([^']+)'\)/g)].forEach((m) => assert.ok(m[1].startsWith('hb-'), f + ' ' + m[1]));
  });
});
test('static: markup has seven tabs with matching panels, labels and a live region', () => {
  const tabs = [...html.matchAll(/role="tab" id="(hb-tab-[a-z]+)" aria-controls="(hb-panel-[a-z]+)"/g)];
  assert.strictEqual(tabs.length, 7);
  tabs.forEach((m) => assert.ok(html.includes('id="' + m[2] + '"') && html.includes('aria-labelledby="' + m[1] + '"')));
  assert.ok(/aria-live="polite"/.test(html));
  assert.ok(/<html lang="en"/.test(html));
  assert.strictEqual((html.match(/<h1[ >]/g) || []).length, 1);
  assert.ok(html.includes('Live demo') === false, 'the live demo line belongs in the README only');
});
test('static: no external fonts, CDNs or images are referenced anywhere in css/js', () => {
  const css = read('css/app.css');
  assert.ok(!/@import|url\(\s*['"]?https?:|@font-face/.test(css));
  UI.concat(['js/online.js']).forEach((f) => {
    const urls = (strip(read(f)).match(/https?:\/\/[^\s'")]+/g) || []).filter((u) => !/mymemory\.translated\.net|www\.w3\.org/.test(u));
    assert.deepStrictEqual(urls, [], f);
  });
});
test('static: CSS honours reduced motion and has focus styles', () => {
  const css = read('css/app.css');
  assert.ok(/@media \(prefers-reduced-motion: reduce\)/.test(css));
  assert.ok(/html\[data-motion="reduce"\]/.test(css));
  assert.ok(/:focus-visible\s*\{[^}]*outline: 3px/.test(css));
});
test('static: package.json has the documented scripts and no dependencies', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.strictEqual(pkg.type, 'commonjs');
  assert.strictEqual(pkg.license, 'MIT');
  assert.ok(!pkg.dependencies && !pkg.devDependencies);
  assert.strictEqual(pkg.scripts.test, 'node --test "test/**/*.test.cjs"');
  ['eval', 'smoke', 'screenshots', 'package'].forEach((k) => assert.ok(pkg.scripts[k], k));
});
test('static: LICENSE is MIT (placeholder or GitHub-generated holder); .gitignore ignores node_modules', () => {
  const lic = read('LICENSE');
  assert.ok(/^MIT License/.test(lic));
  assert.ok(/^Copyright \(c\) \d{4} .+/m.test(lic));
  assert.ok(/Permission is hereby granted, free of charge/.test(lic));
  if (fs.existsSync(path.join(ROOT, '.nojekyll'))) assert.strictEqual(fs.statSync(path.join(ROOT, '.nojekyll')).size, 0);
  assert.ok(/node_modules/.test(read('.gitignore')));
});
