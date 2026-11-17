# Hablemos: build spec

Version 1.0 for app version 1.0.0. Hablemos ("let's talk") is a browser-only Spanish learning tool for English speakers: translate, learn, flashcards, quizzes, scenarios, progress.

Status: this is the public spec of the shipped design. Free-text translation is online only (section 0); the earlier offline translator design has been removed from this document.

This document was decided before building. MUST means required. Where a value is given, use that value. Where this document gives a threshold or a count, it is never changed to fit a result; a miss is reported as a finding.
## 0. Owner decision 2: free-text translation is online only (supersedes the former offline translator design, which has been removed from this document)
The owner replaced the offline word-by-word translator with online-only translation. Where this section conflicts with any other section, this section wins.
- **Removed.** `js/translate.js` (all word-by-word and grammar rules), the breakdown table, "Why?" popovers on translations, the offline result, the "compare with offline" view (`wordDiff` stays in `js/online.js` as an unused helper), the translator CLI and the translator eval (dev set, held-out set, hash, run log). The retired files are not in the package.
- **Translate tab.** "Translate online" is the only way to translate free text. The first press without saved consent opens a consent dialog stating that the typed text is sent to a third-party service (MyMemory), may be logged by it, and that quality is not guaranteed. Nothing is sent before "I agree". After consent (`settings.online` true, revocable in Settings) each press sends the text; the 5,000 and 50,000 characters per day counter, the optional `de` email, chunking and all limit and failure messages from section 8 stay.
- **Fallback.** When offline, blocked, over the daily limit, declined or failed, Hablemos shows no generated Spanish. It shows only exact matches from the curated word list and phrase library (`js/curated.js`: `phraseLookup` and `enLookup`, whose Spanish strings all come from `data/`) plus a clear message. When an online result is shown, the matching curated phrase (if any) is shown next to it.
- **Offline helpers kept.** ES to EN reverse lookup, the curated lookup, Learn, flashcards, quizzes and scenarios.
- **CSP.** `connect-src https://api.mymemory.translated.net` and nothing else is allowed; every other directive stays as in section 13.
- **Gates.** The offline-translator eval gate is retired. Online output is third-party and not covered by the accuracy gate. The curated-content gate is unchanged: the Spanish review samples only authored data (words, phrases, idioms, false friends, scenario lines) and must find 0 errors in sampled data (and an error rate of at most 2% in any case), and it checks that the fallback never emits generated Spanish. Tests use mocked fetch only; no test or smoke row calls the real service.


## 1. Goals and constraints

- Static single page: `index.html` + CSS + plain JavaScript + data in `.js` files. No server, no build step, zero runtime dependencies, no external fonts, CDNs or images.
- Works by double-clicking `index.html` (file://) and on GitHub Pages (https) in current Edge, Chrome and Firefox. Works offline.
- Dev tooling is Node.js 22 or newer using built-ins only. No npm packages.
- Core logic is pure JavaScript (UMD) shared by the browser, the Node library, the CLI and the tests.
- Privacy: everything runs and is stored locally (localStorage). No analytics, no cookies. The only network use is the opt-in online translate (section 8), sent only after consent.
- Clean room and non-commercial personal project: all content is authored originally. No text is copied from dictionaries, textbooks, apps or websites. No open dataset is used (`docs/DATA-SOURCES.md` records this and the "authored from standard grammar" basis). No personal names, employers, internal tool names, local absolute paths or account names appear in any repository file (enforced by the deny-list scan and self-scan, section 13).
- Honesty: Hablemos has no translator of its own. Free text goes to a third-party service with consent, and the UI, README and EVAL say that online output is not guaranteed correct. No usage claims anywhere.

## 2. Tabs and features

Seven tabs in one `role="tablist"`; every tab is always available. First visit (`hb.helpSeen` unset) opens Help; later visits open the last used tab (`settings.lastTab`). Hash routes: `#/help`, `#/translate`, `#/learn`, `#/cards`, `#/quiz`, `#/scenarios`, `#/progress`. The hash never carries user text.

1. **Help**: what Hablemos is, a 4-step quick start, the limits of online translation, privacy, keyboard shortcuts. Setting `hb.helpSeen` on first close.
2. **Translate** (online only, see section 0): text area (max 1000 characters, counter shown), EN->ES through the "Translate online" button after a one-time consent dialog, curated library matches shown next to the online result or alone as the fallback, Spain/Latin America variant switch for library matches, Copy, Speak, "Add to my flashcards", swap direction (ES->EN lookup, section 7.2), and an always-visible limitation note.
3. **Learn**: sub-sections Words, Phrases, False friends, Idioms, Pronunciation, Numbers/dates/time, Cognates, Word of the day. Words and Phrases have category chips, tier filter (A1/A2/B1), text search (accent-insensitive, matches Spanish or English), per-entry "learned" toggle and "Add to flashcards".
4. **Flashcards**: deck picker (by category, by tier, "My cards", "Mistakes", "Due today"), flip card, Again/Hard/Good/Easy, modes EN->ES, ES->EN, audio-first, daily goal bar and streak. Keys: Space/Enter flip, 1-4 rate, S speak, Esc leave.
5. **Quizzes**: multiple choice, typing, listening, matching pairs, conjugation gym, sentence unscramble, 60-second sprint, seeded daily challenge. XP, levels, badges, mistake notebook.
6. **Scenarios**: four branching mini-dialogues (ordering food, asking directions, hotel check-in, at the pharmacy); the learner picks the best reply, gets feedback and can replay the audio.
7. **Progress**: stats, streak calendar (last 12 weeks), badges, export/import JSON, reset (with confirmation), settings: variant (Spain/Latin America, default Latin America), "you" form (tÃº/usted, default tÃº), theme (light/dark/auto), text size (4 steps), sound/TTS on/off, slow speech, accent-insensitive typing (default on), daily goal (10/20/30/50, default 20), new cards per day (5-50, default 10), reduced motion (auto/on), online mode (default off), optional email for the online limit (section 8.7), online usage counter.

## 3. File layout (project root `hablemos/`)

```
index.html                 the app shell (static markup for all tabs)
.nojekyll  .gitignore  LICENSE (MIT, holder placeholder)  README.md  package.json
css/app.css
js/util.js  js/rng.js  js/store.js  js/nouns.js  js/numbers.js  js/conj.js  js/lexicon.js
js/curated.js  js/reverse.js  js/online.js  js/srs.js  js/progress.js  js/quiz.js
js/scenario.js  js/daily.js  js/api.js
js/ui-core.js  js/ui-translate.js  js/ui-learn.js  js/ui-cards.js  js/ui-quiz.js
js/ui-scenarios.js  js/ui-progress.js  js/ui.js
data/words.js  data/phrases.js  data/verbs.js  data/falsefriends.js  data/idioms.js
data/pronunciation.js  data/scenarios.js  data/entext.js  data/why.js   (why.js is retained data; the UI shows no "Why?" popovers)
scripts/eval.cjs           data statistics and fallback check (writes docs/EVAL.md)
scripts/serve.cjs          static server, 127.0.0.1 only
scripts/browser.cjs        headless drivers: Edge via DevTools protocol, Firefox via WebDriver BiDi
scripts/ui-smoke.cjs  scripts/capture-screenshots.cjs
scripts/denylist.cjs  scripts/selfscan.cjs  scripts/brands.json (reserved for brand names, may be empty)
scripts/zip.cjs            minimal zip writer/reader (forward-slash entries)
scripts/package-public.cjs
test/*.test.cjs            node --test files
docs/SPEC.md  docs/DATA-SOURCES.md  docs/EVAL.md  docs/CASE-STUDY.md  docs/screenshot-*.png
```

Not in the repository or the package: `dist/`, logs, `.denylist.local`, any zip, any task or agent folder. `package.json` scripts: `test` = `node --test "test/**/*.test.cjs"`, `eval`, `smoke`, `screenshots`, `package`.

## 4. Module system: classic scripts with a UMD wrapper

Classic `<script defer src>` files only (ES modules, `fetch` and workers fail from file://). Data is therefore also shipped as `.js` files that register onto the global namespace; nothing is fetched. No `type="module"`, no `import`/`export`, no `fetch` except in `online.js` (section 8). `"type": "commonjs"` in `package.json`. Syntax in `js/` and `data/`: ES2018, no `?.`, `??`, optional catch binding, class fields, template literals (use string concatenation). Scripts under `scripts/` may use newer syntax.

Wrapper (dependencies via `require` in Node, via `root.Hablemos` in the browser; result registered as `Hablemos.<name>`):

```js
(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module && module.exports;
  var deps = isNode ? { util: require('./util.js') } : { util: root.Hablemos.util };
  var api = factory(deps);
  if (isNode) module.exports = api;
  else { root.Hablemos = root.Hablemos || {}; root.Hablemos.NAME = api; }
})(typeof self !== 'undefined' ? self : this, function (deps) { 'use strict'; return {}; });
```

Data files use the same wrapper with no deps and export an array or object. Load order in `index.html` (each with `defer`): `util, rng, data/* (words, phrases, verbs, falsefriends, idioms, pronunciation, scenarios, entext, why), store, nouns, numbers, conj, lexicon, curated, reverse, online, srs, progress, quiz, scenario, daily, api, ui-core, ui-translate, ui-learn, ui-cards, ui-quiz, ui-scenarios, ui-progress, ui`.

| Module | Namespace | Depends on | Purpose |
|---|---|---|---|
| util | `util` | none | NFC, trim, accent stripping, normalisation for matching, local day number, escaping helpers |
| rng | `rng` | none | mulberry32, FNV-1a, `deriveSeed`, seeded shuffle and pick |
| data/* | `data.words` ... `data.why` | none | authored content (section 5) |
| store | `store` | util | safe localStorage with in-memory fallback, versioning, export/import validation |
| nouns | `nouns` | util | plural, gender, article (incl. el agua), adjective agreement, apocope, contractions al/del |
| numbers | `numbers` | util | cardinals 0-999999 to Spanish words, ordinals 1-10, time and date phrases |
| conj | `conj` | util, data.verbs | conjugation: present, preterite, imperfect, future, commands |
| lexicon | `lexicon` | util, nouns, conj, data.* | English-side and Spanish-side indexes, lemmatiser, variant resolution |
| curated | `curated` | lexicon, util | exact lookups in the authored word list and phrase library (fallback, no generated Spanish) |
| reverse | `reverse` | lexicon, conj | ES->EN lookup |
| online | `online` | util | MyMemory request builder, response parser, usage counter, chunking, word diff (pure; no I/O) |
| srs | `srs` | util | scheduler |
| progress | `progress` | util, store | XP, levels, streak, badges, calendar, mistakes |
| quiz | `quiz` | rng, lexicon, conj, nouns, util | question generators and checkers |
| scenario | `scenario` | util | dialogue runner and scoring |
| daily | `daily` | rng, quiz, util | word of the day, daily challenge |
| api | `api` | all above | public Node/browser API (section 11) |
| ui-* | none | `Hablemos` | DOM only (browser) |

Pure modules MUST NOT use `Math.random`, `Date`, `window`, `document`, `console` or `localStorage` in code, except `store.js` (storage) and `progress.js`/`daily.js` reading dates only through an injected `today` day number (tested by `static.test.cjs`). All randomness comes from `rng.js`.

## 5. Data schemas

All strings are NFC with no leading/trailing or doubled whitespace. All Spanish uses accents, `Â¿ Â¡` and `Ã±`. Register is neutral. Ids are stable and unique per file.

**Categories.** Words: `greetings, people, family, body, health, food, drink, home, clothes, colours, numbers, time, weather, nature, animals, travel, places, shopping, work, school, feelings, actions, descriptions, grammar, tech, hobbies`. Phrases: `greetings, travel, restaurant, shopping, directions, health, social, work`.

**Word** (`data/words.js`, target 1000 entries: A1 350, A2 400, B1 250; hard minimum 950):

```js
{ id: 'w0001', es: 'casa', en: 'house', pos: 'noun', g: 'f', tier: 'A1', cat: 'home',
  ex: { es: 'La casa es grande.', en: 'The house is big.' },
  // optional:
  pl: 'casas',            // irregular plural override
  art: 'el',              // article override (el agua, el mapa is m so not needed)
  fem: 'bonita',          // adjective feminine override
  inv: true,              // adjective invariable in gender
  pre: true,              // adjective normally goes before the noun
  st: 'estar',            // adjective: 'ser' (default) | 'estar' | 'both'
  tener: 'hambre',        // adjective-like English state translated as tener + noun
  pers: true,             // noun denotes a person (takes personal "a")
  en2: ['home'],          // extra English glosses for lookup
  sense: 'building',      // disambiguates same es+pos
  cog: true, same: true,  // cognate; same: spelled identically in English
  var: { la: { es: 'computadora', g: 'f' } },   // regional override (keys 'es' = Spain, 'la' = Latin America)
  note: 'Spain: ordenador.' }
```

`pos` in `noun, verb, adj, adv, prep, conj, pron, det, interj, num`. `g` in `m, f, mf` is required for nouns and absent otherwise; for `mf` the same form serves both genders (estudiante). Verb entries use the infinitive as `es` and MUST exist in `data/verbs.js`. The example `ex.es` MUST contain a form of the word (singular/plural, all adjective forms, any conjugated form, or any `var` form), checked by the integrity test through `lexicon.forms(entry)`. Unique key: `es|pos|sense`.

**Phrase** (`data/phrases.js`, target 300, at least 25 per category):

```js
{ id: 'p001', es: 'Â¿DÃ³nde estÃ¡ el baÃ±o?', en: 'Where is the bathroom?', cat: 'travel', tier: 'A1',
  note: 'Latin America often says "baÃ±o"; Spain also says "aseos" in public places.', var: { la: '...' } /* optional */ }
```

Phrases carry no `ex`. `en` is the canonical English used for curated phrase matching.

**Verb** (`data/verbs.js`, at least 40 verbs, at least 30 with full reference tables):

```js
{ inf: 'tener', en: 'have', cls: 'irr',            // cls: 'reg' | 'stem' | 'irr'
  forms: { pres: [6], pret: [6], impf: [6], fut: [6], cmd: [5] },   // optional per-tense overrides
  ger: 'teniendo', pp: 'tenido', refl: false }
```

Person order for 6-arrays: yo, tÃº, Ã©l/ella/usted, nosotros, vosotros, ellos/ellas/ustedes. `cmd` order: tÃº (affirmative), usted, nosotros, vosotros (affirmative), ustedes; negative tÃº and vosotros are derived as `no` + the matching present-subjunctive form and are tested for the 30 reference verbs through an extra `cmdNeg: [tÃº, vosotros]` table. Regular verbs need only `inf`, `en`, `cls`; `conj` derives forms from `-ar/-er/-ir` rules (with spelling changes c->qu, g->gu, z->c, i->y). `cls: 'stem'` carries stem-change data in `forms`. Variant handling is outside `conj`: it always returns all six persons; the UI and translator choose vosotros or ustedes.

**False friend** (`data/falsefriends.js`, at least 25): `{ id: 'f001', es: 'embarazada', looksLike: 'embarrassed', actually: 'pregnant', say: 'avergonzado/a', ex: { es, en }, note? }`. `say` is the Spanish for what the learner probably meant.

**Idiom** (`data/idioms.js`, at least 30): `{ id: 'i001', es: 'estar en las nubes', literal: 'to be in the clouds', meaning: 'to be daydreaming', ex: { es, en }, tier }`.

**Pronunciation tip** (`data/pronunciation.js`, at least 12, covering rr, Ã±, ll, v/b, silent h, j/g, c/z (Spain vs Latin America), qu/gu, vowels, stress and written-accent rules): `{ id, topic, rule, examples: [{ es, say, en }] }`. `say` is a plain-English respelling.

**Scenario** (`data/scenarios.js`, exactly 4: `s-food, s-directions, s-hotel, s-pharmacy`; 5-8 steps each, at least one branch with a distinct path in each):

```js
{ id: 's-food', title: 'Ordering at a cafÃ©', level: 'A1', setting: 'You sit down at a small cafÃ©.',
  start: 'a1',
  steps: [ { id: 'a1', npc: { es: 'Buenas tardes. Â¿QuÃ© desea?', en: 'Good afternoon. What would you like?' },
             prompt: 'Order a coffee.',
             choices: [ { es: 'Un cafÃ©, por favor.', en: 'A coffee, please.', ok: true, fb: 'Polite and clear.', next: 'a2' },
                        { es: 'Yo querer cafÃ©.', en: 'I want coffee.', ok: false, fb: 'Use "quisiera" or "un cafÃ©, por favor".', next: 'a2' } ],
             accept: ['un cafÃ© por favor', 'quisiera un cafÃ©'] }, '...' ] }
```

Each step has 2-4 choices with at least one `ok: true`; `next` is a step id or `'end'`; `accept` is an optional list of normalised typed answers that count as correct. Score = correct replies / steps taken. Every reachable path ends at `'end'` (integrity test).

**English-side tables** (`data/entext.js`): English plurals and verb forms, number words and similar tables used to index the English side of the lexicon for the curated lookup. **Why table** (`data/why.js`): retained data from the retired translator; the UI no longer shows "Why?" popovers.

**Counts reported** in `docs/EVAL.md`: words per tier and category, phrases per category, verbs, false friends, idioms, tips, scenarios and steps.

**Data integrity test** (`test/data.test.cjs`): required fields and types; ids unique; valid `pos`, `g`, `tier`, `cat`; no duplicate keys; NFC; no stray whitespace; non-empty examples and translations; every word's example contains a form of the word; every verb word exists in verbs; every scenario path terminates; counts meet the minimums above; cognates flagged at least 80.

## 6. Spaced repetition (`srs.js`)

SM-2-style with fixed, documented rules. Card state: `{ id, ease, interval, reps, lapses, due, last }`. `ease` starts at 2.5 (min 1.3, max 3.0), `interval` is in whole days, `due` and `last` are local day numbers (`util.dayNumber(y, m, d)` from local calendar components). A card is due when `due <= today`. Cards are created on first view in a deck; unseen cards count as new.

| Rating | `reps` | New `interval` (days) | `ease` change | Other |
|---|---|---|---|---|
| Again | 0 | 0 | -0.20 | `lapses += 1`; due today; re-queued in the session after 4 other cards |
| Hard | unchanged | `max(1, round(interval * 1.2))` | -0.15 | |
| Good | +1 | reps 1: 1; reps 2: 3; later: `round(interval * ease)` | none | |
| Easy | +1 | reps 1: 4; reps 2: 7; later: `round(interval * ease * 1.3)` | +0.15 | |

Intervals are capped at 365 days; there is no random fuzz (deterministic). Session limits: new cards per day (setting, default 10), reviews per day 100. Order: due reviews oldest first, then new cards in deck order. A "Good" on a card with `reps` 0 (new) gives reps 1 and interval 1. Pure function: `rate(state, rating, today) -> newState`.

## 7. Speech and lookup

The offline word-by-word translator (output contract, pipeline, rules, variants, "Why?" keys and its dev and held-out evaluation) is retired and removed from this spec; see section 0. Sections 7.6 to 7.7 below keep their numbers so that references stay stable.

### 7.6 Speech

`speechSynthesis` with `lang` `es-MX` (variant `la`) or `es-ES` (variant `es`); prefer a voice whose `lang` equals that value, then any voice starting with `es`. Rate 0.9 (0.7 with slow speech). When the API or a Spanish voice is missing, a visible message says so and speak buttons stay usable without throwing. Nothing is spoken unless the user presses a speak control, or a card/quiz audio mode is chosen.

### 7.7 Reverse lookup (ES->EN)

`reverse.lookup(text, variant)` normalises with accents stripped and lowercased, then returns matches (phrase, word, or a conjugated form with infinitive, tense and person) with English, part of speech and gender. No match: a visible "not in the dictionary" message. It is a lookup, not a translator, and the UI says so.

### 7.8 Curated lookup (fallback)

`curated.phraseLookup(text, variant)` and `curated.enLookup(text, variant)` return only exact (normalised) matches from `data/phrases.js` and `data/words.js`, with the Spanish taken from the data (variant overrides applied). No match gives an empty result and the UI shows a clear message. The function never composes Spanish.

## 8. Optional online mode

Owner decision (section 0): free-text translation is online only and needs consent. Provider: MyMemory (api.mymemory.translated.net), free tier, no key.

### 8.1 Opt-in and consent

Off until the user consents (`settings.online` false). The first press of "Translate online" opens a modal consent dialog that states: the entered text is sent to a third-party service (MyMemory) and may be logged by it; quality is not guaranteed; the provider's usage limits (5,000 characters per day anonymous, 50,000 per day with an email address, as published by the provider and subject to change); that an optional email, if entered, is stored only on this device and sent only as the `de` parameter in the user's own explicit online requests, never anywhere else and never logged; and a link to the provider's terms. "Cancel" leaves it off; "I agree" turns it on. After consent, text is sent only when "Translate online" is pressed, never automatically, never while typing, never on page load. Consent can be withdrawn in Progress, Settings.

### 8.2 Constants (one place: `js/online.js`, documented in README)

`ONLINE_ORIGIN = 'https://api.mymemory.translated.net'`, `LIMIT_ANON = 5000`, `LIMIT_EMAIL = 50000` (characters per local calendar day), `CHUNK_CHARS = 200` (implementation choice, deliberately conservative; the provider's per-request cap is not confirmed and no claim about it is made), `CHUNK_MIN = 40`, `MAX_ONLINE_INPUT = 1000`. The textarea accepts 1-1000 characters.

### 8.3 Request builder and parser (pure, no I/O)

`online.buildRequest(text, email)` returns `{ url, method: 'GET' }` with `url = ONLINE_ORIGIN + '/get?q=' + encodeURIComponent(text) + '&langpair=en%7Ces'` plus `'&de=' + encodeURIComponent(email)` only when `email` is a valid address. Text must be 1-500 characters after trim (callers pass chunks of at most `CHUNK_CHARS`), else it throws `RangeError`. `online.validEmail(s)` accepts the pattern `^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$` and at most 254 characters.

`online.parseResponse(json)` returns `{ ok: true, text, match, lowConfidence }` when `responseStatus` is 200 (number or string) and `responseData.translatedText` is a non-empty string (HTML entities `&quot; &amp; &#39; &lt; &gt;` decoded; the text is only inserted with `textContent`). `match` is `responseData.match` when it is a number in 0-1, else null. `lowConfidence` is true when `match` is a number below 0.5, or when `match` is absent and the best entry in `matches` has `quality` below 50 (when `match` and `matches` are both absent, `lowConfidence` is false and no badge is shown). Otherwise `{ ok: false, reason }` with `reason` = `rate_limited` (status 429), `quota` (message mentions the daily or usage limit), `too_long` (message mentions a query length limit), `bad_response` (anything malformed). The thresholds 0.5 and 50 are implementation choices, documented in README.

### 8.4 Daily-usage counter

`online.createCounter(today, limit)` style pure functions over a stored record `{ day, used }` (key `hb.online`, section 12): `remaining(record, today, hasEmail)`, `canSend(record, today, hasEmail, length)`, `add(record, today, length)`. When `record.day !== today` the count is 0 (local day rollover). The limit is `LIMIT_EMAIL` when a valid email is saved, else `LIMIT_ANON`; saving or clearing the email switches the limit immediately and keeps the day's `used`. The panel always shows "Characters used today: X of N" (translated text length counted per chunk, counted only after a chunk is sent). Before sending, if the total text length exceeds the remaining allowance the app shows a visible warning with the numbers, does not send anything, and shows the curated library matches instead. The counter is a local convenience, not the provider's own accounting, and the UI says so.

### 8.5 Chunking

`online.chunk(text)` splits on sentence boundaries (`. ! ? ;` followed by space or end, keeping the punctuation) and packs consecutive sentences into chunks of at most `CHUNK_CHARS`; a single sentence longer than that is split at the last comma or space before the limit. Joining the chunks with a single space reproduces the normalised input. Chunks are sent sequentially (never in parallel), each only as part of the one explicit click, and the results are reassembled in order. If a chunk gets `too_long`, it is split into halves (each at least `CHUNK_MIN` characters) and retried, at most 3 split levels; otherwise the whole online attempt fails visibly. Any other failure stops the sequence, shows the reason, keeps already-counted usage, and shows the curated library matches only.

### 8.6 Failure handling

Each request has a 10 s `AbortController` timeout. Rate limit, quota exceeded, too long, offline (`navigator.onLine` false or a network error), timeout and malformed JSON each show a distinct visible message in the `aria-live` region and fall back to the curated library matches (no generated Spanish). Online results are never presented as certified: next to every online result the UI shows "Online translation by MyMemory (terms: link)", the note "Not checked by Hablemos; neither is guaranteed correct", and a "low confidence" badge (text plus icon, not colour alone) when `lowConfidence` is true.

### 8.7 Optional email field (Settings)

An optional "Email for a higher daily limit" field, blank by default, with a visible label and help text ("Stored only on this device. Sent only as the provider's `de` parameter when you click Translate online."). Format is validated with `online.validEmail`; invalid input shows a visible message and is not saved; a "Clear" button removes it. It is stored only in `hb.settings.email` in localStorage. It MUST NOT be written to the repo, logs, console, error messages, the URL hash, screenshots or the export file (section 12), and it is sent only as `de` in the user's own explicit online requests. No email address appears in any shipped file, test fixture or screenshot; tests and screenshots use only `user@example.invalid` style values. Providing an email raises the provider limit as published by the provider; personal projects do not qualify for provider whitelisting, so nothing beyond the 50,000 limit is assumed.

### 8.8 (removed)

The offline versus online comparison view was removed by section 0. `online.wordDiff` remains in `js/online.js` as an unused helper.

### 8.9 Tests and smoke for online mode

Unit tests: `buildRequest` with and without `de` (and rejection of an invalid email); parser fixtures for good, low-match, quota exceeded, rate limited, too long, error and malformed responses; counter logic across a day rollover and the limit switch when an email is saved or cleared, and `canSend` at the boundary; chunking (sentence packing, long-sentence splitting, join round trip, halving on `too_long`); `wordDiff` helper (identical, one substitution, insertion, empty); email never appearing in an export. Browser smoke: online-off run has zero network requests; the consent flow (cancel leaves it off, agree shows the button); the usage counter; the failure fallback with the request blocked; the real API is never called. README and Help explain when online helps (sentences, words or idioms outside the built-in library) and when not (private text, high-stakes text, heavy use, offline use), the daily limits and optional email, and the privacy trade-off. The owner decision behind this section is recorded in section 0.
## 9. XP, levels, streak, badges (`progress.js`)

- **XP awards**: multiple-choice correct +10; typing/conjugation/unscramble/matching round item correct +15; listening correct +12; perfect round (all correct, at least 5 items) +20; sprint +2 per correct; daily challenge completed +50 (once per day); scenario finished +30 plus 5 per correct reply; flashcard Again +1, Hard +3, Good +5, Easy +6 (flashcard XP capped at 200 per day); marking a word "learned" +2 (once per id). Wrong answers award 0 and are added to the mistake notebook.
- **Levels**: `threshold(L) = 50 * L * (L - 1)` total XP for level L (L2 100, L3 300, L4 600, L5 1000). Level = the largest L (cap 50) with `threshold(L) <= xp`.
- **Daily goal**: the day's activity count is the number of flashcard ratings plus quiz answers; the goal is the setting (default 20). The first time the count reaches the goal on a day, that day is marked in the calendar and the streak updates.
- **Streak**: if the previous goal day is yesterday, `streak += 1`; if it is today, unchanged; otherwise `streak = 1`. A missed day with no goal met resets the streak to 0 when read. `bestStreak` is kept. No freezes.
- **Mistake notebook**: `{ id, kind, count, last, ok }` per item id, max 200 entries (oldest dropped). An item is removed after 2 consecutive correct answers. "Mistakes" is a flashcard deck and a quiz source.
- **Badges** (id: condition): `first-card` first rating; `streak-7`, `streak-30` best streak; `words-100`, `words-500` learned words; `perfect-round` first perfect round; `daily-7` seven daily challenges; `conj-50` 50 correct conjugation answers; `scenarios-4` all four scenarios finished; `level-5`, `level-10`; `false-friend-10` ten false-friend quiz answers correct. Awarded once, shown with date.

## 10. Quizzes (`quiz.js`)

Question object: `{ id, type, prompt, answer, accept: [normalised answers], options?, pairs?, tokens?, itemId, hint? }`. All generators take a seed and are deterministic for a seed (`rng.js`).

- `mc`: 4 options, EN->ES or ES->EN; the correct answer is always among the options; options are distinct after normalisation and drawn from entries with the same `pos` (and tier where available); never a duplicate of the answer.
- `type`: type the Spanish (or English). Matching normalises case, whitespace, punctuation; the accent-insensitive setting (default on) ignores accents, and a correct answer with wrong or missing accents shows the hint "Right word, mind the accent: estÃ¡". With the setting off, a missing accent is wrong with the same hint.
- `listen`: plays the Spanish by TTS; the user picks from 4 English options or types the Spanish; when TTS is unavailable the round shows a visible message and switches to text prompts.
- `match`: 6 pairs, distinct on both sides, keyboard operable.
- `conj`: conjugation gym; verb, person and tense (present, preterite, imperfect, future, command) from the verb table; accepts the form with the setting's accent rule.
- `unscramble`: 4-8 tokens from a word-example or phrase, shuffled so the order differs from the original; accepts the original or any listed alternative.
- `sprint`: 60 seconds of `mc` questions, timer is the only time source in the UI; score = correct count.
- `daily`: seed = `fnv1a('daily:' + yyyy-mm-dd local)`; 10 questions mixing `mc, type, listen, conj, unscramble`; same questions for the same date; one XP award per date.
- Word of the day: `words[fnv1a('wotd:' + yyyy-mm-dd) % words.length]`.

## 11. Library and CLI

`Hablemos` (Node: `require('./js/api.js')`) exports `curatedLookup, reverseLookup, conjugate(inf, tense), pluralize, agree, numberToWords, rate (srs), makeQuiz(type, opts), dailyChallenge(date), wordOfTheDay(date), buildOnlineRequest, parseOnlineResponse, data`.

## 12. localStorage keys and export format

All keys use the prefix `hb.` and hold JSON. `store.js` wraps every access in try/catch; if storage is unavailable or full the app keeps working in memory and shows a one-time visible notice that progress will not be saved.

| Key | Content |
|---|---|
| `hb.v` | schema version number (1) |
| `hb.helpSeen` | `true` after Help was closed once |
| `hb.settings` | variant, you, theme, textSize, sound, slow, accentLoose, dailyGoal, newPerDay, reducedMotion, online, email (optional, never exported), lastTab |
| `hb.online` | online usage counter `{ day, used }` (local day number, characters) |
| `hb.progress` | xp, streak, bestStreak, lastGoalDay, learned (ids), badges (id to day), counters |
| `hb.cards` | map id -> SRS state; plus `custom` list of `{ id, es, en, note? }` (max 500; es/en each at most 200 characters) |
| `hb.mistakes` | notebook entries (section 9) |
| `hb.calendar` | day number -> activity count (kept 400 days) |
| `hb.daily` | date -> `{ score, total }` |

Export: JSON `{ app: 'hablemos', schema: 1, exportedAt, data: { <allowed keys above> } }` without `settings.email` and without `hb.online` downloaded through `Blob` + temporary `<a download>`. Import: file at most 1 MB; parse, validate against the key allow-list, types and limits (numbers clamped, strings length-limited, unknown keys ignored); on any failure show a visible error and change nothing; on success ask for confirmation and replace (not merge). A round trip export -> import -> export is byte-identical apart from `exportedAt` (tested).

## 13. Security: CSP, deny-list, packaging

`index.html` has this tag as the first element in `<head>` after `<meta charset="utf-8">`:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' file:; style-src 'self' file:; img-src 'self' data: blob: file:; connect-src https://api.mymemory.translated.net; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; media-src 'none'">
```

No inline script, no `on*=` attributes, no `style="..."` attributes (CSSOM and class toggles only), no `eval`. All user and data text is inserted with `textContent` or escaped; never `innerHTML` with unescaped data. If, and only if, the smoke test shows this policy blocks the app's own files under file:// in either browser, remove the meta tag and set `CSP_META = false` in `js/api.js` in the same change and record it; `static.test.cjs` checks that the tag is present and exact when `CSP_META` is true. The privacy sentence in README and Help matches `CSP_META` ("blocked by a Content Security Policy" only when true).

Packaging (`package-public.cjs`): copy only the allow-list (`index.html, css/, js/, data/, scripts/ (without private files), test/, docs/, package.json, README.md, LICENSE, .gitignore, .nojekyll`) into `dist/hablemos-public/`, then zip with forward-slash entry names. It MUST fail (exit non-zero) if `.denylist.local`, a `logs/` folder, any `.zip`, `dist/`, or any file outside the allow-list would be included, if the deny-list scan (private terms file plus the built-in list) has any hit in the folder or the zip, or if the self-scan finds a hit. Self-scan covers absolute local paths, account names, employer and tool names, the repository owner's username or URL, and brand names from `scripts/brands.json`. LICENSE is MIT with a holder placeholder. The README contains exactly `Live demo: add the GitHub Pages link here after publishing.`

## 14. Accessibility and UI conventions

- Every control has a visible label or `aria-label`; all element ids start with `hb-` (collision-proof); field values are read safely (trimmed, length-limited, type-checked) and bad input produces a visible message, never a silent failure.
- Tabs follow the ARIA tabs pattern: Left/Right arrows, Home/End move and activate; roving `tabindex`; panels are `role="tabpanel"` labelled by their tab.
- Flashcards, quizzes, matching and scenarios are fully keyboard operable. Feedback (correct/wrong, results, errors, TTS missing, online status, import result) goes to an `aria-live="polite"` region and is also visible.
- A visible focus ring in Edge and Firefox (at least 3:1 against adjacent colours); text contrast at least 4.5:1 in light and dark themes; target size at least 40 px on touch layouts; color is never the only signal.
- Flip and transition animations are removed under `prefers-reduced-motion: reduce` and when the setting is on.
- Spanish text carries `lang="es"` (or `es-ES`/`es-MX` by variant); English text inherits `lang="en"`.
- Responsive from 320 px; warm palette, simple inline SVG icons (no emoji dependence), friendly tone.

## 15. Tests and smoke

`npm test` (Node test runner, no skipping) covers: conjugation reference tables (at least 30 verbs x present, preterite, imperfect, future, commands x persons, authored from standard grammar), noun and adjective agreement, number words, curated lookup (exact matches only, no generated Spanish), reverse lookup, SRS table, quiz generators (answer among options, no duplicate options, deterministic daily challenge, accent-insensitive matching), progress rules (XP, levels, streak across day boundaries), data integrity, online request builder and parser against fixture JSON (success, 429, daily limit, empty, malformed, entities), export/import round trip and rejection cases, static checks (CSP, no forbidden APIs, no inline script or styles, ids prefixed `hb-`, load order), zip writer/reader, deny-list and self-scan modules.

`scripts/ui-smoke.cjs` runs in Edge and Firefox, in file and http modes (4 combinations), with these rows: Help opens first; each tab renders; curated fallback for a fixed example; flashcard flip and a rating that persists after reload; a quiz round; a scenario run; settings change persists; consent dialog flow (cancel leaves it off, agree shows the online button); zero network requests with online mode off; online failure fallback with the request blocked (never the real API); no console errors; focus visible; tab arrow keys. It runs the Firefox profile preference that prevents a TLS client-certificate dialog from taking focus. It must pass 3 consecutive full runs. The server binds 127.0.0.1 only and the smoke never contacts the real MyMemory origin.

## 16. Review gates

- **Spanish accuracy review**: an independent reviewer re-checks at least 150 random data entries and 40 dialogue lines against standard Spanish grammar. The error rate in sampled entries above 2% is blocking; the fixer corrects and a fresh sample is drawn.
- **Implement/review loop**: the reviewer runs last; at most 2 iterations, with a pause at the maximum.
- **Final checks**: tests, eval (identical output twice), smoke x3, package exit 0, 0 deny-list and 0 self-scan hits, every screenshot viewed, no network without consent.

## 17. Out of scope

Accounts or sync, server code, voseo and other regional grammar beyond the Spain/Latin America switch, an offline translator, past and subjunctive handling, machine translation of our own, speech recognition, user-uploaded decks, mobile apps, analytics.
