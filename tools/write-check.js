/* node tools/write-check.js   (Logseq with its debugging port on the Illness Test Graph, Playwright on NODE_PATH, Logseq's command line)
   Every kind of write the plugin makes, made in the real Logseq through each module's own write code, and then READ BACK from the
   graph (9 November 2026). The stand-ins of test/ record a write and call it done; only Logseq can say whether the write landed.
   This is the check for "a notice says it was done, and nothing changed" (a property deleted from a tag that stays on the tag).
   Each write is followed by its way back, also read back, so the graph ends as it began; threads/tools/graph-check.js takes the
   graph's fingerprint before and compares after, and the run fails if anything differs.
   Works only in the empty scratch page "flow test" and on the Consultation tag (one property declared on it, then taken off).
   Refuses any graph but the Illness Test Graph, and refuses while a block is being edited. */
const path = require('node:path'), { execFileSync } = require('node:child_process');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const GRAPH = 'Illness Test Graph', PLUGIN = 'logseq-plugin', SCRATCH = 'flow test';
const graphCheck = mode => execFileSync('node', [path.join(__dirname, '../threads/tools/graph-check.js'), mode], { encoding: 'utf8' });
let chromium; try { ({ chromium } = require('playwright')); } catch (error) { console.log('skipped: needs Playwright (set NODE_PATH)'); process.exit(2); }

(async () => {
  let browser;
  try { browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 5000 }); } catch (error) { console.log('skipped: Logseq is not reachable on its debugging port'); process.exit(2); }
  const page = browser.contexts().flatMap(c => c.pages()).find(p => /index\.html/.test(p.url()));
  const graph = String(await page.evaluate(async () => (await window.logseq.api.get_current_graph())?.name || '')).replace(/^logseq_db_/, '');
  if (graph !== GRAPH) throw new Error(`the open graph is “${graph}”; this check writes, so only the ${GRAPH}. Nothing was touched`);
  if (await page.evaluate(() => !!window.logseq.api.check_editing())) throw new Error('a block is being edited in Logseq; nothing was touched');
  const frame = page.frames().find(f => f.url().includes('/' + PLUGIN + '_index'));
  if (!frame) throw new Error('the plugin is not running in Logseq');
  console.log(graphCheck('save').trim());

  const results = await frame.evaluate(async scratchName => {
    const out = [], q = async text => (await logseq.DB.datascriptQuery(text)) || [];
    const check = async (name, write, expect) => {
      try { await write(); await new Promise(r => setTimeout(r, 300)); const got = await expect(); out.push({ name, ok: got === true, got: got === true ? '' : JSON.stringify(got) }); }
      catch (error) { out.push({ name, ok: false, got: 'threw: ' + (error?.message || error) }); }
    };
    const scratch = await logseq.Editor.getPage(scratchName);
    if (!scratch) return [{ name: 'the scratch page', ok: false, got: `no page “${scratchName}”` }];
    if (((await logseq.Editor.getPageBlocksTree(scratchName)) || []).some(b => String(b.content ?? b.title ?? '').trim())) return [{ name: 'the scratch page', ok: false, got: 'it is not empty; nothing was written' }];
    const block = await logseq.Editor.appendBlockInPage(scratchName, 'write check');
    const B = String(block.uuid);
    const id = async ident => (await q(`[:find ?p :where [?p :db/ident :${ident}]]`))[0]?.[0];
    const tagUuid = String((await q('[:find ?u :where [?t :block/name "consultation"] [?t :block/tags :logseq.class/Tag] [?t :block/uuid ?u]]'))[0]?.[0]);
    const tagsOf = async () => (await q(`[:find ?t :where [?b :block/uuid #uuid "${B}"] [?b :block/tags ?x] [?x :block/name ?t]]`)).map(r => r[0]);
    const valueOf = async ident => (await q(`[:find ?w :where [?b :block/uuid #uuid "${B}"] [?b :${ident} ?v] [?v :block/title ?w]]`)).map(r => r[0]);
    const numberOf = async ident => (await q(`[:find ?n :where [?b :block/uuid #uuid "${B}"] [?b :${ident} ?v] [?v :logseq.property/value ?n]]`)).map(r => r[0]);
    const declared = async () => (await q(`[:find ?i :where [?t :block/uuid #uuid "${tagUuid}"] [?t :logseq.property.class/properties ?p] [?p :db/ident ?i]]`)).map(r => String(r[0]).replace(/^:/, '')).sort();
    const NOTES = 'user.property/notes', SEVERITY = 'user.property/severity';
    const W = { Predictive: window.Flow?.db, Look: window.Look?.db, Structure: window.Structure?.db, Threads: window.Threads?.core?.provided };

    // A tag put on and taken off, through each module that does it.
    for (const [who, db] of Object.entries(W)) {
      if (!db?.addTag && !db?.removeTag) continue;
      if (db.addTag) await check(`${who}: a tag put on`, () => db.addTag(B, tagUuid), async () => (await tagsOf()).includes('consultation') || await tagsOf());
      else await logseq.Editor.addBlockTag(B, tagUuid);
      await check(`${who}: a tag taken off`, () => db.removeTag(B, tagUuid), async () => !(await tagsOf()).includes('consultation') || await tagsOf());
    }
    // A value set and the property taken off the node again, through each module that does it.
    for (const [who, db] of Object.entries(W)) {
      if (!db?.setValue || !db?.unsetValue) continue;
      await check(`${who}: a words value set`, () => db.setValue(B, NOTES, 'written by the write check'), async () => (await valueOf(NOTES))[0] === 'written by the write check' || await valueOf(NOTES));
      await check(`${who}: the property taken off the node`, () => db.unsetValue(B, NOTES), async () => (await valueOf(NOTES)).length === 0 || await valueOf(NOTES));
      await check(`${who}: a number value set`, () => db.setValue(B, SEVERITY, 3), async () => (await numberOf(SEVERITY))[0] === 3 || await numberOf(SEVERITY));
      await check(`${who}: the number taken off the node`, () => db.unsetValue(B, SEVERITY), async () => (await numberOf(SEVERITY)).length === 0 || await numberOf(SEVERITY));
    }
    if (W.Structure?.putValues) {
      await check('Structure: values put', () => W.Structure.putValues(B, NOTES, [{ text: 'put by Structure' }]), async () => (await valueOf(NOTES))[0] === 'put by Structure' || await valueOf(NOTES));
      await check('Structure: no values, the property comes off', () => W.Structure.putValues(B, NOTES, []), async () => (await valueOf(NOTES)).length === 0 || await valueOf(NOTES));
    }
    // A property declared on a tag, then deleted from the tag: first through the writer, then through Apply as the map's
    // "Delete property from tag" makes it, so the step's own shape is checked too.
    const before = await declared(), notesId = await id(NOTES);
    if (W.Structure?.addClassProp) {
      await check('Structure: a property declared on a tag', () => W.Structure.addClassProp(tagUuid, notesId), async () => (await declared()).includes(NOTES) || await declared());
      await check('Structure: the property deleted from the tag', () => W.Structure.removeClassProp(tagUuid, notesId), async () => JSON.stringify(await declared()) === JSON.stringify(before) || await declared());
      if (window.Structure.apply?.apply && window.Structure.changes?.steps) {
        await W.Structure.addClassProp(tagUuid, notesId);
        await check('Structure: "Delete property from tag" through Apply', async () => {
          const S = window.Structure, M = S.model.build(await S.db.read());
          if (!M) throw new Error('the map\'s model could not be read');
          const tagId = (await q(`[:find ?t :where [?t :block/uuid #uuid "${tagUuid}"]]`))[0][0];
          const steps = S.changes.steps(M, { kind: 'dropProp', tag: tagId, prop: notesId });
          if (!steps.length) throw new Error('the change gave Apply no step to run');
          await S.apply.apply(steps);
        }, async () => JSON.stringify(await declared()) === JSON.stringify(before) || await declared());
        if (!(JSON.stringify(await declared()) === JSON.stringify(before))) await W.Structure.removeClassProp(tagUuid, notesId).catch(() => {});
      }
    }
    /* The one write path's own writes (10 November 2026), read back like the rest. A bullet shows a page by one write and keeps
       its words under it (fix 3: "show a page here" never empties the bullet); a page a change made goes by its id, and only
       while nothing links to it (fixes 4 and 5); a name alone is refused. */
    const D = window.PluginDoor?.write;
    if (D) {
      const linkOf = async () => (await q(`[:find ?l ?w :where [?b :block/uuid #uuid "${B}"] [?b :block/title ?w] [(get-else $ ?b :block/link 0) ?l]]`))[0];
      const target = (await q('[:find ?p :where [?p :block/name "dr. mei chen"]]'))[0]?.[0];
      if (target) {
        await check('the door: a bullet shows a page, its words kept in the graph', () => D.showPage(B, target), async () => { const [l, w] = await linkOf(); return (l === target && w === 'write check') || [l, w]; });
        await check('the door: the page taken off the bullet again, its words as they were', () => D.unshowPage(B), async () => { const [l, w] = await linkOf(); return (l === 0 && w === 'write check') || [l, w]; });
      }
      const NAME = 'ZZ write check made page';
      const live = async uuid => (await q(`[:find ?p :where [?p :block/uuid #uuid "${uuid}"] (not [?p :logseq.property/deleted-at _])]`)).length > 0;
      const made = await D.createPage(NAME, {}, { redirect: false, createFirstBlock: false }), M = String(made.uuid);
      await check('the door: a name alone deletes nothing', async () => { await D.deletePage(NAME).catch(() => {}); }, async () => await live(M) || 'the page went');
      await D.setWords(B, `write check [[${M}]]`);
      await check('the door: a made page something links to stays', async () => { await D.dropMade({ uuid: M, title: NAME }); }, async () => await live(M) || 'the page went');
      await D.setWords(B, 'write check');
      await check('the door: a made page nothing links to goes, by its id', async () => { await D.dropMade({ uuid: M, title: NAME }); }, async () => !(await live(M)) || 'the page is still there');
      await D.deleteForGood(M).catch(() => {});   // out of the Recycle too, so the graph ends as it began
    }
    await logseq.Editor.removeBlock(B);
    return out;
  }, SCRATCH);

  await sleep(800);
  let left = '';
  try { left = graphCheck('compare').trim(); } catch (error) { left = 'PROBLEM: the graph differs after the check\n' + String(error.stdout || error.message).trim(); }
  let failed = 0;
  for (const r of results) { if (!r.ok) failed++; console.log(`${r.ok ? '  ok  ' : 'FAIL  '}${r.name}${r.ok ? '' : ': ' + r.got}`); }
  console.log(left);
  console.log(`write-check: ${results.length - failed} of ${results.length} writes landed and were read back`);
  await browser.close().catch(() => {});
  process.exit(failed || /PROBLEM|differs/.test(left) ? 1 : 0);
})().catch(error => { console.error('write-check:', error.message); process.exit(1); });
