/* node tools/graph/write-in-app.js [--trial] [--from YYYY-MM-DD] [--to YYYY-MM-DD]
   Writes test/graph/flesh-out.json (made by test/graph/flesh-out.py) into the Illness Test Graph, which must be the graph open in
   Logseq. It uses the plugin's own editor calls in the running app (the same ones the proposals write with), so a block lands on a
   journal day that already exists as readily as on a new one. Only adds: nothing is changed or deleted.

   Safe to run again: every block has a fixed uuid, and a block that is already there is skipped. Pages that exist are kept.
   --trial writes only the first three pages and two journal days, to see that it works.
   Needs the debugging port and Playwright (see tools/app/door.js). Refuses any graph but "Illness Test Graph". */
const fs = require('node:fs');
const path = require('node:path');
const { connect, sleep } = require('../app/door.js');

const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const trial = process.argv.includes('--trial'), from = arg('--from') || '0000', to = arg('--to') || '9999';
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../../test/graph/flesh-out.json'), 'utf8'));

// The seed's property slugs, for when a title in the graph has been renamed since.
const SLUG = { Notes: 'notes', Specialty: 'specialty', 'Works at': 'works-at', Definition: 'definition', Target: 'target', 'Therapy regimen': 'regimen', Findings: 'findings', Date: 'date',
  'Decided by': 'decided-by', Severity: 'severity', 'Symptom type': 'symptom-type', Provider: 'provider', Topic: 'topic', 'Spoke with': 'spoke-with', Status: 'status', Agent: 'agent', Cycle: 'cycle' };

// Properties the test graph has since been remodelled away from the seed's: Specialty became a link to a page ("Specialized in"),
// Definition and Findings were merged into Notes, Agent was renamed. Looked up in this order: the title, the seed's slug, these.
const ALT = { Specialty: ['Specialized in'], Definition: ['Notes'], Findings: ['Notes'], Agent: ['Agent used'], 'Side Effects': ['Side effects'] };

// Runs in the plugin's frame. Returns { done, skipped, warnings }.
async function writeIn([payload, SLUG, ALT]) {
  const F = window.Flow, db = F.db, ctx = await F.app.context();
  const out = { done: 0, skipped: 0, warnings: [], pages: 0 };
  const warn = text => { if (out.warnings.length < 40) out.warnings.push(text); };
  const tagUuid = title => ctx.pages.find(p => p.isTag && p.title === title)?.uuid;
  const user = p => p.ident.startsWith('user.property/');
  const prop = title => ctx.schema.props.find(p => user(p) && p.title === title) || ctx.schema.props.find(p => p.ident === 'user.property/' + SLUG[title])
    || (ALT[title] || []).map(t => ctx.schema.props.find(p => user(p) && p.title === t)).find(Boolean);
  const cache = new Map();
  const pageOf = async title => { if (!cache.has(title) || !cache.get(title)) cache.set(title, await logseq.Editor.getPage(title)); return cache.get(title); };
  const uuidOfId = async id => { const [[u] = []] = await db.dsQuery(`[:find ?u :where [(identity ${id}) ?p] [?p :block/uuid ?u]]`); return u && String(u); };

  async function setProps(uuid, props) {
    for (let [title, v] of Object.entries(props || {})) {
      const p = prop(title);
      if (!p) { warn(`no property "${title}"`); continue; }
      try {
        // A choice the graph now models as a link to a page (Specialty -> "Specialized in"): the choice's name is the page's.
        if (v && v.choice && p.type === 'node') v = { node: [v.choice] };
        if (v && v.node) {
          const ids = [];
          for (const t of v.node) { const pg = await pageOf(t); if (!pg) throw new Error(`no page "${t}"`); ids.push(pg.id); }
          await db.setValue(uuid, p.ident, p.many ? ids : ids[0], p.many ? { entityId: true, reset: true } : { entityId: true });
        } else if (v && v.day) await db.setValue(uuid, p.ident, await db.journalPageFor(Number(v.day.replaceAll('-', ''))));
        else if (v && v.choice) {
          const c = p.choices.find(c => c.title === v.choice);
          if (!c) throw new Error(`no choice "${v.choice}"`);
          await db.setValue(uuid, p.ident, c.id, { entityId: true });
        } else if (typeof v === 'number') await db.setValue(uuid, p.ident, v);
        else await db.setValue(uuid, p.ident, String(v));
      } catch (error) { warn(`${title}: ${error.message}`); }
    }
  }
  // At the end of a page, as Logseq's own Enter does: after the last top-level block, or as the first child of an empty page.
  async function append(pageUuid, text, uuid, sibling = null) {
    if (await logseq.Editor.getBlock(uuid)) { out.skipped++; return null; }
    const tree = await logseq.Editor.getPageBlocksTree(pageUuid), last = tree && tree[tree.length - 1];
    const blk = last ? await logseq.Editor.insertBlock(last.uuid, text, { sibling: true, focus: false, customUUID: uuid })
                     : await logseq.Editor.insertBlock(pageUuid, text, { sibling: false, focus: false, customUUID: uuid });
    if (blk && blk.uuid !== uuid) warn(`the uuid was not kept for "${text.slice(0, 30)}"`);
    out.done++;
    return blk;
  }
  for (const pg of payload.pages || []) {
    let page = await logseq.Editor.getPage(pg.title);
    if (!page) { page = await logseq.Editor.createPage(pg.title, {}, { redirect: false, createFirstBlock: false }); out.pages++; cache.set(pg.title, page); }
    if (!page) { warn(`could not make page "${pg.title}"`); continue; }
    if (pg.tag) { const t = tagUuid(pg.tag); if (t) await logseq.Editor.addBlockTag(page.uuid, t); else warn(`no tag "${pg.tag}"`); }
    await setProps(page.uuid, pg.props);
    for (const b of pg.blocks) await append(page.uuid, b.text, b.uuid);
  }
  for (const [day, blocks] of Object.entries(payload.journals || {})) {
    const id = await db.journalPageFor(Number(day.replaceAll('-', '')));
    const pageUuid = id && await uuidOfId(id);
    if (!pageUuid) { warn(`no journal page for ${day}`); continue; }
    for (const b of blocks) {
      const blk = await append(pageUuid, b.text, b.uuid);
      if (!blk) continue;
      if (b.tag) { const t = tagUuid(b.tag); if (t) await logseq.Editor.addBlockTag(b.uuid, t); else warn(`no tag "${b.tag}"`); }
      await setProps(b.uuid, b.props);
      for (const k of b.kids) await logseq.Editor.insertBlock(b.uuid, k.text, { sibling: false, focus: false, customUUID: k.uuid }).then(() => out.done++);
    }
  }
  return out;
}

(async () => {
  const c = await connect();
  try {
    if (c.graph !== 'Illness Test Graph') throw new Error(`the open graph is "${c.graph}"; open the Illness Test Graph first. Nothing was written.`);
    const days = Object.keys(data.journals).filter(d => d >= from && d <= to);
    const pages = trial ? data.pages.slice(0, 3) : (from === '0000' ? data.pages : []);
    const chosen = trial ? days.slice(0, 2) : days;
    console.log(`writing ${pages.length} pages and ${chosen.length} journal days into "${c.graph}"${trial ? ' (trial)' : ''}`);
    const total = { done: 0, skipped: 0, pages: 0, warnings: [] };
    const add = r => { total.done += r.done; total.skipped += r.skipped; total.pages += r.pages; total.warnings.push(...r.warnings); };
    add(await c.frame().evaluate(writeIn, [{ pages }, SLUG, ALT]).catch(e => { throw e; }));
    for (let i = 0; i < chosen.length; i += 8) {
      const slice = chosen.slice(i, i + 8);
      add(await c.frame().evaluate(writeIn, [{ journals: Object.fromEntries(slice.map(d => [d, data.journals[d]])) }, SLUG, ALT]));
      process.stdout.write(`\r${Math.min(i + 8, chosen.length)}/${chosen.length} days, ${total.done} blocks`);
    }
    console.log(`\nadded ${total.done} blocks and ${total.pages} pages; skipped ${total.skipped} already there`);
    if (total.warnings.length) console.log('warnings:\n  ' + [...new Set(total.warnings)].slice(0, 25).join('\n  '));
  } finally { await c.close(); }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
