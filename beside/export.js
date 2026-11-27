/* BESIDE: export. A page, or some bullets, taken out of Logseq as a printed page (PDF) or as Markdown, in the export window
   of the old plugin, which the owner chose again on 26 November 2026 ("Keep md export and a simple paper template, still
   with the editing therer"). It reads the notes and never changes them. What is written is decided in core/export.js, drawn
   by core/paper.js (the one paper template) and core/markdown.js.
   The window: a quiet bar with the column's icon, the two destinations, and the button that does the export; a column of
   choices beside the preview (put away until asked for); the preview itself, the sheets as they will print or the Markdown as
   text, where a press in the words changes them for this export only. Every choice is remembered. */
(function () {
const G = window.PluginDoor, E = G.export;
const DRAWN_AGAIN = 'The sheet was drawn again from the page, so the words changed in it went';
const read = () => E.choices(G.setting('exportChoices'));
const today = () => G.days.number(new Date());
const why = error => error?.message || 'Logseq refused';

const CSS = `
.lk-xp { position: fixed; inset: 0; z-index: 9998; display: flex; flex-direction: column; background: var(--lk-paper); color: var(--lk-text); font-size: var(--lk-line-size); line-height: var(--lk-line-lead); outline: none; pointer-events: auto; -webkit-app-region: no-drag; }
.lk-xp * { box-sizing: border-box; }
.lk-xp[hidden], .lk-xp [hidden] { display: none !important; }
.lk-xp-what { display: flex; align-items: center; justify-content: center; flex: none; font-size: var(--lk-small); color: var(--lk-quiet); }
.lk-xp-bar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; flex: none; padding: 4px 20px 14px; }
.lk-xp-tabs { display: flex; gap: 24px; margin-left: 16px; }
.lk-xp-end { display: flex; align-items: center; gap: 12px; margin-left: auto; }
.lk-xp-bar .lk-xp-column[aria-pressed="true"] { background: var(--lk-wash); }
.lk-xp-bar .lk-xp-icon { padding: 5px 6px; }
.lk-xp-body { display: flex; flex: 1; min-height: 0; }
.lk-xp-side { flex: none; width: min(300px, 40vw); overflow-y: auto; padding: 0 12px 28px; border-right: 1px solid var(--lk-hair); }
.lk-xp-group + .lk-xp-group:not([hidden]), .lk-xp-group[hidden] + .lk-xp-group { margin-top: 20px; }
.lk-xp-head { padding: 0 8px 2px; font-weight: 600; }
.lk-xp-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: var(--lk-line-h); margin: 0; padding: 3px 8px; border: 0; border-radius: var(--lk-corner); background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.lk-xp-row:hover, .lk-xp-row:focus-visible, .lk-xp-row:focus-within { background: var(--lk-wash); outline: none; }
.lk-xp-value { display: inline-flex; align-items: center; min-height: var(--lk-line-lead); color: var(--lk-quiet); white-space: nowrap; }
label.lk-xp-row { cursor: text; }
.lk-xp-row > .lk-field { flex: 0 1 11em; width: 11em; min-width: 3em; height: auto; margin: 0; padding: 0; border: 0; border-bottom: 1px solid var(--lk-hair); border-radius: 0; background: none; box-shadow: none; outline: 0; color: inherit; font: inherit; text-align: right; }
.lk-xp-row > .lk-field:focus { border-bottom-color: var(--lk-line); box-shadow: none; }
.lk-xp-row > .lk-field::placeholder { color: var(--lk-off); }
.lk-xp-whose { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 0 0 8px; color: var(--lk-quiet); font-size: var(--lk-small); }
.lk-xp-whose .lk-btn { color: var(--lk-text); }
.lk-xp-prop { display: flex; align-items: center; gap: 8px; min-height: var(--lk-line-h); margin: 0; padding: 2px 8px; border-radius: var(--lk-corner); cursor: pointer; }
.lk-xp-prop:hover { background: var(--lk-wash); }
.lk-xp-prop > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--lk-prop-face); font-weight: var(--lk-prop-weight); font-size: var(--lk-prop-size); letter-spacing: -.01em; }
.lk-xp-desk { flex: 1; min-width: 0; overflow: auto; padding: 12px 24px 48px; background: var(--lk-wash); }
.lk-xp-zoom { display: flex; justify-content: flex-end; padding: 0 0 12px; }
.lk-xp-zoom .lk-btn { font-size: var(--lk-small); }
.lk-xp-desk > iframe { display: block; margin: 0 auto; width: 794px; max-width: none; height: 600px; border: 0; color-scheme: light; background: transparent; }
.lk-xp-desk > iframe.lk-xp-text { background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.12), 0 10px 36px rgba(0,0,0,.22); }
.lk-xp-desk > iframe.lk-xp-coming { position: absolute; visibility: hidden; pointer-events: none; left: -10000px; }`;

const lookOf = chosen => ({ paper: chosen.paper, margins: chosen.margins, size: chosen.size, footer: chosen.footer, pageNumbers: chosen.pageNumbers });
const optionsOf = (sheet, chosen) => E.options(sheet, chosen, today());
const markdown = (sheet, chosen) => G.markdown.sheet(sheet, optionsOf(sheet, chosen));
async function paperBody(sheet, chosen) {
  const files = E.everything(sheet).flatMap(node => [node.image?.file, node.highlight?.area]).filter(Boolean);
  return G.paper.html(sheet, { ...optionsOf(sheet, chosen), picture: await G.touch.pictures(files) });
}
const titleOf = sheet => E.fileName(sheet);
const print = async (sheet, chosen, body) => G.touch.print(G.paper.page(body ?? await paperBody(sheet, chosen), lookOf(chosen), titleOf(sheet)));
const copy = async text => { const done = await G.touch.copy(text); G.say(done ? 'Copied as Markdown' : 'The clipboard could not be reached', done ? 'success' : 'warning'); return done; };

// What was asked for, read: { sheet, what }, or null with the reason said.
async function gather(asked) {
  const sheet = await G.read.sheet(await G.read.chosen(asked), G.touch.queryShown);
  if (!sheet) { G.say('Open a page first', 'warning'); return null; }
  if (!E.everything(sheet).length && !sheet.title) { G.say('There is nothing to export here', 'warning'); return null; }
  return { sheet, what: sheet.kind === 'page' ? 'this page' : sheet.nodes.length > 1 ? `${sheet.nodes.length} bullets` : 'this bullet' };
}

let shut = null;   // closes the window that stands
function open(sheet, what) {
  shut?.();
  const doc = G.host(), win = doc.defaultView, esc = G.esc, icon = (name, size = 16) => G.touch.icon(name, size);
  let chosen = read(), busy = false, gone = false, drawing = 0, timer = 0, again = 0, frame = null;
  const edits = {};   // for each destination, the words as changed in the preview: { key, value }
  const root = doc.createElement('div');
  root.className = 'lk-xp'; root.tabIndex = -1; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', `Export ${what}`);
  const offered = key => E.OFFERED[key];
  const pick = (key, name) => `<button type="button" class="lk-xp-row" data-pick="${key}" aria-haspopup="menu"><span>${name}</span><span class="lk-xp-value"></span></button>`;
  const turn = (key, name) => `<button type="button" class="lk-xp-row" data-switch="${key}" role="checkbox"><span>${name}</span><span class="lk-xp-value"></span></button>`;
  const field = (key, name, value) => `<label class="lk-xp-row"><span>${name}</span><input type="text" class="lk-field" data-field="${key}" value="${esc(value)}" placeholder="None" spellcheck="false" autocomplete="off"></label>`;
  const group = (name, rows, target = '') => `<div class="lk-xp-group" role="group" aria-label="${name}"${target ? ` data-for="${target}"` : ''}><div class="lk-xp-head">${name}</div>${rows}</div>`;
  const blocks = sheet.kind === 'blocks';
  const lists = [['hiddenHead', 'head', blocks ? (sheet.nodes.length > 1 ? 'Properties of the bullets chosen' : 'Properties of the bullet chosen') : 'Properties of the page'],
    ['hiddenNodes', 'nodes', blocks ? 'Properties of those under' : 'Properties of the nodes']].map(([key, role, name]) => ({ key, role, name, properties: E.propertiesIn(sheet, role) })).filter(list => list.properties.length);
  const list = ({ key, role, name, properties }) => `<div class="lk-xp-whose"><span>${name}</span><span><button type="button" class="lk-btn lk-low" data-all="1" data-list="${key}">all</button><button type="button" class="lk-btn lk-low" data-all="0" data-list="${key}">none</button></span></div>${properties.map(p =>
    `<label class="lk-xp-prop"><input type="checkbox" class="lk-tick" data-list="${key}" value="${esc(p.ident)}"${E.leftOut(sheet, role, chosen).includes(p.ident) ? '' : ' checked'}><span title="${esc(p.name)}">${esc(p.name)}</span></label>`).join('')}`;
  const titles = E.lines(chosen, sheet);
  root.innerHTML = `<div class="lk-xp-what" style="height:${G.touch.dragBand()}px">Export ${esc(what)}</div>
<div class="lk-xp-bar" role="toolbar" aria-label="Export">
  <button type="button" class="lk-btn lk-low lk-xp-icon lk-xp-column" title="Show or hide the choices" aria-label="The choices">${icon('layout-sidebar')}</button>
  <span class="lk-xp-tabs" role="tablist" aria-label="Export as">${offered('target').map(([key, name]) => `<button type="button" class="lk-tab" role="tab" data-kind="" data-target="${key}">${name}</button>`).join('')}</span>
  <span class="lk-xp-end"><button type="button" class="lk-btn" data-do="md-file" data-for="md">Save as file…</button><button type="button" class="lk-accent" data-do="md" data-for="md" title="⌘↩">Copy Markdown</button><button type="button" class="lk-accent" data-do="pdf" data-for="pdf" title="⌘↩">Save PDF…</button><button type="button" class="lk-btn lk-low lk-xp-icon" data-do="close" title="Close (Esc)" aria-label="Close">${icon('x')}</button></span>
</div>
<div class="lk-xp-body">
  <div class="lk-xp-side">
    ${group('Page', pick('text', 'Layout') + pick('paper', 'Paper') + pick('margins', 'Margins') + pick('size', 'Text size') + turn('pageNumbers', 'Page numbers') + field('footer', 'Footer', chosen.footer), 'pdf')}
    ${group('Markdown', pick('links', 'Links') + turn('frontMatter', 'Front matter'), 'md')}
    ${sheet.title ? group('Title', turn('titleDate', 'Today’s date') + field('kicker', 'Line above', titles.kicker) + field('subtitle', 'Subtitle', titles.subtitle) + field('preparedBy', 'Prepared by', chosen.preparedBy)) : ''}
    ${group('Show', turn('tags', 'Tags') + turn('tasks', 'Task marks') + lists.map(list).join(''))}
  </div>
  <div class="lk-xp-desk"><div class="lk-xp-zoom"><button type="button" class="lk-btn lk-low" data-pick="zoom" aria-haspopup="menu" title="How large the preview is drawn"></button></div></div>
</div>`;
  doc.body.appendChild(root);
  const q = selector => root.querySelector(selector), desk = q('.lk-xp-desk');
  const remember = () => { const words = JSON.stringify(chosen); if (words !== G.setting('exportChoices')) { try { G.touch.keep({ exportChoices: words }); } catch (error) { console.warn('Logseq Plugin: the export’s choices could not be kept', error); } } };
  // What decides the words in the preview. Anything else (the paper, the footer, the size) leaves changed words where they are.
  const keyOf = target => JSON.stringify([chosen.tags, chosen.tasks, chosen.hiddenHead, chosen.hiddenNodes, chosen.askedHead, chosen.askedNodes, E.lines(chosen, sheet), chosen.titleDate, chosen.preparedBy, target === 'md' ? [chosen.links, chosen.frontMatter] : chosen.text]);
  const changed = target => edits[target]?.key === keyOf(target) ? edits[target].value : null;

  function describe() {
    for (const el of root.querySelectorAll('[data-for]')) el.hidden = el.dataset.for !== chosen.target;
    for (const tab of root.querySelectorAll('[data-target]')) { const on = tab.dataset.target === chosen.target; tab.classList.toggle('on', on); tab.setAttribute('aria-selected', String(on)); }
    for (const el of root.querySelectorAll('[data-pick]')) { const name = offered(el.dataset.pick).find(([key]) => key === chosen[el.dataset.pick])[1];
      if (el.dataset.pick === 'zoom') el.innerHTML = `${esc(name)}${icon('chevron-down', 14)}`; else el.lastElementChild.textContent = name; }
    for (const el of root.querySelectorAll('[data-switch]')) { const on = chosen[el.dataset.switch]; el.setAttribute('aria-checked', String(on)); el.lastElementChild.innerHTML = on ? icon('check', 14) : ''; }
    q('.lk-xp-side').hidden = !chosen.side; q('.lk-xp-column').setAttribute('aria-pressed', String(chosen.side));
  }
  // The preview's size: the sheet at its true size, larger, or shrunk to the window when that is narrower.
  function fit() {
    if (!frame) return;
    const wide = parseFloat(frame.style.width) || 794, room = desk.clientWidth - 48;
    frame.style.zoom = chosen.zoom === 'fit' ? String(Math.min(1, room / wide)) : String(Number(chosen.zoom) / 100);
    try { const inner = frame.contentDocument; frame.style.height = Math.max(600, inner.body.getBoundingClientRect().height + 2) + 'px'; } catch (error) { /* keeps its height */ }
  }
  /* The preview is drawn in a frame of its own, unseen, and takes the old one's place once it is laid out, so the desk never
     stands empty between two drawings. */
  async function draw() {
    const run = ++drawing, target = chosen.target, now = { ...chosen }, key = keyOf(target), text = target === 'md';
    if (edits[target] && edits[target].key !== key) { delete edits[target]; G.say(DRAWN_AGAIN, 'warning'); }
    const kept = changed(target);
    const html = text ? `<!doctype html><html><head><meta charset="utf-8"><style>:root{color-scheme:light}html,body{margin:0;background:#fff;color:#111}body{padding:56px 64px}pre{margin:0;font:13px/1.55 Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-word;outline:none}</style></head><body><pre contenteditable="plaintext-only" spellcheck="false">${esc(kept ?? markdown(sheet, now))}</pre></body></html>`
      : G.paper.page(kept ?? await paperBody(sheet, now), lookOf(now), titleOf(sheet));
    if (gone || run !== drawing) return;
    const next = doc.createElement('iframe'); next.title = 'Preview'; next.className = `lk-xp-coming${text ? ' lk-xp-text' : ''}`;
    next.style.width = `${text ? 794 : G.paper.sizes(lookOf(now)).width + 40}px`;
    next.onload = async () => {
      const inner = next.contentDocument;
      if (!inner.querySelector(text ? 'pre' : '.x-doc, .sheet')) return;   // the empty page a frame starts with
      if (!text) { inner.body.contentEditable = 'true'; inner.body.spellcheck = false; await G.touch.settled(inner); }
      if (gone || run !== drawing) { next.remove(); return; }
      if (!text) G.sheets.paginate(inner, lookOf(now));   // pictures first, so their height is known
      inner.addEventListener('input', () => {
        edits[target] = { key, value: text ? inner.querySelector('pre').innerText : G.sheets.gather(inner).innerHTML };
        clearTimeout(again);
        if (!text) again = setTimeout(() => { if (frame === next) { G.sheets.repaginate(inner, lookOf(chosen)); fit(); } }, 600);   // the sheets dealt again once writing pauses
        fit();
      });
      inner.addEventListener('keydown', event => { if (!keys(event)) event.stopPropagation(); }, true);
      inner.addEventListener('pointerdown', () => doc.querySelector('.lk-menu') && doc.body.dispatchEvent(new win.PointerEvent('pointerdown', { bubbles: true })));
      frame?.remove(); frame = next; next.classList.remove('lk-xp-coming');
      fit(); setTimeout(() => { if (frame === next) fit(); }, 300);
    };
    for (const old of desk.querySelectorAll('.lk-xp-coming')) old.remove();
    next.srcdoc = html;
    desk.appendChild(next);
  }
  const refresh = () => { describe(); clearTimeout(timer); timer = setTimeout(() => draw().catch(error => { console.error('Logseq Plugin: the preview could not be drawn', error); G.say(`The preview could not be drawn: ${why(error)}`, 'warning'); }), 150); };
  const take = change => { chosen = { ...chosen, ...change }; remember(); refresh(); };

  async function go(action) {
    if (busy || gone) return;
    busy = true; remember();
    let done = false;
    try {
      if (action === 'md') done = await copy(changed('md') ?? markdown(sheet, chosen));
      else if (action === 'md-file') {
        const saved = await G.touch.save(`${titleOf(sheet)}.md`, changed('md') ?? markdown(sheet, chosen), chosen.folder);
        if (saved) { chosen = { ...chosen, folder: saved.folder }; remember(); G.say(`Saved ${saved.path}`, 'success'); done = true; }
      } else {
        const body = changed('pdf');
        root.hidden = true;   // the print window takes its place; it does not say whether it saved, so the export window comes back
        await print(sheet, chosen, body);
      }
    } catch (error) { console.error(error); G.say(`The export stopped: ${why(error)}. Your notes were not changed.`, 'warning'); }
    busy = false;
    if (done) close(); else if (!gone) { root.hidden = false; root.querySelector(`.lk-accent[data-do="${chosen.target}"]`)?.focus({ preventScroll: true }); fit(); }
  }
  // Escape closes the window, Cmd-Enter does the export; true when the key was one of them.
  function keys(event) {
    if (root.hidden) return false;
    if (event.key === 'Escape') close();
    else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) go(chosen.target);
    else return false;
    event.preventDefault(); event.stopImmediatePropagation();
    return true;
  }
  const onKey = event => { if (!event.target.closest?.('.lk-menu')) keys(event); };   // a menu open over the window lets itself go first
  function close() {
    if (gone) return;
    remember(); gone = true; clearTimeout(timer); clearTimeout(again);
    win.removeEventListener('keydown', onKey, true); win.removeEventListener('resize', fit);
    root.remove(); if (shut === close) shut = null;
  }
  shut = close;
  win.addEventListener('keydown', onKey, true); win.addEventListener('resize', fit);
  // Keys pressed in the window stay in it: Logseq's own shortcuts never see them.
  for (const type of ['keydown', 'keyup', 'keypress']) root.addEventListener(type, event => event.stopPropagation());
  root.addEventListener('click', event => {
    const press = event.target.closest('button');
    if (!press) return;
    if (press.dataset.do === 'close') close();
    else if (press.dataset.do) go(press.dataset.do);
    else if (press.dataset.target) take({ target: press.dataset.target });
    else if (press.dataset.switch) take({ [press.dataset.switch]: !chosen[press.dataset.switch] });
    else if (press.dataset.pick) {
      const key = press.dataset.pick, at = (press.querySelector('.lk-xp-value') || press).getBoundingClientRect();
      G.menu({ x: at.left, y: at.bottom, from: press }, offered(key).map(([value, word]) => ({ word, on: chosen[key] === value, take: () => { if (key === 'zoom') { chosen = { ...chosen, zoom: value }; remember(); describe(); fit(); } else take({ [key]: value }); press.focus({ preventScroll: true }); } })));
    } else if (press.dataset.all) {
      const boxes = [...root.querySelectorAll(`input[data-list="${press.dataset.list}"]`)];
      for (const box of boxes) box.checked = press.dataset.all === '1';
      boxed(press.dataset.list);
    } else if (press.classList.contains('lk-xp-column')) { chosen = { ...chosen, side: !chosen.side }; remember(); describe(); fit(); }
  });
  // The boxes of one list as they now stand, kept (core/export.js says what of it is remembered).
  function boxed(key) {
    const ticked = [...root.querySelectorAll(`input[data-list="${key}"]`)].filter(box => box.checked).map(box => box.value);
    take(E.ticks(sheet, lists.find(one => one.key === key).role, chosen, ticked));
  }
  root.addEventListener('change', event => { if (event.target.dataset.list) boxed(event.target.dataset.list); });
  root.addEventListener('input', event => {
    const key = event.target.dataset?.field;
    if (!key) return;
    if (key === 'kicker' || key === 'subtitle') chosen = E.withLines(chosen, sheet, { ...E.lines(chosen, sheet), [key]: event.target.value });
    else chosen = { ...chosen, [key]: event.target.value };
    refresh();
  });
  // In the column Up and Down walk the rows, as in a menu.
  q('.lk-xp-side').addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const rows = [...q('.lk-xp-side').querySelectorAll('button, input')].filter(el => el.offsetParent);
    const next = rows[rows.indexOf(event.target) + (event.key === 'ArrowDown' ? 1 : -1)];
    if (next) { event.preventDefault(); next.focus(); }
  });
  describe(); refresh();
  root.querySelector(`.lk-accent[data-do="${chosen.target}"]`)?.focus({ preventScroll: true });
}

async function show(asked) {
  try { const found = await gather(asked); if (found) open(found.sheet, found.what); }
  catch (error) { console.error(error); G.say(`The export stopped: ${why(error)}. Your notes were not changed.`, 'warning'); }
}
// The quick ways: the remembered choices, no window.
async function quick(action) {
  try {
    const found = await gather();
    if (!found) return;
    if (action === 'md') await copy(markdown(found.sheet, read())); else await print(found.sheet, read());
  } catch (error) { console.error(error); G.say(`The export stopped: ${why(error)}. Your notes were not changed.`, 'warning'); }
}

G.part({
  key: 'export', title: 'Export', about: 'A page, or some bullets, out as a printed page (PDF) or as Markdown: Export… in the command palette, or PDF or Markdown… on a bullet’s or a page’s menu.',
  start(base) {
    base.style('export', CSS);
    G.touch.command('lk-export-page', 'Export: this page…', () => show());
    G.touch.command('lk-export-bullets', 'Export: the selected bullets…', () => show({ blockFirst: true }));
    G.touch.command('lk-export-md', 'Export: copy this page as Markdown', () => quick('md'));
    G.touch.command('lk-export-pdf', 'Export: save this page as PDF', () => quick('pdf'));
    G.touch.menuItem('PDF or Markdown…', asked => show(asked));
    base.onStop(G.touch.graphChanged(() => shut?.()));
    base.onStop(() => shut?.());
  },
});
})();
