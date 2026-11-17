(function (root) {
  'use strict';
  var H = root.Hablemos, ui = H.ui, h = ui.h, st = ui.state, O = H.online, C = H.curated;
  var mode = 'en-es';
  var last = null;      // last online result { input, es }
  var busy = false;
  var els = {};

  var EXAMPLES = ['Good morning', 'Where is the bathroom?', 'Thank you very much', 'I would like a coffee, please'];

  // ---- curated matches: exact entries from the authored word list and phrase library, never generated ----
  function showCurated(text) {
    ui.clear(els.curated);
    var r = C.lookup(text, st.settings.variant);
    els.curated.appendChild(h('h3', { text: 'From the phrase library and word list' }));
    if (!r.phrase && !r.words.length) {
      els.curated.appendChild(h('p', { class: 'hb-note', id: 'hb-tr-nomatch', text: r.message }));
      return r;
    }
    var list = h('ul', { class: 'hb-list' });
    if (r.phrase) {
      list.appendChild(h('li', { class: 'hb-entry', id: 'hb-tr-curated-phrase' },
        h('span', { lang: 'en', text: r.phrase.en }), ' = ', ui.es(r.phrase.es),
        r.phrase.note ? h('div', { class: 'hb-small hb-muted', text: r.phrase.note }) : null,
        h('div', { class: 'hb-row' }, ui.speakButton(r.phrase.es),
          h('button', { type: 'button', class: 'hb-btn hb-btn-small', text: 'Add to my flashcards', on: { click: function () { ui.addCustom(r.phrase.es, r.phrase.en); } } }))));
    }
    r.words.forEach(function (m) {
      list.appendChild(h('li', { class: 'hb-entry' },
        h('span', { lang: 'en', text: m.en }), ' = ', ui.es(m.es), h('span', { class: 'hb-muted', text: ' (' + m.pos + (m.g ? ', ' + m.g : '') + ')' }),
        h('div', { class: 'hb-row' }, ui.speakButton(m.es),
          h('button', { type: 'button', class: 'hb-btn hb-btn-small', text: 'Add to my flashcards', on: { click: function () { ui.addCustom(m.es, m.en); } } }))));
    });
    els.curated.appendChild(list);
    els.curated.appendChild(h('p', { class: 'hb-small hb-muted', text: 'These entries were written by hand for Hablemos. They are exact matches only.' }));
    return r;
  }

  // ---- reverse lookup (Spanish to English) ----
  function doReverse() {
    var text = ui.field(els.input, H.reverse.MAX_LEN);
    ui.clear(els.out); ui.clear(els.curated);
    els.actions.hidden = true;
    if (!text) { els.msg.textContent = 'Type a Spanish word or phrase first.'; ui.say('Type a Spanish word or phrase first.'); return; }
    els.msg.textContent = '';
    var r = H.reverse.lookup(text, st.settings.variant);
    if (!r.matches.length) { els.out.appendChild(h('span', { text: r.message })); ui.say(r.message); return; }
    var list = h('ul', { class: 'hb-list' });
    r.matches.slice(0, 12).forEach(function (m) {
      var detail = m.pos + (m.g ? ' (' + m.g + ')' : '') + (m.tense ? ', ' + m.tense + ', person ' + m.person + ' of ' + m.infinitive : '');
      list.appendChild(h('li', { class: 'hb-entry' },
        ui.es(m.es), ' = ', h('span', { lang: 'en', text: m.en }), h('span', { class: 'hb-muted', text: ' (' + detail + ')' }),
        m.note ? h('div', { class: 'hb-small hb-muted', text: m.note }) : null,
        h('div', { class: 'hb-row' }, ui.speakButton(m.es),
          h('button', { type: 'button', class: 'hb-btn hb-btn-small', text: 'Add to my flashcards', on: { click: function () { ui.addCustom(m.es, m.en); } } }))));
    });
    els.out.appendChild(list);
    els.notes.appendChild(h('p', { class: 'hb-note', text: 'This is a lookup of known words and phrases, not a translator.' }));
    ui.say(r.matches.length + ' result' + (r.matches.length === 1 ? '' : 's') + ' found.');
  }

  // ---- online translation (MyMemory) ----
  function usageText() {
    var has = O.validEmail(st.settings.email);
    var used = O.usedToday(st.online, ui.today());
    return 'Characters used today: ' + used.toLocaleString('en-US') + ' of ' + O.limitFor(has).toLocaleString('en-US') + ' (a local estimate, not the provider\'s own count)';
  }
  function updateUsage() { if (els.usage) els.usage.textContent = usageText(); }

  function showOnlineResult(res, input) {
    ui.clear(els.out);
    ui.clear(els.notes);
    last = { input: input, es: res.text };
    els.actions.hidden = false;
    els.out.appendChild(h('p', { class: 'hb-result', id: 'hb-tr-online-out' }, h('span', { lang: ui.langAttr(), text: res.text })));
    if (res.lowConfidence) els.notes.appendChild(h('p', { class: 'hb-note hb-badge-warn', id: 'hb-tr-lowconf', role: 'note', text: '\u26A0 The service reports low confidence for this result.' }));
    els.notes.appendChild(h('p', { class: 'hb-note', id: 'hb-tr-attrib' }, 'Online translation by MyMemory (', h('a', { href: O.TERMS_URL, target: '_blank', rel: 'noopener noreferrer', text: 'terms' }), '). It is a third-party result, not checked by Hablemos, and quality is not guaranteed.'));
  }

  function showFailure(msg) {
    ui.clear(els.out);
    ui.clear(els.notes);
    last = null;
    els.actions.hidden = true;
    els.onlineMsg.textContent = msg;
    ui.say(msg);
  }

  async function sendOnline(text) {
    var has = O.validEmail(st.settings.email);
    var len = O.chunk(text).reduce(function (n, c) { return n + c.length; }, 0);
    var today = ui.today();
    if (!O.canSend(st.online, today, has, len)) {
      showFailure('This text is ' + len + ' characters but you have ' + O.remaining(st.online, today, has) + ' left today (limit ' + O.limitFor(has) + '). Nothing was sent. Only exact matches from the word list and phrase library are shown. Hablemos does not generate Spanish.');
      return;
    }
    busy = true; els.go.disabled = true;
    els.onlineMsg.textContent = 'Sending to MyMemory...';
    ui.say('Translating online.');
    var res;
    try {
      res = await O.translateText(text, {
        consent: st.settings.online === true,
        email: has ? st.settings.email : '',
        getJson: function (url) { return O.fetchJson(url, O.TIMEOUT_MS); },
        onUsed: function (n) { st.online = O.add(st.online, ui.today(), n); ui.save('online'); updateUsage(); }
      });
    } catch (e) { res = { ok: false, reason: 'network' }; }
    busy = false; els.go.disabled = false;
    if (res.ok) {
      els.onlineMsg.textContent = 'Online result received.';
      showOnlineResult(res, text);
      ui.say('Online result received.');
    } else {
      showFailure(O.REASON_TEXT[res.reason] || O.REASON_TEXT.network);
    }
  }

  // The explicit button press is the only trigger. Nothing is sent until consent has been given.
  async function doOnline() {
    if (busy) return;
    var text = ui.field(els.input, 1000);
    if (!text) { els.msg.textContent = 'Type some English text first.'; ui.say('Type some English text first.'); return; }
    els.msg.textContent = '';
    showCurated(text);
    if (!st.settings.online) {
      consentDialog(function (agreed) {
        if (!agreed) { showFailure(O.REASON_TEXT.no_consent); return; }
        st.settings.online = true; ui.save('settings');
        ui.say('Online translation is on.');
        sendOnline(text);
      });
      return;
    }
    await sendOnline(text);
  }

  function consentDialog(after) {
    var body = h('div', null,
      h('p', { text: 'To translate a sentence, the English text you type is sent over the internet to MyMemory, a third-party service, and may be logged by it. Hablemos has no translator of its own for free text.' }),
      h('p', { text: 'Quality is not guaranteed. Results are not checked by Hablemos. Do not send private or high-stakes text.' }),
      h('p', { text: 'Nothing is sent until you press "I agree", and later only when you press "Translate online". You can turn this off again in Settings (Progress tab).' }),
      h('p', { text: 'Provider limits (published by the provider, may change): 5,000 characters per day for anonymous use, 50,000 per day when an email address is supplied.' }),
      h('p', { text: 'If you add an optional email in Settings, it is stored only on this device and sent only as the provider\'s "de" parameter in your own online requests. It is never logged and never exported.' }),
      h('p', null, h('a', { href: O.TERMS_URL, target: '_blank', rel: 'noopener noreferrer', text: 'MyMemory terms and usage limits' })));
    ui.modal({
      title: 'Send your text to MyMemory?', body: body, cancelValue: false,
      buttons: [{ label: 'Cancel', value: false, id: 'hb-consent-cancel' }, { label: 'I agree', value: true, primary: true, id: 'hb-consent-agree' }],
      onClose: function (v) { after(!!v); }
    });
  }

  function renderOnlineBox() {
    ui.clear(els.onlineBox);
    els.usage = h('p', { class: 'hb-small', id: 'hb-tr-usage' });
    els.onlineMsg = els.onlineMsg || h('p', { class: 'hb-small', id: 'hb-tr-online-msg', role: 'status' });
    els.onlineBox.appendChild(els.usage);
    els.onlineBox.appendChild(els.onlineMsg);
    updateUsage();
  }

  function setMode(m) {
    mode = m;
    els.swap.setAttribute('aria-pressed', m === 'es-en' ? 'true' : 'false');
    els.label.textContent = m === 'en-es' ? 'English text' : 'Spanish word or phrase';
    els.go.textContent = m === 'en-es' ? 'Translate online' : 'Look up';
    els.input.setAttribute('lang', m === 'en-es' ? 'en' : 'es');
    ui.clear(els.out); ui.clear(els.notes); ui.clear(els.curated);
    els.actions.hidden = true;
    els.examples.hidden = m !== 'en-es';
    els.onlineBox.hidden = m !== 'en-es';
  }

  function render(container) {
    var input = h('textarea', { id: 'hb-tr-input', maxlength: '1000', lang: 'en', 'aria-describedby': 'hb-tr-count hb-tr-limits', placeholder: 'Type English here, for example: Good morning' });
    els.input = input;
    els.label = h('label', { for: 'hb-tr-input', text: 'English text' });
    els.count = h('span', { id: 'hb-tr-count', class: 'hb-small hb-muted', text: '0 of 1000 characters' });
    input.addEventListener('input', function () { els.count.textContent = input.value.length + ' of 1000 characters'; });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); } });
    els.go = h('button', { type: 'button', class: 'hb-btn hb-btn-primary', id: 'hb-tr-go', text: 'Translate online', on: { click: function () { run(); } } });
    els.swap = h('button', { type: 'button', class: 'hb-btn', id: 'hb-tr-swap', 'aria-pressed': 'false', text: 'Swap direction (ES to EN lookup)', on: { click: function () { setMode(mode === 'en-es' ? 'es-en' : 'en-es'); } } });
    var variant = h('select', { id: 'hb-tr-variant' }, h('option', { value: 'la', text: 'Latin America' }), h('option', { value: 'es', text: 'Spain' }));
    variant.value = st.settings.variant;
    variant.addEventListener('change', function () {
      st.settings.variant = variant.value === 'es' ? 'es' : 'la'; ui.save('settings');
      if (mode === 'en-es' && els.input.value.trim()) showCurated(els.input.value);
    });
    els.variantSel = variant;
    els.msg = h('p', { class: 'hb-bad', id: 'hb-tr-msg', role: 'alert' });
    els.out = h('div', { class: 'hb-result', id: 'hb-tr-out', 'aria-label': 'Result' });
    els.actions = h('div', { class: 'hb-row', hidden: true },
      h('button', { type: 'button', class: 'hb-btn hb-btn-small', id: 'hb-tr-copy', text: 'Copy', on: { click: copy } }),
      h('button', { type: 'button', class: 'hb-btn hb-btn-small', id: 'hb-tr-speak', text: 'Speak', on: { click: function () { if (last) ui.speak(last.es); } } }),
      h('button', { type: 'button', class: 'hb-btn hb-btn-small', id: 'hb-tr-add', text: 'Add to my flashcards', on: { click: function () { if (last) ui.addCustom(last.es, last.input); } } }));
    els.notes = h('div', { id: 'hb-tr-notes' });
    els.curated = h('div', { id: 'hb-tr-curated' });
    els.onlineBox = h('div', { class: 'hb-card', id: 'hb-tr-onlinebox' });
    els.examples = h('div', { class: 'hb-row', id: 'hb-tr-examples' }, h('span', { class: 'hb-small hb-muted', text: 'Look up:' }),
      EXAMPLES.map(function (ex) { return h('button', { type: 'button', class: 'hb-chip', text: ex, on: { click: function () { input.value = ex; els.count.textContent = ex.length + ' of 1000 characters'; els.msg.textContent = ''; showCurated(ex); } } }); }));
    var limits = h('p', { class: 'hb-note hb-note-warn', id: 'hb-tr-limits' },
      'Free-text translation is online only. When you press "Translate online" and have agreed, your text is sent to MyMemory, a third-party service, and quality is not guaranteed. Hablemos does not translate sentences by itself. Offline, or if the service fails, you only see exact matches from the built-in word list and phrase library. The sample buttons below only look up the library; they send nothing.');
    container.appendChild(h('h2', { text: 'Translate' }));
    container.appendChild(limits);
    container.appendChild(h('div', { class: 'hb-card' },
      els.label, input, els.count,
      h('div', { class: 'hb-row' },
        h('label', { class: 'hb-inline-label', for: 'hb-tr-variant', text: 'Spanish from' }), variant),
      h('div', { class: 'hb-row' }, els.go, els.swap),
      els.examples, els.msg));
    container.appendChild(h('h3', { id: 'hb-tr-result-h', text: 'Result' }));
    container.appendChild(els.out);
    container.appendChild(els.actions);
    container.appendChild(els.notes);
    container.appendChild(els.onlineBox);
    container.appendChild(els.curated);
    renderOnlineBox();
  }

  function run() { if (mode === 'en-es') doOnline(); else doReverse(); }
  function copy() {
    if (!last) return;
    var t = last.es;
    var done = function () { ui.say('Copied.'); };
    var fail = function () { ui.say('Copy was not allowed here. Select the text and copy it by hand.'); };
    try {
      if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) root.navigator.clipboard.writeText(t).then(done, fail);
      else fail();
    } catch (e) { fail(); }
  }

  ui.translatePanel = {
    refreshOnline: function () { if (els.onlineBox) renderOnlineBox(); },
    updateUsage: updateUsage,
    consent: consentDialog,
    syncSettings: function () { if (els.variantSel) els.variantSel.value = st.settings.variant; },
    isBusy: function () { return busy; }
  };
  ui.register('translate', { render: render, show: function () { ui.translatePanel.syncSettings(); updateUsage(); } });
})(typeof self !== 'undefined' ? self : this);
