/* DB Export: a page or some blocks of a Logseq DB graph as a PDF, as Markdown, or as rich text on the clipboard.
   Loaded last by loader.js; the core (core/*.js) and the Logseq parts (logseq/*.js) are on window.DbExport. */
(function () {
const E = window.DbExport;
const { doc: D, themes } = E;
const notify = (text, status = 'success') => logseq.UI.showMsg(text, status);   // no options: with a timeout option the notice stayed on screen (seen 2026-10-29)
const today = () => E.dates.dayNumber(new Date());

// Logseq draws a query as a table; its columns and the rows' order on screen are read from the window, when it is drawn.
const host = () => { try { return window.parent.document; } catch (error) { return null; } };
const columnsOf = async uuid => { try { const t = host()?.querySelector(`.ls-block[blockid="${uuid}"] .ls-table`); return t ? [...t.querySelectorAll('.ls-table-header .ls-table-header-cell [title]')].map(e => e.getAttribute('title')).filter(Boolean) : null; } catch (error) { return null; } };
const orderOf = async uuid => { try { const b = host()?.querySelector(`.ls-block[blockid="${uuid}"]`); const t = b?.querySelector('.ls-table'); if (!t) return null;
  const ids = [...new Set([...t.querySelectorAll('[blockid]')].map(e => e.getAttribute('blockid').toLowerCase()))]; const count = Number(b.querySelector('.ls-view-head')?.textContent.match(/\((\d+)\)/)?.[1]);
  return ids.length && ids.length === count ? ids : null; } catch (error) { return null; } };

// What a choice from the window (or the remembered settings) means for each writer.
const allBut = (doc, role, hidden) => hidden?.size ? new Set(D.propertiesIn(doc, role).map(p => p.ident).filter(i => !hidden.has(i))) : null;
const writerOpts = (doc, ch) => ({ layout: ch.layout, tags: ch.tags, tasks: ch.tasks, shownHead: ch.shownHead ?? allBut(doc, 'head', ch.hiddenHead), shownNodes: ch.shownNodes ?? allBut(doc, 'nodes', ch.hiddenNodes),
  dateKey: ch.dated?.dateKey || 'auto', under: ch.dated?.under || '', newestFirst: !!ch.dated?.newestFirst,
  titleBlock: doc.title ? { kicker: ch.kicker || '', subtitle: ch.subtitle || '', date: ch.titleDate ? today() : null, preparedBy: ch.preparedBy || '' } : {} });
const pageOpts = ch => ({ paper: ch.paper, margins: ch.margins, size: ch.size, footer: ch.footer, pageNumbers: ch.pageNumbers, customCss: ch.customCss });

/* The page as HTML with its look: pictures baked in as data URLs, so the preview, the print frame and a saved page all show them. */
async function pageHtml(doc, ch, { extraCss = '', body = null } = {}) {
  const images = await E.files.pictures(doc);
  const html = body ?? E.html.toHtml(doc, { ...writerOpts(doc, ch), images });
  return E.print.pageHtml({ body: html, look: ch.look, page: pageOpts(ch), title: doc.title || 'Export', extraCss });
}
const markdown = (doc, ch) => E.markdown.toMarkdown(doc, { ...writerOpts(doc, ch), links: ch.links, frontMatter: ch.frontMatter });
// What was changed in the window comes back with its class names: each becomes its rule written inline, as the writer would have.
function inlined(body, cls) {
  const page = new window.DOMParser().parseFromString(`<body>${body}`, 'text/html');
  for (const el of page.body.querySelectorAll('[class]')) {
    const names = [...el.classList].filter(name => name.startsWith('x-')).map(name => name.slice(2)).join(' ');
    const style = names ? cls(names).match(/style="(.*)"/)?.[1] : '';
    el.removeAttribute('class');
    if (style) el.setAttribute('style', style + (el.getAttribute('style') || ''));
  }
  return page.body.innerHTML;
}
// Rich text: the same HTML with the look's rules inline (a pasting app ignores stylesheets); the Markdown as its plain form.
async function richText(doc, ch, editedBody) {
  const { cls, root } = themes.inliner(ch.look, pageOpts(ch));
  const images = await E.files.pictures(doc);
  const body = editedBody != null ? inlined(editedBody, cls) : E.html.toHtml(doc, { ...writerOpts(doc, ch), images, cls });
  return { html: `<div style="${root}">${body}</div>`, text: markdown(doc, ch) };
}
const fileName = doc => E.files.fileName(doc.title ? E.inline.words(doc.title) : (E.inline.words(doc.nodes[0]?.text || '').slice(0, 60) || 'Logseq export'));

// editedBody: the preview as the user changed it in the window; the page's HTML, or for the Markdown actions the text.
// False: not finished (a window cancelled), so the export window stays with what was chosen and written in it.
async function act(doc, ch, action, editedBody) {
  if (action === 'rich') { const ok = await E.clipboard.write(await richText(doc, ch, editedBody)); notify(ok ? 'Copied as rich text' : 'Could not reach the clipboard', ok ? 'success' : 'error'); }
  else if (action === 'md') { const ok = await E.clipboard.write({ text: editedBody ?? markdown(doc, ch) }); notify(ok ? 'Copied as Markdown' : 'Could not reach the clipboard', ok ? 'success' : 'error'); }
  else if (action === 'md-file') { const r = await E.files.save(fileName(doc) + '.md', editedBody ?? markdown(doc, ch), 'text/markdown'); if (r.saved) notify(`Saved ${r.path}`); return r.saved; }
  else if (action === 'html-file') { const r = await E.files.save(fileName(doc) + '.html', await pageHtml(doc, ch), 'text/html'); if (r.saved) notify(`Saved ${r.path}`); return r.saved; }
  else if (action === 'pdf') { await E.print.print(await pageHtml(doc, ch, { body: editedBody })); return false; }   // the print window does not say whether it saved, so the export window stays
  return true;
}

/* What to export: the current page, a block from its menu, the selected blocks, or the block being written. */
async function readWhat(event) {
  await E.files.currentGraph();
  const over = { columnsOf, order: orderOf };
  const uuid = typeof event?.uuid === 'string' ? event.uuid : null;
  if (uuid) return { doc: await E.db.readBlocks([uuid], over), what: 'this block' };
  const selected = await Promise.resolve(logseq.Editor.getSelectedBlocks()).catch(() => null);
  if (selected?.length) return { doc: await E.db.readBlocks(selected.map(b => b.uuid), over), what: selected.length > 1 ? `${selected.length} blocks` : 'this block' };
  const current = await Promise.resolve(logseq.Editor.getCurrentBlock()).catch(() => null);
  if (current?.uuid && event?.blockFirst) return { doc: await E.db.readBlocks([current.uuid], over), what: 'this block' };
  const page = event?.page ? await E.db.readPage(event.page, over) : await E.db.readPage(null, over);
  return page ? { doc: page, what: 'this page' } : null;
}
async function exportWindow(event) {
  try {
    const found = await readWhat(event);
    if (!found) return notify('Open a page first', 'warning');
    if (!D.collect(found.doc.nodes).length && !found.doc.title) return notify('Nothing to export here', 'warning');
    await E.ui.open({ doc: found.doc, what: found.what, act: (ch, action, edited) => act(found.doc, ch, action, edited) });
  } catch (error) { console.error(error); notify(`Export stopped: ${error.message}`, 'error'); }
}
// The quick ways: the remembered choices, no window.
async function quick(action, event) {
  try {
    const found = await readWhat(event);
    if (!found) return notify('Open a page first', 'warning');
    const c = E.ui.read();
    const lines = found.doc.title ? (c.titleLines[found.doc.title] || {}) : {};
    await act(found.doc, { ...c, ...lines }, action, null);
  } catch (error) { console.error(error); notify(`Export stopped: ${error.message}`, 'error'); }
}

const settingsSchema = [
  { key: 'exportHeading', type: 'heading', title: 'DB Export', description: 'Export a page or blocks as a PDF, Markdown or rich text: the command palette (Export…), a bullet’s right-click menu, or the page’s … menu. The style, look and page choices are made in the export window and remembered here.' },
  { key: 'target', type: 'enum', enumChoices: ['pdf', 'md', 'rich'], enumPicker: 'radio', default: 'pdf', title: 'Export as', description: 'What the window starts on: a PDF, Markdown, or rich text.' },
  { key: 'layout', type: 'enum', enumChoices: ['document', 'outline', 'timeline', 'calendar'], enumPicker: 'radio', default: 'document', title: 'Style', description: 'The style the window starts on.' },
  { key: 'look', type: 'enum', enumChoices: ['plain', 'book', 'compact', 'typewriter'], enumPicker: 'radio', default: 'plain', title: 'Look', description: 'The look of the PDF and rich text.' },
  { key: 'paper', type: 'enum', enumChoices: ['A4', 'Letter'], enumPicker: 'radio', default: 'A4', title: 'Paper' },
  { key: 'margins', type: 'enum', enumChoices: ['narrow', 'normal', 'wide'], enumPicker: 'radio', default: 'normal', title: 'Margins' },
  { key: 'size', type: 'enum', enumChoices: ['small', 'normal', 'large'], enumPicker: 'radio', default: 'normal', title: 'Text size' },
  { key: 'customCss', type: 'string', inputAs: 'textarea', default: '', title: 'Your own CSS for the PDF', description: 'Added after the look’s rules. The classes are x-title, x-h2, x-p, x-li, x-meta, x-tag, x-quote, x-pre, x-table, x-figure, x-month, x-date… (core/html.js names them). Name static fonts only: the system font (-apple-system, system-ui) prints as outlines, and the PDF’s words can then not be selected.' },
  { key: 'footer', type: 'string', default: '', title: 'PDF footer' },
  { key: 'pageNumbers', type: 'boolean', default: true, title: 'Page numbers' },
  { key: 'showTags', type: 'boolean', default: true, title: 'Show tags' },
  { key: 'taskBoxes', type: 'boolean', default: true, title: 'Task boxes', description: 'Off: a task’s words only.' },
  { key: 'titleDate', type: 'boolean', default: true, title: 'Today’s date under the title' },
  { key: 'preparedBy', type: 'string', default: '', title: 'Prepared by' },
  { key: 'mdLinks', type: 'enum', enumChoices: ['plain', 'wiki', 'file'], enumPicker: 'radio', default: 'plain', title: 'Markdown: page links', description: 'plain: a page’s name as words. wiki: [[Page]]. file: [Page](Page.md).' },
  { key: 'frontMatter', type: 'boolean', default: false, title: 'Markdown: properties as front matter' },
  { key: 'previewZoom', type: 'enum', enumChoices: ['fit', '75', '100', '125', '150'], enumPicker: 'radio', default: 'fit', title: 'Preview size', description: 'fit: shrunk to the window when it is narrower than the sheet; else the sheet at that size, 100 being its true size.' },
  { key: 'hiddenHeadProperties', type: 'object', default: [], title: 'Page properties left out', description: 'The page’s own properties (for blocks, the chosen blocks’) unticked in the export window; change them there.' },
  { key: 'hiddenNodeProperties', type: 'object', default: [], title: 'Node properties left out', description: 'The properties of the nodes under, unticked in the export window.' },
  { key: 'dated', type: 'object', default: { dateKey: 'auto', under: '', newestFirst: false }, title: 'Timeline and calendar dates', description: 'Chosen in the export window.' },
  { key: 'titleLines', type: 'object', default: {}, title: 'Lines above and under each page’s title', description: 'Kept per page from the export window.' },
  { key: 'saveFolder', type: 'string', default: '', title: 'Folder files were last saved in', description: 'The save dialog starts there.' },
];

function main() {
  logseq.App.registerCommandPalette({ key: 'db-export-page', label: 'Export: this page…' }, () => exportWindow());
  logseq.App.registerCommandPalette({ key: 'db-export-blocks', label: 'Export: the selected blocks…' }, () => exportWindow({ blockFirst: true }));
  logseq.App.registerCommandPalette({ key: 'db-export-md', label: 'Export: copy this page as Markdown' }, () => quick('md'));
  logseq.App.registerCommandPalette({ key: 'db-export-pdf', label: 'Export: save this page as PDF' }, () => quick('pdf'));
  logseq.Editor.registerBlockContextMenuItem('Export as PDF or Markdown…', event => exportWindow(event));
  logseq.App.registerPageMenuItem?.('Export as PDF or Markdown…', event => exportWindow({ page: event?.page }));
  logseq.App.onCurrentGraphChanged(() => { E.db.forget(); E.files.forget(); E.ui.sweep(); });
  logseq.DB.onChanged(() => E.db.forget());   // names and days may change; they are cheap to read again
  E.app = { pageHtml, markdown, richText, act, readWhat, exportWindow, quick, settingsSchema };
}
const stop = () => { try { E.ui.sweep(); } catch (error) { /* Logseq's window is gone */ } };   // the window and its stylesheet live in Logseq's document
// Everything else is chosen in the export window, beside the preview that shows it.
window.PluginDoor.describe('export', { schema: [{ type: 'heading', title: 'The PDF' }, { ...settingsSchema.find(item => item.key === 'customCss'), placeholder: '.x-title { letter-spacing: -.01em; }' }] });
window.PluginDoor.register({
  key: 'export', title: 'DB Export', about: 'A page or some blocks out as a PDF, as Markdown or as rich text on the clipboard.',
  schema: settingsSchema, start: main, stop,
});
})();
