/* The flows measure.js drives: each opens one bar, list or window by the press or key a person uses, on a copy of a test graph.
   A flow names what opens (`float`, the first selector that matches), what called it (`anchor`: a thing pressed, 'caret', or
   'editing' for the line being written), what must not be covered (`protect`), what must not move (`still`), its rows, and the
   faces its words must be in. `typing` flows type letters 80 ms apart into a thing already open. */
const LIST = ['[data-editor-popup-ref]', '#ui__ac', '.absolute-modal'];
const PICKER = ['[data-radix-popper-content-wrapper]:has(#ui__ac-inner)', '.ui__popover-content:has(#ui__ac-inner)', '#ui__ac-inner'];
const PROPERTY = ['.ui__popover-content:has(.ls-property-dialog)'], MADE = 'Measure Calm Probe';
const TICKED = '.ls-table-row:has(label[data-table-row-select] [aria-checked="true"], label[data-table-row-select] [data-state="checked"])';
const mono = f => /mono|menlo|consolas|courier/i.test(f.family), serif = f => /new york|serif|georgia/i.test(f.family) && !/sans/i.test(f.family);

function helpers(box, sleep) {
  const { page } = box, f = () => box.frame();
  const H = {
    sleep,
    go: async name => { await page.evaluate(n => window.logseq.api.push_state('page', { name: n.toLowerCase() }), name); await sleep(1800); },
    reset: async () => { for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await sleep(120); } await page.mouse.move(690, 550); },
    // The n-th bullet of the page in view, put in writing with the caret at its end. Its words are kept to put back.
    write: async (n = 0) => {
      const got = await page.evaluate(async n => {
        const el = [...document.querySelectorAll('#main-content-container .page-blocks-inner .ls-block[blockid]')][n]; if (!el) return null;
        const uuid = el.getAttribute('blockid'), b = await window.logseq.api.get_block(uuid); const text = b?.title ?? b?.content ?? '';
        await window.logseq.api.edit_block(uuid, { pos: text.length }); return { uuid, text };
      }, n);
      if (!got) throw new Error('the page shows no bullet to write in');
      H.written = got; await sleep(700); return got;
    },
    putBack: async () => { if (!H.written) return; const w = H.written; H.written = null; await H.reset(); await f().evaluate(([u, t]) => logseq.Editor.updateBlock(u, t), [w.uuid, w.text]).catch(() => {}); await sleep(300); },
    tick: async n => {
      for (let i = 0; i < n; i++) { const row = page.locator('.ls-table-row').nth(i); await row.hover(); await sleep(150); await row.locator('label[data-table-row-select]').click({ force: true }); await sleep(250); }
    },
    untick: async () => { const all = page.locator('.ls-table-header label[data-table-row-select], .ls-table-header [role="checkbox"]').first(); if (await page.locator(TICKED).count()) { await all.click({ force: true }).catch(() => {}); await sleep(200); if (await page.locator(TICKED).count()) { await all.click({ force: true }).catch(() => {}); await sleep(200); } } },
    addProperty: () => page.getByText('Add property', { exact: true }).first().click(),
    unmake: async name => { await f().evaluate(async n => { const p = await logseq.Editor.getPage(n); if (p) await logseq.Editor.deletePage(n); }, name).catch(() => {}); await sleep(200); },
    bar: text => page.locator('.ls-table-actions').getByText(text, { exact: true }),
  };
  return H;
}

// In the page: the rectangle of the thing about to be pressed.
const anchorRect = a => {
  const els = [...document.querySelectorAll(a.sel)].filter(e => e.checkVisibility() && (!a.text || e.textContent.trim() === a.text));
  if (!els.length) return null; const r = els[0].getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height };
};

const PF = 'Personal Finance', ILL = 'Illness Test Graph', WRITING = 'FOLFOX side effects, what to expect';
const others = '#main-content-container .page-blocks-inner .ls-block:not(:has(textarea)) > div .block-content';

const FLOWS = [
  { name: 'rows-ticked', graph: PF, says: 'the bar that shows when a table row is ticked',
    setup: async (b, H) => { await H.go('Bills'); await H.untick(); },
    input: async (b, H) => { const row = b.page.locator('.ls-table-row').first(); await row.hover(); await H.sleep(200); await row.locator('label[data-table-row-select]').click({ force: true }); },
    float: ['.ls-table-actions'], still: ['.ls-table-row', '.ls-view-head, .ls-table-header'], protect: ['.ls-table-header .ls-table-header-cell:not(:first-child)'],
    after: async (b, H) => H.untick() },
  { name: 'set-property', graph: PF, says: 'Logseq’s list of properties, from “Set property” on the bar',
    setup: async (b, H) => { await H.go('Bills'); await H.untick(); await H.tick(3); },
    anchor: { sel: '.ls-table-actions button', text: 'Set property' }, input: async (b, H) => H.bar('Set property').click(),
    float: PICKER, rows: '.menu-link-wrap', still: ['.ls-table-row', '.ls-table-header'], protect: [`${TICKED} .ls-table-cell`],
    faces: { 'a property’s name': '#ui__ac-inner .menu-link span[title*="property/"]' }, faceWant: { 'a property’s name': mono },
    after: async (b, H) => { await H.reset(); await H.untick(); } },
  { name: 'move-values', graph: PF, says: 'the Move values box, from its word on the bar',
    setup: async (b, H) => { await H.go('Bills'); await H.untick(); await H.tick(3); },
    anchor: { sel: '.ls-table-actions button', text: 'Move values…' }, input: async (b, H) => H.bar('Move values…').click(),
    float: ['.st-values'], still: ['.ls-table-row', '.ls-table-header'], protect: [`${TICKED} .table-block-title`],
    after: async (b, H) => { await H.reset(); await H.untick(); } },
  // The bin's question: Logseq's own window on main, the bar's own question since 24 November 2026. Never answered: Escape leaves.
  { name: 'bin-ask', graph: PF, says: 'the question the bin asks before deleting the ticked rows', ms: 900,
    setup: async (b, H) => { await H.go('Bills'); await H.untick(); await H.tick(3); },
    input: async b => b.page.locator('.ls-table-actions button:has(.ls-icon-trash)').click(),
    float: ['.st-bar-ask', '.ui__dialog-content'], still: ['.ls-table-row', '.ls-table-header'], protect: [`${TICKED} .table-block-title`, '.ls-table-header .ls-table-header-cell:not(:first-child)'],
    after: async (b, H) => { await H.reset(); await b.page.locator('.ui__dialog-content button', { hasText: /^Cancel$/ }).click({ force: true, timeout: 500 }).catch(() => {}); await H.untick(); } },
  // On the page's third bullet: on its first, Predictive pencils a tag at the line's right end as [[ is typed, the words wrap
  // anew, and the list then stands where the caret was (found 24 November 2026; Predictive's to settle, measured apart).
  { name: 'link-list', graph: ILL, says: 'Logseq’s list of pages to link, after [[ on a line',
    setup: async (b, H) => { await H.go(WRITING); await H.write(2); },
    anchor: 'caret', input: async b => b.page.keyboard.type(' [['),
    float: LIST, rows: '.menu-link-wrap', still: [others], protect: ['editing'], after: async (b, H) => H.putBack() },
  { name: 'tag-list', graph: ILL, says: 'the list of tags, after # on a line',
    setup: async (b, H) => { await H.go(WRITING); await H.write(2); },
    anchor: 'caret', input: async b => b.page.keyboard.type(' #'),
    float: LIST, rows: '.menu-link-wrap', still: [others], protect: ['editing'], unevenRows: true, keepsWidth: true,   // a tree stepped in and out of keeps its width
    faces: { 'a tag': '#ui__ac-inner .menu-link-wrap.st-hrow:not(.st-plain), #ui__ac-inner .menu-link-wrap.st-in-tree' }, faceWant: { 'a tag': serif },
    after: async (b, H) => H.putBack() },
  { name: 'small-find', graph: ILL, says: 'the small Find under the line, on Option-K',
    setup: async (b, H) => { await H.go(WRITING); await H.write(0); },
    anchor: 'editing', input: async b => b.page.keyboard.press('Alt+k'),
    float: ['.fd.fd-panel'], rows: '.fd-r', still: [others], protect: ['editing'], unevenRows: true, after: async (b, H) => H.putBack() },
  { name: 'small-find-typing', graph: ILL, says: 'typing in the small Find', typing: true, ms: 1400,
    setup: async (b, H) => { await H.go(WRITING); await H.write(0); await b.page.keyboard.press('Alt+k'); await H.sleep(900); },
    input: async b => b.page.keyboard.type('report', { delay: 80 }),
    float: ['.fd.fd-panel'], rows: '.fd-r', after: async (b, H) => H.putBack() },
  { name: 'find-window', graph: ILL, says: 'the Find window, on Command-K', ms: 900,
    setup: async (b, H) => { await H.go(WRITING); },
    input: async b => b.page.keyboard.press('Meta+k'),
    float: ['dialog[open].fd'], rows: '.fd-r', unevenRows: true,
    keepsWidth: true, faces: { 'a tag': 'dialog[open].fd .fd-choices .lk-ch:first-child .lk-view' }, faceWant: { 'a tag': serif },
    after: async (b, H) => H.reset() },
  { name: 'find-window-typing', graph: ILL, says: 'typing in the Find window', typing: true, ms: 1400,
    setup: async (b, H) => { await H.go(WRITING); await b.page.keyboard.press('Meta+k'); await H.sleep(1200); },
    input: async b => b.page.keyboard.type('report', { delay: 80 }),
    float: ['dialog[open].fd'], rows: '.fd-r', after: async (b, H) => H.reset() },
  // Making a property, the owner's five pictures of 24 November 2026: the list under "+ Add property", a new name typed into it,
  // and "Choose tag" after the type Node. Each hangs from "+ Add property"; the name made is taken out again after each run.
  { name: 'property-list', graph: ILL, says: 'the list of properties, from “+ Add property” on a page',
    setup: async (b, H) => { await H.go('Dr. Mei Chen'); },
    anchor: { sel: '.ls-new-property button', text: 'Add property' }, input: async (b, H) => H.addProperty(),
    float: PROPERTY, rows: '.menu-link-wrap', still: ['.ls-page-properties .property-pair', '.th-two-way .th-tw-name'],
    faces: { 'a property’s name': `${PROPERTY[0]} .menu-link span[title*="property/"]` }, faceWant: { 'a property’s name': mono },
    after: async (b, H) => H.reset() },
  { name: 'property-name-typing', graph: ILL, says: 'typing a new property’s name into that list', typing: true, ms: 1700,
    setup: async (b, H) => { await H.go('Dr. Mei Chen'); await H.addProperty(); await H.sleep(900); },
    input: async b => b.page.keyboard.type(MADE, { delay: 80 }),
    float: PROPERTY, rows: '.menu-link-wrap', after: async (b, H) => H.reset() },
  { name: 'property-choose-tag', graph: ILL, says: '“Choose tag”, after a new property is given the type Node', ms: 1100,
    setup: async (b, H) => { await H.go('Dr. Mei Chen'); await H.unmake(MADE); await H.addProperty(); await H.sleep(900); await b.page.keyboard.type(MADE, { delay: 30 }); await H.sleep(800); await b.page.keyboard.press('Enter'); await H.sleep(1000); },
    anchor: { sel: '.ls-new-property button', text: 'Add property' }, input: async b => b.page.locator('.ui__select-content').getByText('Node', { exact: true }).click(),
    float: PROPERTY, rows: '.menu-link-wrap', unevenRows: true, still: ['.ls-page-properties .property-pair'],
    faces: { 'a tag': `${PROPERTY[0]} #ui__ac-inner > .menu-link-wrap:not(.st-vplain) .menu-link` }, faceWant: { 'a tag': serif },
    after: async (b, H) => { await H.reset(); await H.unmake(MADE); } },
];

module.exports = FLOWS;
module.exports.helpers = helpers;
module.exports.anchorRect = anchorRect;
