'use strict';
// Browser smoke test: headless Edge (DevTools protocol) and Firefox (WebDriver BiDi), file:// and http modes.
// Usage: node scripts/ui-smoke.cjs [--browser edge|firefox|all] [--mode file|http|all] [--port 4395]
//                                  [--cdp-port 9397] [--bidi-port 9398] [--edge <path>] [--firefox <path>] [--keep]
// Exit codes: 0 = all passed; 1 = a failure; 2 = no browser could run or invalid arguments.
// The real translation service is never contacted: a preload hook replaces window.fetch for its origin with fixtures.
// Only processes started here are stopped. Port 4317 is refused.
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const { pathToFileURL } = require('url');
const B = require('./browser.cjs');
const ROOT = path.resolve(__dirname, '..');
const RESERVED_PORT = 4317;
const VALUE_FLAGS = ['--browser', '--mode', '--port', '--cdp-port', '--bidi-port', '--edge', '--firefox', '--only'];
const BOOL_FLAGS = ['--keep'];
const argv = process.argv.slice(2);
function usage(msg) {
  console.error(msg);
  console.error('Usage: node scripts/ui-smoke.cjs [--browser edge|firefox|all] [--mode file|http|all] [--port 4395] [--cdp-port 9397] [--bidi-port 9398] [--edge <path>] [--firefox <path>] [--keep]');
  process.exit(2);
}
const opts = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (BOOL_FLAGS.includes(a)) { opts[a] = true; continue; }
  if (!VALUE_FLAGS.includes(a)) usage('unknown option: ' + a);
  if (i + 1 >= argv.length) usage(a + ' needs a value');
  opts[a] = argv[++i];
}
const BROWSER = String(opts['--browser'] || 'all').toLowerCase();
const MODE = String(opts['--mode'] || 'all').toLowerCase();
const PORT = Number(opts['--port'] || '4395');
const CDP_PORT = Number(opts['--cdp-port'] || '9397');
const BIDI_PORT = Number(opts['--bidi-port'] || '9398');
const KEEP = !!opts['--keep'];
const ONLY = opts['--only'] ? String(opts['--only']).split(',') : null;
const sleep = B.sleep;
if (typeof WebSocket !== 'function') usage('Node 22+ is required (global WebSocket).');
if (!['edge', 'firefox', 'all'].includes(BROWSER)) usage('--browser must be edge, firefox or all.');
if (!['file', 'http', 'all'].includes(MODE)) usage('--mode must be file, http or all.');
for (const [name, p] of [['--port', PORT], ['--cdp-port', CDP_PORT], ['--bidi-port', BIDI_PORT]]) {
  if (!Number.isInteger(p) || p < 1 || p > 65535) usage(name + ' must be a port number.');
  if (p === RESERVED_PORT) usage('Port ' + RESERVED_PORT + ' is reserved for another local tool; choose another port.');
}
const BROWSERS = BROWSER === 'all' ? ['edge', 'firefox'] : [BROWSER];
const MODES = MODE === 'all' ? ['file', 'http'] : [MODE];
const ORIGIN = 'http://127.0.0.1:' + PORT;
const children = [];
const results = [];

// ---------------------------------------------------------------- preload hook
const HOOK = '(function () {\n' +
  '  if (window.__smokeHooked) return;\n' +
  '  window.__smokeHooked = true;\n' +
  '  window.__smokeCsp = 0; window.__smokeBlobs = []; window.__smokeDownloads = []; window.__smokeFetch = []; window.__smokeMode = "fail";\n' +
  '  window.addEventListener("securitypolicyviolation", function () { window.__smokeCsp += 1; }, true);\n' +
  '  var create = URL.createObjectURL;\n' +
  '  URL.createObjectURL = function (b) { window.__smokeBlobs.push(b); return create.call(URL, b); };\n' +
  '  var click = HTMLAnchorElement.prototype.click;\n' +
  '  HTMLAnchorElement.prototype.click = function () {\n' +
  '    if (this.hasAttribute("download")) { window.__smokeDownloads.push(this.getAttribute("download")); return; }\n' +
  '    return click.apply(this, arguments);\n' +
  '  };\n' +
  '  window.fetch = function (url) {\n' +
  '    var u = String(url);\n' +
  '    if (u.indexOf("https://api.mymemory.translated.net/") === 0) {\n' +
  '      window.__smokeFetch.push(u);\n' +
  '      if (window.__smokeMode === "fail") return Promise.reject(new TypeError("blocked by the smoke test"));\n' +
  '      var match = window.__smokeMode === "low" ? 0.2 : 0.9;\n' +
  '      var body = { responseData: { translatedText: "Yo quiero dos caf\\u00e9s.", match: match }, responseStatus: 200, matches: [] };\n' +
  '      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));\n' +
  '    }\n' +
  '    window.__smokeFetch.push("UNEXPECTED " + u);\n' +
  '    return Promise.reject(new TypeError("unexpected fetch"));\n' +
  '  };\n' +
  '})();';

// ---------------------------------------------------------------- helpers
function fail(msg) { throw new Error(msg); }
function check(cond, msg) { if (!cond) fail(msg); }
const J = JSON.stringify;
const byId = B.byId;
const baseUrl = (mode) => (mode === 'file' ? pathToFileURL(path.join(ROOT, 'index.html')).href : ORIGIN + '/index.html');
const READY = '(() => !!(window.Hablemos && window.Hablemos.ui && window.Hablemos.ui.panels && document.querySelector("[role=tab][aria-selected=true]")))()';
const DUP_IDS = '(() => { const seen = Object.create(null), dup = []; for (const el of document.querySelectorAll("[id]")) { if (seen[el.id]) dup.push(el.id); seen[el.id] = 1; } return dup; })()';
async function harvestCsp(d) {
  try { const n = await d.evaluate('typeof window.__smokeCsp === "number" ? window.__smokeCsp : 0'); d.cspTotal += Number(n) || 0; } catch (e) { /* no page */ }
}
async function waitReady(d, what) {
  const ok = await B.waitFor(() => d.evaluate(READY), 15000, 100);
  check(ok, 'the app did not start (' + what + ')');
}
async function open(d, url) {
  await harvestCsp(d);
  await d.goto('about:blank');
  await d.goto(url);
  await waitReady(d, url.slice(0, 5));
}
async function fresh(d, mode) {
  await open(d, baseUrl(mode));
  await d.evaluate('(() => { try { localStorage.clear(); } catch (e) {} return 1; })()');
  await d.reload();
  await waitReady(d, 'reload');
}
const text = (d, id) => d.evaluate('(' + byId(id) + ' || {}).textContent');
const exists = (d, id) => d.evaluate('!!' + byId(id));
const visible = (d, id) => d.evaluate('(() => { const e = ' + byId(id) + '; return !!e && !e.hidden && e.getClientRects().length > 0; })()');
async function click(d, id) { await B.clickEl(d, byId(id)); await sleep(80); }
async function setVal(d, id, v) {
  await d.evaluate('(() => { const el = ' + byId(id) + '; el.value = ' + J(String(v)) + '; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); return el.value; })()');
}
async function selectedTab(d) { return d.evaluate('(() => { const t = document.querySelector("[role=tab][aria-selected=true]"); return t ? t.id : null; })()'); }
async function tab(d, name) {
  await click(d, 'hb-tab-' + name);
  check(await selectedTab(d) === 'hb-tab-' + name, name + ' tab not selected after click');
  await sleep(60);
}
const ls = (d, key) => d.evaluate('(() => { const v = localStorage.getItem(' + J(key) + '); return v === null ? null : JSON.parse(v); })()');
// Free text can only be translated online (after consent). translate() presses the button and returns the result box.
async function translate(d, textIn) {
  await tab(d, 'translate');
  await setVal(d, 'hb-tr-input', textIn);
  await click(d, 'hb-tr-go');
  return text(d, 'hb-tr-out');
}
// Library lookup that never sends anything: the sample buttons under the text box.
async function sample(d, idx) {
  await tab(d, 'translate');
  await d.evaluate('document.querySelectorAll("#hb-tr-examples button")[' + idx + '].click()');
  await sleep(60);
}
// Keyboard-focus checks need the page to own the keyboard focus (a freshly reloaded headless window may not yet).
async function waitFocus(d) {
  await B.clickEl(d, byId('hb-brand'));
  const ok = await B.waitFor(() => d.evaluate('document.hasFocus()'), 8000, 100);
  check(ok, 'the page never received keyboard focus');
}
async function turnOnOnline(d) {
  await tab(d, 'progress');
  await click(d, 'hb-set-online');
  check(await visible(d, 'hb-consent-agree'), 'consent dialog did not open');
  await click(d, 'hb-consent-agree');
  await sleep(100);
}

// ---------------------------------------------------------------- scenarios
const TAB_NAMES = ['help', 'translate', 'learn', 'cards', 'quiz', 'scenarios', 'progress'];
const SCENARIOS = [
  { id: 'S01', name: 'help-opens-first', fn: async (d, mode) => {
    await fresh(d, mode);
    check(await selectedTab(d) === 'hb-tab-help', 'Help is not the first tab');
    check(await visible(d, 'hb-panel-help'), 'Help panel hidden');
    const ev = await text(d, 'hb-help-eval');
    check(/third party/.test(ev) && /not covered/.test(ev), 'Help does not say that online results are third-party and unchecked');
    const dis = await d.evaluate('document.body.textContent.indexOf("no translator of its own") >= 0');
    check(dis, 'online-only note missing');
  } },
  { id: 'S02', name: 'every-tab-renders', fn: async (d, mode) => {
    await open(d, baseUrl(mode));
    for (const t of TAB_NAMES) {
      await tab(d, t);
      const n = await d.evaluate('(() => { const p = ' + byId('hb-panel-' + t) + '; return { kids: p.children.length, vis: !p.hidden, h2: !!p.querySelector("h2") }; })()');
      check(n.kids > 0 && n.vis && n.h2, t + ' did not render (' + J(n) + ')');
    }
  } },
  { id: 'S03', name: 'translate-needs-consent-then-online', fn: async (d, mode) => {
    await fresh(d, mode);
    await d.evaluate('window.__smokeMode = "ok"');
    await tab(d, 'translate');
    await setVal(d, 'hb-tr-input', 'I want two coffees');
    await click(d, 'hb-tr-go');
    check(await visible(d, 'hb-consent-agree'), 'consent dialog did not open on the first press');
    const dlg = await text(d, 'hb-dialog');
    check(/third-party/.test(dlg) && /not guaranteed/.test(dlg) && /MyMemory/.test(dlg), 'consent text incomplete: ' + dlg.slice(0, 120));
    check(await d.evaluate('window.__smokeFetch.length === 0'), 'a request was sent before consent');
    await click(d, 'hb-consent-cancel');
    await sleep(100);
    check(await d.evaluate('window.__smokeFetch.length === 0'), 'a request was sent after cancelling');
    check((await text(d, 'hb-tr-out')).trim() === '', 'Spanish shown without consent: ' + await text(d, 'hb-tr-out'));
    check(/Nothing was sent/.test(await text(d, 'hb-tr-online-msg')), 'no visible message after cancel');
    await click(d, 'hb-tr-go');
    await click(d, 'hb-consent-agree');
    await B.waitFor(() => exists(d, 'hb-tr-online-out'), 5000, 100);
    check(/Yo quiero dos caf\u00e9s/.test(await text(d, 'hb-tr-online-out')), 'online result not shown');
    check(/MyMemory/.test(await text(d, 'hb-tr-attrib')), 'attribution missing');
    check(await d.evaluate('window.__smokeFetch.length === 1'), 'expected exactly one request');
    check((await ls(d, 'hb.settings')).online === true, 'consent not saved');
    await click(d, 'hb-tr-add');
    const cards = await ls(d, 'hb.cards');
    check(cards && cards.custom && cards.custom.length === 1, 'card was not added to My cards');
    await click(d, 'hb-tr-go');
    await B.waitFor(() => d.evaluate('window.__smokeFetch.length === 2'), 5000, 100);
    check(!(await visible(d, 'hb-consent-agree')), 'consent was asked again');
  } },
  { id: 'S04', name: 'library-matches-and-variants', fn: async (d, mode) => {
    await fresh(d, mode);
    await sample(d, 0);
    check(/Buenos d\u00edas/.test(await text(d, 'hb-tr-curated-phrase')), 'phrase match missing: ' + await text(d, 'hb-tr-curated'));
    await setVal(d, 'hb-tr-input', 'computer');
    await setVal(d, 'hb-tr-variant', 'es');
    check(/ordenador/.test(await text(d, 'hb-tr-curated')), 'Spain variant not applied: ' + await text(d, 'hb-tr-curated'));
    await setVal(d, 'hb-tr-variant', 'la');
    check(/computadora/.test(await text(d, 'hb-tr-curated')), 'Latin America variant not applied');
    await setVal(d, 'hb-tr-input', 'I am going to eat a quokka');
    await setVal(d, 'hb-tr-variant', 'es');
    check(/does not generate Spanish/.test(await text(d, 'hb-tr-nomatch')), 'no-match message missing');
    check(!(await d.evaluate('document.querySelector("#hb-tr-curated [lang^=es]")')), 'Spanish shown for unmatched text');
    await setVal(d, 'hb-tr-variant', 'la');
    check(await d.evaluate('window.__smokeFetch.length === 0'), 'library lookup sent a request');
  } },
  { id: 'S05', name: 'reverse-lookup-and-empty-input', fn: async (d, mode) => {
    await open(d, baseUrl(mode));
    await tab(d, 'translate');
    await setVal(d, 'hb-tr-input', '');
    await click(d, 'hb-tr-go');
    check(/Type some English/.test(await text(d, 'hb-tr-msg')), 'empty input gave no visible message');
    await click(d, 'hb-tr-swap');
    await setVal(d, 'hb-tr-input', 'casa');
    await click(d, 'hb-tr-go');
    check(/house|home/.test(await text(d, 'hb-tr-out')), 'reverse lookup gave no result');
    await click(d, 'hb-tr-swap');
  } },
  { id: 'S06', name: 'learn-browse-and-search', fn: async (d, mode) => {
    await open(d, baseUrl(mode));
    await tab(d, 'learn');
    check(await d.evaluate('document.querySelectorAll("#hb-learn-list li").length > 10'), 'word list too short');
    await setVal(d, 'hb-learn-search', 'cafe');
    await sleep(100);
    check(await d.evaluate('document.querySelectorAll("#hb-learn-list li").length >= 1 && document.querySelectorAll("#hb-learn-list li").length < 20'), 'accent-insensitive search failed');
    await setVal(d, 'hb-learn-search', '');
    await d.evaluate('document.querySelector("#hb-learn-list input[type=checkbox]").click()');
    await sleep(80);
    const p = await ls(d, 'hb.progress');
    check(p && p.learned.length === 1, 'learned toggle not saved');
    for (const s of ['phrases', 'ff', 'idioms', 'pron', 'nums', 'cog', 'wotd']) {
      await click(d, 'hb-learn-' + s);
      check(await d.evaluate('document.getElementById("hb-learn-body").textContent.length > 40'), 'learn section empty: ' + s);
    }
    await click(d, 'hb-learn-nums');
    await setVal(d, 'hb-num-in', '21');
    check(/veintiuno/.test(await text(d, 'hb-num-out')), 'number converter wrong');
  } },
  { id: 'S07', name: 'flashcard-flip-rate-persist', fn: async (d, mode) => {
    await fresh(d, mode);
    await tab(d, 'cards');
    await click(d, 'hb-deck-start');
    check(await exists(d, 'hb-flip'), 'no card shown');
    check(!(await visible(d, 'hb-rate')), 'rating buttons visible before the flip');
    await click(d, 'hb-flip');
    check(await d.evaluate('document.getElementById("hb-flip-inner").classList.contains("hb-flipped")'), 'card did not flip');
    check(await visible(d, 'hb-rate'), 'rating buttons not shown after the flip');
    await click(d, 'hb-rate-good');
    const c1 = await ls(d, 'hb.cards');
    check(c1 && Object.keys(c1.states).length === 1, 'rating not saved');
    await d.reload();
    await waitReady(d, 'reload');
    const c2 = await ls(d, 'hb.cards');
    check(c2 && Object.keys(c2.states).length === 1 && c2.states[Object.keys(c2.states)[0]].reps === 1, 'rating did not persist after reload');
    await tab(d, 'cards');
    check(/1 of/.test(await text(d, 'hb-goal-text')), 'daily goal did not count the rating: ' + await text(d, 'hb-goal-text'));
    await click(d, 'hb-deck-start');
    await d.press('Escape');
    await sleep(80);
    check(await exists(d, 'hb-deck-start'), 'Esc did not leave the deck');
  } },
  { id: 'S08', name: 'quiz-rounds', fn: async (d, mode) => {
    await fresh(d, mode);
    await tab(d, 'quiz');
    await click(d, 'hb-qz-mc');
    for (let i = 0; i < 10; i++) {
      check(await exists(d, 'hb-qz-prompt'), 'question ' + (i + 1) + ' missing');
      const n = await d.evaluate('document.querySelectorAll("#hb-qz-ans button.hb-option").length');
      check(n === 4, 'options: ' + n);
      const opts = await d.evaluate('[...document.querySelectorAll("#hb-qz-ans button.hb-option")].map((b) => b.textContent.replace(/^\\d+\\.\\s*/, ""))');
      check(new Set(opts).size === 4, 'duplicate options ' + J(opts));
      await d.evaluate('document.querySelector("#hb-qz-ans button.hb-option").click()');
      await sleep(60);
      check(await exists(d, 'hb-qz-next'), 'no Next after answering');
      await d.evaluate('document.getElementById("hb-qz-next").click()');
      await sleep(60);
    }
    check(/of 10 right/.test(await text(d, 'hb-qz-score')), 'results missing');
    await click(d, 'hb-qz-menu');
    await click(d, 'hb-qz-conj');
    await setVal(d, 'hb-qz-input', 'xyz');
    await click(d, 'hb-qz-check');
    check(/Not quite/.test(await text(d, 'hb-qz-fb')), 'wrong conjugation answer not marked');
    await click(d, 'hb-qz-menu').catch(() => {});
    const prog = await ls(d, 'hb.progress');
    check(prog && prog.xp >= 0, 'progress not saved');
    const m = await ls(d, 'hb.mistakes');
    check(Array.isArray(m) && m.length >= 1, 'mistake notebook empty after a wrong answer');
  } },
  { id: 'S09', name: 'scenario-run', fn: async (d, mode) => {
    await fresh(d, mode);
    await tab(d, 'scenarios');
    await click(d, 'hb-sc-s-food');
    for (let i = 0; i < 12; i++) {
      if (await exists(d, 'hb-sc-done')) break;
      check(await exists(d, 'hb-sc-npc'), 'no dialogue line');
      await d.evaluate('(() => { const b = document.querySelector("#hb-sc-card .hb-option"); b.click(); })()');
      await sleep(60);
      check(/repl|Good|Not/.test(await text(d, 'hb-sc-fb')), 'no feedback');
      await d.evaluate('document.getElementById("hb-sc-next").click()');
      await sleep(60);
    }
    check(await exists(d, 'hb-sc-done'), 'scenario did not finish');
    const p = await ls(d, 'hb.progress');
    check(p && p.counters['scen-s-food'] === 1 && p.xp >= 30, 'scenario progress not saved');
  } },
  { id: 'S10', name: 'settings-persist-and-reduced-motion', fn: async (d, mode) => {
    await fresh(d, mode);
    await tab(d, 'progress');
    await setVal(d, 'hb-set-theme', 'dark');
    await setVal(d, 'hb-set-motion', 'on');
    await setVal(d, 'hb-set-size', '2');
    await d.reload();
    await waitReady(d, 'reload');
    const a = await d.evaluate('({ t: document.documentElement.getAttribute("data-theme"), m: document.documentElement.getAttribute("data-motion"), s: document.documentElement.getAttribute("data-size") })');
    check(a.t === 'dark' && a.m === 'reduce' && a.s === '2', 'settings did not persist: ' + J(a));
    check(await selectedTab(d) === 'hb-tab-progress', 'last tab not restored after reload');
    await tab(d, 'cards');
    await click(d, 'hb-deck-start');
    await click(d, 'hb-flip');
    const faces = await d.evaluate('({ f: getComputedStyle(document.getElementById("hb-face-front")).display, b: getComputedStyle(document.getElementById("hb-face-back")).display, tr: getComputedStyle(document.getElementById("hb-flip-inner")).transitionDuration })');
    check(faces.f === 'none' && faces.b !== 'none', 'reduced motion: faces ' + J(faces));
    check(/^0s(, 0s)*$/.test(faces.tr), 'reduced motion: transition ' + faces.tr);
    await tab(d, 'progress');
    await setVal(d, 'hb-set-theme', 'auto');
    await setVal(d, 'hb-set-motion', 'auto');
    await setVal(d, 'hb-set-size', '1');
  } },
  { id: 'S11', name: 'zero-network-with-online-off', fn: async (d, mode, ctx) => {
    await fresh(d, mode);
    const start = d.requests.length;
    await sample(d, 1);
    await tab(d, 'quiz');
    await tab(d, 'learn');
    const fetches = await d.evaluate('window.__smokeFetch.length');
    check(fetches === 0, 'fetch was called ' + fetches + ' times with online mode off');
    const allowed = mode === 'file' ? (u) => u.startsWith('file:') : (u) => u.startsWith(ORIGIN + '/');
    const bad = d.requests.slice(start).filter((u) => !/\/favicon\.ico(\?|$)/.test(u) && u !== 'about:blank' && !allowed(u));
    check(bad.length === 0, 'unexpected requests: ' + bad.slice(0, 3).map((u) => u.slice(0, 60)).join(', '));
    const s = await ls(d, 'hb.settings');
    check(!s || s.online !== true, 'online mode is on by default');
    void ctx;
  } },
  { id: 'S12', name: 'consent-dialog-flow', fn: async (d, mode) => {
    await fresh(d, mode);
    await tab(d, 'translate');
    await setVal(d, 'hb-tr-input', 'Good evening');
    await click(d, 'hb-tr-go');
    check(await visible(d, 'hb-consent-agree') && /third-party/.test(await text(d, 'hb-dialog')), 'consent dialog missing or incomplete');
    check(/5,000/.test(await text(d, 'hb-dialog')) && /50,000/.test(await text(d, 'hb-dialog')), 'limits not shown in consent dialog');
    await d.press('Escape');
    await sleep(80);
    check(!(await visible(d, 'hb-overlay')), 'Esc did not close the dialog');
    check(!((await ls(d, 'hb.settings')) || {}).online, 'Esc turned online on');
    check(await d.evaluate('window.__smokeFetch.length === 0'), 'a request was sent after Esc');
    await tab(d, 'progress');
    await click(d, 'hb-set-online');
    check(await visible(d, 'hb-consent-agree'), 'Settings consent dialog did not open');
    await click(d, 'hb-consent-cancel');
    check(!(await d.evaluate('document.getElementById("hb-set-online").checked')), 'cancel did not leave online off');
    await turnOnOnline(d);
    await tab(d, 'translate');
    check(/Characters used today: 0 of 5,000/.test(await text(d, 'hb-tr-usage')), 'counter text: ' + await text(d, 'hb-tr-usage'));
    check(await d.evaluate('window.__smokeFetch.length === 0'), 'a request was sent before the explicit click');
  } },
  { id: 'S13', name: 'online-failure-shows-library-only', fn: async (d, mode) => {
    await fresh(d, mode);
    await d.evaluate('window.__smokeMode = "fail"');
    await turnOnOnline(d);
    await tab(d, 'translate');
    await setVal(d, 'hb-tr-input', 'Good morning');
    await click(d, 'hb-tr-go');
    await B.waitFor(() => d.evaluate('document.getElementById("hb-tr-online-msg").textContent.indexOf("does not generate Spanish") >= 0'), 5000, 100);
    check(/does not generate Spanish/.test(await text(d, 'hb-tr-online-msg')), 'no visible fallback message: ' + await text(d, 'hb-tr-online-msg'));
    check((await text(d, 'hb-tr-out')).trim() === '', 'generated or online text shown after failure: ' + await text(d, 'hb-tr-out'));
    check(/Buenos d\u00edas/.test(await text(d, 'hb-tr-curated-phrase')), 'library match not shown');
    const f = await d.evaluate('window.__smokeFetch');
    check(f.length === 1 && f[0].indexOf('https://api.mymemory.translated.net/get?q=') === 0 && f[0].indexOf('&de=') < 0, 'request shape: ' + J(f));
    check(!d.requests.some((u) => /mymemory/i.test(u)), 'the real service was contacted');
    check(await exists(d, 'hb-tr-online-out') === false, 'online result shown after failure');
  } },
  { id: 'S14', name: 'online-success-counter-email', fn: async (d, mode) => {
    await fresh(d, mode);
    await d.evaluate('window.__smokeMode = "low"');
    await turnOnOnline(d);
    await tab(d, 'progress');
    await setVal(d, 'hb-set-email', 'not an email');
    await click(d, 'hb-set-email-save');
    check(/does not look like/.test(await text(d, 'hb-set-email-msg')), 'invalid email not rejected visibly');
    check(!(await ls(d, 'hb.settings')).email, 'invalid email was saved');
    await setVal(d, 'hb-set-email', 'user@example.invalid');
    await click(d, 'hb-set-email-save');
    check(/50,000/.test(await text(d, 'hb-set-usage')), 'limit did not switch to 50,000: ' + await text(d, 'hb-set-usage'));
    await tab(d, 'translate');
    await setVal(d, 'hb-tr-input', 'I want two coffees');
    await click(d, 'hb-tr-go');
    await B.waitFor(() => exists(d, 'hb-tr-online-out'), 5000, 100);
    check(await exists(d, 'hb-tr-online-out'), 'online result missing');
    check(await exists(d, 'hb-tr-lowconf'), 'low confidence badge missing for a low match');
    check(/MyMemory/.test(await text(d, 'hb-tr-attrib')), 'attribution missing');
    check(/Characters used today: 18 of 50,000/.test(await text(d, 'hb-tr-usage')), 'counter did not update: ' + await text(d, 'hb-tr-usage'));
    const f = await d.evaluate('window.__smokeFetch');
    check(f.length === 1 && f[0].indexOf('&de=user%40example.invalid') > 0, 'email not sent as de: ' + J(f).replace(/user%40example\.invalid/, 'EMAIL'));
    await click(d, 'hb-tr-add');
    const c = await ls(d, 'hb.cards');
    check(c && c.custom.length === 1, 'online version not added to flashcards');
    // export must not contain the email or the online counter
    await tab(d, 'progress');
    await click(d, 'hb-export');
    const exp = await d.evaluate('(async () => { const b = window.__smokeBlobs[window.__smokeBlobs.length - 1]; return b ? await b.text() : null; })()');
    check(exp && JSON.parse(exp).app === 'hablemos', 'export missing');
    check(exp.indexOf('example.invalid') < 0 && exp.indexOf('hb.online') < 0 && exp.indexOf('"email"') < 0, 'export leaks the email or the usage counter');
    check(await d.evaluate('window.__smokeDownloads.indexOf("hablemos-progress.json") >= 0'), 'download not triggered');
    await click(d, 'hb-set-email-clear');
    check(!(await ls(d, 'hb.settings')).email, 'email not cleared');
    check(!d.requests.some((u) => /mymemory/i.test(u)), 'the real service was contacted');
  } },
  { id: 'S15', name: 'tab-arrow-keys', fn: async (d, mode) => {
    await fresh(d, mode);
    await waitFocus(d);
    const selected = (id) => B.waitFor(async () => (await selectedTab(d)) === id, 3000, 50);
    await d.evaluate('document.getElementById("hb-tab-help").focus()');
    await B.waitFor(() => d.evaluate('document.activeElement && document.activeElement.id === "hb-tab-help"'), 3000, 50);
    await d.evaluate('window.__keys = []; document.addEventListener("keydown", (e) => window.__keys.push(e.key + "@" + (e.target.id || e.target.tagName)), true); 1');
    await d.press('ArrowRight');
    check(await selected('hb-tab-translate'), 'ArrowRight did not move to Translate (selected ' + await selectedTab(d) + '; keys ' + (await d.evaluate('JSON.stringify(window.__keys)')) + '; active ' + (await d.evaluate('document.activeElement.id')) + '; hash ' + (await d.evaluate('location.hash')) + ')');
    check(await d.evaluate('document.activeElement.id') === 'hb-tab-translate', 'focus did not follow');
    await d.press('End');
    check(await selected('hb-tab-progress'), 'End did not select the last tab');
    await d.press('Home');
    check(await selected('hb-tab-help'), 'Home did not select the first tab');
    await d.press('ArrowLeft');
    check(await selected('hb-tab-progress'), 'ArrowLeft did not wrap');
    check(await d.evaluate('document.getElementById("hb-tab-translate").getAttribute("tabindex")') === '-1', 'roving tabindex missing');
  } },
  { id: 'S16', name: 'focus-visible', fn: async (d, mode) => {
    await fresh(d, mode);
    await tab(d, 'translate');
    await waitFocus(d);
    await d.evaluate('document.getElementById("hb-tab-translate").focus()');
    const problems = [];
    const seen = new Set();
    for (let i = 0; i < 8; i++) { // stays inside the page: the Translate tab has more than 8 tab stops
      await d.press('Tab');
      await sleep(40);
      const fx = await d.evaluate('(() => { const e = document.activeElement; if (!e || e === document.body) return null; const c = getComputedStyle(e); return { id: e.id || e.tagName, style: c.outlineStyle, w: parseFloat(c.outlineWidth), sh: c.boxShadow, fv: e.matches(":focus-visible"), hf: document.hasFocus() }; })()');
      if (!fx || !fx.hf) break; // focus left the page (end of the tab order)
      seen.add(fx.id);
      if ((fx.style === 'none' || fx.w < 2) && fx.sh === 'none') problems.push(fx.id + ' outline ' + fx.style + ' ' + fx.w + ' fv=' + fx.fv + ' hasFocus=' + fx.hf + ' step=' + i);
    }
    await B.clickEl(d, byId('hb-brand')); // give the keyboard focus back to the page
    check(seen.size >= 6, 'Tab reached only ' + seen.size + ' elements');
    check(problems.length === 0, problems.slice(0, 5).join('; '));
  } },
  { id: 'S17', name: 'accessibility-basics', fn: async (d, mode) => {
    await open(d, baseUrl(mode));
    for (const t of TAB_NAMES) {
      await tab(d, t);
      const a = await d.evaluate('(() => {\n' +
        '  const unlabelled = [];\n' +
        '  for (const el of document.querySelectorAll("input, select, textarea")) {\n' +
        '    if (el.type === "hidden") continue;\n' +
        '    const named = (el.id && document.querySelector("label[for=\\"" + el.id + "\\"]")) || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");\n' +
        '    if (!named) unlabelled.push(el.id || el.tagName);\n' +
        '  }\n' +
        '  const noName = [...document.querySelectorAll("button")].filter((b) => !b.textContent.trim() && !b.getAttribute("aria-label")).map((b) => b.id || "button");\n' +
        '  const badIds = [...document.querySelectorAll("[id]")].filter((e) => e.id.indexOf("hb-") !== 0).map((e) => e.id);\n' +
        '  return { unlabelled, noName, badIds, lang: document.documentElement.getAttribute("lang"), h1: document.querySelectorAll("h1").length, live: !!document.querySelector("[aria-live=polite]") };\n' +
        '})()');
      check(a.unlabelled.length === 0, t + ': unlabelled controls ' + a.unlabelled.slice(0, 6).join(','));
      check(a.noName.length === 0, t + ': buttons without a name ' + a.noName.join(','));
      check(a.badIds.length === 0, t + ': ids without the hb- prefix ' + a.badIds.slice(0, 5).join(','));
      check(a.lang === 'en' && a.h1 === 1 && a.live, t + ': lang/h1/live ' + J(a));
    }
    const dups = await d.evaluate(DUP_IDS);
    check(dups.length === 0, 'duplicate ids ' + dups.join(','));
    await sample(d, 0);
    check(await d.evaluate('document.querySelectorAll("#hb-tr-curated [lang^=es]").length >= 1'), 'Spanish text lacks a lang attribute');
  } },
  { id: 'S18', name: 'responsive-375', fn: async (d, mode) => {
    await open(d, baseUrl(mode));
    await sample(d, 0);
    await d.setViewport(375, 800);
    try {
      await sleep(300);
      for (const t of TAB_NAMES) {
        await d.evaluate(byId('hb-tab-' + t) + '.click()');
        await sleep(200);
        const r = await d.evaluate('({ sw: document.documentElement.scrollWidth, iw: window.innerWidth })');
        check(r.iw <= 400, 'viewport not applied: innerWidth ' + r.iw);
        check(r.sw <= r.iw + 1, t + ' overflows: scrollWidth ' + r.sw + ' > ' + r.iw);
      }
    } finally { await d.setViewport(1400, 1000); }
  } },
  { id: 'S19', name: 'import-rejects-bad-and-roundtrips', fn: async (d, mode) => {
    await fresh(d, mode);
    await tab(d, 'progress');
    const bad = await d.evaluate('(() => { const S = Hablemos.store; return [S.parseImport("not json").ok, S.parseImport(JSON.stringify({ app: "other" })).ok, S.parseImport(JSON.stringify({ app: "hablemos", schema: 1, data: { progress: { xp: "x" } } })).ok]; })()');
    check(bad[0] === false && bad[1] === false && bad[2] === true, 'import validation: ' + J(bad));
    await click(d, 'hb-export');
    const exp = await d.evaluate('(async () => window.__smokeBlobs[window.__smokeBlobs.length - 1].text())()');
    const again = await d.evaluate('(() => { const S = Hablemos.store; const a = JSON.parse(' + J(exp) + '); const r = S.parseImport(' + J(exp) + '); return JSON.stringify(S.buildExport(r.data, a.exportedAt)) === JSON.stringify(a); })()');
    check(again, 'export -> import -> export is not identical');
  } },
  { id: 'S20', name: 'no-csp-violations-and-local-requests-only', fn: async (d, mode, ctx) => {
    await harvestCsp(d);
    const allowed = mode === 'file' ? (u) => u.startsWith('file:') : (u) => u.startsWith(ORIGIN + '/');
    const bad = d.requests.slice(ctx.requestStart).filter((u) => !/\/favicon\.ico(\?|$)/.test(u) && u !== 'about:blank' && !allowed(u));
    check(bad.length === 0, 'unexpected requests: ' + bad.slice(0, 5).map((u) => u.slice(0, 80)).join(', '));
    const cspMeta = await d.evaluate('window.Hablemos && window.Hablemos.api ? window.Hablemos.api.CSP_META : null');
    check(cspMeta === true, 'CSP_META in page ' + cspMeta);
    check(d.cspTotal === ctx.cspStart, 'securitypolicyviolation events: ' + (d.cspTotal - ctx.cspStart));
    const unexpected = await d.evaluate('window.__smokeFetch.filter((u) => u.indexOf("UNEXPECTED") === 0)');
    check(unexpected.length === 0, 'unexpected fetch calls: ' + J(unexpected));
  } }
];

// ---------------------------------------------------------------- runner
function report(browser, mode, id, name, ok, detail) {
  results.push({ browser, mode, id, ok });
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + browser + ' ' + mode + ' ' + id + ' ' + name + (ok ? '' : ' - ' + detail));
}
async function runMode(d, mode) {
  const ctx = { requestStart: d.requests.length, cspStart: d.cspTotal };
  const errs17 = [];
  for (const sc of SCENARIOS) {
    if (ONLY && !ONLY.includes(sc.id)) continue;
    const errStart = d.errors.length;
    let ok = true;
    let detail = '';
    try { await sc.fn(d, mode, ctx); } catch (e) { ok = false; detail = String((e && e.message) || e).split('\n')[0]; }
    await sleep(100);
    const errs = d.errors.slice(errStart);
    let dups = [];
    try { dups = await d.evaluate(DUP_IDS); } catch (e) { /* page gone */ }
    if (errs.length) errs17.push(sc.id + ' errors: ' + errs.slice(0, 3).join(' | '));
    if (dups && dups.length) errs17.push(sc.id + ' duplicate ids: ' + dups.join(','));
    report(d.name, mode, sc.id, sc.name, ok, detail);
  }
  report(d.name, mode, 'S21', 'no-console-errors', errs17.length === 0, errs17.join('; '));
}
function startServer() {
  return new Promise((resolve, reject) => {
    const probe = http.get({ host: '127.0.0.1', port: PORT, path: '/', timeout: 1500 }, (res) => {
      res.resume();
      reject(new Error('port ' + PORT + ' is already in use; choose another --port'));
    });
    probe.on('timeout', () => probe.destroy(new Error('timeout')));
    probe.on('error', () => {
      const proc = spawn(process.execPath, [path.join(__dirname, 'serve.cjs'), '--port', String(PORT), '--root', ROOT], { stdio: ['ignore', 'pipe', 'pipe'] });
      children.push(proc);
      let out = '';
      proc.stdout.on('data', (c) => { out += c; });
      proc.stderr.on('data', (c) => { out += c; });
      B.waitFor(() => new Promise((ok) => {
        const r = http.get({ host: '127.0.0.1', port: PORT, path: '/', timeout: 1000 }, (res) => { res.resume(); ok(res.statusCode === 200); });
        r.on('error', () => ok(false));
        r.on('timeout', () => { r.destroy(); ok(false); });
      }), 8000, 200).then((up) => (up ? resolve(proc) : reject(new Error('serve.cjs did not start: ' + out.slice(-200)))));
    });
  });
}
function cleanup() { for (const p of children) B.killTree(p); }
async function main() {
  const watchdog = setTimeout(() => { console.error('Smoke test timed out after 40 minutes.'); cleanup(); process.exit(1); }, 40 * 60 * 1000);
  process.on('SIGINT', () => { cleanup(); process.exit(1); });
  if (MODES.includes('http')) {
    try { await startServer(); } catch (e) { console.error('Cannot run http mode: ' + e.message); cleanup(); process.exit(2); }
  }
  let ran = 0;
  for (const name of BROWSERS) {
    const exe = B.resolveExe(name, opts['--' + name]);
    if (!exe) { console.log('SKIP ' + name + ': executable not found'); continue; }
    let d;
    try {
      d = name === 'edge' ? await B.openEdge(exe, { cdpPort: CDP_PORT, keep: KEEP }) : await B.openFirefox(exe, { bidiPort: BIDI_PORT, keep: KEEP });
    } catch (e) {
      console.log('SKIP ' + name + ': could not start (' + String(e.message).split('\n')[0] + ')');
      continue;
    }
    children.push(d.proc);
    ran++;
    d.cspTotal = 0;
    console.log('# ' + name + ': ' + (d.version || d.label));
    try {
      await d.addPreload(HOOK);
      for (const mode of MODES) await runMode(d, mode);
    } catch (e) {
      report(name, '-', 'S00', 'driver', false, String(e.message).split('\n')[0]);
    } finally {
      try { await d.close(); } catch (e) { /* killed in cleanup */ }
    }
  }
  cleanup();
  clearTimeout(watchdog);
  const failed = results.filter((r) => !r.ok);
  console.log('Summary: ' + results.length + ' checks, ' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed; browsers run: ' + ran + '.');
  if (ran === 0) { console.log('No browser could run.'); process.exit(2); }
  process.exit(failed.length ? 1 : 0);
}
main().catch((e) => { console.error((e && e.stack) || e); cleanup(); process.exit(1); });










