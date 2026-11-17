'use strict';
// Screenshot capture:  node scripts/capture-screenshots.cjs [--out docs] [--edge <path>] [--cdp-port 9401]
// Headless Edge via CDP, file:// mode, viewport 1100 x 900, fresh profile, synthetic demo data only (no personal data, no e-mail).
// The online result screenshot uses a fixture reply injected into window.fetch; the real service is never contacted.
// Before each shot the page's visible text is checked against the deny-list (including .denylist.local), the operating-system
// user name and the self-scan patterns; any hit refuses the shot and exits 1 without printing the term.
// A person must still look at every image before publishing.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const B = require('./browser.cjs');
const deny = require('./denylist.cjs');
const selfscan = require('./selfscan.cjs');

const ROOT = path.resolve(__dirname, '..');
const RESERVED_PORT = 4317;
const USAGE = 'Usage: node scripts/capture-screenshots.cjs [--out docs] [--edge <path>] [--cdp-port 9401]';
const MAX_HEIGHT = 1500;
const byId = B.byId;
const sleep = B.sleep;
function usage(msg) { console.error(msg + '\n' + USAGE); process.exit(2); }
function parseArgs(argv) {
  const o = { out: 'docs', edge: null, cdpPort: 9401 };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a !== '--out' && a !== '--edge' && a !== '--cdp-port') usage('unknown option: ' + a);
    if (seen.has(a)) usage(a + ' given twice');
    seen.add(a);
    const val = argv[i + 1];
    if (val === undefined || val.startsWith('--')) usage(a + ' needs a value');
    i++;
    if (a === '--out') o.out = val; else if (a === '--edge') o.edge = val; else o.cdpPort = Number(val);
  }
  if (!Number.isInteger(o.cdpPort) || o.cdpPort < 1024 || o.cdpPort > 65535) usage('--cdp-port must be an integer from 1024 to 65535');
  if (o.cdpPort === RESERVED_PORT) usage('Port ' + RESERVED_PORT + ' is reserved for another local tool; choose another port.');
  return o;
}
const ARGS = parseArgs(process.argv.slice(2));
const OUT = path.resolve(ROOT, ARGS.out);
if (typeof WebSocket !== 'function') { console.error('Node 22+ is required (global WebSocket).'); process.exit(2); }

function matchers() {
  const terms = deny.loadTerms({ root: ROOT }).terms.slice();
  let user = '';
  try { user = os.userInfo().username || ''; } catch (e) { /* no user name available */ }
  if (user) terms.push(user);
  return deny.buildMatchers(terms);
}
const HOOK = '(function () {\n' +
  '  if (window.__shotHooked) return; window.__shotHooked = true;\n' +
  '  window.fetch = function (url) {\n' +
  '    if (String(url).indexOf("https://api.mymemory.translated.net/") === 0) {\n' +
  '      var body = { responseData: { translatedText: "Much\\u00edsimas gracias.", match: 0.92 }, responseStatus: 200, matches: [] };\n' +
  '      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));\n' +
  '    }\n' +
  '    return Promise.reject(new TypeError("blocked"));\n' +
  '  };\n' +
  '})();';
const READY = '(() => !!(window.Hablemos && window.Hablemos.ui && window.Hablemos.ui.panels && document.querySelector("[role=tab][aria-selected=true]")))()';
async function open(d, url) {
  await d.goto('about:blank');
  await d.goto(url);
  if (!(await B.waitFor(() => d.evaluate(READY), 15000, 100))) throw new Error('the app did not start');
}
async function click(d, id) { await B.clickEl(d, byId(id)); await sleep(150); }
async function tab(d, name) { await click(d, 'hb-tab-' + name); await sleep(150); }
async function setVal(d, id, v) {
  await d.evaluate('(() => { const el = ' + byId(id) + '; el.value = ' + JSON.stringify(String(v)) + '; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); return 1; })()');
}
const HIDE_SCROLLBAR = '(() => { if (window.__shotSheet) return true; const s = new CSSStyleSheet();' +
  ' s.replaceSync("html { scrollbar-width: none; } ::-webkit-scrollbar { width: 0; height: 0; }");' +
  ' document.adoptedStyleSheets = document.adoptedStyleSheets.concat([s]); window.__shotSheet = s; return true; })()';
function boxExpr(fromId, toId) {
  return '(() => { const a = document.getElementById(' + JSON.stringify(fromId) + '); const b = document.getElementById(' + JSON.stringify(toId) + ');' +
    ' if (!a || !b) return null; const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect();' +
    ' const x = Math.min(ra.left, rb.left), y = ra.top, r = Math.max(ra.right, rb.right), btm = rb.bottom;' +
    ' return { x: x + window.scrollX, y: y + window.scrollY, width: r - x, height: btm - y }; })()';
}
async function shot(d, M, file, fromId, toId) {
  await d.evaluate(HIDE_SCROLLBAR);
  await d.evaluate('document.getElementById("hb-live").textContent = ""; window.scrollTo(0, 0)');
  await sleep(250);
  const visibleText = await d.evaluate('document.body.innerText');
  if (deny.textHasHit(visibleText, M) || selfscan.textHasHit(visibleText)) {
    throw Object.assign(new Error('REFUSED: the visible text for ' + file + ' contains a deny-list term, the user name or a private pattern.'), { refused: true });
  }
  const box = await d.evaluate(boxExpr(fromId, toId || fromId));
  if (!box || !box.width || !box.height) throw new Error('#' + fromId + ' is not visible for ' + file);
  const clip = { x: Math.floor(box.x), y: Math.floor(box.y), width: Math.ceil(box.width), height: Math.min(MAX_HEIGHT, Math.ceil(box.height)) };
  const png = await d.screenshot({ clip, captureBeyondViewport: true });
  const hits = [];
  deny.scanPng(file, png, M, hits);
  if (hits.length) throw Object.assign(new Error('REFUSED: ' + hits[0]), { refused: true });
  fs.writeFileSync(path.join(OUT, file), png);
  console.log('Saved ' + path.relative(ROOT, path.join(OUT, file)).replace(/\\/g, '/') + ' (' + clip.width + 'x' + clip.height + ')');
}

// Synthetic demo progress (no real person): ~5-day streak, some XP, a few cards.
const SEED = '(() => {\n' +
  '  const U = Hablemos.util; const d = new Date(); const today = U.dayNumber(d.getFullYear(), d.getMonth() + 1, d.getDate());\n' +
  '  const cal = {}; for (let i = 0; i < 34; i++) { if (i % 3 !== 2) cal[String(today - i)] = 8 + ((i * 7) % 30); }\n' +
  '  const states = {}; ["w0001","w0002","w0003","w0004","w0005","w0006"].forEach((id, k) => { states[id] = { id, ease: 2.5, interval: 3 + k, reps: 2, lapses: 0, due: today + k - 2, last: today - 3 }; });\n' +
  '  localStorage.setItem("hb.helpSeen", "true");\n' +
  '  localStorage.setItem("hb.progress", JSON.stringify({ xp: 640, streak: 5, bestStreak: 9, lastGoalDay: today, learned: ["w0001","w0002","w0003","w0004","w0005","w0006","w0007","w0008"], badges: { "first-card": today - 20, "streak-7": today - 8 }, counters: { cardsRated: 42, conjCorrect: 12, "scen-s-food": 1 }, flashXp: { day: 0, xp: 0 } }));\n' +
  '  localStorage.setItem("hb.calendar", JSON.stringify(cal));\n' +
  '  localStorage.setItem("hb.cards", JSON.stringify({ states, custom: [{ id: "c-demo1", es: "\\u00bfC\\u00f3mo se dice esto?", en: "How do you say this?" }], newDay: { day: today, n: 3 } }));\n' +
  '  localStorage.setItem("hb.settings", JSON.stringify({ online: true, lastTab: "translate" }));\n' +
  '  return 1; })()';

async function main() {
  const exe = B.resolveExe('edge', ARGS.edge);
  if (!exe) { console.error('Microsoft Edge was not found. Pass --edge <path> or set EDGE_PATH.'); process.exit(2); }
  fs.mkdirSync(OUT, { recursive: true });
  const M = matchers();
  const url = pathToFileURL(path.join(ROOT, 'index.html')).href;
  const d = await B.openEdge(exe, { cdpPort: ARGS.cdpPort });
  let code = 0;
  try {
    console.log('Browser: ' + d.version);
    await d.addPreload(HOOK);
    await d.setViewport(1100, 900);
    await open(d, url);
    await d.evaluate('localStorage.clear()');
    await open(d, url);
    await shot(d, M, 'screenshot-help.png', 'hb-main');
    await d.evaluate(SEED);
    await open(d, url);
    // Translate tab: exact library match (nothing is sent).
    await tab(d, 'translate');
    await d.evaluate('document.querySelectorAll("#hb-tr-examples button")[0].click()');
    await sleep(200);
    await shot(d, M, 'screenshot-translate.png', 'hb-main');
    // Online result (fixture reply) with the library match next to it.
    await setVal(d, 'hb-tr-input', 'Thank you very much');
    await click(d, 'hb-tr-go');
    await B.waitFor(() => d.evaluate('!!document.getElementById("hb-tr-online-out")'), 5000, 100);
    await sleep(200);
    await shot(d, M, 'screenshot-online-compare.png', 'hb-tr-out', 'hb-tr-curated');
    await tab(d, 'learn');
    await shot(d, M, 'screenshot-learn.png', 'hb-main');
    await tab(d, 'cards');
    await setVal(d, 'hb-deck-kind', 'mine');
    await click(d, 'hb-deck-start');
    await click(d, 'hb-flip');
    await sleep(700);
    await shot(d, M, 'screenshot-flashcards.png', 'hb-main');
    await tab(d, 'quiz');
    await click(d, 'hb-qz-conj');
    await shot(d, M, 'screenshot-quiz.png', 'hb-main');
    await tab(d, 'scenarios');
    await click(d, 'hb-sc-s-food');
    await d.evaluate('document.querySelector("#hb-sc-card .hb-option").click()');
    await sleep(200);
    await shot(d, M, 'screenshot-scenario.png', 'hb-main');
    await tab(d, 'progress');
    await shot(d, M, 'screenshot-progress.png', 'hb-main');
    if (d.errors.length) { console.error('Page errors: ' + d.errors.length + '; first: ' + String(d.errors[0]).slice(0, 120)); code = 1; }
    else console.log('Done: 8 screenshots, visible-text scan clean. Look at every image before publishing.');
  } catch (e) {
    console.error(e.refused ? e.message : 'ERROR: ' + e.message);
    code = 1;
  } finally {
    await d.close();
  }
  process.exit(code);
}
main().catch((e) => { console.error('ERROR: ' + e.message); process.exit(1); });


