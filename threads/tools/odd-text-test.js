#!/usr/bin/env node
/* Odd names, drawn (2026-10-23, docs/history/FINISHING-PROMPT-2026-10-23.md section 4, "Odd text"): page, tag and property names with
   [[, ]], #, ::, quotes, back slashes, emoji, right-to-left words, 500 letters, Logseq's own names, markup, an empty name
   and a name of spaces (tools/odd-names.js), put through what draws a name, in Chromium:
   - the kit's pieces (the tag word, the tag as words in a paragraph, the pop-up's items and head, a question, a chip,
     a quiet button, the hover card, the Undo arrow's words);
   - the two-way rows (a field and its nodes, short and as an open list);
   - the model's readers (titles, stored links, trailing tags, days in words).
   Nothing may throw; no name may become markup (no element made from a name: the kit's one esc() at work); every name
   drawn must be readable on the page as written (its words, spaces folded). The proposals read the same names in
   tools/shadow-stress.js (2b).
   Needs Playwright and Chromium; skipped quietly where they are missing. Run: node tools/odd-text-test.js */
const fs = require('fs');
const path = require('path');
const twoWay = require('./two-way-files');
const ODD = require('./odd-names');

let chromium;
for (const where of ['playwright', '/opt/node-tools/node_modules/playwright']) { try { ({ chromium } = require(where)); break; } catch (error) { /* try the next */ } }
if (!chromium) { console.log('odd-text-test skipped (needs Playwright and Chromium)'); process.exit(0); }
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exposeAtEnd = (source, names) => source.replace(/\}\)\(\);\s*$/, `${names.map(n => `window.__${n} = ${n};`).join(' ')} })();`);

// A pretend Logseq whose tags and properties carry the odd names (each tag one property, a link between pairs).
function oddLogseq(names) {
  let next = 10;
  const props = [], tags = [];
  names.forEach((name, i) => {
    const prop = { ':db/id': next++, ':db/ident': `:user.property/p${i}`, ':block/title': name, ':block/uuid': `p-${i}`, ':logseq.property/type': i % 2 ? ':node' : ':default',
      ':db/cardinality': ':db.cardinality/one', ':logseq.property/classes': [] };
    props.push(prop);
    const tag = { ':db/id': next++, ':db/ident': `:user.class/t${i}`, ':block/uuid': `t-${i}`, ':block/title': name,
      ':logseq.property.class/extends': i % 4 && tags.length ? [{ ':db/id': tags[tags.length - 1][':db/id'] }] : [],
      ':logseq.property.class/properties': [{ ':db/id': prop[':db/id'], ':db/ident': prop[':db/ident'], ':block/title': name, ':block/uuid': prop[':block/uuid'] }] };
    if (i % 3 === 0) tag[':logseq.property/description'] = { ':block/title': name };
    tags.push(tag);
  });
  // Each link property accepts the tag before it.
  props.forEach((p, i) => { if (p[':logseq.property/type'] === ':node' && i) p[':logseq.property/classes'] = [{ ':db/id': tags[i - 1][':db/id'] }]; });
  const settings = { tagTreeRoots: '', twoWayNames: '', twoWayOneEnd: '' };
  window.parent = window;
  window.logseq = {
    settings, updateSettings: o => Object.assign(settings, o),
    DB: { datascriptQuery: async q => q.includes('logseq.property/classes [') ? props.map(p => [p])
      : q.includes('closed-value') ? [] : q.includes('class/extends [:db/id]') ? tags.map(t => [t]) : q.includes('count') ? tags.map(t => [t[':db/id'], 2]) : [], onChanged: () => () => {} },
    UI: { showMsg() {} }, App: { pushState() {} }, Editor: {},
  };
  (window.Threads ||= {}).core = { provided: { backwardsLabel: n => n + ' of', setBackwards() {}, shownAtOtherEnd: () => true, setShownAtOtherEnd() {} } };
}

(async () => {
  let browser;
  try { browser = await chromium.launch(); } catch (error) { console.log('odd-text-test skipped (Chromium did not start)'); process.exit(0); }
  const problems = [], lines = [];
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<!doctype html><html><head></head><body><div id="stage"></div></body></html>');
  // The names that can be drawn (Logseq gives no node an empty name or one of spaces; those go to the readers only).
  const drawn = ODD.filter(n => n.trim());
  for (const content of [`(${oddLogseq})(${JSON.stringify(drawn)});`, read('../plugin.js'), read('parts/shared.js'), read('parts/model.js'), require('./pretend-model')]) await page.addScriptTag({ content });
  // The two-way part needs a bare window of its own (it reads no pretend graph): its rowHtml is reached the same way.
  for (const content of [...twoWay.sources(), twoWay.reach(['rowHtml', 'state'])]) await page.addScriptTag({ content });

  const result = await page.evaluate(async ({ names, all }) => {
    const shared = window.Threads.shared, doc = document, out = { faults: [], counts: {} };
    // Markup made from a name would show as an element the drawing did not mean: <b>, <img>, <script>, or any
    // element whose tag a name spells.
    const bad = root => [...root.querySelectorAll('b, img, script, query')];
    const fold = text => String(text).replace(/\s+/g, ' ').trim();
    const check = (what, root, want) => {
      if (bad(root).length) out.faults.push(`${what}: a name became markup (${bad(root).map(e => e.outerHTML.slice(0, 60)).join(', ')})`);
      for (const name of want) if (!fold(root.textContent).includes(fold(name).replace(/^#/, ''))) { out.faults.push(`${what}: “${fold(name).slice(0, 40)}” is not readable as written`); break; }
    };
    const stage = doc.getElementById('stage');
    // 1. The kit's pieces.
    try {
      for (const name of names) {
        const box = shared.el(doc, 'div', {}, shared.tag(doc, name), ' ', shared.quiet(doc, { label: name }), shared.note(doc, name));
        stage.append(box);
        check('the kit', box, [name]);
        box.remove();
      }
      const pop = shared.popup({ head: names[0], items: names.slice(0, 20).map(label => ({ label, icon: 'tag' })) });
      check('a pop-up', pop.el, names.slice(0, 20));
      pop.close();
      const asked = shared.ask({ question: names[1], note: names[2] });
      const askEl = [...doc.querySelectorAll('.th-pop')].pop();
      if (askEl) check('a question', askEl, [names[1]]);
      shared.popups.closeAll();
      void asked;
      const card = shared.card({ at: stage, title: names[3], fields: [{ name: names[5], uuid: 'u', values: [{ text: names[6], uuid: 'v' }] }], lines: [{ uuid: 'l', html: shared.esc(names[7]) }], open() {} });
      const cardEl = card?.el || doc.querySelector('.th-card, .th-pop');
      if (cardEl) check('the hover card', cardEl, [names[3], names[5], names[6], names[7]]);
      card?.close?.();
      const markup = names.find(n => /<img/.test(n));
      shared.undo.offer({ key: 'odd', at: () => null, text: markup, run: () => {} });
      const dock = doc.querySelector('.lk-undo-dock');
      if (!dock) out.faults.push('the Undo arrow was not drawn'); else check('the Undo arrow', dock, [markup]);
      shared.undo.clear?.();
    } catch (error) { out.faults.push('the kit threw: ' + error.message); }
    // 2. The two-way rows.
    try {
      window.__state.pageUuid = 'p';
      const item = (i, title) => ({ uuid: 'r' + i, title, tag: names[(i + 3) % names.length], day: 20261001 + (i % 20) });
      const groups = names.map((name, i) => ({ name, label: name + ' of', ident: 'user.property/x' + i, fieldUuid: 'f' + i, items: (i % 2 ? names.slice(0, 6) : names.slice(i, i + 2)).map((t, k) => item(k, t)) }));
      const box = shared.el(doc, 'div', { class: 'th-two-way' });
      box.innerHTML = groups.map(window.__rowHtml).join('');
      stage.append(box);
      check('the two-way rows', box, names.slice(0, 6));
      out.counts.rows = box.querySelectorAll('.th-tw-row').length;
      box.remove();
    } catch (error) { out.faults.push('the two-way rows threw: ' + error.message); }
    // 4. The model's readers, on every name and on the names inside links and tags.
    try {
      const m = window.Threads.core.provided;
      let read = 0;
      for (const name of all) for (const text of [name, `[[${name}]]`, `#${name}`, `#[[${name}]]`, `${name} #Tag`, `on ${name}`]) {
        m.titleOf({ title: text }); await m.readableTitle?.(text); m.trailingTags.test(text); m.bare?.(text); m.parseDay?.(text, new Date(2026, 9, 23)); String(text).match(m.storedRef);
        read++;
      }
      out.counts.readings = read;
    } catch (error) { out.faults.push('a model reader threw: ' + error.message); }
    return out;
  }, { names: drawn, all: ODD });
  for (const e of errors) problems.push('error in the page: ' + e);
  problems.push(...result.faults);
  lines.push(`  ${drawn.length} odd names through the kit, ${result.counts.rows || 0} two-way rows; ${result.counts.readings || 0} readings by the model; a cut property name's tooltip ${result.counts.tips ? 'checked' : 'not checked'}`);
  await browser.close();
  console.log('odd names, drawn and read:');
  for (const line of lines) console.log(line);
  for (const p of problems) console.log('PROBLEM: ' + p);
  if (problems.length) { console.log(`odd-text-test: FAILED (${problems.length})`); process.exit(1); }
  console.log('odd-text-test: OK');
})().catch(error => { console.log('PROBLEM: ' + (error?.stack || error)); process.exit(1); });
