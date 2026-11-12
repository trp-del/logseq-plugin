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
    const rows = [{ title: 'Zed', top: 'Visit' }, { title: 'Scan', top: 'Report' }, { title: 'Ada', top: 'Visit' }, { title: 'Entity thing', top: 'Entity' }, { title: 'Note', top: '' }];
    assert.equal(byKind(rows).map(group => `${group.head}: ${group.rows.map(row => row.title).join(', ')}`).join(' | '), 'Entity: Entity thing | Report: Scan | Visit: Ada, Zed | No tag: Note', 'by kind: a head for each top-level tag, by name, no tag first for its name; the untagged last'); }
  assert.ok(styles['look-quote-bullets'].includes('[data-type="annotation"]') && styles['look-quote-bullets'].includes('.hl-page'), 'a highlight and a bullet that only cites one carry the quotation mark');
  assert.ok(styles['look-tags'].includes('--lk-tag-face') && !styles['look-tags'].includes('uppercase'), 'tags in mono, as written');
  assert.ok(/\.ls-page-blocks \.ls-block :is\(\.ls-bidirectional-properties/.test(styles['look-two-way'] || '') && !/right-sidebar/.test(styles['look-two-way']), 'Logseq\'s two-way list goes from under a node, a page\'s own list left to Threads');
  // a day in a property's value keeps the value's colour; the quiet grey stays for a day in the words
  assert.ok(/\.property-value-container, \.bottom-property-pill\)[^{]*a\.page-ref[^{]*\{ color: inherit !important; \}/.test(styles['look-days']), 'a day in a value keeps the value’s colour');
  assert.ok(/^[^.]*a\.page-ref:is\(\[data-uuid\^="00000001-"\][^{]*\{ color: var\(--lk-quiet\)/m.test(styles['look-days']), 'a day in the words stays quiet');
  // the dot between a bullet's properties also stands before a pencilled one
  assert.ok(styles['look-capsules'].includes(':is(:not(:has(.empty-value)), :has(.lk-pencil)) ~ .bottom-property-pill::before'), 'a pencilled property counts as filled for the dot');
  assert.ok(/\.bottom-properties-pills-strip \{[^}]*width: 0 !important/.test(styles['look-capsules']), 'the strip of properties is given no width of its own, so it cannot widen the bullet\'s words past the pane');
  assert.ok(/\.bottom-properties-pills-strip \{[^}]*flex-wrap: wrap !important/.test(styles['look-capsules']), 'a long line of properties wraps like words, so nothing runs past the pane');
  assert.ok(/\.bottom-properties-row \{[^}]*max-height: none !important/.test(styles['look-capsules']), 'and its row grows to hold the lines: Logseq caps it at one');
  // the shared names: a pencilled tag fades once; the one alternative in force takes the text colour
  assert.ok(door.NAMES.includes('.lk-pencil .lk-tag, .lk-tag.lk-pencil { opacity: 1; font-family: var(--lk-mono) !important;'), 'a pencilled tag fades once, in the proposals\' mono');
  assert.ok(door.NAMES.includes('.lk-alts > * { color: var(--lk-quiet) !important; }') && door.NAMES.includes('.lk-alts { color: inherit !important; }'), 'the alternatives faint one by one, the line itself in the text colour');
  // the index: chains, and no sort of any kind (the four kinds are tags like any other since 4 November 2026)
  const index = Look.index; assert.ok(index, 'the page index was read');
  assert.equal(index.chainByUuid(U(3)).chain.map(t => t.title).join('/'), 'Doctor/Person/Entity');
  assert.ok(!('sortByUuid' in index) && !('sortByName' in index) && !('SORT_NAMES' in Look.db), 'no tag is read as a kind by its name');
  assert.equal(index.chainsOfPage(U(20))[0].chain.at(-1).title, 'Entity', 'a page’s top-level tag is the last of its chain');
  // no mark of a sort anywhere: before a link, in a page's icon slot, in the left sidebar (taken off 3 November 2026)
  assert.equal(doc.querySelectorAll('[data-lk-sort], .lk-page-mark').length, 0, 'no sort mark is drawn');
  assert.ok(!styles['look-marks'], 'no stylesheet for marks');
  // the tag chain at the title's right end, nearest first, the held tag with its ×
  const pathBox = doc.querySelector('.ls-block-right > .lk-path');
  assert.ok(pathBox, 'the chain is drawn'); assert.equal(pathBox.textContent.replace(/\s+/g, ''), 'Doctor×/Person/Entity');
  assert.ok(pathBox.querySelector('.lk-held .lk-x'), 'the held tag has an ×');
  // On a tag's own page the × reaches every node under the tag, so it writes nothing: it opens Structure's ask, and with Structure off it is not there.
  { const title = doc.querySelector('.ls-page-title .ls-block[blockid]'), was = title.getAttribute('blockid');
    const settings = logseq.settings, was2 = settings.structureOn;
    settings.structureOn = false; title.setAttribute('blockid', U(3)); Look.title.draw(doc);
    const box = doc.querySelector('.ls-block-right > .lk-path');
    assert.equal(box.textContent.replace(/\s+/g, ''), 'Person/Entity', 'only the tags above it');
    assert.ok(!box.querySelector('.lk-x'), 'with Structure switched off, no ×');
    settings.structureOn = true; box.dataset.key = ''; Look.title.draw(doc);
    const x = box.querySelector('.lk-x'); assert.ok(x, 'with Structure, the ×');
    // Structure not started yet: the press says what is needed, through the door, never by a name on the window.
    const said = []; const notify0 = logseq.UI.showMsg; logseq.UI.showMsg = (...a) => { said.push(a[0]); };
    x.click(); await new Promise(r => setTimeout(r, 0));
    assert.ok(said.some(m => /Switch on Structure/.test(m)), 'no Structure answering: it says so');
    const asked = []; const off = door.offerAsk('structure.takeOut', async (...a) => { asked.push(a); });
    x.click(); await new Promise(r => setTimeout(r, 0));
    assert.deepEqual(asked, [[U(3), U(2)]], 'a press asks Structure through the door, the tag and the tag above it');
    off(); assert.ok(!door.answers('structure.takeOut'), 'the offer is taken off at stop');
    logseq.UI.showMsg = notify0; settings.structureOn = was2;
    title.setAttribute('blockid', was); box.dataset.key = ''; Look.title.draw(doc); }
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
  assert.equal(described.schema.filter(i => i.type === 'heading').length, 10, 'ten sections');
  assert.ok(described.schema.filter(i => i.type === 'heading').every(i => ['window', 'page', 'sidebar', 'keys'].includes(i.place)), 'every section of Look is sent to a place');
  const rowsOf = heading => { const at = described.schema.findIndex(i => i.title === heading); const next = described.schema.findIndex((i, n) => n > at && i.type === 'heading'); return described.schema.slice(at + 1, next < 0 ? undefined : next).map(i => i.key); };
  assert.equal(rowsOf('Notices').join(), 'quietNotices', 'Notices holds how a notice shows');
  assert.equal(rowsOf('Look and feel').join(), 'calmType,readingWidth,calmSidebar,calmToolbar,calmPage,calmTables,calmSearch,calmMenus', 'Look and feel holds a switch per part and the reading width');
  assert.equal(rowsOf('The outline').join(), 'outlinePath,focusGlide', 'The outline holds the way to the bullet you edit, and focusing in and out');
  assert.equal(rowsOf('The key sheet').join(), 'keySheet', 'The key sheet, under Keys, holds its switch');
  assert.equal(rowsOf('Folded nodes').join(), 'foldedNote', 'Folded nodes holds only what a folded node says');
  for (const key of ['propertyIcons', 'propertyNameTips', 'quietAddProperty', 'hideDatePencil', 'hideTwoWayList']) assert.ok(rowsOf('Properties').includes(key), key + ' under Properties');
  assert.ok(!described.schema.some(i => i.key === 'quietEmptyProps'), 'one row for empty properties, Predictive’s');
  assert.ok(!described.schema.some(i => i.key === 'linkMarks' || i.key === 'pageMark'), 'no setting for marks');
  assert.ok(described.specimen({ key: 'valuesOpen' }, true).includes('lk-change'), 'a specimen of the thing itself');
  // Logseq's own look in a specimen follows light and dark: no fixed colour but the blue of Logseq's chosen row and a shadow (the audit's 14)
  for (const item of described.schema) for (const v of item.type === 'enum' ? item.enumChoices || [] : [true, false]) {
    const fixed = (described.specimen(item, v).match(/#[0-9a-f]{3,8}\b|rgb\(\s*\d/gi) || []).filter(c => !['#3b82f6', 'rgb(0'].includes(c.toLowerCase()));   // a black shadow reads in both
    assert.deepEqual(fixed, [], `${item.key} (${v}) draws a fixed colour, which reads wrong in one of the two themes`);
  }
  // a cut property name shows whole as a tooltip under the pointer, one that fits does not, and the sweep takes it off
  { const tip = (scroll, words) => { const n = doc.createElement('span'); n.className = 'property-key-inner'; n.textContent = words; Object.defineProperty(n, 'scrollWidth', { value: scroll }); Object.defineProperty(n, 'clientWidth', { value: 100 }); doc.body.append(n); n.dispatchEvent(new (doc.defaultView.MouseEvent)('mouseover', { bubbles: true })); return n; };
    const long = tip(180, 'Referring consultant at Northgate'), short = tip(90, 'Notes');
    assert.equal(long.getAttribute('title'), 'Referring consultant at Northgate', 'a cut name shows whole'); assert.ok(!short.hasAttribute('title'), 'one that fits has no tooltip');
    Look.kit.sweep(doc); assert.ok(!long.hasAttribute('title'), 'the sweep takes it off'); long.remove(); short.remove(); }
  // A page in the right sidebar: "Open properties" is pressed once for the item and never again, even when its properties never
  // show as open (a press is a click, and a click closes Logseq's list in the bullet being written; 6 November 2026).
  { const side = doc.createElement('div'); side.id = 'right-sidebar';
    side.innerHTML = '<div class="sidebar-item item-type-page"><div class="ls-sidebar-page-properties"><div><button type="button">Open properties</button></div></div></div>';
    doc.body.appendChild(side); let presses = 0; side.querySelector('button').addEventListener('click', () => { presses++; });
    const clocks = [...new Set([Date, doc.defaultView.Date].filter(Boolean))], was = clocks.map(D => D.now); let t = Date.now();
    clocks.forEach(D => { D.now = () => t; });
    for (let i = 0; i < 4; i++) { Look.sidebar.openProperties(doc); t += 2000; }   // a pass every two seconds, as while typing
    clocks.forEach((D, i) => { D.now = was[i]; });
    assert.equal(presses, 1, 'pressed once, not again on each pass: ' + presses); side.remove(); }
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
  // A tag in Logseq's table reads without the # it writes into the name (the audit's 22); a name without one is left alone.
  { const cell = doc.createElement('div'); cell.className = 'ls-table-cell'; cell.innerHTML = '<a class="tag"><span>#Consultation</span></a><a class="tag"><span>Untitled</span></a>';
    doc.getElementById('main-content-container')?.append(cell) ?? doc.body.append(cell); Look.kit.run(doc);
    const [hash, plainName] = cell.querySelectorAll('span');
    assert.ok(hash.hasAttribute('data-lk-hash') && !plainName.hasAttribute('data-lk-hash'), 'only a name that starts with # is marked');
    assert.ok(styles['look-tags'].includes('span[data-lk-hash]') && styles['look-tags'].includes('clip-path: inset(0 -.2em 0 var(--lk-hash, .6em))'), 'and its # clipped off in place, by its width in the tag\'s face'); }
  // The key sheet: Option held alone brings it after a moment; another key, a quick Option or Option with Cmd does not.
  { const { keysHtml, HOLD } = Look.keys, wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    assert.equal(keysHtml(['⌘⇧↑', '⌘⇧↓']), '<span class="lk-ks-k"><span class="lk-ks-m">⌘</span><span class="lk-ks-m">⇧</span><span class="lk-ks-m">↑</span></span><span class="lk-ks-k"><span class="lk-ks-m">⌘</span><span class="lk-ks-m">⇧</span><span class="lk-ks-m">↓</span></span>', 'each key whole');
    assert.equal(door.keyMarks('mod+alt+enter') + door.keyMarks('⌘+⇧+k') + door.keyMarks('t p | ⌘+,'), '⌥⌘↩⇧⌘Kt p', 'keys as the Mac\'s marks, two letters as Logseq writes them');
    const key = (type, k, more = {}) => doc.dispatchEvent(new doc.defaultView.KeyboardEvent(type, { key: k, bubbles: true, ...more }));
    const sheet = () => doc.getElementById('lk-key-sheet');
    key('keydown', 'Alt', { altKey: true }); await wait(HOLD + 60);
    assert.ok(sheet()?.classList.contains('lk-window'), 'Option held: the sheet, a window of the library');
    assert.ok(/Moving around/.test(sheet().textContent) && /⌘\./.test(sheet().textContent), 'its keys as the Mac\'s marks');
    key('keydown', 't', { altKey: true }); assert.ok(!sheet(), 'another key puts it away');
    key('keyup', 'Alt');
    key('keydown', 'Alt', { altKey: true }); await wait(120); key('keydown', 'e', { altKey: true }); key('keyup', 'Alt'); await wait(HOLD);
    assert.ok(!sheet(), 'a quick Option-E brings nothing');
    key('keydown', 'Alt', { altKey: true, metaKey: true }); await wait(HOLD + 60); key('keyup', 'Alt');
    assert.ok(!sheet(), 'Option with Cmd brings nothing');
    logseq.settings = { ...(logseq.settings || {}), keySheet: false };
    key('keydown', 'Alt', { altKey: true }); await wait(HOLD + 60); key('keyup', 'Alt');
    assert.ok(!sheet(), 'switched off, nothing');
    logseq.settings = { ...logseq.settings, keySheet: true };
    key('keydown', 'Alt', { altKey: true }); await wait(HOLD + 60); assert.ok(sheet(), 'on again');
    // Let go once it shows: it stays, finds as you type, Escape clears then closes.
    key('keyup', 'Alt'); assert.ok(sheet()?.classList.contains('stays'), 'let go, it stays');
    const find = sheet().querySelector('.lk-ks-find'); assert.equal(doc.activeElement, find, 'the keyboard in its find line');
    find.value = 'focus'; find.dispatchEvent(new doc.defaultView.Event('input'));
    const shown = [...sheet().querySelectorAll('.lk-ks-line:not([hidden])')].map(line => line.textContent);
    assert.ok(shown.length >= 1 && shown.every(text => /focus/i.test(text)) && sheet().querySelector('.lk-ks-line.lit mark'), 'typing finds, the words lit: ' + shown);
    key('keydown', 'Escape'); assert.ok(sheet() && !find.value && !sheet().querySelector('.lk-ks-line[hidden]'), 'Escape clears what was typed');
    key('keydown', 'Escape'); assert.ok(!sheet(), 'then closes');
    assert.equal(Look.keys.spelled({ code: 'KeyT', key: '†', altKey: true, metaKey: false, ctrlKey: false, shiftKey: false }), 'alt+t', 'a key pressed, as the settings spell it');
    assert.equal(Look.keys.spelled({ code: 'Semicolon', key: '…', altKey: true, metaKey: false, ctrlKey: false, shiftKey: true }), 'alt+shift+;'); }
  // stop: everything swept
  await logseq._unload();
  assert.equal(doc.querySelectorAll('.lk-own, [data-lk-sort], [data-lk-kind], [data-lk-hash]').length, 0, 'nothing left on the page');
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
