/* node test/load.js
   Loads the plugin's files in files.js's order against the pretend Logseq of test/graph.js, starts it, reads the pretend
   page through the adapter and writes it as Markdown and HTML. It cannot show the plugin works inside Logseq 2.0.2 (only
   running it there can); it shows every file parses, they find each other, and Logseq-shaped rows become the document. */
const assert = require('node:assert/strict');
const plain = x => JSON.parse(JSON.stringify(x));   // values made in the plugin's vm context are of another realm
const eq = (a, b, m) => assert.deepEqual(plain(a), plain(b), m);
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { logseq, U, shown, commands, menus } = require('./graph.js');
const { root, order } = require('../../test/module.js')('export');
const doc = { head: { appendChild() {} }, body: { appendChild() {}, append() {} }, createElement: () => ({ style: {}, setAttribute() {}, remove() {}, click() {}, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} }), getElementById: () => null, querySelector: () => null, addEventListener() {}, removeEventListener() {}, currentScript: null };
const window = { parent: { document: { defaultView: { getComputedStyle: () => ({ getPropertyValue: () => '' }) }, body: {}, querySelector: () => null } }, document: doc };
window.window = window;
const errors = [];
const quiet = { ...console, error: (...a) => { errors.push(a.map(String).join(' ')); console.error(...a); } };
const sandbox = { window, document: doc, logseq, console: quiet, setTimeout, clearTimeout, Promise, URL, Date, Map, Set, JSON, Math, Number, String, Array, Object, RegExp, encodeURI, fetch: async () => { throw new Error('no network'); }, Blob: class {}, FileReader: class {} };
vm.createContext(sandbox);
for (const file of order) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });

(async () => {
  await new Promise(r => setTimeout(r, 30));
  const E = window.DbExport;
  eq(errors, [], 'main() started without an error');
  assert.ok(E.inline && E.doc && E.markdown && E.html && E.themes && E.db && E.files && E.clipboard && E.print && E.ui && E.app, 'every part registered');
  eq(commands.sort(), ['db-export-blocks', 'db-export-md', 'db-export-page', 'db-export-pdf'], 'commands registered');
  assert.ok(menus.filter(m => m === 'Export as PDF or Markdown…').length === 2, 'menu items registered');
  console.log('  ok  every file loads in order and main() starts');

  await E.files.currentGraph();
  const page = await E.db.readPage(null);
  assert.equal(page.title, 'Dr. Mei Chen'); assert.equal(page.kind, 'page'); eq(page.tags, ['Doctor']);
  const props = Object.fromEntries(page.properties.map(p => [p.name, p.values.map(v => v.text)]));
  eq(props, { Specialty: ['Oncology'], Notes: ['Secretary Paula'], Site: ['https://northgate.example/chen'] }, 'a choice, a text value and a URL read as words');
  const [intro, appointments, code, papers, query, embed, ref, cites] = page.nodes.filter(n => n.kind !== 'value');
  assert.equal(page.nodes.length, 9, 'the value block is kept as a node (hidden)');
  assert.equal(intro.text, 'Consultant oncologist. Explains with **drawings**.');
  assert.ok(appointments.numbered, 'a numbered list');
  const spoke = appointments.children[0];
  assert.equal(spoke.text, 'Spoke with [[Dr. Mei Chen]] about [[Fatigue]] #[[Consultation]]', 'ids in the words become names');
  eq(spoke.tags, ['Consultation']);
  eq(spoke.properties.map(p => [p.name, p.type, p.values[0].text, p.values[0].day ?? null]), [['Date', 'date', 'Oct 23rd, 2026', 20261023], ['Provider', 'node', 'Dr. Mei Chen', null], ['Severity', 'number', '4', null]], 'dates first then by name; a number read from its value block');
  assert.equal(spoke.children.length, 1); assert.equal(spoke.children[0].kind, 'value', 'the number kept as a block is a value, not a child shown');
  const task = appointments.children[1];
  eq(task.task, { status: 'todo', priority: 'high', deadline: 1785542400000, scheduled: null }); eq(task.tags, [], 'Logseq’s own Task class is not a tag of yours');
  assert.equal(code.display, 'code'); assert.equal(code.lang, 'js');
  const pdf = papers.children[0];
  assert.equal(pdf.kind, 'file'); assert.equal(pdf.file.file, `assets/${U(207)}.pdf`);
  const [hl, area] = pdf.children;
  assert.equal(hl.kind, 'highlight'); eq(hl.highlight, { page: 2, pdf: 'Epidemiology of cholangiocarcinoma', area: null });
  assert.equal(area.highlight.area.file, `assets/${U(210)}.png`); assert.equal(area.children.length, 0, 'the area picture is the quotation, not a child');
  assert.equal(query.kind, 'query'); assert.equal(query.query.text, '(task todo)'); assert.equal(query.query.rows[0].text, 'Sort out the power of attorney'); assert.equal(query.query.rows[0].task.status, 'todo');
  assert.equal(embed.kind, 'embed'); assert.equal(embed.children[0].text, 'Tired most afternoons since the second cycle');
  assert.equal(ref.text, 'Consultant oncologist. Explains with **drawings**.', 'a block reference reads as the block’s words'); assert.equal(ref.heading, 2);
  assert.equal(cites.text, 'She pointed at “United States of America and Canada have observed an increase in iCCA” (Epidemiology of cholangiocarcinoma, p. 2)', 'a cited highlight reads as a quotation');
  console.log('  ok  a page with every kind of node reads into the document');

  const tagPage = await E.db.readPage('doctor');
  assert.equal(tagPage.title, 'Doctor'); eq(tagPage.tagged.map(n => n.text), ['Dr. Kim, radiologist', 'Dr. Mei Chen'], 'a block and a page carrying the tag, the tag itself not repeated'); assert.equal(tagPage.tagged[0].journalDay, 20261020); assert.equal(tagPage.tagged[1].properties[0].name, 'Notes');
  const blocks = await E.db.readBlocks([U(201), U(202)]);
  assert.equal(blocks.nodes.length, 1, 'a block inside a chosen block is not repeated');
  console.log('  ok  a tag page lists its nodes; chosen blocks do not repeat');

  const c = E.ui.read();
  const md = E.app.markdown(page, c);
  assert.ok(md.startsWith('# Dr. Mei Chen\n'), md.slice(0, 40));
  assert.ok(md.includes(`1. Spoke with Dr. Mei Chen about Fatigue #Consultation  \n   *Date: ${E.dates.fmt.day(20261023)} · Provider: Dr. Mei Chen · Severity: 4*`), 'a numbered item with its properties under it\n' + md);
  assert.ok(md.includes('2. [ ] Sort out the power of attorney  \n   *Deadline:'), 'a task in the numbered list');
  assert.ok(md.includes('```js\nconst x = 1;\n```'));
  assert.ok(md.includes(`[Epidemiology of cholangiocarcinoma](assets/${U(207)}.pdf)`));
  assert.ok(md.includes('> “United States of America and Canada have observed an increase in iCCA”\n  > — (Epidemiology of cholangiocarcinoma, p. 2)'), md);
  assert.ok(md.includes(`**Open to-dos**\n\n- [ ] Sort out the power of attorney  \n  *Deadline: ${E.dates.fmt.day(1785542400000)} · Priority: high*`), 'a query row with its task dates\n' + md);
  assert.ok(md.includes('Tired most afternoons'), 'the embed’s words are in');
  assert.ok(md.includes('## Consultant oncologist'), 'the heading from a block reference');
  const html = await E.app.pageHtml(page, c);
  assert.ok(html.includes('<title>Dr. Mei Chen</title>') && html.includes('@page { size: A4;') && html.includes('class="x-title"'));
  assert.ok(html.includes(`src="assets:///graphs/pretend/assets/${U(210)}.png"`), 'a picture loads from the graph’s assets folder');
  const rich = await E.app.richText(page, c);
  assert.ok(/<h1 style="[^"]*font-size/.test(rich.html) && !rich.html.includes('class="x-'), 'rich text carries its styles inline');
  assert.equal(rich.text, md);
  console.log('  ok  Markdown, the printed page and rich text come out of the pretend page');
  process.exit(0);
})().catch(error => { console.error('FAIL ', error); process.exit(1); });
