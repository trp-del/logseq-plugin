/* node test/load.js   (needs jsdom: NODE_PATH=/Users/admin/logseq-value/logseq-plugin-old/node_modules)
   Loads the plugin's files against the stand-in of test/stand-in.js (a fake `logseq` and a jsdom page drawn like a Logseq
   page: a title row, a page's list with a date, a bullet with links, a tag and a line of properties, a folded node with two
   tags, the left sidebar's recents with an untagged page and a journal day). It shows that every file parses, that the parts
   find each other, and that each drawing lands where it should and is swept away when the plugin stops. Only the real app
   shows the rest. */
const assert = require('node:assert/strict');
let standIn; try { standIn = require('./stand-in.js'); } catch (error) { console.log('skipped: needs jsdom (set NODE_PATH)'); process.exit(2); }
const { U, load, pencilled } = standIn;

(async () => {
  const { dom, doc, Look, logseq, styles, errors, order, door } = await load();
  const window_described = () => door.described.look;
  // pure pieces
  assert.equal(Look.folded.dueLabel(20261119, new Date(2026, 10, 1)), 'due Nov 19');
  assert.equal(Look.folded.dueLabel(20261012, new Date(2026, 10, 1)), 'was due Oct 12');
  assert.equal(JSON.stringify(Look.folded.wordsFor({ task: 2, files: [['pdf', 1]], quotes: 0, tags: ['Consultation'], due: 0 })), JSON.stringify(['2 unfinished tasks under it', '1 PDF', 'Consultation']));
  // styles sent
  for (const key of ['look-tokens', 'look-links', 'look-days', 'look-tags', 'look-capsules', 'look-marks', 'look-props', 'look-title', 'look-folded']) assert.ok(styles[key] && !styles[key].includes('no rules'), key + ' sent');
  assert.ok(styles['look-tags'].includes('--lk-mono') && !styles['look-tags'].includes('uppercase'), 'tags in mono, as written');
  // a day in a property's value keeps the value's colour; the quiet grey stays for a day in the words
  assert.ok(/\.property-value-container, \.bottom-property-pill\)[^{]*a\.page-ref[^{]*\{ color: inherit !important; \}/.test(styles['look-days']), 'a day in a value keeps the value’s colour');
  assert.ok(/^[^.]*a\.page-ref:is\(\[data-uuid\^="00000001-"\][^{]*\{ color: var\(--lk-quiet\)/m.test(styles['look-days']), 'a day in the words stays quiet');
  // the dot between a bullet's properties also stands before a pencilled one
  assert.ok(styles['look-capsules'].includes(':is(:not(:has(.empty-value)), :has(.lk-pencil)) ~ .bottom-property-pill::before'), 'a pencilled property counts as filled for the dot');
  // the shared names: a pencilled tag fades once; the one alternative in force takes the text colour
  assert.ok(styles['look-shared'].includes('.lk-pencil .lk-tag, .lk-tag.lk-pencil { opacity: 1; }'), 'a pencilled tag fades once');
  assert.ok(styles['look-shared'].includes('.lk-alts > * { color: var(--lk-faint) !important; }') && styles['look-shared'].includes('.lk-alts { color: inherit !important; }'), 'the alternatives faint one by one, the line itself in the text colour');
  // the index: chains and sorts
  const index = Look.index; assert.ok(index, 'the page index was read');
  assert.equal(index.chainByUuid(U(3)).chain.map(t => t.title).join('/'), 'Doctor/Person/Entity');
  assert.equal(index.sortByUuid(U(20)), 'entity'); assert.equal(index.sortByUuid(U(21)), 'phenomenon'); assert.equal(index.sortByName('fatigue'), 'phenomenon');
  assert.equal(index.sortByUuid(U(3)), 'entity', 'a tag page takes its sort');
  assert.equal(index.sortByUuid(U(300)), 'occurrence', 'a tagged bullet has a sort too');
  // marks before links, in words and in a property's value; none on the tag link nor on a journal day
  const links = [...doc.querySelectorAll('a.page-ref[data-lk-sort]')].map(a => a.getAttribute('data-lk-sort'));
  assert.equal(links.join(','), 'entity,entity,phenomenon,information,occurrence,entity,entity');
  assert.equal(doc.querySelector('a.tag').hasAttribute('data-lk-sort'), false);
  assert.ok([...doc.querySelectorAll('a.page-ref[data-uuid^="00000001-"]')].every(a => !a.hasAttribute('data-lk-sort')), 'no mark on a day');
  // the page's mark in the icon slot; in the sidebar's list, a mark where the page has one, an empty slot where it has none
  assert.equal(doc.querySelector('.is-page-title-row > .block-control-wrap > .lk-page-mark')?.dataset.sort, 'entity');
  const slot = name => doc.querySelector(`#left-sidebar .link-item[data-page-name="${name}"] .page-icon`).getAttribute('data-lk-sort');
  assert.equal(slot('Fatigue'), 'phenomenon'); assert.equal(slot('CT report'), 'information'); assert.equal(slot('Doctor'), 'entity');
  assert.equal(slot('Questions for Dr. Chen'), 'none', 'an untagged page: the slot kept empty'); assert.equal(slot('Oct 19th, 2026'), 'none', 'a journal day: the slot kept empty');
  assert.ok(styles['look-marks'].includes('.page-icon[data-lk-sort] :is(.ls-icon-file, .ls-icon-page) { visibility: hidden; }'), 'the plain page icon gives way');
  // the tag chain at the title's right end, nearest first, the held tag with its ×
  const pathBox = doc.querySelector('.ls-block-right > .lk-path');
  assert.ok(pathBox, 'the chain is drawn'); assert.equal(pathBox.textContent.replace(/\s+/g, ''), 'Doctor×/Person/Entity');
  assert.ok(pathBox.querySelector('.lk-held .lk-x'), 'the held tag has an ×');
  // property icons in the page's list: the web for a link to nodes, a calendar for a date, 123, a box for a choice, letters; nothing under a node
  const kind = name => doc.querySelector(`.ls-page-properties [data-property-title="${name}"] .property-m[data-lk-kind] > .lk-kind`);
  assert.ok(kind('Works at')?.querySelector('.lk-web'), 'the web mark on Works at');
  assert.ok(kind('First seen')?.querySelector('.ti-calendar') && kind('Rating')?.querySelector('.ti-123') && kind('Status')?.querySelector('.ti-select') && kind('Specialty')?.querySelector('.ti-letter-case'), 'a calendar, 123, a box, letters');
  assert.equal(doc.querySelectorAll('.ls-block-properties .lk-kind, .bottom-property-pill .lk-kind').length, 0, 'plain text under a node');
  // the folded note: a circle, a PDF, two tags with a dot between them, the due day, no numbers on the tags
  await new Promise(r => setTimeout(r, 60));
  const note = doc.querySelector(`.ls-block[blockid="${U(400)}"] .lk-folded`);
  assert.ok(note, 'the folded note is drawn');
  assert.ok(note.querySelector('.ti-circle') && note.querySelector('.ti-file-type-pdf'), 'task circle and PDF icons');
  assert.deepEqual([...note.querySelectorAll('a.lk-tag')].map(a => a.textContent), ['Consultation', 'Symptom']);
  for (const tag of note.querySelectorAll('a.lk-tag')) assert.ok(tag.previousElementSibling?.classList.contains('lk-sep') && tag.previousElementSibling.textContent === '·', `a dot before ${tag.textContent}`);
  assert.ok(/due Nov 19|was due Nov 19/.test(note.textContent) && !/\d+ Consultation|Consultation \d/.test(note.textContent), 'the due day, no count on the tag');
  assert.equal(note.querySelector('.lk-pair').textContent, '1', 'the task count beside the circle');
  // the settings window draws from Look's description: a heading per section, the one row for the property icon
  const described = window_described();
  assert.equal(described.schema.filter(i => i.type === 'heading').length, 5, 'five sections');
  assert.equal(described.schema.find(i => i.key === 'propertyIcons').also, 'propertyKindIcons', 'one row sets Look’s icon and Threads’ mark');
  assert.ok(described.specimen({ key: 'pageMark' }, true).includes('lk-page-mark'), 'a specimen of the thing itself');
  // stop: everything swept
  await logseq._unload();
  assert.equal(doc.querySelectorAll('.lk-own, [data-lk-sort], [data-lk-kind]').length, 0, 'nothing left on the page');
  assert.equal(errors.length, 0, errors.join('\n'));
  // a bullet as Predictive leaves it: Look adds nothing inside the pencils, and the markup keeps the names its rules go by
  const other = await load({ html: pencilled });
  assert.equal(other.doc.querySelectorAll('.flow-ghost .lk-own, .flow-ghost [data-lk-sort]').length, 0, 'nothing of Look’s inside a pencil');
  assert.ok(other.doc.querySelector('.ls-block-right > .lk-pencil > .lk-tag') && other.doc.querySelectorAll('.bottom-property-pill:has(.lk-pencil)').length === 3, 'the pencilled tag and three pencilled values stand');
  await other.logseq._unload();
  assert.equal(other.errors.length, 0, other.errors.join('\n'));
  console.log('ok: ' + order.length + ' files load; marks, chain, icons, the folded note and the settings window draw and are swept');
})().catch(error => { console.error('load test failed:', error); process.exit(1); });
