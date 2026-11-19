#!/usr/bin/env node
/* node tools/app-checks/tag-placement.js [screenshot folder]
   Where a tag goes, in the real Logseq (18 November 2026, for release 0.3.164: "a new tag can go anywhere in the tree, and
   Logseq's tag lists show your tags as a tree"). Drives the checks' own Logseq (LOGSEQ_PORT, a throwaway copy made by
   tools/audit/fresh.js; kit.connect refuses any other graph) with real presses and real typing:
   1. a chain of five tags is made (ZZ Alpha > ZZ Bravo > ZZ Charlie > ZZ Delta > ZZ Echo); "#ZZ Foxtrot" typed in a bullet and
      Enter makes a new tag; "Put ZZ Foxtrot under" opens with the whole tree open, ZZ Echo four steps in; ZZ Delta's fold arrow
      closes it and opens it again; a press on ZZ Echo makes it ZZ Foxtrot's parent, read back from the graph; the faded Undo
      arrow puts ZZ Foxtrot back at the top;
   2. "#ZZ Golf" in another bullet; in its question "echo" is typed into the find line: only ZZ Echo stays, with its path;
      Enter makes it ZZ Golf's parent, read back; Undo;
   3. the bullet picked (Escape) and p t opens Logseq's Set Tags list: the chain stands in order, each a step further in than
      its parent, Logseq's own tags under their heading below; a press on ZZ Delta gives the bullet that tag, read back; a
      second press takes it off again;
   4. ZZ Foxtrot on the first bullet right-clicked: "Change to another tag…" opens the tree; "delta" and Enter; the bullet holds
      ZZ Delta and no longer ZZ Foxtrot, read back; Undo puts ZZ Foxtrot back;
   5. everything made is deleted for good: the graph is as it began (kit.fingerprint), nothing of the plugin's in the console,
      no menu or list left open.
   Prints "ok  …" or "PROBLEM: …" per line, then "tag-placement: OK" or "tag-placement: FAILED (n)". Exit 0, 1, or 2 when
   Logseq cannot be reached. */
const path = require('node:path'), fs = require('node:fs');
const kit = require('../audit/kit');
const { sleep } = kit;
const CHAIN = ['ZZ Alpha', 'ZZ Bravo', 'ZZ Charlie', 'ZZ Delta', 'ZZ Echo'];
const NEW1 = 'ZZ Foxtrot', NEW2 = 'ZZ Golf', PAGE = 'ZZ Tag Check';
const B1 = 'zz check first bullet', B2 = 'zz check second bullet';
const ALL = [...CHAIN, NEW1, NEW2, PAGE, 'ZZ'];   // "ZZ": the tag Logseq makes of "#ZZ Foxtrot" if the question never came
const shots = process.argv[2] || null;

(async () => {
  let c;
  try { c = await kit.connect(); }
  catch (error) { console.log(`tag-placement: Logseq cannot be reached on port ${kit.PORT}: ${String(error.message || error).split('\n')[0]}`); process.exit(2); }
  const { browser, page, frame, said } = c;
  const problems = [];
  const ok = words => console.log(`ok  ${words}`);
  const problem = words => { problems.push(words); console.log(`PROBLEM: ${words}`); };
  const shot = async name => { if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, `tag-placement-${name}.png`) }); } };
  const q = query => page.evaluate(s => window.logseq.api.datascript_query(s), query);
  const until = async (fn, ms = 3000) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v || Date.now() > end) return v; await sleep(120); } };
  const uuidOf = async name => { const r = await q(`[:find ?u :where [?t :block/title ${JSON.stringify(name)}] [?t :block/name] [?t :block/uuid ?u] (not [?t :logseq.property/deleted-at _])]`); return r[0] ? String(r[0][0]) : null; };
  const parentsOf = async name => (await q(`[:find ?pt :where [?t :block/title ${JSON.stringify(name)}] [?t :block/tags :logseq.class/Tag] [?t :logseq.property.class/extends ?p] [?p :block/title ?pt]]`)).map(r => r[0]);
  const tagsOf = async words => (await q(`[:find ?tt :where [?b :block/title ${JSON.stringify(words)}] [?b :block/tags ?t] [?t :block/title ?tt]]`)).map(r => r[0]);
  // What the plugin has open: its tag question, its menu, Logseq's list.
  const opened = () => page.evaluate(() => [['the tag question', '.st-where'], ['a plugin menu', '.lk-door-menu'], ['Logseq’s list', '.cp__select']].filter(([, s]) => document.querySelector(s)).map(([w]) => w));
  const closeAll = async () => { for (let i = 0; i < 4 && (await opened()).length; i++) { await page.keyboard.press('Escape'); await sleep(250); } };
  const question = () => page.evaluate(() => { const w = document.querySelector('.st-where'); if (!w) return null; return { ask: w.querySelector('.st-wq')?.textContent.trim(), rows: [...w.querySelectorAll('.st-wr')].map(r => ({ name: r.querySelector('.nm')?.textContent.trim(), path: r.querySelector('.lk-note')?.textContent.trim() || '', d: Number(r.style.getPropertyValue('--d') || 0), top: r.classList.contains('st-wtop'), x: Math.round(r.querySelector('.nm').getBoundingClientRect().left) })) }; });
  const whereRow = name => page.locator('.st-where .st-wr', { has: page.locator('.nm', { hasText: new RegExp(`^${name}$`) }) });
  const block = words => page.locator('.ls-block .block-content', { hasText: words }).first();
  const undoArrow = key => page.locator(`.lk-undo[data-lk-undo^="${key}"]`).first();

  // Anything a run cut short left behind goes first, for good; the graph as it stands then is the one to come back to.
  async function removeOurs() {
    const pg = await uuidOf(PAGE);
    if (pg) await page.evaluate(n => window.logseq.api.delete_page(n), PAGE).catch(() => {});
    const gone = [pg];
    for (const name of [NEW2, NEW1, 'ZZ', ...[...CHAIN].reverse()]) { const u = await uuidOf(name); if (u) { gone.push(u); await page.evaluate(u => window.logseq.api.delete_page(u), u).catch(() => {}); } }
    await sleep(500);
    // A deleted page waits in Logseq's Recycle: taken out of it for good, by its id, so the graph is as it was.
    const recycled = (await q(`[:find ?u :where [?p :block/uuid ?u] [?p :logseq.property/deleted-at _] [?p :block/title ?t] [(contains? #{${ALL.map(n => JSON.stringify(n)).join(' ')}} ?t)]]`)).map(r => String(r[0]));
    for (const u of [...new Set([...gone.filter(Boolean), ...recycled])]) await page.evaluate(u => window.logseq.api.delete_recycled_page_permanently(u), u).catch(() => {});
    await sleep(500);
  }

  try {
    await closeAll();
    await removeOurs();
    const before = await kit.fingerprint(page);

    // ---------- the chain, made by the plugin's own way of making a tag and placing it ----------
    const made = await frame().evaluate(async names => {
      const S = window.Structure, out = [];
      for (const n of names) { const t = await S.db.makeTag(n); if (out.length) await S.db.addExtends(t.uuid, out[out.length - 1]); out.push(t.uuid); }
      return out;
    }, CHAIN);
    await page.evaluate(async ([p, a, b]) => { const pg = await window.logseq.api.create_page(p, {}, { redirect: false }); await window.logseq.api.append_block_in_page(pg.uuid, a); await window.logseq.api.append_block_in_page(pg.uuid, b); }, [PAGE, B1, B2]);
    const known = await until(() => frame().evaluate(n => [...window.Structure.app.tray.model.tags.values()].some(t => t.title === n && t.parents.length), CHAIN[4]), 6000);
    const chainOk = made.length === 5 && (await parentsOf(CHAIN[4])).includes(CHAIN[3]) && known;
    if (!chainOk) throw new Error('the chain of five tags could not be made, so nothing could be checked');
    await kit.go(page, PAGE, 2200);

    // ---------- 1. a new tag, put under a tag four steps down ----------
    const newTag = async (words, name) => {
      await block(words).click(); await sleep(350);
      await page.keyboard.press('End');
      await page.keyboard.type(` #${name}`, { delay: 30 });
      const litNow = () => page.evaluate(() => document.querySelector('#ui__ac-inner a.chosen')?.textContent.trim());
      const lit = await until(async () => { const l = await litNow(); return l === `New tag ${name}` ? l : null; }, 4000) || await litNow();
      if (lit !== `New tag ${name}`) return `the # list lit “${lit || 'nothing'}”, not “New tag ${name}”`;
      await page.keyboard.press('Enter');
      const asked = await until(async () => (await question())?.ask, 4000);
      return asked === `Put ${name} under` ? null : `no “Put ${name} under” question came after Enter on “New tag ${name}”${asked ? ` (it asked “${asked}”)` : ''}`;
    };
    {
      const why = await newTag(B1, NEW1);
      if (why) problem(why);
      else {
        // The whole tree stands open (18 November 2026): ZZ Echo is there without a press; ZZ Delta's fold arrow closes it away and
        // opens it again.
        let reached = 3;
        await until(async () => (await question())?.rows.some(r => r.name === CHAIN[4]), 2000);
        const deltaRow = whereRow(CHAIN[3]);
        if (await deltaRow.count()) {
          await deltaRow.locator('.lk-fold').click(); await sleep(450);
          if ((await question())?.rows.some(r => r.name === CHAIN[4])) problem(`${CHAIN[3]}'s fold arrow did not close it: ${CHAIN[4]} still shows`);
          else ok(`${CHAIN[3]}'s fold arrow closes it`);
          await deltaRow.locator('.lk-fold').click(); await sleep(450);
        }
        const qs = await question();
        const echo = qs?.rows.find(r => r.name === CHAIN[4]), delta = qs?.rows.find(r => r.name === CHAIN[3]);
        if (!echo) {
          const deepest = qs?.rows.filter(r => r.name?.startsWith('ZZ ')).sort((a, b) => b.d - a.d)[0];
          problem(`“Put ${NEW1} under” never showed ${CHAIN[4]}: with the tree open it reached ${deepest ? `${deepest.name} at depth ${deepest.d}` : 'none of the chain'}${reached < 3 ? `; ${CHAIN[reached + 1]} never showed under ${CHAIN[reached]} to be opened` : ''}`);
          await shot('broken-put-under');
          await closeAll();
        } else {
          if (echo.d === 4 && delta && echo.x > delta.x) ok(`“Put ${NEW1} under” opens down to ${CHAIN[4]}, four steps in, under ${CHAIN[3]}`);
          else problem(`${CHAIN[4]} shows in “Put ${NEW1} under” but not four steps in under ${CHAIN[3]} (depth ${echo.d})`);
          await whereRow(CHAIN[4]).scrollIntoViewIfNeeded(); await sleep(200);
          await shot('1-put-under-depth-5');
          await whereRow(CHAIN[4]).locator('.nm').click();
          const parents = await until(async () => { const p = await parentsOf(NEW1); return p.includes(CHAIN[4]) ? p : null; }, 3000) || await parentsOf(NEW1);
          if (parents.includes(CHAIN[4]) && !(await opened()).includes('the tag question')) ok(`a press on ${CHAIN[4]} made it ${NEW1}'s parent in the graph`);
          else problem(`a press on ${CHAIN[4]} left ${NEW1} under ${parents.join(', ') || 'nothing'}`);
          const arrow = undoArrow(`structure:where:`);
          if (await until(async () => await arrow.count(), 2000)) {
            await arrow.click();
            const back = await until(async () => !(await parentsOf(NEW1)).includes(CHAIN[4]), 3000);
            if (back) ok(`the Undo arrow beside ${NEW1} put it back at the top`); else problem(`the Undo arrow beside ${NEW1} did not take it out from under ${CHAIN[4]}`);
          } else problem(`no Undo arrow stood beside ${NEW1} after it was placed`);
        }
      }
      await closeAll();
    }

    // ---------- 2. the find line narrows to a deep tag ----------
    {
      const why = await newTag(B2, NEW2);
      if (why) problem(why);
      else {
        const all = (await question()).rows.length;
        await page.keyboard.type('echo', { delay: 40 }); await sleep(400);
        const qs = await question();
        const rows = qs.rows.filter(r => !r.top);
        const want = CHAIN.slice(0, 4).join(' / ');
        if (rows.length === 1 && rows[0].name === CHAIN[4] && rows[0].path === want) ok(`typing “echo” in the find line narrowed ${all} rows to ${CHAIN[4]} with its path “${want}”`);
        else problem(`typing “echo” in the find line left ${rows.length} rows (${rows.slice(0, 4).map(r => r.name + (r.path ? ` [${r.path}]` : '')).join(', ')}${rows.length > 4 ? ', …' : ''}), not ${CHAIN[4]} alone with its path`);
        await shot(rows.length === 1 ? '2-find-line' : 'broken-find-line');
        await page.keyboard.press('Enter');
        const parents = await until(async () => { const p = await parentsOf(NEW2); return p.includes(CHAIN[4]) ? p : null; }, 3000) || await parentsOf(NEW2);
        if (parents.includes(CHAIN[4])) ok(`Enter on the found row made ${CHAIN[4]} ${NEW2}'s parent in the graph`);
        else problem(`Enter on the find line's first row left ${NEW2} under ${parents.join(', ') || 'nothing'}, not ${CHAIN[4]}`);
        const arrow = undoArrow(`structure:where:`);
        if (parents.includes(CHAIN[4]) && await until(async () => await arrow.count(), 2000)) {
          await arrow.click();
          if (!(await until(async () => !(await parentsOf(NEW2)).includes(CHAIN[4]), 3000))) problem(`the Undo arrow beside ${NEW2} did not take it out from under ${CHAIN[4]}`);
        }
      }
      await closeAll();
    }

    // ---------- 3. Logseq's Set Tags list as a tree ----------
    {
      // The second bullet picked as a person picks it: still being written, Escape.
      if (!(await page.evaluate(() => document.activeElement?.tagName === 'TEXTAREA'))) { await block(B2).click(); await sleep(300); }
      await page.keyboard.press('Escape'); await sleep(350);
      await page.keyboard.press('p'); await page.keyboard.press('t');
      const list = await until(() => page.evaluate(() => document.querySelector('.cp__select input.cp__select-input')?.placeholder), 3000);
      if (list !== 'Set Tags') problem(`p t on the picked bullet opened ${list ? `“${list}”` : 'no list'}, not Logseq’s Set Tags`);
      else {
        await sleep(400);
        const row = n => page.locator('.cp__select #ui__ac-inner > .menu-link-wrap', { hasText: new RegExp(`^\\s*${n}\\s*$`) });
        await row(CHAIN[3]).scrollIntoViewIfNeeded().catch(() => {}); await sleep(250);
        // As drawn: every row's place from the top and where its words start.
        const seen = await page.evaluate(() => {
          const list = document.querySelector('.cp__select #ui__ac-inner');
          const items = [...list.children].filter(n => n.offsetParent !== null).map(n => {
            const words = n.textContent.trim(), r = n.getBoundingClientRect();
            const leaf = [...n.querySelectorAll('*')].filter(e => !e.children.length && e.textContent.trim() === words)[0] || n;
            return { words, head: n.classList.contains('st-vh'), top: r.top, x: Math.round(leaf.getBoundingClientRect().left) };
          }).sort((a, b) => a.top - b.top);
          return items;
        });
        const at = n => seen.findIndex(s => s.words === n && !s.head);
        const idx = CHAIN.map(at);
        const inOrder = idx.every((i, k) => i >= 0 && (k === 0 || i === idx[k - 1] + 1));
        const stepped = idx.every((i, k) => i >= 0 && (k === 0 || seen[i].x > seen[idx[k - 1]].x));
        const head = seen.findIndex(s => s.head), task = at('Task');
        if (inOrder && stepped) ok(`Set Tags lists ${CHAIN.join(' > ')} one under another, each a step further in`);
        else problem(`Set Tags is not drawn as a tree: ${CHAIN.map((n, k) => `${n} at row ${idx[k]}, ${idx[k] >= 0 ? seen[idx[k]].x : '-'}px`).join('; ')}`);
        if (head >= 0 && task > head && head > Math.max(...idx)) ok('Logseq’s own tags stand under their own heading below the tree');
        else problem(`Logseq’s own tags are not under a heading below the tree (heading at row ${head}, Task at row ${task})`);
        await shot(inOrder && stepped ? '3-set-tags-tree' : 'broken-set-tags');
        await row(CHAIN[3]).click();
        if (await until(async () => (await tagsOf(B2)).includes(CHAIN[3]), 3000)) ok(`a press on ${CHAIN[3]} in Set Tags gave the bullet that tag`);
        else problem(`a press on ${CHAIN[3]} in Set Tags did not give the bullet that tag (it holds ${(await tagsOf(B2)).join(', ') || 'none'})`);
        // The way back: the same press again.
        if ((await tagsOf(B2)).includes(CHAIN[3])) {
          if (!(await opened()).includes('Logseq’s list')) { await page.keyboard.press('p'); await page.keyboard.press('t'); await sleep(700); }
          await row(CHAIN[3]).click().catch(() => {});
          if (!(await until(async () => !(await tagsOf(B2)).includes(CHAIN[3]), 3000))) problem(`a second press on ${CHAIN[3]} did not take the tag off the bullet`);
        }
      }
      await closeAll();
    }

    // ---------- 4. right-click a tag: Change to another tag… ----------
    {
      const bullet = await uuidOf(B1) || String((await q(`[:find ?u :where [?b :block/title ${JSON.stringify(B1)}] [?b :block/uuid ?u]]`))[0]?.[0] || '');
      const link = page.locator(`.ls-block[blockid="${bullet}"] .block-tags a.tag`, { hasText: NEW1 }).first();
      if (!(await until(async () => await link.count(), 2000))) problem(`${NEW1} is not drawn on the first bullet, so its right-click menu could not be tried`);
      else {
        await link.click({ button: 'right' });
        const line = page.locator('.lk-door-menu .lk-item', { hasText: 'Change to another tag…' });
        if (!(await until(async () => await line.count(), 2000))) {
          const words = await page.evaluate(() => [...document.querySelectorAll('.lk-door-menu .lk-item')].map(n => n.textContent.trim()).filter(Boolean).join(', '));
          problem(`the right-click menu on ${NEW1} has no “Change to another tag…” (${words ? `it lists ${words}` : 'no plugin menu opened'})`);
          await shot('broken-change-to');
        } else {
          await sleep(500); await line.scrollIntoViewIfNeeded().catch(() => {});
          await shot('4-change-to-menu');
          await line.click();
          const asked = await until(async () => (await question())?.ask, 2500);
          if (asked !== `Change ${NEW1} to`) problem(`“Change to another tag…” opened ${asked ? `“${asked}”` : 'nothing'}, not the tree “Change ${NEW1} to”`);
          else {
            await page.keyboard.type('delta', { delay: 40 }); await sleep(300);
            await page.keyboard.press('Enter');
            const now = await until(async () => { const t = await tagsOf(B1); return t.includes(CHAIN[3]) && !t.includes(NEW1) ? t : null; }, 3000) || await tagsOf(B1);
            if (now.includes(CHAIN[3]) && !now.includes(NEW1)) ok(`“Change to another tag…” swapped ${NEW1} for ${CHAIN[3]} on the bullet`);
            else problem(`after “Change to another tag…” → ${CHAIN[3]} the bullet holds ${now.join(', ') || 'no tag'}`);
            const arrow = undoArrow(`structure:tag:${bullet}`);
            if (now.includes(CHAIN[3]) && await until(async () => await arrow.count(), 2000)) {
              await arrow.click();
              const back = await until(async () => { const t = await tagsOf(B1); return t.includes(NEW1) && !t.includes(CHAIN[3]); }, 3000);
              if (back) ok(`the Undo arrow put ${NEW1} back in place of ${CHAIN[3]}`); else problem(`the Undo arrow did not put ${NEW1} back (the bullet holds ${(await tagsOf(B1)).join(', ')})`);
            } else if (now.includes(CHAIN[3])) problem('no Undo arrow stood beside the bullet’s tags after the change');
          }
        }
      }
      await closeAll();
    }

    // ---------- 5. as it began ----------
    await page.keyboard.press('Escape'); await sleep(200);
    const left = await opened();
    if (left.length) problem(`still open at the end: ${left.join(', ')}`); else ok('no menu or list is left open');
    await removeOurs();
    const changed = kit.differs(before, await kit.fingerprint(page));
    if (changed.length) problem(`the graph is not as it began: ${changed.slice(0, 3).map(d => `${d.what} “${d.words}”${d.now.length ? ' ' + d.now.slice(0, 2).join(' ') : ''}`).join('; ')}`);
    else ok('everything made was deleted for good: the graph is as it began');
    const noise = kit.ours(said);
    if (noise.length) problem(`the console said ${noise.length} thing${noise.length > 1 ? 's' : ''}: ${noise[0].type}: ${noise[0].text.slice(0, 160)}`);
    else ok('nothing in the console');
  } catch (error) {
    problem(String(error.message || error).split('\n')[0]);
    await closeAll().catch(() => {});
    await removeOurs().catch(() => {});
  }
  console.log(problems.length ? `tag-placement: FAILED (${problems.length})` : 'tag-placement: OK');
  await browser.close();
  process.exit(problems.length ? 1 : 0);
})().catch(error => { console.log(`tag-placement: Logseq cannot be reached: ${String(error.message || error).split('\n')[0]}`); process.exit(2); });
