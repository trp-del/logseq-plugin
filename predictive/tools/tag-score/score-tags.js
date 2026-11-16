/* node tools/tag-score/score-tags.js <copy of db.sqlite> [--plain 400] [--set tagGap=2 ...] [--json out.json]
   How well each way of guessing a bullet's tag does on a graph's own tagged bullets, outside Logseq, on a copy of the graph.

   Each tagged bullet is replayed as if being written: its words one at a time, its own line left out of what the guesses
   learn from (leave-one-out). At each word every way says its tag or nothing. Counted per way:
   - at the end: right, wrong, silent; "shown right" = right / (right + wrong), the share of shown guesses that are right;
   - first shown: the first tag the way showed while the words came in, right or wrong, and after how many words;
   - flicker: bullets where the shown tag changed to another tag on the way; wrong on the way: bullets that showed a wrong tag at
     some point;
   - plain lines (no tag): how many would get a tag at the end (should be near none).
   Reads only the copy. Nothing in the plugin loads this file. */
const path = require('node:path');
const { readGraph, all } = require('./read-graph.js');
const core = n => require(path.join(__dirname, '../../core', n + '.js'));
const context = core('context'), engine = core('engine'), profileLib = core('profile'), propose = core('propose');
const ways = require('./ways.js');

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--') && /sqlite$/.test(a)) || '';
const arg = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const limits = {};
args.forEach((a, i) => { if (a === '--set') { const [k, v] = args[i + 1].split('='); limits[k] = v === 'true' ? true : v === 'false' ? false : Number(v); } });
const only = arg('ways', '').split(',').filter(Boolean);

// Tags made by tests in this dummy graph (ZZ…, Review…, probes) are not real writing: left out as classes and as test lines.
const JUNK = /^(\{\[|zz|review|blind test|test$|mergeable|to merge|sym$|doctr|d$|do$|pe$|per$|hosp$|entity$|uuid$|conversati$|consultationnext|specialty kind)/i;

function load(file) {
  const E = readGraph(file);
  const ents = [...E.values()];
  const title = e => typeof e['block/title'] === 'string' ? e['block/title'] : '';
  const isClass = e => typeof e['db/ident'] === 'string' && e['db/ident'].startsWith('user.class/');
  const realTags = ents.filter(e => isClass(e) && title(e) && !JUNK.test(title(e)) && !/\[\[|\]\]/.test(title(e)));
  const tagIds = new Set(realTags.map(t => t['db/id']));
  const deleted = e => e['logseq.property/deleted-at'] !== undefined;
  const lessons = ents.find(e => e['block/name'] === 'predictive lessons');
  const tagIdent = new Map(ents.filter(e => typeof e['db/ident'] === 'string').map(e => [e['db/id'], e['db/ident']]));
  const pages = ents.filter(e => e['block/name'] !== undefined && title(e) && !title(e).startsWith('$$$') && e['block/journal-day'] === undefined && !deleted(e)
      && !all(e['block/tags']).some(t => tagIdent.get(t) === 'logseq.class/Property'))
    .map(p => { const t = title(p), tags = all(p['block/tags']).map(id => ({ id, title: title(E.get(id) || {}), ident: tagIdent.get(id) })); return { id: p['db/id'], uuid: String(p['block/uuid'] || ''), title: t, lower: t.toLowerCase(), tags, isTag: tags.some(x => x.ident === 'logseq.class/Tag') || isClass(p), aliasOf: null }; });
  const bullets = ents.filter(e => e['block/page'] !== undefined && e['block/name'] === undefined && title(e).trim() && !deleted(e) && (!lessons || e['block/page'] !== lessons['db/id']));
  const lines = bullets.map(b => ({ id: b['db/id'], title: title(b), allTags: all(b['block/tags']), tags: all(b['block/tags']).filter(t => tagIds.has(t)),
    page: b['block/page'], parent: b['block/parent'], created: b['block/created-at'] || 0, order: b['block/order'] || '' }));
  // Tagged only with tags that are not real: left out, as the plugin leaves out tags that are not yours.
  const kept = lines.filter(l => l.tags.length || !l.allTags.length);
  return { E, pages, tagIds: [...tagIds], lines: kept, byId: new Map(kept.map(l => [l.id, l])) };
}

function contextOf(g) {
  const entries = g.lines.map(l => ({ id: l.id, title: l.title, tags: l.tags, values: new Map(), page: l.page }));
  const days = new Map([...g.E.values()].filter(e => e['block/journal-day'] !== undefined).map(e => [e['db/id'], e['block/journal-day']]));
  const ctx = context.buildContext({ schema: { props: [], parentsOf: new Map(), classProps: new Map(), byId: new Map() }, pages: g.pages, userTagIds: g.tagIds, entries, days, limits });
  ctx.graph = g;
  return ctx;
}

// Words one at a time: a link [[…]] counts as one word, as typed.
const steps = text => { const parts = String(text).match(/#?\[\[[^\]]*\]\]\S*|\S+/g) || []; return parts.map((_, i) => parts.slice(0, i + 1).join(' ')); };

function replay(ctx, line, wayList) {
  const out = {};
  const prefixes = steps(line.title);
  for (const way of wayList) {
    const seen = []; let first = null, firstAt = 0, last = null, changes = 0, wrongOnWay = false, gone = 0, prev = null;
    for (let i = 0; i < prefixes.length; i++) {
      const got = way.guess(ctx, line, prefixes[i], { at: i + 1, of: prefixes.length, last });
      const id = got ? got.id : null;
      if (id != null) {
        if (first == null) { first = id; firstAt = i + 1; }
        if (last != null && id !== last) changes++;
        if (!line.tags.includes(id)) wrongOnWay = true;
        last = id;
      } else if (way.sticky === false) last = null;
      if (prev != null && id == null) gone++;
      prev = id;
      seen.push(id);
    }
    const end = seen[seen.length - 1] ?? null;
    out[way.name] = { end, first, firstAt, changes, wrongOnWay, gone, words: prefixes.length };
  }
  return out;
}

function summary(rows, plainRows, wayList) {
  const out = {};
  for (const w of wayList) {
    const r = rows.map(x => ({ ...x.got[w.name], tags: x.line.tags }));
    const right = r.filter(x => x.end != null && x.tags.includes(x.end)).length, wrong = r.filter(x => x.end != null && !x.tags.includes(x.end)).length;
    const firstRight = r.filter(x => x.first != null && x.tags.includes(x.first));
    const firstWrong = r.filter(x => x.first != null && !x.tags.includes(x.first)).length;
    const wordsNeeded = firstRight.map(x => x.firstAt).sort((a, b) => a - b);
    out[w.name] = { right, wrong, silent: r.length - right - wrong, shownRight: pct(right, right + wrong), firstShownRight: pct(firstRight.length, firstRight.length + firstWrong),
      wordsMedian: wordsNeeded[Math.floor(wordsNeeded.length / 2)] ?? null, flicker: r.filter(x => x.changes > 0).length, vanished: r.filter(x => x.gone > 0).length, wrongOnWay: r.filter(x => x.wrongOnWay).length,
      plainTagged: `${plainRows.filter(x => x.got[w.name].end != null).length}/${plainRows.length}`, plainFlash: plainRows.filter(x => x.got[w.name].first != null).length };
  }
  return out;
}
const pct = (a, b) => b ? Math.round(100 * a / b) + '%' : '—';
// --corpus N: the made-up health graph of tools/harness/corpus.js (N notes learned from, --held notes in OTHER sentences asked
// about, as written on a journal day), instead of a graph's copy.
function corpusMain() {
  const t0 = Date.now(), N = Number(arg('corpus', 6000)), H = Number(arg('held', 2000));
  const made = require('../harness/corpus.js').make({ notes: N, plain: Math.round(N / 4), held: H, heldPlain: Math.round(H / 4), seed: Number(arg('seed', 7)), untagged: Number(arg('untagged', 0)) });
  const ctx = made.ctx; Object.assign(ctx.limits, limits);
  const days = ctx.days instanceof Map ? ctx.days : new Map(); if (!days.has(9902)) days.set(9902, 20261102); ctx.days = days;
  const wayList = ways.all(ctx).filter(w => !only.length || only.includes(w.name));
  const rows = made.held.map((h, i) => ({ line: { id: -1 - i, title: h.text, tags: [h.tag], page: 9902 } })).map(x => ({ ...x, got: replay(ctx, x.line, wayList) }));
  const plainRows = made.heldPlain.map((t, i) => ({ line: { id: -100000 - i, title: t, tags: [], page: 9902 } })).map(x => ({ ...x, got: replay(ctx, x.line, wayList) }));
  const report = { graph: `made-up graph, ${N} notes learned`, limits, sets: {}, plainAll: plainRows.length, plainShare: 0 };
  report.sets[`${rows.length} notes in other sentences (+${plainRows.length} plain)`] = summary(rows, plainRows, wayList);
  report.ms = Date.now() - t0;
  print(report);
}
function main() {
  if (args.includes('--corpus')) return corpusMain();
  const t0 = Date.now();
  const g = load(file);
  
  const ctx = contextOf(g);
  context.profileOf(ctx);
  const wayList = ways.all(ctx).filter(w => !only.length || only.includes(w.name));
  const sampleN = Number(arg('sample', 0)), sampled = list => sampleN && list.length > sampleN ? list.filter((_, i) => i % Math.ceil(list.length / sampleN) === 0) : list;
  const tagged = sampled(g.lines.filter(l => l.tags.length && steps(l.title).length >= 2));
  const plainAll = g.lines.filter(l => !l.tags.length && steps(l.title).length >= 4);
  const plain = plainAll.filter((_, i) => i % Math.max(1, Math.floor(plainAll.length / Number(arg('plain', 400)))) === 0);
  const rows = tagged.map(l => ({ line: l, got: replay(ctx, l, wayList) }));
  const plainRows = plain.map(l => ({ line: l, got: replay(ctx, l, wayList) }));
  const name = id => ctx.byId.get(id)?.title || String(id);
  // Fresh wording: lines with no near look-alike among the others (the nearest under FRESH), as a new line usually is.
  const FRESH = Number(arg('fresh', .5));
  const nearest = l => { const t = ways.tokensOf(ctx, l.title); return engine.neighbours(ctx.index, t, { k: 1, skip: new Set([l.id]) })[0]?.sim || 0; };
  const fresh = rows.filter(x => nearest(x.line) < FRESH);
  // Hand-written lines the graph has never seen (test/graph/held-out.json), for the Illness Test Graph only.
  const byName = new Map(ctx.pages.filter(p => p.isTag).map(p => [p.lower, p.id]));
  const held = /illness/i.test(file) ? require('../../test/graph/held-out.json').lines.map((h, i) => ({ id: -1 - i, title: h.text, tags: h.tag ? [byName.get(h.tag.toLowerCase())].filter(x => x != null) : [] })) : [];
  const heldRows = held.filter(l => l.tags.length).map(l => ({ line: l, got: replay(ctx, l, wayList) }));
  const heldPlain = held.filter(l => !l.tags.length).map(l => ({ line: l, got: replay(ctx, l, wayList) }));
  const report = { graph: path.basename(file), limits, sets: {}, plainAll: plainAll.length, plainShare: plainAll.length / (plainAll.length + tagged.length) };
  if (args.includes('--peek')) for (const w of wayList) { console.log('\nplain lines tagged by ' + w.name + ':'); for (const x of plainRows.filter(x => x.got[w.name].end != null).slice(0, 40)) console.log(`  ${name(x.got[w.name].end).padEnd(14)} ${x.line.title.slice(0, 110)}`); }
  report.sets[`all ${rows.length} tagged (look-alikes in the graph)`] = summary(rows, plainRows, wayList);
  report.sets[`fresh wording ${fresh.length} (no look-alike over ${FRESH})`] = summary(fresh, plainRows, wayList);
  if (heldRows.length) report.sets[`held-out ${heldRows.length} hand-written (+${heldPlain.length} plain)`] = summary(heldRows, heldPlain, wayList);
  // What each tag is mistaken for, by the combined way (the last listed), for reading misses.
  const lastWay = wayList[wayList.length - 1].name, confusion = new Map();
  for (const x of rows) { const e = x.got[lastWay].end; if (e != null && !x.line.tags.includes(e)) { const k = `${name(x.line.tags[0])} → ${name(e)}`; confusion.set(k, (confusion.get(k) || 0) + 1); } }
  report.mistakes = [...confusion].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const byTag = new Map();
  for (const l of tagged) byTag.set(name(l.tags[0]), (byTag.get(name(l.tags[0])) || 0) + 1);
  report.tags = [...byTag].sort((a, b) => b[1] - a[1]);
  report.ms = Date.now() - t0;
  if (arg('json')) require('node:fs').writeFileSync(arg('json'), JSON.stringify({ report, rows: rows.map(x => ({ id: x.line.id, tags: x.line.tags.map(name), title: x.line.title, got: Object.fromEntries(Object.entries(x.got).map(([k, v]) => [k, { ...v, end: v.end && name(v.end), first: v.first && name(v.first) }])) })) }, null, 1));
  print(report);
}
function print(r) {
  console.log(`${r.graph}, plain lines ${r.plainAll} (${Math.round(100 * r.plainShare)}% of lines), ${Math.round(r.ms / 1000)} s${Object.keys(r.limits).length ? ', ' + JSON.stringify(r.limits) : ''}`);
  const cols = ['right', 'wrong', 'silent', 'shownRight', 'firstShownRight', 'wordsMedian', 'flicker', 'vanished', 'wrongOnWay', 'plainTagged', 'plainFlash'];
  console.log(['way'.padEnd(22), ...cols.map(c => c.padStart(12))].join(''));
  for (const [set, ways] of Object.entries(r.sets)) {
    console.log('\n' + set);
    for (const [n, w] of Object.entries(ways)) console.log([n.slice(0, 22).padEnd(22), ...cols.map(c => String(w[c] ?? '—').padStart(12))].join(''));
  }
  if (r.mistakes) console.log('mistakes:', r.mistakes.map(([k, v]) => `${k} ${v}`).join('; '));
  if (r.tags) console.log('tags:', r.tags.map(([k, v]) => `${k} ${v}`).join(', '));
}
main();
