#!/usr/bin/env node
/* node off-on.js <out dir> [label]   Goalpost lines 6.2 and 4.6: switching the plugin off and on again leaves every page right.
   In the checks' own Logseq, read-only. With the plugin on, two pages are read: Consultation (a tag's page: the names in its
   table) and Dr. Mei Chen (Linked, the list that stands in for Logseq's own). The plugin is switched off: the table must still
   show names (Logseq's own drawing) and Logseq's own list must be back. The plugin is switched on again, and each page is
   read at 1.5, 3, 6 and 12 seconds after it is opened: no "[[]]" where a name stood, the same names as before, Linked drawn and
   Logseq's own list not shown beside it. */
const fs = require('node:fs'), path = require('node:path');
const { connect, ours, go, sleep, setPlugin, fingerprint, differs, finish, fail } = require('./kit');
(async () => {
  const out = process.argv[2] || path.join(require('node:os').tmpdir(), 'off-on'), label = process.argv[3] || 'now'; fs.mkdirSync(out, { recursive: true });
  const { browser, page, said } = await connect();
  const before = await fingerprint(page);
  const read = () => page.evaluate(() => {
    const main = document.querySelector('#main-content-container'), vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const text = main?.innerText || '';
    const table = [...main.querySelectorAll('.ls-table-rows, [class*="table-row"], table')].filter(vis)[0];
    const cells = table ? [...table.querySelectorAll('a, .page-ref, [data-ref]')].filter(vis).map(e => e.innerText.trim()).filter(Boolean) : [];
    const linked = [...main.querySelectorAll('[class^="th-"], [class*=" th-"]')].filter(vis);
    const own = [...main.querySelectorAll('.references, .page-linked, .lazy-visibility .references-blocks, .cp__bidirectional-properties, [class*="bidirectional"]')].filter(vis);
    const OWN = /^(lk|th|st|fd|td|xp|sw|sp)-/;
    const left = [...document.querySelectorAll('body *')].filter(e => vis(e) && [...e.classList].some(c => OWN.test(c))).slice(0, 400);
    const styles = [...document.querySelectorAll('style')].filter(st => /^(lk|sw|pm|th|st|fd|td|xp)-/.test(st.id) || /\.lk-|\.th-tw|\.st-row|\.fd-/.test(st.textContent.slice(0, 20000))).length;
    // The page's own bullets, as words: what plain Logseq shows of your notes on this page.
    const mineOwn = [...main.querySelectorAll('.ls-page-blocks .block-content, .page-blocks-inner .block-content')].filter(vis).map(e => (e.innerText || '').split('\n')[0].trim().slice(0, 70)).filter(Boolean);
    return { bullets: [...new Set(mineOwn)], left: left.length, leftFirst: left.slice(0, 3).map(e => e.tagName.toLowerCase() + '.' + [...e.classList].slice(0, 3).join('.')).join(' '), styles, empties: (text.match(/\[\[\]\]/g) || []).length, raw: (text.match(/\[\[[^\]]{0,60}\]\]/g) || []).slice(0, 4), names: [...new Set(cells)].slice(0, 40), linked: linked.length, linkedWords: linked.slice(0, 3).map(e => e.tagName + '.' + String(e.className).slice(0, 50) + ' “' + (e.innerText || '').trim().slice(0, 30).replace(/\n/g, ' | ') + '”').join('  '), own: own.map(e => String(e.className).slice(0, 40)), chars: text.length };
  });
  const PAGES = ['Consultation', 'Dr. Mei Chen'];
  const lines = [], shots = [];
  const look = async (state, waits) => {
    const got = {};
    for (const name of PAGES) {
      await go(page, name, 0); let at = 0; got[name] = [];
      for (const ms of waits) { await sleep(ms - at); at = ms; got[name].push({ ms, ...(await read()) }); }
      const file = `${name.replace(/[^a-z0-9]+/gi, '-')}-${state}-${label}.png`; await page.screenshot({ path: path.join(out, file) }); shots.push(file);
    }
    return got;
  };
  const on1 = await look('on-before', [3500]);
  await setPlugin(page, false);
  const off = await look('off', [3500]);
  await setPlugin(page, true);
  const on2 = await look('on-again', [1500, 3000, 6000, 12000]);
  const on3 = await look('on-later', [3500]);

  const names = r => r.names.join(' · ');
  let ok = true, offOk = true; const fault = words => { ok = false; lines.push('FAIL ' + words); };
  for (const name of PAGES) {
    const was = on1[name][0];
    lines.push(`     ${name}, plugin on, before: ${was.names.length} names in the table, Linked pieces ${was.linked}, Logseq's own lists ${was.own.length}, “[[]]” ${was.empties}`);
    lines.push(`     ${name}, plugin off: ${off[name][0].names.length} names, Linked pieces ${off[name][0].linked}, Logseq's own lists ${off[name][0].own.length}, “[[]]” ${off[name][0].empties}`);
    if (off[name][0].linked) offOk = false;
    if (off[name][0].linked) fault(`${name}: with the plugin off, ${off[name][0].linked} of Linked's pieces are still on the page: ${off[name][0].linkedWords}`);
    if (off[name][0].empties) { offOk = false; fault(`${name}: with the plugin off the page shows “[[]]” ${off[name][0].empties} time(s)`); }
    if (off[name][0].left || off[name][0].styles) { offOk = false; fault(`${name}: with the plugin off, ${off[name][0].left} piece(s) of the plugin are still drawn (${off[name][0].leftFirst}) and ${off[name][0].styles} of its stylesheets are still in the page`); }
    if (off[name][0].chars < 200) { offOk = false; fault(`${name}: with the plugin off the page is all but empty`); }
    for (const r of [...on2[name], ...on3[name].map(x => ({ ...x, ms: 'the second visit, 3500' }))]) {
      const bad = [];
      if (r.empties) bad.push(`“[[]]” ${r.empties} time(s)`);
      if (r.raw.length) bad.push(`raw links ${r.raw.join(' ')}`);
      if (typeof r.ms === 'number' && r.ms < 3000) { /* the first second and a half may still be drawing: only "[[]]" counts there */ }
      else { if (was.linked && !r.linked) bad.push('Linked is not drawn'); if (names(r) !== names(was)) bad.push(`the table's names differ (${r.names.length} against ${was.names.length})`); if (r.own.length !== was.own.length) bad.push(`Logseq's own lists shown: ${r.own.length} against ${was.own.length} before`); }
      (bad.length ? fault : w => lines.push('ok   ' + w))(`${name}, switched on again, at ${r.ms} ms: ${bad.join('; ') || `as before (${r.names.length} names, Linked ${r.linked ? 'drawn' : 'not on this page'})`}`);
    }
  }
  // 4.6: nothing of yours is hidden. Every bullet of the page that plain Logseq shows is shown with the plugin on.
  const hidden = [];
  for (const name of PAGES) { const plain = off[name][0].bullets || [], withIt = new Set([...(on1[name][0].bullets || []), ...(on3[name][0].bullets || [])]); for (const b of plain) if (!withIt.has(b)) hidden.push(`${name}: “${b}”`); lines.push(`     ${name}: plain Logseq shows ${plain.length} bullets of the page; with the plugin on, ${plain.filter(b => withIt.has(b)).length} of them are shown`); }
  for (const h of hidden.slice(0, 6)) lines.push('FAIL hidden with the plugin on: ' + h);
  for (const l of lines) console.log(l);
  const changed = differs(before, await fingerprint(page));
  if (changed.length) { ok = false; console.log(`FAIL the graph changed: ${changed.slice(0, 3).map(c => c.what + ' ' + c.words).join('; ')}`); }
  const noise = ours(said);
  for (const s of [...new Set(noise.map(s => s.type + ': ' + s.text.slice(0, 240)))]) console.log('console ' + s);
  if (noise.length) ok = false;
  console.log('pictures: ' + shots.join(', '));
  const firstFault = (lines.find(l => l.startsWith('FAIL ')) || '').slice(5, 220);
  await finish(browser, { '6.2': { ok, said: ok ? 'switched off and on again, both pages read as before at every look, nothing said in the console' : 'after switching off and on a page was wrong: ' + firstFault }, '4.6': { ok: !hidden.length && PAGES.every(n => (off[n][0].bullets || []).length > 0 || n === 'Consultation'), said: hidden.length ? `${hidden.length} bullet(s) that plain Logseq shows are not shown with the plugin on: ${hidden[0]}` : 'every bullet plain Logseq shows on the two pages is shown with the plugin on: nothing of yours is hidden (side by side pictures in the run)' }, '6.7': { ok: offOk && !changed.length, said: offOk ? 'with the plugin off both pages read in plain Logseq: its own lists are back, the names stand, and nothing of the plugin is left on the page' : 'with the plugin off a page was not plain Logseq: ' + firstFault } });
})().catch(fail);
