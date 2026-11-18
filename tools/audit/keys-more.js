#!/usr/bin/env node
/* node keys-more.js <out dir>   Goalpost lines 5.1 and 7.5: the three keys that had no check.
   In the checks' own Logseq, in bullets on a throwaway page:
   - Option-C (citeKeys) opens the line under the bullet that finds a source; Escape closes it and writes nothing;
   - Cmd-; (pageKeys) makes the bullet's words a page: the bullet gets Logseq's Page tag, a faded Undo arrow shows, and the
     arrow turns it back into a plain bullet;
   - << (embedTrigger) typed at the start of a bullet opens Logseq's own Node embed search; Escape gives back the marks.
   Everything made goes again by its id; nothing else in the graph may change. */
const fs = require('node:fs'), path = require('node:path');
const { connect, ours, go, sleep, fingerprint, differs, finish, fail } = require('./kit');
(async () => {
  const out = process.argv[2] || path.join(require('node:os').tmpdir(), 'keys-more'); fs.mkdirSync(out, { recursive: true });
  const { browser, page, said } = await connect();
  const before = await fingerprint(page);
  const NAME = 'ZZ keys check ' + Date.now();
  const pageUuid = await page.evaluate(async n => String((await window.logseq.api.create_page(n, {}, { redirect: true })).uuid), NAME);
  await sleep(2500);
  const bullet = async words => { const u = await page.evaluate(async ([p, w]) => { const b = await window.logseq.api.append_block_in_page(p, w); await window.logseq.api.edit_block(String(b.uuid)); return String(b.uuid); }, [pageUuid, words]); await sleep(900); return u; };
  const lines = []; const say = (ok, w) => lines.push(`${ok ? 'ok  ' : 'FAIL'} ${w}`);
  const words = u => page.evaluate(async u => (await window.logseq.api.get_block(u))?.title ?? (await window.logseq.api.get_block(u))?.content ?? '', u);
  // Option-C
  { const u = await bullet('ZZ the scan results came back');
    await page.keyboard.press('End'); await page.keyboard.press('Alt+c'); await sleep(1000);
    const line = await page.evaluate(() => !!document.querySelector('.flow-cite-field'));
    await page.screenshot({ path: path.join(out, 'cite.png') });
    await page.keyboard.press('Escape'); await sleep(500);
    const gone = await page.evaluate(() => !document.querySelector('.flow-cite-field'));
    const w = await words(u);
    say(line && gone && w === 'ZZ the scan results came back', `Option-C opens the line that finds a source (${line ? 'yes' : 'no'}); Escape closes it (${gone ? 'yes' : 'no'}) and the words are as they were (“${w}”)`);
    await page.keyboard.press('Escape'); await sleep(300); }
  // Cmd-;
  { const u = await bullet('ZZ Keys check page ' + Date.now());
    await page.keyboard.press('Meta+;'); await sleep(2000);
    const tagged = await page.evaluate(async u => (await window.logseq.api.datascript_query(`[:find ?t :where [?b :block/uuid #uuid "${u}"] [?b :block/tags ?x] [?x :block/title ?t]]`)).flat(), u);
    const arrow = page.locator('.lk-undo').first(), hasArrow = await arrow.count() > 0;
    await page.screenshot({ path: path.join(out, 'make-page.png') });
    await page.keyboard.press('Escape'); await sleep(400);
    if (hasArrow) { await arrow.click().catch(() => {}); await sleep(1500); }
    const after = await page.evaluate(async u => (await window.logseq.api.datascript_query(`[:find ?t :where [?b :block/uuid #uuid "${u}"] [?b :block/tags ?x] [?x :block/title ?t]]`)).flat(), u);
    say(tagged.includes('Page') && hasArrow && !after.includes('Page'), `Cmd-; makes the bullet a page (tags: ${tagged.join(', ') || 'none'}), an Undo arrow shows (${hasArrow ? 'yes' : 'no'}), and the arrow turns it back (tags after: ${after.join(', ') || 'none'})`); }
  // <<
  { const u = await bullet('');
    await page.keyboard.type('<<', { delay: 80 }); await sleep(1200);
    const search = await page.evaluate(() => !!document.querySelector('#ui__ac, .cp__select, [data-modal-name="block-search"], .absolute-modal'));
    await page.screenshot({ path: path.join(out, 'embed.png') });
    await page.keyboard.press('Escape'); await sleep(700);
    const w = await words(u);
    say(search && /<</.test(w), `<< opens Logseq's Node embed search (${search ? 'yes' : 'no'}); Escape gives back the marks (the bullet reads “${w}”)`);
    await page.keyboard.press('Escape'); await sleep(300); }
  await page.evaluate(async p => { await window.logseq.api.delete_page(p).catch(() => {}); }, pageUuid);
  await go(page, 'Dr. Mei Chen', 1500);
  const changed = differs(before, await fingerprint(page)).filter(c => !(c.now || []).some(f => f.includes('→' + pageUuid))).filter(c => !/^ZZ /.test(c.words) && !/^(Linked references|Unlinked references|All|<<)$/.test(c.words))
    // Logseq fills in :block/refs on its own built-in Page tag the first time a bullet is given that tag (refs to Root Tag, Tag, Tags,
    // Extends: what the tag already says of itself). Its own housekeeping, not a note changed: a change of refs alone is set aside.
    .filter(c => [...(c.now || []).filter(f => !(c.was || []).includes(f)), ...(c.was || []).filter(f => !(c.now || []).includes(f))].some(f => !/^block\/refs /.test(f)));
  if (changed.length) say(false, `the graph is not as before: ${changed.slice(0, 3).map(c => c.what + ' “' + c.words + '” ' + [...(c.now || []).filter(f => !(c.was || []).includes(f)).map(f => '+' + f), ...(c.was || []).filter(f => !(c.now || []).includes(f)).map(f => '-' + f)].slice(0, 4).join(' ').slice(0, 300)).join('; ')}`);
  const noise = ours(said); if (noise.length) say(false, 'the console said ' + noise[0].text.slice(0, 140));
  for (const l of lines) console.log(l);
  const ok = lines.every(l => l.startsWith('ok'));
  await finish(browser, { '5.1': { ok, said: ok ? 'Option-C, Cmd-; and << each do what the README says, close on Escape, and leave the graph as it was' : (lines.find(l => l.startsWith('FAIL')) || '').slice(5) } });
})().catch(fail);
