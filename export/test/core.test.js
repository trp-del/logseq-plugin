/* node test/core.test.js
   The pure core on the hand-made document of test/sample.js: the words' markup, the Markdown of every layout, the HTML
   and the looks. British dates (locale en-GB) so the expected words are fixed. */
const assert = require('node:assert/strict');
const E = require('./run-core.js');
const { inline, markdown, html, themes, doc: D, dates } = E;
const doc = E.sample();
const L = 'en-GB';
const plain = x => JSON.parse(JSON.stringify(x));

// The words' markup.
const t = inline.parse('Saw **Dr. [[Mei Chen]]** about `x` and [the paper](https://a.b/c?d=1), #[[Consultation]] 2*3*4 _soft_ $E=mc^2$ [the oncologist]([[Dr. Mei Chen]]) see https://x.org/a. done');
assert.equal(inline.toHtml(t), 'Saw <strong>Dr. Mei Chen</strong> about <code class="x-code">x</code> and <a class="x-a" href="https://a.b/c?d=1">the paper</a>, <span class="x-tag">Consultation</span> 2*3*4 <em>soft</em> <span class="x-math">E=mc^2</span> the oncologist see <a class="x-a" href="https://x.org/a">https://x.org/a</a>. done');
assert.equal(inline.toMarkdown(t, { links: 'wiki' }), 'Saw **Dr. [[Mei Chen]]** about `x` and [the paper](https://a.b/c?d=1), #Consultation 2\\*3\\*4 *soft* $E=mc^2$ [[Dr. Mei Chen|the oncologist]] see <https://x.org/a>. done');
assert.equal(inline.toMarkdown(t, { links: 'file', tags: false }), 'Saw **Dr. [Mei Chen](Mei%20Chen.md)** about `x` and [the paper](https://a.b/c?d=1),  2\\*3\\*4 *soft* $E=mc^2$ [the oncologist](Dr.%20Mei%20Chen.md) see <https://x.org/a>. done');
assert.equal(inline.toPlain(t), 'Saw Dr. Mei Chen about x and the paper (https://a.b/c?d=1), #Consultation 2*3*4 soft E=mc^2 the oncologist see https://x.org/a. done');
assert.equal(inline.words('**a** [[b]] #[[c]]\nd'), 'a b #c d');
assert.equal(inline.toHtml(inline.parse('a <b> & "c"')), 'a &lt;b&gt; &amp; &quot;c&quot;', 'HTML is escaped');
assert.equal(inline.toMarkdown(inline.parse('1. not a list [x] *y*')), '1\\. not a list \\[x\\] *y*', 'a line that would read as a list is escaped');
console.log('  ok  the words’ markup reads and writes');

// Dates.
assert.equal(dates.fmt.day(20261023, L), '23 Oct 2026'); assert.equal(dates.fmt.month(20261023, L), 'October 2026'); assert.equal(dates.fmt.iso(20261023), '2026-10-23');
assert.equal(dates.fmt.span(20260909, 20260912, L), '9 – 12 Sept'); assert.equal(dates.fmt.span(20260928, 20261002, L), '28 Sept – 2 Oct');
assert.equal(dates.fmt.time(new Date(2026, 9, 23, 14, 30).getTime(), L), '14:30'); assert.equal(dates.fmt.time(new Date(2026, 9, 23).getTime(), L), '');
console.log('  ok  dates');

// The document's helpers.
assert.deepEqual(plain(D.propertiesIn(doc).map(p => p.name)), ['Date', 'Deadline', 'End', 'Hospital', 'Phone', 'Provider', 'Severity', 'Specialty', 'Topic', 'Works at']);
assert.deepEqual(plain(D.dateChoices(doc).map(d => d.key)), ['user.property/date', 'user.property/deadline', 'user.property/end', 'deadline', 'scheduled', 'journal']);
assert.deepEqual(plain(D.autoKeys(doc)), ['user.property/date', 'user.property/deadline', 'deadline', 'scheduled', 'journal', 'user.property/end'], 'End comes last: it closes a stay');
const es = D.entries(doc, {});
assert.deepEqual(plain(es.filter(e => e.when != null).map(e => [inline.words(e.node.text).slice(0, 12), e.when, e.end?.when ?? null])),
  [['Sort out pow', new Date(2026, 6, 31).getTime(), null], ['Pack the hos', 20260908, null], ['Stay at Nort', 20260909, 20260912], ['Chest X-ray ', 20261023, null], ['Spoke with D', 20261029, null], ['Book the pat', 20261105, null]], 'the own Date properties come before the task dates');
assert.ok(es.filter(e => e.when == null).every(e => e.node.kind !== 'embed'), 'an embed passes through to what it holds');
console.log('  ok  properties, dates and the dated entries of a document');

// Markdown.
const md = markdown.toMarkdown(doc, { layout: 'document', locale: L, titleBlock: { date: 20261029, preparedBy: 'Ruth' } });
for (const piece of ['# Dr. Mei Chen\n29 October 2026 · Prepared by Ruth\n\nSpecialty: Oncology  \nWorks at: Northgate Cancer Center  \nPhone: 020 7946 0880  \n#Doctor  \n\n',
  '## Appointments\n\nSpoke with Dr. Mei Chen about fatigue #Consultation  \n*Provider: Dr. Mei Chen · Date: 29 Oct 2026 · Topic: Fatigue*\n\n- She suggested *shorter walks* and a blood test, see <https://example.org/bloods>.\n- Ask about the ==iron== levels next time\n\nChest X-ray results',
  '## Things to do\n\n- [ ] Sort out power of attorney with Ruth  \n  *Deadline: 31 Jul 2026 · Priority: high*\n- [x] Pack the hospital bag  \n  *Scheduled: 8 Sept 2026*\n- [x] ~~Ring the pharmacy~~\n\n## Steps for the morning\n\n1. Tablets with water\n2. Breakfast, then a walk\n   - Twenty minutes is enough\n\n```js\nconst dose = (weight) => weight * 85; // mg/m²\nconsole.log(dose(70));\n```\n\n> Hope is not a plan',
  '- > “In this study, 34% of patients with liver-involved pCUP, fulﬁlled the radiological criteria for an iCCA diagnosis”\n  > — (Intrahepatic cholangiocarcinoma hidden within cancer of unknown primary, p. 1)\n- ![Intrahepatic cholangiocarcinoma hidden within cancer of unknown primary, p. 1](assets/6adbf876-d939-4be9-89cc-92032d55b1c5.png)  \n  (Intrahepatic',
  '**Open to-dos**\n\n| Name | Tags | Deadline |\n| --- | --- | --- |\n| Book the patient transport |  | 5 Nov 2026 |\n| Ask about the second opinion |  |  |\n\nNorthgate Cancer Center, ward 4B, visiting 2–8 pm\n\n## Formula\n\n$$\nE = mc^2\n$$\n']) assert.ok(md.includes(piece), 'document Markdown holds:\n' + piece + '\n--- in ---\n' + md);
assert.ok(!md.includes('u11') && !/\n\n\n/.test(md), 'no hidden value, no triple blank');
const noBoxes = markdown.toMarkdown(doc, { layout: 'document', locale: L, tasks: false });
assert.ok(noBoxes.includes('Sort out power of attorney with Ruth #Task\n') && noBoxes.includes('| Book the patient transport | Task | 5 Nov 2026 |') && !noBoxes.includes('[ ]'), 'with no task boxes the tag Task stays, the only sign\n' + noBoxes);
const outline = markdown.toMarkdown(doc, { layout: 'outline', links: 'wiki', frontMatter: true, locale: L, tasks: false, tags: false });
assert.ok(outline.startsWith('---\ntitle: Dr. Mei Chen\ntags: [Doctor]\nspecialty: Oncology\nworks-at: Northgate Cancer Center\nphone: "020 7946 0880"\n---\n\n# Dr. Mei Chen\n\n- Consultant'), outline.slice(0, 200));
assert.ok(outline.includes('  - Spoke with [[Dr. Mei Chen]] about fatigue  \n    *Provider: Dr. Mei Chen · Date: 29 Oct 2026 · Topic: Fatigue*\n    - She suggested'), outline);
assert.ok(outline.includes('  - Ring the pharmacy\n') && !outline.includes('[x]'), 'no task boxes, no tags when they are off');
assert.ok(outline.includes('  1. Tablets with water\n  2. Breakfast, then a walk\n     - Twenty minutes is enough\n- ```js'), outline);
const timeline = markdown.toMarkdown(doc, { layout: 'timeline', locale: L, under: 'user.property/hospital' });
assert.ok(timeline.includes('## September 2026\n\n**Tue 8 Sept**  \n- [x] Pack the hospital bag  \n  *Scheduled: 8 Sept 2026*\n\n**Wed 9 – 12 Sept** · Northgate Cancer Center  \nStay at Northgate Cancer Center #Hospitalization\n\n## October 2026'), timeline);
assert.ok(timeline.includes('## No date\n\nConsultant medical oncologist'), 'undated entries after the dated, without a date line\n' + timeline);
const calendar = markdown.toMarkdown(doc, { layout: 'calendar', locale: L, newestFirst: true });
assert.ok(calendar.includes('## November 2026\n\n**Thu 5 Nov**\n\n- [ ] Book the patient transport  \n  *Deadline: 5 Nov 2026 · Priority: medium*\n\n## October 2026\n\n**Thu 29 Oct**\n\n- Spoke with Dr. Mei Chen about fatigue #Consultation  \n  *Provider: Dr. Mei Chen · Topic: Fatigue*\n  - She suggested'), calendar);
console.log('  ok  Markdown in every layout');

// HTML and the looks.
const h = html.toHtml(doc, { layout: 'document', locale: L, titleBlock: { date: 20261029 } });
for (const piece of ['<h1 class="x-title">Dr. Mei Chen</h1>', '<p class="x-props">Specialty: Oncology<br>Works at: Northgate Cancer Center<br>Phone: 020 7946 0880<br><span class="x-tag">Doctor</span></p>',
  '<h2 class="x-h2">Appointments</h2>', '<p class="x-p">Spoke with Dr. Mei Chen about fatigue <span class="x-tag">Consultation</span><br><span class="x-meta">Provider: Dr. Mei Chen · Date: 29 Oct 2026 · Topic: Fatigue</span></p>',
  '<p class="x-p"><span class="x-task">☐</span> Sort out power of attorney with Ruth', '<span class="x-task x-done">☑</span> <s>Ring the pharmacy</s>', '<ol class="x-ol">', '<pre class="x-pre"><code>const dose',
  '<blockquote class="x-quote">In this study, 34%', '<cite class="x-cite">Intrahepatic cholangiocarcinoma hidden within cancer of unknown primary, p. 1</cite>', '<li class="x-li x-pic"><figure class="x-figure"><img class="x-img" src="assets/6adbf876',
  '<table class="x-table"><thead><tr><th class="x-th">Name</th><th class="x-th">Tags</th><th class="x-th">Deadline</th></tr></thead><tbody><tr><td class="x-td x-name"><span class="x-task">☐</span> Book the patient transport</td><td class="x-td"></td><td class="x-td">5 Nov 2026</td></tr>']) assert.ok(h.includes(piece), 'HTML holds ' + piece + '\n' + h);
assert.ok(!h.includes('x-value') && !h.includes('>4<'), 'the hidden value block is not drawn');
assert.ok(!h.includes('<span class="x-tag">Task</span>'), 'with task boxes drawn, no row says Task after its words');
assert.ok(html.toHtml(doc, { layout: 'document', locale: L, tasks: false }).includes('Sort out power of attorney with Ruth <span class="x-tag">Task</span>'), 'with no task boxes the tag Task stays');
const cal = html.toHtml(doc, { layout: 'calendar', locale: L });
assert.ok(cal.includes('<h2 class="x-month">September 2026</h2>\n<table class="x-cal"><tbody>\n<tr class="x-calrow"><td class="x-calday"><span class="x-weekday">Tue</span><span class="x-date">8 Sept</span></td><td class="x-calitems">'), cal);
for (const look of themes.looks) {
  const css = themes.stylesheet(look.key, { paper: 'Letter', margins: 'narrow', size: 'large', footer: 'Private "notes"', pageNumbers: true, customCss: '.x-p { color: red }' });
  assert.ok(css.includes('@page { size: Letter; margin: 14mm 15mm 16mm; @bottom-left { content: "Private \\"notes\\"";') && css.includes('counter(page) " / " counter(pages)') && css.includes('.x-title {') && css.endsWith('.x-p { color: red }'), look.key);
  const { cls, root } = themes.inliner(look.key, {});
  assert.ok(cls('title').startsWith(' style="margin:0 0 ') && cls('task done').includes('color:') && cls('nothing') === '' && root.includes('font-family:'), look.key + ' inline');
}
const inlined = html.toHtml(doc, { layout: 'outline', locale: L, cls: themes.inliner('plain', {}).cls });
assert.ok(!inlined.includes('class="') && inlined.includes('<li style="margin:0 0 '), 'inline styles for the clipboard');
{   // the head's properties (the page's, or the chosen blocks') and the nodes' are chosen apart
  assert.deepEqual(plain(D.propertiesIn(doc, 'head').map(p => p.name)), ['Phone', 'Specialty', 'Works at']);
  assert.deepEqual(plain(D.propertiesIn(doc, 'nodes').map(p => p.name)), ['Date', 'Deadline', 'End', 'Hospital', 'Provider', 'Severity', 'Topic']);
  const none = new Set(), only = new Set(['user.property/provider']);
  const page = html.toHtml(doc, { locale: L });
  assert.ok(page.includes('Specialty: Oncology') && page.includes('Provider: Dr. Mei Chen') && page.includes('Topic: Fatigue'));
  const noHead = html.toHtml(doc, { locale: L, shownHead: none }), someNodes = html.toHtml(doc, { locale: L, shownNodes: only });
  assert.ok(!noHead.includes('Specialty: Oncology') && noHead.includes('Provider: Dr. Mei Chen'), 'page properties off');
  assert.ok(someNodes.includes('Specialty: Oncology') && someNodes.includes('Provider: Dr. Mei Chen') && !someNodes.includes('Topic: Fatigue'), 'one node property chosen');
  const mdNoHead = markdown.toMarkdown(doc, { locale: L, shownHead: none, frontMatter: true });
  assert.ok(!mdNoHead.includes('Specialty') && mdNoHead.includes('Provider: Dr. Mei Chen'), 'no page properties in front matter');
  const blocks = D.document({ kind: 'blocks', nodes: doc.nodes[1].children });   // the appointments: their own properties are the head's
  assert.deepEqual(plain(D.propertiesIn(blocks, 'head').map(p => p.name)), ['Date', 'End', 'Hospital', 'Provider', 'Severity', 'Topic']);
  assert.ok(!html.toHtml(blocks, { locale: L, shownHead: none }).includes('Provider: Dr. Mei Chen'), 'the chosen blocks’ properties off');
  const parent = D.document({ kind: 'blocks', nodes: [doc.nodes[1]] });   // one block with the appointments under it: theirs are the nodes’
  assert.ok(html.toHtml(parent, { locale: L, shownHead: none }).includes('Provider: Dr. Mei Chen') && !html.toHtml(parent, { locale: L, shownNodes: none }).includes('Provider: Dr. Mei Chen'));
  console.log('  ok  the head’s and the nodes’ properties are chosen apart');
}
for (const look of themes.looks) {   // a variable font (the system font) prints as outlines, not text: no look may name one
  assert.doesNotMatch(themes.stylesheet(look.key, {}), themes.VARIABLE_FONTS, `${look.name} names a variable font`);
  assert.doesNotMatch(themes.inliner(look.key, {}).root, themes.VARIABLE_FONTS, `${look.name} names a variable font inline`);
}
console.log('  ok  HTML, the looks’ stylesheets and their inline form');

// Prose: # headings as sections, bullets as paragraphs, citations as numbered notes; the other styles keep a citation as written.
{
  const N = D.node;
  const page = D.document({ title: 'Fatigue', kind: 'page', nodes: [
    N({ text: 'Summary', heading: 1, children: [
      N({ text: 'Worse after the second cycle ([[Consultation, 2 Oct]]). Ferritin was low ([[Blood panel]], p. 3).' }),
      N({ text: 'Common in this setting ([ESMO](https://example.org/esmo)), walks advised (*Ward leaflet*, p. 2)' }) ] }),
    N({ text: 'Findings', heading: 1, children: [
      N({ text: 'Blood', heading: 3, children: [N({ text: 'Haemoglobin 104, down from 121 ([[Blood panel]], p. 3)', children: [N({ text: 'Repeat in four weeks' }), N({ text: 'Ask about iron?' })] })] }),
      N({ text: 'Steps', numbered: true, children: [N({ text: 'One' }), N({ text: 'Two' })] }),
      N({ text: 'Ring the ward', task: { status: 'todo', priority: '', deadline: null, scheduled: null }, tags: ['Task'] }) ] }),
  ] });
  const cited = inline.parse('a ([[B]], p. 3) (*w*) ([t](https://x.y)) (plain)').filter(tok => tok.t === 'cite');
  assert.deepEqual(plain(cited.map(tok => [tok.id, tok.page])), [['b', '3'], ['words:w', ''], ['https://x.y', '']], 'the three citations /Cite writes are read; plain brackets are not one');
  assert.ok(html.toHtml(page, { layout: 'document' }).includes('(Blood panel, p. 3)') && markdown.toMarkdown(page, { layout: 'outline' }).includes('(*Ward leaflet*, p. 2)'), 'outside Prose a citation stays as written');
  const h = html.toHtml(page, { layout: 'prose' });
  for (const piece of ['<h2 class="x-h2"><span class="x-num">1</span>Summary</h2>', '<h3 class="x-h3"><span class="x-num">2.1</span>Blood</h3>',
    'second cycle.<sup class="x-ref">1</sup> Ferritin was low.<sup class="x-ref">2</sup></p>', 'this setting,<sup class="x-ref">3</sup> walks advised<sup class="x-ref">4</sup></p>',
    '<p class="x-p">Haemoglobin 104, down from 121.<sup class="x-ref">2</sup> Repeat in four weeks. Ask about iron?</p>',
    '<p class="x-p">Steps</p>\n<ol class="x-ol">', '<span class="x-task">☐</span> Ring the ward',
    '<p class="x-toc-row x-toc-first"><span class="x-num">1</span>Summary</p>', '<p class="x-toc-row x-toc-in x-toc-last"><span class="x-num">2.1</span>Blood</p>',
    '<h2 class="x-h2 x-notes-head">Notes</h2>\n<p class="x-note"><span class="x-note-n">1</span>Consultation, 2 Oct.</p>\n<p class="x-note"><span class="x-note-n">2</span>Blood panel, p. 3.</p>',
    '<span class="x-note-n">3</span><a class="x-a" href="https://example.org/esmo">ESMO</a>, https://example.org/esmo.</p>', '<span class="x-note-n">4</span><em>Ward leaflet</em>, p. 2.</p>'])
    assert.ok(h.includes(piece), `the prose page holds: ${piece}\n${h}`);
  assert.equal((h.match(/x-note-n/g) || []).length, 4, 'the same source at the same page is one note');
  const each = html.toHtml(page, { layout: 'prose', prose: { children: 'each' } }), list = html.toHtml(page, { layout: 'prose', prose: { children: 'list' } });
  assert.ok(each.includes('<p class="x-p">Repeat in four weeks</p>') && each.includes('<p class="x-p">Ask about iron?</p>'), 'a paragraph each, as written');
  assert.ok(list.includes('down from 121<sup class="x-ref">2</sup></p>\n<ul class="x-ul">\n<li class="x-li">Repeat in four weeks'), 'or the bullets stay');
  const bare = html.toHtml(page, { layout: 'prose', prose: { contents: false, numbered: false, runIn: true, notesHead: '', titleSheet: true, sectionSheets: true } });
  assert.ok(!bare.includes('x-toc') && !bare.includes('x-num') && !bare.includes('x-notes-head'), 'no contents, no numbers, no heading over the notes');
  assert.ok(bare.includes('<p class="x-p"><strong>Blood.</strong> Haemoglobin 104'), 'a heading under a # leads its paragraph');
  assert.ok(bare.includes('<p class="x-note x-note-first">'), 'the first note carries the line the heading would');
  assert.ok(bare.includes('</header>\n<h2 class="x-newsheet x-h2">Summary') && bare.includes('<h2 class="x-h2 x-newsheet">Findings'), 'the title on its own sheet, each # on a new one');
  assert.ok(!html.toHtml(page, { layout: 'prose', prose: { sectionSheets: true, contents: false } }).includes('newsheet">Summary'), 'the first section stays under the title');
  const m = markdown.toMarkdown(page, { layout: 'prose' });
  for (const piece of ['## 1 Summary\n\nWorse after the second cycle.[^1] Ferritin was low.[^2]\n', '### 2.1 Blood\n\nHaemoglobin 104, down from 121.[^2] Repeat in four weeks. Ask about iron?\n', '1. One\n2. Two', '- [ ] Ring the ward',
    '[^1]: Consultation, 2 Oct.\n[^2]: Blood panel, p. 3.\n[^3]: [ESMO](https://example.org/esmo).\n[^4]: *Ward leaflet*, p. 2.\n'])
    assert.ok(m.includes(piece), `the prose Markdown holds: ${piece}\n${m}`);
  assert.ok(themes.stylesheet('plain', {}).includes('.x-newsheet { break-before: page; }'));
  assert.ok(themes.PARTS.every(([part]) => themes.ruleText('plain', part).includes(': ')), 'every part named in the window has a rule to write');
  assert.equal(themes.ruleText('plain', 'title').split('\n')[0], '.x-title {');
  console.log('  ok  Prose: sections, paragraphs, numbered notes, footnotes in Markdown');
}
// Templates: the plugin's three, the person's own beside them, a set compared key by key.
{
  const T = E.templates;
  assert.deepEqual(plain(T.names({})), ['Report', 'Paper', 'Brief']);
  const choice = { target: 'pdf', layout: 'prose', look: 'book', hiddenHead: new Set(['b', 'a']), prose: D.proseOpts({}), customCss: '', zoom: '125' };
  let store = T.save({}, 'Letter', choice);
  assert.deepEqual(plain(store.Letter.hiddenHead), ['a', 'b']); assert.ok(!('zoom' in store.Letter), 'only a template’s keys are held');
  assert.deepEqual(plain(T.names(store)), ['Report', 'Paper', 'Brief', 'Letter']);
  assert.equal(T.changed(T.get(store, 'Letter'), choice), false); assert.equal(T.changed(T.get(store, 'Letter'), { ...choice, look: 'plain' }), true);
  assert.equal(T.changed(T.get(store, 'Report'), { ...choice, look: 'plain', margins: 'normal', size: 'normal', prose: D.proseOpts(T.BUILT_IN.Report.prose) }), false, 'a key the template does not hold never counts');
  store = T.rename(store, 'Letter', 'Clinic letter'); assert.deepEqual(plain(T.names(store)), ['Report', 'Paper', 'Brief', 'Clinic letter']);
  store = T.save(store, 'Report', choice); assert.ok(T.isOwn(store, 'Report') && T.get(store, 'Report').look === 'book', 'one of the plugin’s saved is the person’s');
  store = T.remove(store, 'Report'); assert.equal(T.get(store, 'Report').look, 'plain', 'deleted, the plugin’s comes back');
  assert.equal(T.clean('  My   letter '), 'My letter');
  for (const set of Object.values(T.BUILT_IN)) { assert.ok(D.layouts.some(l => l.key === set.layout) && themes.looks.some(l => l.key === set.look) && themes.MARGINS[set.margins] && themes.SIZES[set.size]); assert.deepEqual(plain(D.proseOpts(set.prose)), plain(set.prose)); }
  console.log('  ok  templates');
}
console.log('core: all good');
