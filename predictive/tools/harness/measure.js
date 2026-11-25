/* node tools/harness/measure.js [--held 600] [--notes 6000] [--plain 1500] [--untagged 0] [--seed 7] [--set nearLeast=.4 ...] [--json file]
   Measures Predictive on a large made-up graph (tools/harness/corpus.js: one fictional patient, about no one real), outside
   Logseq, with the plugin's own core. Nothing is written anywhere but the report. Until 24 November 2026 it also asked Apple's
   matcher and model through Predictive's helper; those went with the helper, and what is left is the rules.

   Each held-out note is asked about as if it were being written with its tag and no values (the properties), then with no tag,
   as the Alfred workflow's Add panel asks (which tag is it). Not here: dates.

   The report: what you would see (written at once, pencilled, nothing) against what a careful person filled in, by what the
   value went on and by how the note carries the value (a link, a name, a part of a name, other words, not in the words); the
   tag where one is asked for; plain notes that should get no tag.

   --set changes a limit for the run (ctx.limits: nearLeast, lead, tagNearLeast ...), to see what a setting does before it is
   changed in the plugin. */
const path = require('node:path'), fs = require('node:fs');
const core = n => require(path.join(__dirname, '../../core', n + '.js'));
const { propose } = core('propose'), lessons = core('lessons'), { fieldsOfTags, isChoiceProp, isBuiltInProp } = core('schema');
const corpus = require('./corpus.js');

const args = process.argv.slice(2), arg = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const limits = {};
args.forEach((a, i) => { if (a === '--set') { const [k, v] = args[i + 1].split('='); limits[k] = v === 'true' ? true : v === 'false' ? false : Number(v); } });

const blank = () => ({ right: 0, wrong: 0, silent: 0, spoke: 0 });
const pct = (n, of) => of ? Math.round(100 * n / of) + '%' : '–';
const sameSet = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
// Each property of the note's tag against what was written: right, wrong, silent (nothing shown for a value written), spoke
// (shown for one left empty), quiet (nothing shown, nothing written).
function judge(ctx, note, pieces) {
  const by = new Map(pieces.filter(p => p.kind !== 'tag').map(p => [p.ident, p])), out = [];
  for (const prop of fieldsOfTags(note.b.tags, ctx.schema)) {
    if (isChoiceProp(prop) || isBuiltInProp(prop) || prop.ident === 'block/tags') continue;
    const truth = note.truth.get(prop.ident), piece = by.get(prop.ident);
    const result = !piece ? (truth ? 'silent' : 'quiet') : !truth ? 'spoke'
      : truth.kind === 'number' ? (Number(piece.ids[0]) === Number(truth.number) ? 'right' : 'wrong') : sameSet(piece.ids, truth.ids) ? 'right' : 'wrong';
    out.push({ ident: prop.ident, title: prop.title, result, sure: !!piece && !piece.guess, source: piece ? lessons.sourceOf(piece) : null });
  }
  return out;
}

const made = corpus.make({ notes: Number(arg('notes', 6000)), held: Number(arg('held', 600)), plain: Number(arg('plain', 1500)), untagged: Number(arg('untagged', 0)), seed: Number(arg('seed', 7)) });
const { ctx } = made;
Object.assign(ctx.limits, limits);
const page = { id: 9902, uuid: '00000000-0000-4000-8000-000000009902', title: 'Nov 2', day: 20261102, tags: [] };

const seen = { sure: blank(), guess: blank(), silent: 0, empty: 0, bySource: new Map(), byHow: new Map(), byProp: new Map() };
const tags = { right: 0, wrong: 0, silent: 0, of: 0 }, plain = { tagged: 0, of: 0 };
const cell = (map, key) => { if (!map.has(key)) map.set(key, blank()); return map.get(key); };
let n = 0;
for (const note of made.held) {
  const b = { id: -(++n), uuid: '', text: note.text, tags: [note.tag], values: new Map(), page, parent: null };
  // The properties, the tag given.
  for (const r of judge(ctx, { b, truth: note.truth }, propose(ctx, b).pieces)) {
    if (r.result === 'quiet' || r.result === 'spoke') seen.empty++;
    if (r.result === 'quiet') continue;
    const how = note.how.get(r.ident) || 'left empty';
    cell(seen.byHow, how)[r.result]++; cell(seen.byProp, `${note.tagTitle} · ${r.title}`)[r.result]++;
    if (r.result === 'silent') { seen.silent++; continue; }
    seen[r.sure ? 'sure' : 'guess'][r.result]++;
    cell(seen.bySource, (r.sure ? 'written: ' : 'pencilled: ') + r.source)[r.result]++;
  }
  // The tag, the note bare, asked for.
  const tag = propose(ctx, { ...b, tags: [] }, null, { offerTag: true }).pieces.find(p => p.kind === 'tag')?.tag || null;
  tags.of++;
  if (!tag) tags.silent++; else tags[tag.id === note.tag ? 'right' : 'wrong']++;
}
// Plain notes: a tag offered for one is a wrong tag.
for (const text of made.heldPlain) {
  const bare = { id: -(++n), uuid: '', text, tags: [], values: new Map(), page, parent: null };
  plain.of++; if (propose(ctx, bare, null, { offerTag: true }).pieces.some(p => p.kind === 'tag')) plain.tagged++;
}

const row = (label, cells) => String(label).padEnd(40) + cells.map(c => String(c).padStart(12)).join('');
const rws = c => [c.right, c.wrong, c.silent, c.spoke];
const filled = seen.sure.right + seen.sure.wrong + seen.guess.right + seen.guess.wrong + seen.silent;
const shown = seen.sure.right + seen.sure.wrong + seen.guess.right + seen.guess.wrong, right = seen.sure.right + seen.guess.right;
const order = ['link', 'name', 'part', 'other', 'absent', 'number', 'left empty'];
const lines = [
  `Predictive on the made-up graph · ${ctx.index.entries.length} notes learned · ${made.held.length} held-out notes, ${made.heldPlain.length} plain${Object.keys(limits).length ? ' · set: ' + JSON.stringify(limits) : ''}`,
  '', `WHAT YOU WOULD SEE: of ${filled} properties a careful person filled in`,
  row('', ['right', 'wrong']),
  row('written when you leave the bullet', [seen.sure.right, seen.sure.wrong]),
  row('pencilled, a guess', [seen.guess.right, seen.guess.wrong]),
  row('nothing shown', [seen.silent]),
  row('right of all filled', [pct(right, filled)]),
  row('right of what was shown', [pct(right, shown)]),
  row(`of ${seen.empty} left empty, filled anyway`, [`${seen.sure.spoke + seen.guess.spoke} (written ${seen.sure.spoke}, pencilled ${seen.guess.spoke})`]),
  '', 'BY WHAT IT WENT ON', row('', ['right', 'wrong', '', 'empty filled']),
  ...[...seen.bySource].sort().map(([name, c]) => row(name, rws(c).map((v, i) => i === 2 ? '' : v))),
  '', 'BY HOW THE NOTE CARRIES THE VALUE', row('', ['right', 'wrong', 'silent', 'empty filled']),
  ...order.filter(h => seen.byHow.has(h)).map(h => row(h, rws(seen.byHow.get(h)))),
  '', 'BY PROPERTY', row('', ['right', 'wrong', 'silent', 'empty filled']),
  ...[...seen.byProp].sort().map(([name, c]) => row(name, rws(c))),
  '', `THE TAG OF A NOTE, WHERE ONE IS ASKED FOR (${tags.of} notes)`, row('', ['right', 'wrong']),
  row('offered', [tags.right, tags.wrong]), row('no tag offered', [tags.silent]),
  '', `PLAIN NOTES THAT SHOULD GET NO TAG (${plain.of})`, row('tagged anyway', [plain.tagged]),
];
console.log(lines.join('\n'));
const out = arg('json', '');
if (out) fs.writeFileSync(out, JSON.stringify({ seen: { ...seen, bySource: [...seen.bySource], byHow: [...seen.byHow], byProp: [...seen.byProp] }, tags, plain, limits }, null, 1));
