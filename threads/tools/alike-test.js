#!/usr/bin/env node
/* Checks the "looks like" engine (parts/alike.js) on a small pretend set of nodes: what it must find, what it must
   not, and how it votes. Then times it on a pretend graph of 20,000 nodes (building the index, and finding the
   neighbours of a line), since it runs on every key while a bullet is written.
   Needs node and jsdom:   npm install --no-save --no-package-lock jsdom
   Run from the repo root: node tools/alike-test.js   (tools/check.sh runs it when node and jsdom are there) */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const problems = [];
const problem = text => { problems.push(text); console.log('PROBLEM: ' + text); };
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', runScripts: 'outside-only' });
const { window } = dom;
window.parent = window;
window.logseq = { settings: {}, updateSettings() {}, onSettingsChanged: () => () => {}, App: {}, UI: {}, Editor: {}, DB: { onChanged: () => () => {} } };
window.eval(fs.readFileSync(path.join(root, 'parts/shared.js'), 'utf8'));
window.eval(fs.readFileSync(path.join(root, 'parts/alike.js'), 'utf8'));
const core = { provided: {}, provide: things => Object.assign(core.provided, things) };
window.refinementParts.find(p => p.name === 'alike').provide(core);
const { tokensOf, buildIndex, updateEntry, neighbours, vote, stem, limits } = core.provided.alike;
let cases = 0;
const same = (got, want, name) => { cases++; const a = JSON.stringify(got), b = JSON.stringify(want); if (a !== b) problem(`${name}: got ${a}, wanted ${b}`); };

// 1. Tokens: words stemmed and lower-case, short words and numbers out, links and tags as their own tokens.
same(tokensOf('Flagging again by teatime, flagged on day 2'), ['flagg', 'again', 'teatime', 'day'], 'tokens of a line');
same(tokensOf(new Set(['Tired', 'by', 'evening']), [7], [3]), ['tir', 'even', 'link:7', 'tag:3'], 'tokens from split words, a link and a tag');
same([stem('nodes'), stem('class'), stem('tingling'), stem('day'), stem('nausea')], ['node', 'class', 'tingl', 'day', 'nausea'], 'the stem');

// 2. A pretend set: symptom logs (tag 9) with their symptom (property s), and conversations (tag 12) with a topic (t).
const SYM = 'user.property/symptom-type', TOP = 'user.property/topic';
const node = (id, text, tags, values = {}, links = []) => ({ id, tokens: tokensOf(text, links, tags), values: new Map(Object.entries(values)) });
const entries = [
  node(1, 'Tired by evening.', [9], { [SYM]: [107] }),
  node(2, 'Wiped out all day.', [9], { [SYM]: [107] }),
  node(3, 'Flagging again by teatime.', [9], { [SYM]: [107] }),
  node(4, 'Dull ache on the right side this morning.', [9], { [SYM]: [110] }),
  node(5, 'The pain is easing.', [9], { [SYM]: [110] }),
  node(6, 'Nausea all evening.', [9], { [SYM]: [105] }, [105]),
  node(7, 'Zoë rang. Neutrophils too low, so cycle 4 moves.', [12], { [TOP]: [120] }, [201]),
  node(8, 'Zoë rang about the neutrophils again.', [12], { [TOP]: [120] }, [201]),
  node(9, 'Dr. Patel rang with the pathology.', [12], { [TOP]: [121] }, [202]),
];
const index = buildIndex(entries);
const near = (text, tags, links = [], options = {}) => neighbours(index, tokensOf(text, links, tags), options);
const ids = found => found.map(x => x.entry.id);

same(ids(near('Flagged by teatime again', [9])).slice(0, 1), [3], 'the same line, stemmed, is nearest');
same(near('Flagged by teatime again', [9])[0].sim > .9, true, 'and nearly identical');
same(ids(near('Tired all evening', [9]))[0], 1, 'the line sharing the rarest words is first');
same(ids(near('Dull pain this morning', [9])).slice(0, 2).sort(), [4, 5], 'the pain lines are nearest to a pain line');
same(ids(near('Something entirely new here', [9])).every(id => [1, 2, 3, 4, 5, 6].includes(id)), true, 'only the tag is shared: logs, not conversations');
same(near('Something entirely new here', [9])[0].sim < limits.nearLeast, true, 'but none near enough to speak');
same(ids(near('Zoë rang again', [12], [201])).slice(0, 2).sort(), [7, 8], 'a shared link and words find the calls with Zoë');
same(ids(near('Tired by evening.', [9], [], { skip: new Set([1]) }))[0] !== 1, true, 'the node itself is skipped');
same(ids(near('Tired by evening.', [9], [], { keep: e => e.values.has(TOP) })).every(id => id >= 7), true, 'keep narrows to the holders');
same(near('Tired by evening.', [9], [], { k: 2 }).length, 2, 'k limits the count');

// 3. Votes: the leading value among the holders, when near enough and clearly ahead.
same(vote(near('Flagging by teatime', [9]), SYM)?.ids, [107], 'the fatigue lines vote Fatigue');
same(vote(near('Flagging by teatime', [9]), TOP), null, 'no holder of the topic among them');
same(vote(near('Something entirely new here', [9]), SYM), null, 'too far: no vote');
same(vote(near('Nausea all evening', [9], [105]), SYM)?.ids, [105], 'a linked symptom finds its own line');
same(vote(near('Tired and wiped out, pain easing', [9]), SYM), null, 'split between fatigue and pain: nothing');
same(vote(near('Zoë rang about the neutrophils', [12], [201]), TOP)?.ids, [120], 'the calls with Zoë agree on the topic');
same(vote([], SYM), null, 'nothing near: nothing');

// 3b. Learning one node at once (0.4.267): a node just written counts for the next bullet without building the index again.
{
  const live = buildIndex(entries.map(e => ({ ...e, values: new Map(e.values) })));
  const nearLive = text => neighbours(live, tokensOf(text, [], [9]));
  same(vote(nearLive('Shivering and cold all night'), SYM), null, 'before: no line like it, no vote');
  updateEntry(live, node(20, 'Shivering and cold all night.', [9], { [SYM]: [130] }));
  same(vote(nearLive('Shivering and cold all night'), SYM)?.ids, [130], 'a node just written votes at once');
  updateEntry(live, node(20, 'Shivering and cold all night.', [9], { [SYM]: [131] }));
  same(vote(nearLive('Shivering and cold all night'), SYM)?.ids, [131], 'its value changed: the new one votes, once');
  same(nearLive('Shivering and cold all night').filter(x => x.entry.id === 20).length, 1, 'the node is there once, not twice');
  updateEntry(live, { id: 20, tokens: [], values: new Map() });
  same(vote(nearLive('Shivering and cold all night'), SYM), null, 'emptied (deleted, untagged): it no longer votes');
  updateEntry(live, { id: 21, tokens: [], values: new Map() });
  same(live.entries.length, entries.length + 1, 'a new node with nothing to learn from is not added');
  same(vote(nearLive('Flagging by teatime'), SYM)?.ids, [107], 'the other lines vote as before');
}

// 4. Timing on a pretend graph: 20,000 nodes of 8 words each from a 3,000-word vocabulary, 40 tags, 2,000 links.
const rnd = (() => { let s = 7; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; })();
const vocab = Array.from({ length: 3000 }, (_, i) => 'word' + i);
const big = [];
for (let i = 0; i < 20000; i++) {
  const words = Array.from({ length: 8 }, () => vocab[Math.floor(rnd() ** 2 * vocab.length)]);
  big.push({ id: i, tokens: tokensOf(words.join(' '), [1000 + Math.floor(rnd() * 2000)], [Math.floor(rnd() * 40)]), values: new Map([[SYM, [Math.floor(rnd() * 50)]]]) });
}
const time = (what, limit, run) => { const t = process.hrtime.bigint(); const out = run(); const ms = Number(process.hrtime.bigint() - t) / 1e6; console.log(`  ${what}: ${ms.toFixed(1)} ms`); if (ms > limit) problem(`${what} took ${ms.toFixed(0)} ms (limit ${limit})`); return out; };
console.log('timings on a pretend graph (20,000 nodes, 3,000 words, 40 tags):');
const bigIndex = time('building the index', 400, () => buildIndex(big));
const line = tokensOf('word3 word10 word25 word100 word7 word1 word400 word2', [1001], [3]);
time('finding the neighbours of a line (one key)', 15, () => neighbours(bigIndex, line));
time('finding them 20 times (a sentence typed)', 200, () => { for (let i = 0; i < 20; i++) neighbours(bigIndex, line); });
time('a vote', 5, () => vote(neighbours(bigIndex, line), SYM));

console.log(`alike-test: ${cases} checks`);
if (problems.length) { console.log(`alike-test: FAILED (${problems.length})`); process.exit(1); }
console.log('alike-test: OK');
