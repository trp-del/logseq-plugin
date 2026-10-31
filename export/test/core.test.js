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
console.log('core: all good');
