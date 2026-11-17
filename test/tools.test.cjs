'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeZip, readZip } = require('../scripts/zip.cjs');
const deny = require('../scripts/denylist.cjs');
const self = require('../scripts/selfscan.cjs');
const pkg = require('../scripts/package-public.cjs');
const ROOT = path.resolve(__dirname, '..');

const j = (...p) => p.join('');
test('zip: writer and reader round trip with forward-slash entry names', () => {
  const entries = [{ name: 'p/a.txt', data: Buffer.from('hola') }, { name: 'p/dir/b.js', data: Buffer.from('x'.repeat(5000)) }, { name: 'p/c.json', data: Buffer.alloc(0) }];
  const back = readZip(writeZip(entries));
  assert.deepStrictEqual(back.map((e) => e.name), entries.map((e) => e.name));
  back.forEach((e, i) => assert.ok(e.data.equals(entries[i].data)));
  assert.ok(back.every((e) => !e.name.includes('\\')));
  assert.throws(() => readZip(Buffer.from('not a zip')));
});
test('deny-list: generic patterns flag local paths and real-looking e-mail but allow reserved domains', () => {
  const m = deny.buildMatchers([]);
  assert.ok(deny.textHasHit('see ' + j('C:\\', 'Users', '\\someone\\file'), m));
  assert.ok(deny.textHasHit('write to ' + j('person', '@', 'company.com'), m));
  assert.ok(!deny.textHasHit('user' + '@' + 'example.invalid', m));
  assert.ok(!deny.textHasHit('user' + '@' + 'mail.example.org', m));
  assert.ok(deny.isReservedDomain('a.example.test'));
  assert.ok(!deny.isReservedDomain('example.io'));
});
test('deny-list: private terms match case-insensitively across separators; short terms need word edges', () => {
  const m = deny.buildMatchers(['Two Words', 'ab1']);
  assert.ok(deny.textHasHit('two_words', m));
  assert.ok(deny.textHasHit('TWO-WORDS', m));
  assert.ok(deny.textHasHit('x ab1 y', m));
  assert.ok(!deny.textHasHit('xab1y', m));
  assert.deepStrictEqual(deny.parseTermList('# c\nfoo # note\n\nbar\n'), ['foo', 'bar']);
});
test('self-scan: flags paths, names, owner URLs and real-looking e-mail; allows placeholders', () => {
  assert.ok(self.textHasHit(j('C:\\', 'Users', '\\x\\y')));
  assert.ok(self.textHasHit('built at ' + j('Ama', 'zon')));
  assert.ok(self.textHasHit('https://' + 'github.com/' + 'someone/hablemos'));
  assert.ok(!self.textHasHit('https://' + 'github.com/' + 'your-username/hablemos'));
  assert.ok(self.textHasHit('mail ' + j('me', '@', 'company.com')));
  assert.ok(!self.textHasHit('mail user' + '@' + 'example.invalid'));
  assert.ok(!self.textHasHit('Hablemos teaches Spanish to English speakers.'));
});
test('package: path rules refuse private, log, zip, hidden and build files', () => {
  assert.ok(pkg.pathProblem('.denylist.local'));
  assert.ok(pkg.pathProblem('logs/run.txt'));
  assert.ok(pkg.pathProblem('docs/run.log'));
  assert.ok(pkg.pathProblem('hablemos.zip'));
  assert.ok(pkg.pathProblem('dist/x.js'));
  assert.ok(pkg.pathProblem('.' + 'agents/x.md'));
  assert.ok(pkg.pathProblem('node_modules/x/index.js'));
  assert.strictEqual(pkg.pathProblem('.gitignore'), null);
  assert.strictEqual(pkg.pathProblem('.nojekyll'), null);
  assert.strictEqual(pkg.pathProblem('js/api.js'), null);
});
test('package: allow-list covers the public files and never the private ones', () => {
  const files = pkg.allowList(ROOT);
  ['index.html', 'README.md', 'LICENSE', '.gitignore', '.nojekyll', 'package.json', 'css/app.css', 'js/api.js', 'data/words.js', 'scripts/package-public.cjs', 'docs/SPEC.md'].forEach((f) => assert.ok(files.includes(f), f));
  assert.ok(!files.some((f) => /denylist\.local|\.log$|\.zip$|^logs\/|^dist\//.test(f)));
  assert.deepStrictEqual(files, files.slice().sort());
});
test('package: a real package run is clean (0 deny-list hits, 0 self-scan hits) and the zip has forward slashes', () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hb-pkg-')), 'hablemos-public');
  try {
    const r = pkg.packagePublic({ out, requireLocal: fs.existsSync(path.join(ROOT, '.denylist.local')) });
    assert.deepStrictEqual(r.problems, []);
    assert.strictEqual(r.ok, true, r.lines.join('\n'));
    assert.deepStrictEqual(r.hits, []);
    assert.deepStrictEqual(r.selfHits, []);
    assert.strictEqual(r.backslashes, 0);
    assert.ok(r.zipEntries.every((n) => n.startsWith('hablemos-public/')));
    assert.ok(!fs.existsSync(path.join(out, '.denylist.local')));
    assert.ok(!r.zipEntries.some((n) => /\.zip$|\.log$|denylist\.local|logs\//.test(n)));
    const readme = fs.readFileSync(path.join(out, 'README.md'), 'utf8').split(/\r?\n/);
    assert.ok(readme.includes('Live demo: add the GitHub Pages link here after publishing.'));
  } finally {
    fs.rmSync(path.dirname(out), { recursive: true, force: true });
  }
});


