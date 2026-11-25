/* Loaded by main.js with the other parts. Kept in its own scope; main.js starts and stops it. */
(() => {
/* The Recycle list of Relations: Logseq's Recycle as a plain list, with Restore and a red Delete, the library's presses, on
   each line; Delete, and Delete all, ask first under their line, the blue yes and Leave it. It changes notes only when one of
   those is pressed. With it, "Open Logseq's Recycle and copy what goes wrong", which shows what Logseq wrote as a report to copy
   (the kit's pop-up with the text and Copy, the library's main button). One entry in Logseq's command list opens the list,
   "Relations: the Recycle list", and so does the button in the settings window.
   The other troubleshooting tools (what the plugin finds on a page, measuring and its report, a bullet's styling details, the
   warnings, the tour) and the Recycle list's own "Copy the list as a report" were taken out on 24 November 2026 at the owner's
   word. This part is layer 1 (it talks to Logseq), so its own Logseq calls stay. */
const shared = window.Threads.shared;
const { host, notify, el, note } = shared;
const base = window.PluginDoor.base('threads', { prefix: 'Relations: ' });
const runUnloadTasks = () => base.stop();
// From the model part, taken when the part starts.
let CHECKED_WITH;

// First line of a report: this plugin's and Logseq's version.
async function versionLine() {
  let logseqVersion = '?';
  try { logseqVersion = (await logseq.App.getInfo('version')) || '?'; } catch (error) { /* ignore */ }
  const note = logseqVersion !== '?' && logseqVersion !== CHECKED_WITH ? ` (the plugin was last checked against Logseq ${CHECKED_WITH})` : '';
  return `Relations ${logseq.baseInfo?.version || '?'} · Logseq ${logseqVersion}${note}`;
}
// A report: the kit's pop-up with the text to copy and one quiet word, Copy (it is copied as it opens, too).
function showDiagnostics(text) {
  const doc = host();
  const pop = shared.popup({ doc, cls: 'th-report', width: 'min(720px, 92vw)', head: 'Report from the plugin. Copy and paste it into your chat.' });
  const area = el(doc, 'textarea', { readonly: true, spellcheck: 'false', 'aria-label': 'The report' });
  area.value = text;
  const hint = note(doc, '');
  const copy = () => {
    area.focus(); area.select();
    let copied = false;
    try { copied = doc.execCommand('copy'); } catch (error) { /* fall through */ }
    hint.textContent = copied ? 'Copied to the clipboard · Esc to close' : 'Press Cmd+C (Ctrl+C) to copy · Esc to close';
  };
  // Copy is the one thing the report is for: the library's main button (lk-accent).
  pop.body.append(area, el(doc, 'div', { class: 'th-btns' }, hint, shared.go(doc, { label: 'Copy', cls: 'lk-i-copy', run: copy })));
  shared.keepKeys(area);
  copy();
  return pop;
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/* The Recycle as a plain list. Logseq's own Recycle page draws every deleted node in full, so one damaged
   node stops the whole page: the owner's graph showed Logseq's "Something went wrong" each time, the plugin off too,
   and Logseq's four repair steps did not help (2026-10-25). This list reads the same nodes as names and dates only,
   marks one that looks damaged, and brings any back with Restore: Logseq's own restore, the one its Recycle page
   uses (restore_page takes a deleted bullet as well as a page). It changes notes only on a
   click. The nodes in the Recycle are the ones with a deletion time; the bullets under one move with it. */
const DELETED_AT = ':logseq.property/deleted-at', ORIGINAL_PAGE = ':logseq.property.recycle/original-page';
const RECYCLE_QUERY = `[:find (pull ?b [:block/uuid :block/title :block/name ${DELETED_AT} {:block/parent [:block/title]} {${ORIGINAL_PAGE} [:block/title ${DELETED_AT}]}]) :where [?b ${DELETED_AT}]]`;
const dayWords = at => window.PluginDoor.dates.words(window.PluginDoor.dates.number(new Date(at)), { year: 'always' });
// Logseq's answer as rows, newest first: { uuid, title, page, at, from, damage: [what looks wrong, in words] }.
function recycleRows(answer) {
  const rows = [];
  for (const [node] of answer || []) {
    if (!node) continue;
    const page = node.name != null, at = Number(node[DELETED_AT]), from = node[ORIGINAL_PAGE];
    const damage = [];
    if (!node.uuid) damage.push('no id, so it cannot be restored');
    if (node.parent?.title !== 'Recycle') damage.push('not under the Recycle');
    if (!Number.isFinite(at) || at <= 0) damage.push('no deletion time');
    if (!String(node.title ?? '').trim()) damage.push('no words');
    if (!page && !from?.title) damage.push('the page it came from is gone');
    else if (!page && from[DELETED_AT] != null) damage.push('the page it came from is deleted too');
    rows.push({ uuid: node.uuid ? String(node.uuid) : '', title: String(node.title ?? '').trim(), page, at: Number.isFinite(at) ? at : 0, from: page ? '' : String(from?.title || ''), damage });
  }
  return rows.sort((a, b) => b.at - a.at);
}
const recycleLine = row => `${row.title || (row.page ? 'a page with no name' : 'a bullet with no words')}${row.from ? ` · from ${row.from}` : ''}`;
async function openRecycleList() {
  let rows;
  try { rows = recycleRows(await logseq.DB.datascriptQuery(RECYCLE_QUERY)); } catch (error) { console.error(error); return notify(`The Recycle could not be read: ${window.PluginDoor.reason(error, 'Logseq did not answer')}`, 'error'); }
  const damaged = rows.filter(row => row.damage.length).length;
  const done = (item, words) => {
    item.done = true;
    const button = [...pop.body.querySelectorAll('.th-item')].find(b => b.item === item);
    if (button) { button.disabled = true; button.classList.add('th-faint'); (button.querySelector('.th-end') || button.appendChild(el(host(), 'span', { class: 'th-end' }))).textContent = words; }
  };
  const restore = async (item, row) => {
    if (item.done || !row.uuid) return 'keep';
    try { await window.PluginDoor.write.restorePage(row.uuid); } catch (error) { console.error(error); notify(`“${recycleLine(row)}” could not be restored: ${window.PluginDoor.reason(error, 'Logseq did not take it. It is still in the Recycle')}`, 'error'); return 'keep'; }
    done(item, 'Restored');
    return 'keep';
  };
  /* The big change asks under what it answers for (the grammar, the owner 1 November): a bold line, what goes, the blue yes
     and "Leave it". It rolls out under the row; the keyboard waits on Leave it, so Enter and Escape leave it and only a press of the yes deletes. One open at a time. */
  let asking = null;
  const leave = () => { const box = asking; asking = null; if (box) window.PluginDoor.rollUp(box).then(() => box.remove()); };
  const askUnder = (item, { head, words, yes, run }) => {
    const doc = host(), row = [...pop.body.querySelectorAll('.th-item')].find(b => b.item === item);
    if (!row) return;
    leave();
    const yesPress = el(doc, 'button', { type: 'button', class: 'lk-big', click: event => { event.stopPropagation(); leave(); run(); } }, yes);
    const leavePress = el(doc, 'button', { type: 'button', class: 'lk-btn lk-low lk-i-x lk-enter', click: event => { event.stopPropagation(); leave(); row.focus?.(); } }, 'Leave it');
    const box = el(doc, 'div', { class: 'th-recycle-ask', role: 'group', 'aria-label': head },
      el(doc, 'div', { class: 'th-recycle-ask-h' }, head), el(doc, 'div', { class: 'th-recycle-ask-l' }, words),
      el(doc, 'div', { class: 'lk-answers' }, yesPress, leavePress));
    box.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); leave(); row.focus?.(); }
      else if (event.key === 'Enter' && event.target === yesPress) { event.preventDefault(); event.stopPropagation(); yesPress.click(); }
      else if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); leavePress.click(); }
    });
    row.after(box);
    asking = box;
    window.PluginDoor.unroll(box);
    leavePress.focus({ preventScroll: true });   // what cannot be undone is only pressed: Enter leaves it (8 November 2026)
    box.scrollIntoView?.({ block: 'nearest' });
  };
  /* Delete for good: Logseq's own, the one its Recycle page's Delete uses (deleteRecycledPagePermanently),
     asked first under the row. Logseq's Recycle page breaks when a node it shows is deleted for good
     ("Missing direct-children parent", seen in the test graph, 2026-10-25), so if it is open behind the list, Logseq
     goes to the journals first. */
  const awayFromRecycle = async win => { if (/^#\/page\/recycle\b/i.test(win.location.hash || '')) { logseq.App.pushState('all-journals'); await sleep(800); } };
  const removeForGood = async (item, row) => {
    if (item.done || !row.uuid) return;
    const win = host().defaultView;
    await awayFromRecycle(win);
    try { await window.PluginDoor.write.deleteForGood(row.uuid); } catch (error) { console.error(error); notify(`“${recycleLine(row)}” could not be deleted: ${window.PluginDoor.reason(error, 'Logseq did not take it. It is still in the Recycle')}`, 'error'); return; }
    done(item, 'Deleted');
  };
  /* Delete all (the owner: "yes I want delete all"): every line not yet restored or deleted, one question for
     all, one after another, each line reading Deleted as it goes; a node Logseq refuses is left and counted. */
  const rowItems = [];
  const removeAll = async allItem => {
    const left = rowItems.filter(([item, row]) => !item.done && row.uuid);
    if (!left.length || allItem.done) return 'keep';
    askUnder(allItem, { head: `Delete all ${left.length} for good`, words: `Every node in the Recycle goes. Undo cannot bring ${left.length === 1 ? 'it' : 'them'} back.`, yes: 'Delete for good', run: () => removeAllNow(allItem, left) });
    return 'keep';
  };
  const removeAllNow = async (allItem, left) => {
    const win = host().defaultView;
    done(allItem, 'Deleting…');
    await awayFromRecycle(win);
    let failed = 0;
    for (const [item, row] of left) {
      if (item.done) continue;
      try { await window.PluginDoor.write.deleteForGood(row.uuid); done(item, 'Deleted'); } catch (error) { console.error(error); failed++; }
    }
    done(allItem, failed ? `${failed} could not be deleted` : 'Done');
    notify(failed ? `Deleted ${left.length - failed} of ${left.length}; ${failed} could not be deleted` : `Deleted all ${left.length} from the Recycle`, failed ? 'warning' : 'success');
    return 'keep';
  };
  // At a row's end, the library's presses for a row (lk-fix): Restore, and Delete in red, which asks under the row first.
  const actions = (item, row) => {
    const doc = host();
    const press = (cls, words, run) => el(doc, 'span', { class: `lk-fix ${cls}`, role: 'button', click: event => { event.preventDefault(); event.stopPropagation(); run(); } }, words);
    return el(doc, 'span', { class: 'lk-strip th-recycle-acts' },
      press('lk-i-undo', 'Restore', () => restore(item, row)),
      press('lk-del', 'Delete', () => { if (!item.done) askUnder(item, { head: `Delete “${recycleLine(row)}” for good`, words: 'Undo cannot bring it back.', yes: 'Delete for good', run: () => removeForGood(item, row) }); }));
  };
  const items = [
    { icon: 'warning', label: 'Open Logseq’s Recycle and copy what goes wrong', run: () => { watchRecycle(); } },
    rows.some(row => row.uuid) ? { icon: 'delete', label: `Delete all ${rows.length} for good`, title: 'Every node in the Recycle, deleted for good after one question under this line (cannot be undone)', keep: true, run: item => removeAll(item) } : null,
    { note: rows.length ? `Deleted nodes, newest first${damaged ? `. ${damaged} look${damaged === 1 ? 's' : ''} damaged (the triangle)` : ''}.` : 'The Recycle is empty.' },
    ...rows.map(row => {
      const item = { icon: row.damage.length ? 'warning' : row.page ? 'page' : 'point', label: recycleLine(row), disabled: !row.uuid,
        title: `Deleted ${row.at ? dayWords(row.at) : 'at an unknown time'}${row.damage.length ? ` · looks damaged: ${row.damage.join('; ')}` : ''}` };
      item.right = row.uuid ? actions(item, row) : 'Restore';
      item.run = () => { restore(item, row); return 'keep'; };
      rowItems.push([item, row]);
      return item;
    }),
  ];
  const pop = shared.popup({ head: `The Recycle · ${rows.length} deleted node${rows.length === 1 ? '' : 's'}`, cls: 'th-recycle', width: 'min(600px, 92vw)', items });
  return pop;
}
/* Logseq's Recycle page opened while the errors Logseq writes are recorded: when it breaks, Logseq writes
   the error to its console (ui.cljs catch-error: log/error :exception) and shows "Something went wrong"; the error is
   what says which node it could not draw, so it is shown as a report to copy, over Logseq's crash screen. Six seconds
   at most; Logseq's console is put back after. It changes nothing in the notes. */
async function watchRecycle() {
  const doc = host(), win = doc.defaultView, seen = [];
  const text = value => { try { return value instanceof win.Error || value instanceof Error ? `${value.message}\n${String(value.stack || '').split('\n').slice(1, 8).join('\n')}` : typeof value === 'string' ? value : JSON.stringify(value)?.slice(0, 600) ?? String(value); } catch (error) { return String(value); } };
  const original = win.console.error;
  win.console.error = (...args) => { try { seen.push(args.map(text).join(' ').slice(0, 1500)); } catch (error) { /* never break the caller */ } return original.apply(win.console, args); };
  const onError = event => seen.push(`uncaught: ${text(event.error || event.message)}`.slice(0, 1500));
  const onRejection = event => seen.push(`unhandled: ${text(event.reason)}`.slice(0, 1500));
  win.addEventListener('error', onError);
  win.addEventListener('unhandledrejection', onRejection);
  const broken = () => /Something went wrong/.test(doc.body.innerText || '');
  try {
    logseq.App.pushState('page', { name: 'recycle' });
    for (let waited = 0; waited < 6000 && !broken(); waited += 250) await sleep(250);
    await sleep(500);
  } finally {
    win.console.error = original;
    win.removeEventListener('error', onError);
    win.removeEventListener('unhandledrejection', onRejection);
  }
  const wanted = seen.filter(line => !/db-worker has not been initialized/.test(line));
  const lines = [await versionLine(), broken() ? 'Logseq’s Recycle broke ("Something went wrong"). What Logseq wrote meanwhile, first to last:' : 'Logseq’s Recycle opened. What Logseq wrote meanwhile, first to last:', ''];
  for (const line of [...new Set(wanted)].slice(0, 12)) lines.push(line, '');
  if (!wanted.length) lines.push('  nothing');
  showDiagnostics(lines.join('\n'));
}

function provide(core) { core.provide({ openRecycleList }); }
function start() {
  ({ CHECKED_WITH } = window.Threads.core.provided); // from the model part
}
function ready() {
  // One palette entry opens the list (registered here since 5 November 2026, when the engine's command register went).
  logseq.App.registerCommandPalette({ key: 'recycle-list', label: 'Relations: the Recycle list' }, () => openRecycleList());
}
/* Foundation only: the plugin runs just its foundation, the engine and the Logseq model (parts/model.js),
   with the Recycle list and the settings window, to see whether a part above it is at fault. The core reads the setting; the parts that stay mark themselves `foundation: true`. */
const settingsSchema = [
  { key: 'troubleshootHeading', type: 'heading', group: 'tools', rank: 4, title: 'Troubleshooting', default: null,
    legend: 'Run only the foundation, to find a fault',
    zone: '<div><span class="m">Foundation only</span> · nothing drawn</div>',
    description: 'For finding a fault in the plugin. The Recycle list is in the command palette under “Relations: the Recycle list”.' },
  { key: 'foundationOnly', type: 'boolean', title: 'Foundation only', default: false,
    description: 'Runs only the plugin’s foundation: the part that watches Logseq and the part that knows what pages, blocks, tags and days are. Nothing is drawn and no shortcut works; the settings window and the Recycle list stay. For seeing whether a part above the foundation is at fault. Applies after you reload the plugin.' },
];
((window.Threads ||= {}).parts ||= []).push({ name: 'diagnostics', says: 'its Recycle list', foundation: true, schema: settingsSchema, provide, start, ready, stop: runUnloadTasks });
})();
