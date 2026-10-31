#!/usr/bin/env node
/* Proves a test round left the Illness Test Graph as it found it.
     node tools/graph-check.js save      before the round: writes a fingerprint of the graph
     node tools/graph-check.js compare   after it: names every page or block that differs, or says it matches
   Reads the graph through Logseq's command line (~/.local/bin/logseq), which works while the app has it open.
   The fingerprint is every fact about every page and block, with links written as the uuid of what they point to
   (an undo can give a block a new number but keeps its uuid), leaving out the times Logseq stamps on a save.
   The fingerprint is kept in check.log/ (ignored by git). Exits non-zero when the graph differs.
   One kind of difference is Logseq's own and named apart, not failed (2026-10-23, docs/PROCESS.md's lessons): the first
   time a page is opened Logseq saves view blocks on it ("Linked references", "Unlinked references", "All"), each
   marked with logseq.property.view/feature-type and view-for. Only such a block newly added counts so; one changed or
   gone, or any other block, fails as before. Likewise Logseq's Recycle bookkeeping: a page in the Recycle before and
   after whose only changes are when it went there and its place (logseq.property/deleted-at, block/order), as when
   it is brought back and put back again (Turn into links and its Undo). */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const GRAPH = process.env.GRAPH || 'Illness Test Graph';
const CLI = path.join(os.homedir(), '.local/bin/logseq');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'check.log', 'graph-fingerprint.json');
const SKIP = new Set(['block/created-at', 'block/updated-at', 'block/tx-id']);
// Number-valued facts that are not links.
const NUMBERS = new Set(['block/journal-day', 'logseq.property/scheduled', 'logseq.property/deadline', 'logseq.property.asset/size']);

const ask = query => {
  const out = JSON.parse(execFileSync(CLI, ['query', '-g', GRAPH, '-o', 'json', '--timeout-ms', '60000', '--query', query], { encoding: 'utf8', maxBuffer: 1 << 28 }));
  if (out.status !== 'ok') throw new Error('the command line said: ' + JSON.stringify(out).slice(0, 300));
  return out.data.result;
};

function fingerprint() {
  const facts = ask('[:find ?e ?a ?v :where [?e :block/uuid] [?e ?a ?v]]');
  const uuid = new Map(facts.filter(([, a]) => a === 'block/uuid').map(([e, , v]) => [e, v]));
  const nodes = {};
  for (const [e, a, v] of facts) {
    if (SKIP.has(a)) continue;
    const value = typeof v === 'number' && !NUMBERS.has(a) && uuid.has(v) ? '→' + uuid.get(v) : JSON.stringify(v);
    (nodes[uuid.get(e)] ||= []).push(`${a} ${value}`);
  }
  for (const id in nodes) nodes[id].sort();
  return nodes;
}

const label = facts => {
  const title = facts?.find(f => f.startsWith('block/title '));
  return title ? JSON.parse(title.slice('block/title '.length)).slice(0, 60) : '(no title)';
};

const mode = process.argv[2];
if (!fs.existsSync(CLI)) { console.log('graph check skipped (no Logseq command line at ' + CLI + ')'); process.exit(0); }
if (mode === 'save') {
  const nodes = fingerprint();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ graph: GRAPH, at: new Date().toISOString(), nodes }));
  console.log(`graph check: fingerprint saved (${Object.keys(nodes).length} pages and blocks in "${GRAPH}")`);
} else if (mode === 'compare') {
  if (!fs.existsSync(file)) { console.log('PROBLEM: no saved fingerprint; run "node tools/graph-check.js save" before the round'); process.exit(1); }
  const before = JSON.parse(fs.readFileSync(file, 'utf8')).nodes, after = fingerprint();
  const lines = [], views = [], kept = [];
  for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[id], b = after[id];
    if (!a && b.some(f => f.startsWith('logseq.property.view/feature-type ')) && b.some(f => f.startsWith('logseq.property/view-for '))) { views.push(label(b)); continue; }
    if (!a) { lines.push(`added: "${label(b)}" (${id})`); continue; }
    if (!b) { lines.push(`gone: "${label(a)}" (${id})`); continue; }
    const was = new Set(a), now = new Set(b);
    const lost = a.filter(f => !now.has(f)), got = b.filter(f => !was.has(f));
    const recycled = facts => facts.some(f => f.startsWith('logseq.property/deleted-at '));
    if (recycled(a) && recycled(b) && [...lost, ...got].every(f => /^(logseq\.property\/deleted-at|block\/order) /.test(f))) { kept.push(label(b)); continue; }
    if (lost.length || got.length) lines.push(`changed: "${label(b)}" (${id})\n    was: ${lost.join('; ') || '-'}\n    now: ${got.join('; ') || '-'}`);
  }
  const keptNote = kept.length ? ` (and ${kept.length} page${kept.length > 1 ? 's' : ''} in Logseq's Recycle put back there again: ${kept.join(', ')})` : '';
  const viewNote = (keptNote ? keptNote : '') + (views.length ? ` (and ${views.length} view block${views.length > 1 ? 's' : ''} Logseq saved on first opening a page: ${[...new Set(views)].join(', ')})` : '');
  if (!lines.length) { console.log(`graph check: OK, "${GRAPH}" is as it was (${Object.keys(after).length - views.length} pages and blocks)${viewNote}`); process.exit(0); }
  for (const line of lines) console.log('PROBLEM: ' + line);
  console.log(`graph check: FAILED, ${lines.length} differ`);
  process.exit(1);
} else {
  console.log('usage: node tools/graph-check.js save | compare');
  process.exit(2);
}
