#!/usr/bin/env node
/* node linked-truth.js [out.json]   Goalpost line 5.2, in the checks' own Logseq (9333). Read-only.
   For every page something links to: the bullets Logseq itself holds as linking to the page (its :block/refs, the list behind
   Linked references), set beside what Linked reads for that page: its rows through properties, its mentions and, on a journal
   day, the tasks whose Deadline or Scheduled is that day. Names every bullet Logseq has and Linked lacks.
   Left out, as Logseq's own list leaves them out: the page's own bullets, deleted ones, links to a tag's or a property's page
   (those are uses, not mentions), and Logseq's hidden pages (favourites, views: names that start with $$$). */
const fs = require('node:fs');
const { connect, ours, finish, fail } = require('./kit');
(async () => {
  const { browser, frame, said } = await connect();
  const out = await frame().evaluate(async () => {
    const q = async s => (await logseq.DB.datascriptQuery(s)) || [];
    const T = window.Threads.core.provided;
    const refs = await q('[:find ?p ?pt ?bu ?bt ?bp :where [?b :block/refs ?p] [?p :block/name] [?p :block/title ?pt] [?b :block/uuid ?bu] [?b :block/page ?bp] [(get-else $ ?b :block/title "") ?bt] (not [?p :logseq.property/deleted-at]) (not [?b :logseq.property/deleted-at])]');
    const gone = new Set((await q('[:find ?p :where [?p :logseq.property/deleted-at]]')).map(r => r[0]));
    const kinds = new Set((await q('[:find ?p :where (or [?p :block/tags :logseq.class/Tag] [?p :block/tags :logseq.class/Property])]')).map(r => r[0]));
    const hidden = new Set((await q('[:find ?p ?n :where [?p :block/name ?n]]')).filter(r => String(r[1]).startsWith('$$$')).map(r => r[0]));
    const dayOf = new Map(await q('[:find ?p ?d :where [?p :block/journal-day ?d]]'));
    const by = new Map();
    for (const [p, pt, bu, bt, bp] of refs) { if (bp === p || gone.has(bp) || hidden.has(bp) || kinds.has(p)) continue; if (!by.has(p)) by.set(p, { title: pt, want: new Map() }); by.get(p).want.set(String(bu), String(bt).slice(0, 70)); }
    const pages = [];
    for (const [id, { title, want }] of by) {
      let have = new Set(), err = '';
      try { const li = await T.linksInto(id); for (const r of (li.records instanceof Map ? li.records.values() : li.records || [])) have.add(String(r.uuid)); } catch (e) { err += 'links: ' + e.message; }
      try { const me = await T.mentionsInto(id); for (const r of (me?.records || me?.nodes || me || [])) have.add(String(r.uuid ?? r)); } catch (e) { err += ' mentions: ' + e.message; }
      if (dayOf.has(id)) try { for (const r of await T.duesOn(dayOf.get(id))) have.add(String(r.uuid)); } catch (e) { err += ' dues: ' + e.message; }
      const missing = [...want].filter(([u]) => !have.has(u));
      pages.push({ title, logseq: want.size, linked: have.size, missing: missing.map(([u, t]) => ({ uuid: u, words: t })), err });
    }
    return pages;
  });
  const bad = out.filter(p => p.missing.length || p.err), bullets = bad.reduce((n, p) => n + p.missing.length, 0), wanted = out.reduce((n, p) => n + p.logseq, 0);
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ at: new Date().toISOString(), pages: out.length, bad }, null, 1));
  console.log(`${out.length} pages with links, ${wanted} linking bullets; ${bad.length} pages where Logseq holds a linking bullet that Linked does not read; ${bullets} such bullets`);
  for (const p of bad.sort((a, b) => b.missing.length - a.missing.length).slice(0, 14)) console.log(' ', p.title.slice(0, 34).padEnd(34), 'Logseq', String(p.logseq).padStart(3), 'Linked', String(p.linked).padStart(3), 'missing', p.missing.length, p.err, '|', p.missing.slice(0, 2).map(m => m.words).join(' ‖ ').slice(0, 110));
  const noise = ours(said); for (const s of noise.slice(0, 5)) console.log('console ' + s.type + ': ' + s.text.slice(0, 200));
  const ok = out.length > 20 && !bad.length && !noise.length;
  await finish(browser, { '5.2': { ok, said: ok ? `Linked reads every one of the ${wanted} bullets that Logseq holds as linking to ${out.length} pages` : `${bullets} bullet(s) on ${bad.length} page(s) link a page and Linked does not read them${bad[0] ? ': first, ' + bad[0].title : ''}` } });
})().catch(fail);
