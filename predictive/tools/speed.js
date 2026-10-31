/* node tools/speed.js [lines]  -  how long the work costs on a large graph (default 20,000 lines). The per-key work must
   stay a few milliseconds, or typing stalls; the full reading happens in the background every few minutes. */
const { buildContext } = require('../core/context.js');
const { propose } = require('../core/propose.js');
const { suggestFor } = require('../core/link.js');
const synthetic = require('../test/synthetic.js');

const n = Number(process.argv[2]) || 20000;
const g = synthetic.work();
const entries = [];
let id = 5e6;
const source = g.entries.filter(e => e.tags.length);
for (let i = 0; i < n; i++) { const e = source[i % source.length]; entries.push({ id: id++, title: e.title + ' ' + (i % 997), tags: e.tags, values: e.values }); }
let t = performance.now();
const ctx = buildContext({ schema: g.schema, pages: g.pages, userTagIds: Object.values(g.tagPage).map(p => p.id), entries, days: new Map(), dated: new Map() });
console.log(`index of ${n} lines: ${Math.round(performance.now() - t)} ms`);
const b = { id: -1, uuid: '', text: 'Sync about the schema migration and index for the roadmap', tags: [g.tagPage.Meeting.id], values: new Map(), page: null, parent: null };
propose(ctx, b);   // the first call builds the name tables
t = performance.now();
for (let i = 0; i < 200; i++) propose(ctx, b);
console.log(`one proposal: ${((performance.now() - t) / 200).toFixed(2)} ms`);
t = performance.now();
for (let i = 0; i < 200; i++) suggestFor('Spoke with Ana', 14, g.pages, { min: 5 });
console.log(`one link suggestion over ${g.pages.length} pages: ${((performance.now() - t) / 200).toFixed(3)} ms`);
