/* Checks, in the real Logseq, the Ontology's part in writing (14 November 2026): the list on #, a property's list of values by
   tag, and a bullet's tag right-clicked. Logseq must be running with its debugging port on the Illness Test Graph, Playwright
   reachable:
     NODE_PATH=/Users/massimo/logseq-value/logseq-plugin/node_modules node structure/tools/app/writing.js
   It types real keys into one bullet of the scratch page "flow test" (Predictive's door, tools/app/door.js), and only while that
   bullet's text box has the keyboard, so Logseq's one-key shortcuts never fire. Every tag it gives it takes off again, and the
   scratch page is left empty. It refuses to run while a block is being edited. */
const assert = require('node:assert/strict');
const D = require('../../../predictive/tools/app/door.js');
const sleep = D.sleep;
(async () => {
  const c = await D.connect(), p = c.page;
  if (await p.evaluate(() => window.logseq.api.check_editing())) { console.log('skipped: a block is being edited'); process.exit(2); }
  const was = await p.evaluate(() => window.location.hash);
  await D.reload(c);
  const f = c.frame();
  const editing = () => p.evaluate(() => document.activeElement?.tagName === 'TEXTAREA' && !!document.activeElement.closest('.ls-block[blockid]'));
  const type = async (text, gap = 40) => { for (const ch of text) { if (!(await editing())) throw new Error('the bullet lost the keyboard before ' + JSON.stringify(text)); await p.keyboard.type(ch); await sleep(gap); } };
  const clear = async () => { if (await editing() && await p.evaluate(() => document.activeElement.value !== '')) { await p.keyboard.press('Meta+a'); await p.keyboard.press('Backspace'); await sleep(300); } };
  const leave = async () => { for (let i = 0; i < 3 && await editing(); i++) { await p.keyboard.press('Escape'); await sleep(250); } };
  const open = async (tag, words) => { const uuid = await D.scratch(c, tag); for (let i = 0; i < 6 && !(await editing()); i++) { await f.evaluate(u => logseq.Editor.editBlock(u), uuid); await sleep(500); } if (words) await type(words); return uuid; };
  const tagsOf = uuid => f.evaluate(async u => (await window.PluginDoor.query(`[:find ?tt :where [?b :block/uuid #uuid "${u}"] [?b :block/tags ?t] [?t :block/title ?tt]]`)).flat().sort(), uuid);
  // The list on #, as shown: '>' the lit row, '*' one of the plugin's rows, '^' a row the keys pass over.
  const rows = () => p.evaluate(() => { const l = document.getElementById('ui__ac-inner'); if (!l) return null; const ord = n => Number(getComputedStyle(n).order) || 0; return [...l.children].filter(n => getComputedStyle(n).display !== 'none').map((n, i) => [n, i]).sort((a, b) => ord(a[0]) - ord(b[0]) || a[1] - b[1]).map(([n]) => n).map(n => (n.querySelector('a.chosen') && !(l.classList.contains('st-twin-lit') && !n.classList.contains('st-hrow')) ? '>' : ' ') + (n.classList.contains('st-hrow') ? '*' : n.classList.contains('st-hc') ? '^' : ' ') + n.textContent.trim()); });
  const lit = async () => ((await rows()) || []).find(r => r[0] === '>') || '';
  let passed = 0;
  const ok = (cond, said) => { assert.ok(cond, said); passed++; console.log('  ok  ' + said); };
  try {
    await p.mouse.move(5, 600);
    let uuid = await open(null, '');
    // 1. # alone
    await type('#'); await sleep(800);
    let list = await rows();
    ok(list.every(r => r[1] === '*') && list.some(r => /Logseq’s tags:/.test(r)), '# alone: your own tags under your top-level tags, Logseq’s tags in one line at the foot');
    ok((await lit()).length > 2 && !/›$/.test((await lit()).trim()) , '# alone: the first tag under the first top-level tag is lit');
    await p.keyboard.press('ArrowUp'); await sleep(150); await p.keyboard.press('ArrowRight'); await sleep(300);
    list = await rows(); ok(list[0].startsWith(' *') && list.length > 1 && list.slice(1).every(r => r[1] === '*'), 'Right arrow on a top-level tag steps down to the tags under it');
    await p.keyboard.press('ArrowLeft'); await sleep(300); ok((await rows()).some(r => /Logseq’s tags:/.test(r)), 'Left arrow steps back up');
    await p.keyboard.press('ArrowUp'); await sleep(150); ok(/Logseq’s tags:/.test(await lit()), 'Up from the first row goes round to the foot');
    await p.keyboard.press('Enter'); await sleep(300); ok((await rows()).some(r => r.endsWith('Task')), 'Enter on the foot unfolds Logseq’s tags');
    await p.keyboard.press('ArrowLeft'); await sleep(300);
    await clear();
    // 2. letters, Right arrow, Enter, Cmd-Z
    await type('Seen today #Perso'); await sleep(900);
    ok(/^> Person.*Doctor.*›/.test(await lit()), '#Perso: Person is lit, with its path, and names the tags under it');
    await p.keyboard.press('ArrowRight'); await sleep(350); list = await rows();
    ok(/^>\*/.test(await lit()) && list.some(r => r.endsWith('*Doctor')), 'Right arrow steps down to the tags under Person');
    ok(await p.evaluate(() => document.activeElement.value) === 'Seen today #Perso', 'the words in the bullet are untouched by the step');
    const kid = (await lit()).slice(2).replace(/ ›$/, '').replace(/[A-Z][^›]*›$/, '').trim() || (await lit()).slice(2);
    await p.keyboard.press('Enter'); await sleep(1400);
    const got = await tagsOf(uuid);
    ok(got.length === 1 && kid.startsWith(got[0]) && (await p.evaluate(() => document.activeElement.value)).trim() === 'Seen today' && await editing(), `Enter gives the lit tag (${got[0]}), takes the #words out and leaves the cursor in the bullet`);
    await p.keyboard.press('Meta+z'); await sleep(700); ok((await tagsOf(uuid)).length === 0, 'Cmd-Z takes the tag off again');
    if (!(await editing())) { await f.evaluate(u => logseq.Editor.editBlock(u), uuid); await sleep(500); }
    // 3. a near name
    await clear(); await type('Dr. Okafor #Doctors'); await sleep(900);
    list = await rows(); ok(list[0].startsWith('>*Doctor') && /Person$/.test(list[0]) && list.at(-1).trim() === 'New tag Doctors', '#Doctors: Doctor stands first, lit, with its path; New tag Doctors is last');
    await p.keyboard.press('ArrowDown'); await sleep(200); ok(/New tag Doctors/.test(await lit()), 'Down goes to New tag Doctors');
    await p.keyboard.press('ArrowUp'); await sleep(200); ok((await lit()).startsWith('>*Doctor'), 'Up goes back to Doctor');
    await p.keyboard.press('Enter'); await sleep(1400); ok((await tagsOf(uuid)).join() === 'Doctor', 'Enter gives the tag you have, and no tag Doctors is made');
    ok(await f.evaluate(async () => (await window.PluginDoor.query('[:find ?t :where [?t :block/title "Doctors"] [?t :block/tags :logseq.class/Tag]]')).length) === 0, 'no tag named Doctors is in the graph');
    await p.keyboard.press('Meta+z'); await sleep(700);
    if (!(await editing())) { await f.evaluate(u => logseq.Editor.editBlock(u), uuid); await sleep(500); }
    await clear(); await type('x #Consultaton'); await sleep(900); ok(/^> Consultation/.test(await lit()), 'a letter off a name Logseq’s own list holds: the tag you have is lit, not New tag');
    // letters: every row a match with its path, the first match lit, New tag last, the keys in the order shown
    await clear(); await type('x #hospi'); await sleep(900); list = await rows();
    ok(/^> Hospital.*Organization$/.test(list[0]) && list.at(-1).trim() === 'New tag hospi' && list.every(r => r[1] !== '^'), '#hospi: Hospital lit first with its path, Hospitalization next, New tag hospi last, and no row the keys pass over');
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await sleep(250); ok(/New tag hospi/.test(await lit()), 'Down twice, quickly, reaches New tag: one row a press');
    await p.keyboard.press('ArrowDown'); await sleep(200); ok(/^> Hospital/.test(await lit()), 'Down from the last row goes round to the first');
    // The pointer moved over a row lights it, with no error thrown (15 November 2026: a constant reassigned on every move broke this).
    const thrown = []; const onError = error => thrown.push(String(error.message || error)); p.on('pageerror', onError);
    const second = await p.evaluateHandle(() => { const l = document.getElementById('ui__ac-inner'); return [...l.querySelectorAll(':scope > .menu-link-wrap')].find(w => /^Hospitalization/.test(w.textContent.trim())); });
    const b2 = await second.asElement().boundingBox(); await p.mouse.move(b2.x + 40, b2.y + b2.height / 2, { steps: 4 }); await sleep(300);
    p.off('pageerror', onError);
    ok(/^> Hospitalization/.test(await lit()) && !thrown.length, `the pointer moved over Hospitalization lights it, and nothing is thrown${thrown.length ? ' (' + thrown[0] + ')' : ''}`);
    await p.mouse.move(5, 600);
    ok(await p.evaluate(() => { const m = document.querySelector('#ui__ac-inner mark'); const st = m && getComputedStyle(m); return !!st && st.backgroundColor === 'rgba(0, 0, 0, 0)' && Number(st.fontWeight) >= 600; }), 'the letters typed are semibold in a match, with no yellow behind them');
    await clear(); await leave();
    // # right after a link (15 November 2026: Logseq's plain tag list showed there)
    if (!(await editing())) { await f.evaluate(u => logseq.Editor.editBlock(u), uuid); await sleep(500); }
    await clear(); await leave();
    await f.evaluate(u => logseq.Editor.updateBlock(u, 'Called [[Dr. Mei Chen]]'), uuid); await sleep(600);   // Logseq pairs typed brackets, so the link is set, not typed
    for (let i = 0; i < 6 && !(await editing()); i++) { await f.evaluate(u => logseq.Editor.editBlock(u), uuid); await sleep(500); }
    await p.keyboard.press('End'); await sleep(200); await type('#'); await sleep(900); list = await rows();
    ok(list && list.every(r => r[1] === '*') && list.some(r => /Logseq’s tags:/.test(r)), '# right after a [[link]]: your own tags under your top-level tags, not Logseq’s plain list');
    await clear(); await leave();
    // 5. a property's values by tag
    uuid = await open('Conversation', 'Phoned about the scan results'); await leave(); await sleep(800);
    const pill = await p.evaluateHandle(u => [...document.querySelectorAll(`.ls-block[blockid="${u}"] .bottom-property-pill`)].find(n => n.querySelector('.property-k')?.textContent.trim() === 'Spoke with')?.querySelector('.property-value-inner .jtrigger'), uuid);
    await pill.asElement().click(); await sleep(1000);
    const vals = () => p.evaluate(() => { const l = document.querySelector('.cp__select #ui__ac-inner'); if (!l) return null; return [...l.children].filter(n => getComputedStyle(n).display !== 'none').sort((a, b) => Number(a.style.order) - Number(b.style.order)).map(n => ((n.querySelector('a.chosen') && !l.classList.contains('st-vmore-lit')) || n.classList.contains('on') ? '>' : ' ') + (n.classList.contains('st-vh') ? '#' : ' ') + n.textContent.trim()); });
    let v = await vals();
    ok(v[0] === ' #Doctor' && v[1][0] === '>' && v.includes(' #Person') && v.some(r => /^  and \d+ more$/.test(r)), 'Spoke with: doctors under Doctor, then people under Person, the first row lit, a long group cut to its first few');
    for (let i = 0; i < 5; i++) { await p.keyboard.press('ArrowDown'); await sleep(120); }
    ok(/^> and \d+ more$/.test((await vals()).find(r => r[0] === '>')), 'Down walks the rows in the order shown and reaches "and N more"');
    const before = (await vals()).length; await p.keyboard.press('Enter'); await sleep(400); ok((await vals()).length > before, 'Enter on it opens the group');
    await p.keyboard.press('Escape'); await sleep(400); if (await p.evaluate(() => !!document.querySelector('.cp__select'))) { await p.keyboard.press('Escape'); await sleep(300); }
    // 6. a bullet's tag, right-clicked
    uuid = await open('Consultation', 'Saw Dr. Mei Chen about the fatigue again'); await leave(); await sleep(900);
    await (await p.$(`.ls-block[blockid="${uuid}"] .block-tags a.tag`)).click({ button: 'right' }); await sleep(600);
    const menu = () => p.evaluate(() => [...(document.querySelector('.lk-door-menu')?.children || [])].map(n => (n.classList.contains('on') ? '>' : ' ') + (n.classList.contains('lk-group') ? '#' : ' ') + n.textContent));
    const m = await menu();
    ok(m[0] === ' #Change to its parent' && m.includes(' #Change to a tag beside it') && m.at(-1).trim() === 'Remove tag' && !(await p.evaluate(() => !!document.querySelector('.ui__dropdown-menu-content'))), 'right-click on Consultation: its parent, the tags beside it, then Logseq’s three lines; Logseq’s own menu stays shut');
    await p.keyboard.press('ArrowDown'); await sleep(150); const to = (await menu()).find(r => r[0] === '>').slice(2);
    await p.keyboard.press('Enter'); await sleep(1300);
    ok((await tagsOf(uuid)).join() === to && /flow%20test|flow test/.test(await p.evaluate(() => window.location.hash)), `choosing ${to} gives it in place of Consultation, and the page stays`);
    const arrow = await p.$('[data-lk-undo^="structure:tag:"]'); ok(!!arrow, 'the faded Undo arrow waits beside the tags');
    await arrow.click(); await sleep(1300); ok((await tagsOf(uuid)).join() === 'Consultation', 'Undo puts Consultation back');
    console.log(`\n${passed} checks passed`);
  } finally {
    for (let i = 0; i < 3 && await p.evaluate(() => !!document.querySelector('.cp__select, .lk-door-menu, .st-where')); i++) { await p.keyboard.press('Escape'); await sleep(300); }
    await clear().catch(() => {}); await leave().catch(() => {}); await D.cleanup(c);
    await p.evaluate(h => { window.location.hash = h; }, was).catch(() => {});
    await c.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
