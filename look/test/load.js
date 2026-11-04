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
  const { dom, doc, win, Look, logseq, styles, errors, order, door } = await load();
  const window_described = () => door.described.look;
  // Another module's setting saved leaves Look asleep; Look's own wakes it.
  let woken = 0; const run = Look.kit.run; Look.kit.run = target => { woken++; return run(target); };
  logseq._settingsHook({ linkSuggestMemory: { a: 1 } }, {}); assert.equal(woken, 0, 'another module’s setting wakes nothing');
  logseq._settingsHook({ quietLinks: false }, { quietLinks: true }); assert.equal(woken, 1, 'its own does');
  logseq._settingsHook({ quietLinks: true }, { quietLinks: false }); Look.kit.run = run;
  // pure pieces
  assert.equal(Look.folded.dueLabel(20261119, new Date(2026, 10, 1)), 'due Nov 19');
  assert.equal(Look.folded.dueLabel(20261012, new Date(2026, 10, 1)), 'was due Oct 12');
  assert.equal(JSON.stringify(Look.folded.wordsFor({ task: 2, files: [['pdf', 1]], quotes: 0, tags: ['Consultation'], due: 0 })), JSON.stringify(['2 unfinished tasks under it', '1 PDF', 'Consultation']));
  // styles sent
  for (const key of ['look-links', 'look-days', 'look-tags', 'look-capsules', 'look-props', 'look-title', 'look-folded', 'look-quote-bullets']) assert.ok(styles[key] && !styles[key].includes('no rules'), key + ' sent');
  { const { linksIn, byKind } = Look.links;
    const tree = [{ title: 'Saw [[Ana]] about #[[Fatigue]] and [[ana]]', children: [{ title: 'Then [[Ben]]' }] }];
    assert.equal(linksIn(tree).join(' '), 'ana ben', 'each link once, in the order of the page, a tag not among them');
    assert.equal(linksIn([{ title: 'Smaller ([[Report]], p. 3) as [[Ana]] said ([[Scan]])' }]).join(' '), 'ana', 'a citation is not a link here');
    assert.equal(Look.links.citationsIn([{ title: 'A ([[Report]], p. 3)', children: [{ title: 'B ([[Report]], p. 3) and ([[Report]], p. 9) ([[Scan]]) and [[Ana]]' }] }]).map(note => `${note.key} ${note.page}`).join(', '), 'report 3, report 9, scan 0', 'endnotes: in order, the same source at the same page once');
    { const page = new (doc.defaultView.DOMParser)().parseFromString('<span class="w">Smaller (<span class="page-reference"></span>, p. 3) today</span>', 'text/html'), ref = page.querySelector('.page-reference');
      assert.equal(Look.cites.citedAt(ref).page, '3', 'a citation is told by what stands either side of its link');
      ref.nextSibling.nodeValue = ') today'; assert.equal(Look.cites.citedAt(ref).page, '');
      ref.previousSibling.nodeValue = 'Smaller '; assert.equal(Look.cites.citedAt(ref), null, 'a link with no bracket before it is no citation'); }
    assert.equal(Look.links.citationsIn([{ title: 'A ([site](https://a.org/b)) B (*Smith 2023*, p. 6) C (*not this* one)' }]).map(note => `${note.id} ${note.title} ${note.page}`).join(', '), 'https://a.org/b site 0, words:smith 2023 Smith 2023 6', 'a web address and plain words are citations too');
    assert.equal(linksIn([{ title: '([site](https://a.org)) (*Smith*) [[Ana]]' }]).join(' '), 'ana');
    const rows = [{ title: 'Zed', sort: 'entity' }, { title: 'Ada', sort: 'entity' }, { title: 'Scan', sort: 'occurrence' }, { title: 'Note', sort: null }];
    assert.equal(byKind(rows).map(group => `${group.head}: ${group.rows.map(row => row.title).join(', ')}`).join(' | '), 'Entity: Ada, Zed | Occurrence: Scan | No kind: Note', 'by kind: the kinds in order, by name, the rest last'); }
  assert.ok(styles['look-quote-bullets'].includes('[data-type="annotation"]') && styles['look-quote-bullets'].includes('.hl-page'), 'a highlight and a bullet that only cites one carry the quotation mark');
  assert.ok(styles['look-tags'].includes('--lk-mono') && !styles['look-tags'].includes('uppercase'), 'tags in mono, as written');
  // a day in a property's value keeps the value's colour; the quiet grey stays for a day in the words
  assert.ok(/\.property-value-container, \.bottom-property-pill\)[^{]*a\.page-ref[^{]*\{ color: inherit !important; \}/.test(styles['look-days']), 'a day in a value keeps the value’s colour');
  assert.ok(/^[^.]*a\.page-ref:is\(\[data-uuid\^="00000001-"\][^{]*\{ color: var\(--lk-quiet\)/m.test(styles['look-days']), 'a day in the words stays quiet');
  // the dot between a bullet's properties also stands before a pencilled one
  assert.ok(styles['look-capsules'].includes(':is(:not(:has(.empty-value)), :has(.lk-pencil)) ~ .bottom-property-pill::before'), 'a pencilled property counts as filled for the dot');
  assert.ok(/\.bottom-properties-pills-strip \{[^}]*width: 0 !important/.test(styles['look-capsules']), 'the strip of properties is given no width of its own, so it cannot widen the bullet\'s words past the pane');
  assert.ok(/\.bottom-properties-pills-strip \{[^}]*flex-wrap: wrap !important/.test(styles['look-capsules']), 'a long line of properties wraps like words, so nothing runs past the pane');
  assert.ok(/\.bottom-properties-row \{[^}]*max-height: none !important/.test(styles['look-capsules']), 'and its row grows to hold the lines: Logseq caps it at one');
  // the shared names: a pencilled tag fades once; the one alternative in force takes the text colour
  assert.ok(door.NAMES.includes('.lk-pencil .lk-tag, .lk-tag.lk-pencil { opacity: 1; }'), 'a pencilled tag fades once');
  assert.ok(door.NAMES.includes('.lk-alts > * { color: var(--lk-faint) !important; }') && door.NAMES.includes('.lk-alts { color: inherit !important; }'), 'the alternatives faint one by one, the line itself in the text colour');
  // the index: chains and sorts
  const index = Look.index; assert.ok(index, 'the page index was read');
  assert.equal(index.chainByUuid(U(3)).chain.map(t => t.title).join('/'), 'Doctor/Person/Entity');
  assert.equal(index.sortByUuid(U(20)), 'entity'); assert.equal(index.sortByUuid(U(21)), 'phenomenon'); assert.equal(index.sortByName('fatigue'), 'phenomenon');
  assert.equal(index.sortByUuid(U(3)), null, 'a tag has no mark');
  assert.equal(index.sortByUuid(U(300)), 'occurrence', 'a tagged bullet has a sort too');
  // no mark of a sort anywhere: before a link, in a page's icon slot, in the left sidebar (taken off 3 November 2026)
  assert.equal(doc.querySelectorAll('[data-lk-sort], .lk-page-mark').length, 0, 'no sort mark is drawn');
  assert.ok(!styles['look-marks'], 'no stylesheet for marks');
  // the tag chain at the title's right end, nearest first, the held tag with its ×
  const pathBox = doc.querySelector('.ls-block-right > .lk-path');
  assert.ok(pathBox, 'the chain is drawn'); assert.equal(pathBox.textContent.replace(/\s+/g, ''), 'Doctor×/Person/Entity');
  assert.ok(pathBox.querySelector('.lk-held .lk-x'), 'the held tag has an ×');
  // On a tag's own page the × reaches every node under the tag, so it writes nothing: it opens Structure's ask, and with Structure off it is not there.
  { const title = doc.querySelector('.ls-page-title .ls-block[blockid]'), was = title.getAttribute('blockid');
    title.setAttribute('blockid', U(3)); Look.title.draw(doc);
    const box = doc.querySelector('.ls-block-right > .lk-path');
    assert.equal(box.textContent.replace(/\s+/g, ''), 'Person/Entity', 'only the tags above it');
    assert.ok(!box.querySelector('.lk-x'), 'with no Structure, no ×');
    const asked = []; win.Structure = { app: { askTakeOut: async (...a) => { asked.push(a); } } }; box.dataset.key = ''; Look.title.draw(doc);
    const x = box.querySelector('.lk-x'); assert.ok(x, 'with Structure, the ×'); x.click(); await new Promise(r => setTimeout(r, 0));
    assert.deepEqual(asked, [[U(3), U(2)]], 'a press asks Structure, the tag and the tag above it');
    title.setAttribute('blockid', was); delete win.Structure; box.dataset.key = ''; Look.title.draw(doc); }
  // property icons in the page's list: the web for a link to nodes, a calendar for a date, 123, a box for a choice, letters; nothing under a node
  const kind = name => doc.querySelector(`.ls-page-properties [data-property-title="${name}"] .property-m[data-lk-kind] > .lk-kind`);
  assert.ok(kind('Works at')?.querySelector('.lk-web'), 'the web mark on Works at');
  assert.ok(kind('First seen')?.querySelector('.ti-calendar') && kind('Rating')?.querySelector('.ti-123') && kind('Status')?.querySelector('.ti-select') && kind('Specialty')?.querySelector('.ti-letter-case'), 'a calendar, 123, a box, letters');
  assert.equal(doc.querySelectorAll('.ls-block-properties .lk-kind, .bottom-property-pill .lk-kind').length, 0, 'plain text under a node');
  // a row that comes has its icon before the next frame, so Logseq's dot never shows first
  { const row = doc.querySelector('.ls-page-properties [data-property-title]'), copy = row.cloneNode(true);
    copy.querySelector('.lk-kind').remove(); copy.querySelector('.property-m').removeAttribute('data-lk-kind');
    row.after(copy); await Promise.resolve(); await Promise.resolve();
    assert.ok(copy.querySelector('.property-m > .lk-kind'), 'the icon comes at once'); copy.remove(); }
  // the folded note: a circle, a PDF, two tags with a dot between them, the due day, no numbers on the tags
  await new Promise(r => setTimeout(r, 60));
  const note = doc.querySelector(`.ls-block[blockid="${U(400)}"] .lk-folded`);
  assert.ok(note, 'the folded note is drawn');
  assert.ok(note.querySelector('.ti-circle') && note.querySelector('.ti-file-type-pdf'), 'task circle and PDF icons');
  assert.deepEqual([...note.querySelectorAll('a.lk-tag')].map(a => a.textContent), ['Consultation', 'Symptom']);
  for (const tag of note.querySelectorAll('a.lk-tag')) assert.ok(tag.previousElementSibling?.classList.contains('lk-sep') && tag.previousElementSibling.textContent === '·', `a dot before ${tag.textContent}`);
  assert.ok(/due Nov 19|was due Nov 19/.test(note.textContent) && !/\d+ Consultation|Consultation \d/.test(note.textContent), 'the due day, no count on the tag');
  assert.equal(note.querySelector('.lk-pair').textContent, '1', 'the task count beside the circle');
  assert.ok(!note.querySelector('.ti-link'), 'no count of links');
  // the settings window draws from Look's description: a heading per section, the one row for the property icon
  const described = window_described();
  assert.equal(described.schema.filter(i => i.type === 'heading').length, 8, 'eight sections');
  const rowsOf = heading => { const at = described.schema.findIndex(i => i.title === heading); const next = described.schema.findIndex((i, n) => n > at && i.type === 'heading'); return described.schema.slice(at + 1, next < 0 ? undefined : next).map(i => i.key); };
  assert.equal(rowsOf('Notices').join(), 'quietNotices', 'Notices holds how a notice shows');
  assert.equal(rowsOf('The outline').join(), 'litBranch', 'The outline holds the way to the bullet you edit');
  assert.equal(rowsOf('Folded nodes').join(), 'foldedNote', 'Folded nodes holds only what a folded node says');
  for (const key of ['propertyIcons', 'propertyNameTips', 'quietAddProperty', 'hideDatePencil']) assert.ok(rowsOf('Properties').includes(key), key + ' under Properties');
  assert.ok(!described.schema.some(i => i.key === 'quietEmptyProps'), 'one row for empty properties, Predictive’s');
  assert.ok(!described.schema.some(i => i.key === 'linkMarks' || i.key === 'pageMark'), 'no setting for marks');
  assert.ok(described.specimen({ key: 'valuesOpen' }, true).includes('lk-change'), 'a specimen of the thing itself');
  // a cut property name shows whole as a tooltip under the pointer, one that fits does not, and the sweep takes it off
  { const tip = (scroll, words) => { const n = doc.createElement('span'); n.className = 'property-key-inner'; n.textContent = words; Object.defineProperty(n, 'scrollWidth', { value: scroll }); Object.defineProperty(n, 'clientWidth', { value: 100 }); doc.body.append(n); n.dispatchEvent(new (doc.defaultView.MouseEvent)('mouseover', { bubbles: true })); return n; };
    const long = tip(180, 'Referring consultant at Northgate'), short = tip(90, 'Notes');
    assert.equal(long.getAttribute('title'), 'Referring consultant at Northgate', 'a cut name shows whole'); assert.ok(!short.hasAttribute('title'), 'one that fits has no tooltip');
    Look.kit.sweep(doc); assert.ok(!long.hasAttribute('title'), 'the sweep takes it off'); long.remove(); short.remove(); }
  // Words written read nothing; a tag or a name changed reads the index again.
  let asked = 0; const reads = logseq.DB.datascriptQuery; logseq.DB.datascriptQuery = async q => { asked++; return reads(q); };
  const page = { id: 901, name: 'a page', title: 'A page', tags: [{ id: 1, ident: 'logseq.class/Page' }] };
  { const loads = []; const props = Look.props.load, marks = Look.marks.load; Look.props.load = () => loads.push('props'); Look.marks.load = () => loads.push('marks'); logseq._graph(); Look.props.load = props; Look.marks.load = marks; assert.deepEqual(loads.sort(), ['marks', 'props'], 'another graph reads the marks and the property kinds again'); }
  Look.kit.graphChanged({ blocks: [{ id: 900, title: 'Words', page: { id: 901 } }, page], txMeta: { outlinerOp: 'save-block' } });
  await new Promise(r => setTimeout(r, 1000)); assert.equal(asked, 0, 'a bullet written, with its page in the list, reads nothing');
  Look.kit.graphChanged({ blocks: [{ id: 900, title: 'Words', page: { id: 901 }, tags: [{ id: 5, ident: 'user.class/Doctor' }] }], txMeta: { outlinerOp: 'save-block' } });
  await new Promise(r => setTimeout(r, 1000)); assert.ok(asked > 0, 'a tag typed in the words does'); asked = 0;
  Look.kit.graphChanged({ blocks: [{ ...page, title: 'B page', name: 'b page' }], txMeta: { outlinerOp: 'rename-page' } });
  await new Promise(r => setTimeout(r, 1000)); assert.ok(asked > 0, 'a rename does'); logseq.DB.datascriptQuery = reads;
  // A wrapped line of properties: the first on the new line loses its dot.
  const strip = doc.createElement('div'); strip.className = 'bottom-properties-pills-strip';
  const pills = [0, 0, 32].map(top => { const pill = doc.createElement('div'); Object.defineProperty(pill, 'offsetTop', { value: top }); Object.defineProperty(pill, 'offsetParent', { value: doc.body }); strip.append(pill); return pill; });
  doc.body.append(strip); Look.props.draw(doc);
  assert.deepEqual(pills.map(pill => pill.hasAttribute('data-lk-line')), [false, false, true], 'only the first on a new line');
  strip.remove();
  // At the row's end the place line gives way from the middle: the kind is the last to go.
  assert.ok(styles['look-title'].includes('flex: 0 1000 auto') && styles['look-title'].includes('.lk-path > a.lk-end { flex-shrink: 0; }'), 'the middle gives way first');
  const placed = [...doc.querySelectorAll('.lk-path:not(.lk-path-sb) > a.lk-tag')];
  assert.ok(placed.length && placed.at(-1).classList.contains('lk-end'), 'the last of the chain is kept: ' + placed.map(a => a.textContent));
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
  // a part that never started does not keep the others from stopping
  const broken = await load();
  let rest = 0; broken.Look.marks.stop = () => { throw new Error('never started'); }; broken.Look.title.stop = () => { rest++; };
  await broken.logseq._unload();
  assert.equal(rest, 1, 'the next part still stops'); assert.equal(broken.doc.querySelectorAll('.lk-own').length, 0, 'and the sweep still runs');
  console.log('ok: ' + order.length + ' files load; marks, chain, icons, the folded note and the settings window draw and are swept');
})().catch(error => { console.error('load test failed:', error); process.exit(1); });
