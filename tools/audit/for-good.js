#!/usr/bin/env node
/* node for-good.js <out dir> [label]   Goalpost lines 1.3 and 3.5: what Undo cannot bring back asks first, says what goes for
   good, names its yes by the result, and rests Enter on the safe answer.
   In the checks' own Logseq, on the Ontology map: a merge of the tag "test" (one node) into "mergeable" is staged, so the tag
   "test" would be deleted for good. Cmd-Enter (Apply) must ask first. The question must say that test is deleted for good, its
   yes must say so too ("Apply, deleting test for good", never plain "Apply"), and the return sign must stand on Leave it.
   Plain Enter must leave it: nothing applied, the change still waiting. Escape must leave it too. Then the change is discarded.
   The graph must be exactly as before: nothing is ever applied here. */
const fs = require('node:fs'), path = require('node:path');
const { connect, ours, route, sleep, fingerprint, differs, finish, fail } = require('./kit');
(async () => {
  const out = process.argv[2] || path.join(require('node:os').tmpdir(), 'for-good'), label = process.argv[3] || 'now'; fs.mkdirSync(out, { recursive: true });
  const { browser, page, frame, said } = await connect();
  const before = await fingerprint(page);
  await route(page, '#/structure', 3500);
  { const d = page.locator('.st [data-discard]'); if (await d.count()) { await d.first().click(); await sleep(800); } }
  const staged = await frame().evaluate(() => { const S = window.Structure, m = S.app.tray.model, T = t => [...m.tags.values()].find(x => x.title === t); const a = T('test'), b = T('mergeable'); if (!a || !b) return 'the tags test and mergeable are not both in this graph'; const c = S.app.stage({ kind: 'merge', from: a.id, into: b.id }, { wait: true }); S.app.draw(); return c ? '' : 'the merge was refused'; });
  if (staged) throw new Error(staged);
  await sleep(700);
  const waits = () => frame().evaluate(() => ({ n: window.Structure.app.tray.changes.length, busy: !!window.Structure.app.st.busy, done: !!window.Structure.app.tray.done }));
  const big = () => page.evaluate(() => { const q = document.querySelector('.st-big'); if (!q) return null; const yes = q.querySelector('[data-stage]'), no = q.querySelector('[data-leave]'); return { words: q.innerText.replace(/\s*\n\s*/g, ' | ').slice(0, 220), yes: yes?.innerText.trim() || '', no: no?.innerText.trim() || '', enterOnNo: !!no?.classList.contains('lk-enter'), enterOnYes: !!yes?.classList.contains('lk-enter') }; });
  // The map takes the keys once a row has been pressed beside its name.
  await page.locator('.st-row .ct').first().click(); await sleep(300);
  const lines = []; let ok = true; const say = (good, words) => { if (!good) ok = false; lines.push(`${good ? 'ok  ' : 'FAIL'} ${words}`); };
  await page.keyboard.press('Meta+Enter'); await sleep(900);
  const q = await big();
  await page.screenshot({ path: path.join(out, `for-good-${label}.png`) });
  say(!!q, `Apply asks before a tag with a node is deleted for good${q ? `: “${q.words.slice(0, 120)}”` : ': no question came'}`);
  if (q) {
    say(/deleted for good/.test(q.words) && /test/.test(q.words), 'the question says what goes for good');
    say(q.yes === 'Apply, deleting test for good', `its yes is named by its result: “${q.yes}”`);
    say(q.enterOnNo && !q.enterOnYes, `the return sign stands on “${q.no}”, not on the yes`);
    await page.keyboard.press('Enter'); await sleep(900);
    const w = await waits();
    say(!(await big()) && w.n === 1 && !w.busy && !w.done, `plain Enter leaves it: ${w.n} change still waits, nothing was applied`);
    await page.keyboard.press('Meta+Enter'); await sleep(800);
    say(!!(await big()), 'Cmd-Enter asks again');
    await page.keyboard.press('Escape'); await sleep(700);
    const w2 = await waits();
    say(!(await big()) && w2.n === 1 && !w2.done, 'Escape leaves it too');
  }
  { const d = page.locator('.st [data-discard]'); if (await d.count()) { await d.first().click(); await sleep(900); } }
  const w3 = await waits();
  say(w3.n === 0 && !w3.done, 'the waiting merge was discarded');
  const changed = differs(before, await fingerprint(page));
  say(!changed.length, changed.length ? `the graph changed: ${changed.slice(0, 3).map(c => c.what + ' “' + c.words + '”').join('; ')}` : 'no note changed');
  const noise = ours(said); for (const s of noise.slice(0, 4)) lines.push('console ' + s.type + ': ' + s.text.slice(0, 200));
  if (noise.length) ok = false;
  for (const l of lines) console.log(l);
  const first = (lines.find(l => l.startsWith('FAIL')) || '').slice(5);
  await finish(browser, {
    '1.3': { ok, said: ok ? 'before a tag with a node is deleted for good, Ontology asks, says what goes, and Enter and Escape both leave it; nothing was applied' : 'the question before a delete for good is not safe: ' + first },
    '3.5': { ok: !!q && q.yes === 'Apply, deleting test for good', said: q ? `the yes of that question reads “${q.yes}”` : 'no question came' },
  });
})().catch(fail);
