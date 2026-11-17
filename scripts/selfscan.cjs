'use strict';
// Self-scan (module and CLI):  node scripts/selfscan.cjs [dir]
// Default dir: dist/hablemos-public. Exit 0 = no hits, 1 = hits, 2 = bad arguments.
// Checks that need no private term file: absolute local paths, account and employer-style names, internal tool names,
// repository-owner URLs, real-looking e-mail addresses, brand names from scripts/brands.json (may be empty).
// Output: "file:line <check> [N chars]", never the matched text.
const fs = require('fs');
const path = require('path');
const deny = require('./denylist.cjs');
const { readZip } = require('./zip.cjs');
const ROOT = path.resolve(__dirname, '..');
const BRANDS = JSON.parse(fs.readFileSync(path.join(__dirname, 'brands.json'), 'utf8'));
const SKIP_NAMES = new Set(['.denylist.local', 'dist', 'node_modules', '.git']);
// Built from fragments so this file does not contain the words it looks for.
const j = (...p) => p.join('');
const WORDS = [j('Ama', 'zon'), j('a', '2z'), j('Kau', 'shik'), j('Anir', 'udh'), j('anik', 'aus'), j('Vendor ', 'Specialist'), j('Ki', 'ro ', 'Pro', 'jects'),
  j('VS ', 'Copilot'), j('Quick ', 'agent'), j('Selection ', 'Central'), j('I', 'IM ', 'Jam', 'mu'), j('Win', 'ston')];
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); }
const CHECKS = [
  { kind: 'absolute local path', re: new RegExp('[A-Za-z]:[\\\\/]+' + 'Users' + '[\\\\/]', 'i') },
  { kind: 'home path', re: new RegExp('\\/' + 'Users' + '\\/[^\\/\\s]+\\/') },
  { kind: 'home path', re: new RegExp('\\/' + 'home' + '\\/[^\\/\\s]+\\/') },
  { kind: 'private name or tool', re: new RegExp('(?<![A-Za-z0-9])(?:' + WORDS.map((w) => escapeRe(w).replace(/ /g, '\\s+')).join('|') + ')(?![A-Za-z0-9])', 'i') },
  { kind: 'agent folder', re: new RegExp('(?<![A-Za-z0-9])\\.' + 'agents' + '(?![A-Za-z0-9])') },
  { kind: 'repository owner URL', re: new RegExp('github\\.com\\/(?!your-username|YOUR-USERNAME|OWNER|<)[A-Za-z0-9_-]+', 'i') },
  { kind: 'real-looking e-mail address', re: new RegExp('[A-Za-z0-9._%+-]+' + '@' + '[A-Za-z0-9.-]+\\.[A-Za-z]{2,}'), allow: deny.isAllowedEmail }
];
function escapedBrands(list) { return list.length ? new RegExp('(?<![A-Za-z0-9])(?:' + list.map((b) => escapeRe(b).replace(/ /g, '\\s+')).join('|') + ')(?![A-Za-z0-9])', 'g') : null; }
const BRAND_RE = escapedBrands(BRANDS);
const fatalUtf8 = new TextDecoder('utf-8', { fatal: true });
function isTextName(name) {
  const base = path.posix.basename(String(name).replace(/\\/g, '/'));
  return deny.TEXT_NAMES.has(base) || deny.TEXT_EXT.has(path.extname(base).toLowerCase());
}
function scanString(label, text) {
  const hits = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const at = label + ':' + (i + 1);
    for (const c of CHECKS) {
      const g = new RegExp(c.re.source, c.re.flags.includes('g') ? c.re.flags : c.re.flags + 'g');
      let m;
      while ((m = g.exec(line)) !== null) {
        if (!(c.allow && c.allow(m[0]))) hits.push(at + ' ' + c.kind + ' [' + m[0].length + ' chars]');
        if (m[0].length === 0) g.lastIndex++;
      }
    }
    if (BRAND_RE) { BRAND_RE.lastIndex = 0; let m; while ((m = BRAND_RE.exec(line)) !== null) hits.push(at + ' brand [' + m[0].length + ' chars]'); }
  });
  return hits;
}
function scanBuffer(label, buf) {
  let text;
  try { text = fatalUtf8.decode(buf); } catch (e) { return [label + ': undecodable text']; }
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  return scanString(label, text);
}
function walk(dir, base, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_NAMES.has(ent.name)) continue;
    const abs = path.join(dir, ent.name);
    const rel = base ? base + '/' + ent.name : ent.name;
    if (ent.isDirectory()) walk(abs, rel, out); else if (ent.isFile()) out.push({ abs, rel });
  }
  return out;
}
function scanDir(dir) {
  const hits = [];
  let files = 0;
  for (const e of walk(dir, '', [])) {
    if (!isTextName(e.rel)) continue;
    files++;
    for (const h of scanBuffer(e.rel, fs.readFileSync(e.abs))) hits.push(h);
  }
  return { files, hits };
}
function scanZip(label, buf) {
  let entries;
  try { entries = readZip(buf); } catch (e) { return { files: 0, hits: [label + ': unparseable zip'] }; }
  const hits = [];
  let files = 0;
  for (const e of entries) {
    if (!isTextName(e.name)) continue;
    files++;
    for (const h of scanBuffer(label + '!' + e.name, e.data)) hits.push(h);
  }
  return { files, hits };
}
function textHasHit(text) { return scanString('text', String(text)).length > 0; }
module.exports = { BRANDS, CHECKS, scanString, scanBuffer, scanDir, scanZip, isTextName, textHasHit };
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.some((a) => a.startsWith('--')) || args.length > 1) { console.error('Usage: node scripts/selfscan.cjs [dir]'); process.exit(2); }
  const dir = path.resolve(args[0] || path.join(ROOT, 'dist', 'hablemos-public'));
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) { console.error('Not a folder: ' + (args[0] || 'dist/hablemos-public')); process.exit(2); }
  const r = scanDir(dir);
  for (const h of r.hits) console.log('HIT: ' + h);
  console.log('Self-scanned ' + r.files + ' text files: ' + r.hits.length + ' self-scan hits.');
  process.exit(r.hits.length ? 1 : 0);
}

