#!/usr/bin/env node
/* node old-reports.js <plugin folder> <out dir>   Goalpost line 7.6, for reports that had no check of their own.
   In the checks' own Logseq, read-only:
   - 10 Nov “Same-as-next came back”: the words “same as next” stand nowhere in the plugin's running code;
   - 11 Nov “Linked lost its margin and the page scrolled up on a fold”: on Dr. Mei Chen, scrolled down, Linked's first list is
     folded and opened again by its arrow: the page does not move under the pointer and the section keeps its left edge;
   - 12 Nov “The + label covered the tag and name under the pointer”: pointing at a + in Linked draws no words over the row; what
     it does is said by its tooltip;
   - 16 Nov “A suggestion and its fix must be unmissable”: on the Ontology map a suggestion stands in a box of its own with its fix
     drawn as a button. */
const fs = require('node:fs'), path = require('node:path');
const { connect, ours, go, route, sleep, finish, fail } = require('./kit');
(async () => {
  const plugin = path.resolve(process.argv[2] || '.'), out = process.argv[3] || path.join(require('node:os').tmpdir(), 'old'); fs.mkdirSync(out, { recursive: true });
  const walk = (d, o = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!/^(node_modules|dist|test|tools|vendor|\.git|alfred)$/.test(e.name)) walk(p, o); } else if (p.endsWith('.js')) o.push(p); } return o; };
  const lines = [];
  const say = (ok, w) => lines.push(`${ok ? 'ok  ' : 'FAIL'} ${w}`);
  const same = walk(plugin).filter(f => /same.as.next/i.test(fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')));
  say(!same.length, `Same-as-next stays out of the running code${same.length ? ': found in ' + same.join(', ') : ''}`);
  const { browser, page, said } = await connect();
  await page.setViewportSize({ width: 1400, height: 900 }).catch(() => {});
  await go(page, 'Dr. Mei Chen', 3000);
  // fold and open Linked's first list, scrolled down
  await page.evaluate(() => { const box = document.querySelector('#main-content-container .th-two-way'); box?.scrollIntoView({ block: 'start' }); document.querySelector('#main-content-container')?.scrollBy?.(0, -40); });
  await sleep(600);
  const at = () => page.evaluate(() => { const s = document.querySelector('#main-content-container'), box = s.querySelector('.th-two-way'), head = box?.querySelector('.th-tw-row .lk-fold, .th-tw-row [data-fold]'); const r = head?.getBoundingClientRect(); return { y: s.scrollTop, left: Math.round(box?.getBoundingClientRect().left ?? -1), head: r ? { x: r.x + r.width / 2, y: r.y + r.height / 2, top: Math.round(r.top) } : null }; });
  const a = await at();
  if (a.head) {
    await page.mouse.click(a.head.x, a.head.y); await sleep(900); const b = await at();
    await page.mouse.click(b.head?.x ?? a.head.x, b.head?.y ?? a.head.y); await sleep(900); const c = await at();
    say(Math.abs((b.head?.top ?? 0) - a.head.top) <= 2 && Math.abs((c.head?.top ?? 0) - a.head.top) <= 2 && b.left === a.left && c.left === a.left, `folding Linked's first list and opening it again: its arrow stays under the pointer (at ${a.head.top}, ${b.head?.top}, ${c.head?.top} px) and the section keeps its left edge (${a.left}, ${b.left}, ${c.left} px)`);
  } else say(false, 'no fold arrow found in Linked on Dr. Mei Chen');
  await page.screenshot({ path: path.join(out, 'linked-fold.png') });
  // the + under the pointer
  // The + shows under the pointer (the library's lk-reveal): the pointer goes to the list's head first.
  { const head = page.locator('#main-content-container .th-tw-row .th-tw-head').first(); if (await head.count()) { await head.hover(); await sleep(500); } }
  const plus = await page.evaluate(() => { const p = [...document.querySelectorAll('#main-content-container .th-two-way .th-tw-add, #main-content-container .th-two-way .th-tw-gadd')].find(e => e.getBoundingClientRect().width > 0); if (!p) return null; const r = p.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, title: p.getAttribute('title') || p.dataset.what || p.getAttribute('aria-label') || '' }; });
  if (plus) {
    await page.mouse.move(plus.x, plus.y); await sleep(700);
    // The 12 November report: the words under the pointer lay over the list's tag and name. Read now: the name at the head of the
    // list the + belongs to is still what stands at its own place on screen.
    const covered = await page.evaluate(({ x, y }) => { const add = document.elementFromPoint(x, y)?.closest('.th-tw-row, .th-tw-head'); const row = add?.closest('.th-tw-row') || add; const name = row?.querySelector('.th-tw-head .th-tw-name, .th-tw-name'); if (!name) return 'no name found'; const r = name.getBoundingClientRect(); const top = document.elementFromPoint(r.x + Math.min(20, r.width / 2), r.y + r.height / 2); return name.contains(top) ? '' : (top?.className || top?.tagName || '?').toString().slice(0, 60); }, plus);
    await page.screenshot({ path: path.join(out, 'linked-plus.png') });
    say(!covered && !!plus.title, `pointing at + in Relations leaves the list's name uncovered${covered ? ' (covered by ' + covered + ')' : ''}; what it does is said: “${plus.title.slice(0, 60)}”`);
    await page.mouse.move(5, 500);
  } else say(false, 'no + found in Linked on Dr. Mei Chen');
  // a suggestion on the Ontology map
  await route(page, '#/structure', 3000);
  { const m = page.locator('.st-row .nm', { hasText: /^mergeable$/ }).first(); if (await m.count()) { await m.click(); await sleep(800); } }   // a tag that has a suggestion (the fixtures' empty tag): suggestions show for the tag in hand
  { const shut = page.locator('.st .sugs-shut').first(); if (await shut.count()) { await shut.click(); await sleep(700); } }   // closed until opened since 0.3.153
  const sug = await page.evaluate(() => { const box = [...document.querySelectorAll('.st [class*="sug"], .st .st-iss, .st [data-fix]')].find(e => e.getBoundingClientRect().width > 0 && e.querySelector('button, .lk-btn, .lk-accent, [data-fix], [data-stage]')); if (!box) return null; const s = getComputedStyle(box); return { words: box.innerText.trim().slice(0, 80), boxed: s.borderStyle !== 'none' && parseFloat(s.borderWidth) > 0 || s.backgroundColor !== 'rgba(0, 0, 0, 0)', button: !!box.querySelector('button, .lk-btn, .lk-accent, .act, [data-fix], [role="button"]') }; });
  await page.screenshot({ path: path.join(out, 'ontology-suggestion.png') });
  // Since 0.3.150 and 0.3.153 (the owner: “too bright for just a suggestion”, “suggestions should have to be opened”) the box is
  // quiet and opens on a press; what still holds of the 16 November report: it stands apart, in a box, and its fix can be pressed.
  say(!!sug && sug.boxed && sug.button, sug ? `a suggestion on the Ontology map, once opened, stands in a box (${sug.boxed ? 'yes' : 'no'}) with its fix as a button (${sug.button ? 'yes' : 'no'}): “${sug.words}”` : 'no suggestion with a fix found on the Ontology map');
  const noise = ours(said); if (noise.length) say(false, 'the console said ' + noise[0].text.slice(0, 120));
  for (const l of lines) console.log(l);
  const ok = lines.every(l => l.startsWith('ok'));
  await finish(browser, { '7.6': { ok, said: ok ? 'the reports that had no check of their own (same-as-next, the fold that scrolled, the + label, the suggestion box) are now tried in Logseq' : (lines.find(l => l.startsWith('FAIL')) || '').slice(5) } });
})().catch(fail);
