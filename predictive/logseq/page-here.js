/* A bullet that is also a page: the one key (Cmd-; as it comes; the setting "Keys for making the bullet a page").

   The bullet's words are the page's name. With no page by that name the bullet becomes the page, by Logseq's own Page tag: it stays in the
   outline, its children are the page's, and it is left open, where Logseq folds it, with the cursor in its first child. With a page by that
   name the bullet shows that page, by Logseq's own Node embed, with the page's children under it. Either way the words read as a link,
   and a press on them opens the page. */
(function () {
const Flow = (window.Flow ||= {});
const { app, db } = Flow;
const { setting, host, warnOnce, notify } = app;
const P = Flow.proposeUi;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const nameIn = words => String(words).trim().replace(/^\[\[(.+)\]\]$/, '$1').trim();
const canName = name => !!name && !/\[\[|\]\]|\n/.test(name);
const pageTagUuid = async () => String((await db.dsQuery('[:find ?u :where [?t :db/ident :logseq.class/Page] [?t :block/uuid ?u]]'))[0]?.[0] ?? '');
const rows = () => [...host().querySelectorAll('#ui__ac .menu-link, .ui__popover-content .menu-link, [data-editor-popup-ref] .menu-link')];
async function rowFor(matches, patience = 2500) {
  for (const began = Date.now(); Date.now() - began < patience; await sleep(60)) { const row = rows().find(matches); if (row) return row; }
  return null;
}
function retype(box, words) {
  box.focus(); box.setSelectionRange(0, box.value.length);
  let typed = false;
  try { typed = box.ownerDocument.execCommand('insertText', false, words); } catch (error) { typed = false; }
  if (typed) return;
  box.setRangeText(words, 0, box.value.length, 'end');
  box.dispatchEvent(new box.ownerDocument.defaultView.InputEvent('input', { bubbles: true, inputType: 'insertText', data: words }));
}

// The bullet becomes the page by #Page typed in its words, which Logseq turns into the tag as the bullet is left: its API refuses that tag. Logseq folds a
// bullet as it gets the tag, so it is opened again once the tag has landed.
async function becomePage(box, uuid, name) {
  const tag = await pageTagUuid();
  retype(box, `${name} #Page`);
  await logseq.Editor.exitEditingMode();
  await sleep(400);
  await logseq.Editor.setBlockCollapsed(uuid, false);
  const block = await logseq.Editor.getBlock(uuid, { includeChildren: true });
  const child = block?.children?.[0]?.uuid || (await logseq.Editor.insertBlock(uuid, '', { sibling: false }))?.uuid;
  if (tag) P.rememberUndo(uuid, uuid, [{ kind: 'tag', ident: 'block/tags', ids: [tag], tag: { title: 'Page' }, shown: '#Page' }], () => db.removeTag(uuid, tag));
  if (child) await logseq.Editor.editBlock(child);
}

// The bullet shows a page that exists, through Logseq's own Node embed, its rows pressed as a person would: its list opens only on a key. Anything but
// the very page in the list: the words go back.
function typeKey(box, letter) {
  const win = box.ownerDocument.defaultView, key = type => box.dispatchEvent(new win.KeyboardEvent(type, { key: letter, keyCode: letter === '/' ? 191 : 0, which: letter === '/' ? 191 : 0, bubbles: true, cancelable: true }));
  key('keydown');
  box.ownerDocument.execCommand('insertText', false, letter);
  key('keyup');
}
function press(row) {
  const win = row.ownerDocument.defaultView;
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'])
    row.dispatchEvent(new (type.startsWith('pointer') && win.PointerEvent ? win.PointerEvent : win.MouseEvent)(type, { bubbles: true, cancelable: true, view: win, button: 0, buttons: type.endsWith('down') ? 1 : 0, pointerType: 'mouse', isPrimary: true }));
}
async function putBack(uuid, words) {
  host().activeElement?.dispatchEvent(new (host().defaultView.KeyboardEvent)('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
  await logseq.Editor.exitEditingMode();
  await logseq.Editor.updateBlock(uuid, words);
}
// Logseq puts an embed in the bullet only if the bullet is empty, and under it otherwise, so the words go first. They come back
// whatever goes wrong on the way (8 November 2026): a step that stops or throws puts them back before it says so.
async function showPage(box, uuid, name) {
  const words = box.value, lower = name.toLowerCase();
  await logseq.Editor.exitEditingMode();
  await logseq.Editor.updateBlock(uuid, '');
  try {
    await logseq.Editor.editBlock(uuid);
    await sleep(250);
    const empty = host().activeElement;
    if (!app.isBlockBox(empty) || app.uuidOf(empty) !== uuid) { await putBack(uuid, words); return notify('The bullet could not be opened to show the page.', 'warning'); }
    typeKey(empty, '/');
    const command = await rowFor(row => row.innerText.trim() === 'Node embed');
    if (!command) { await putBack(uuid, words); return notify('Logseq’s Node embed did not open.', 'warning'); }
    press(command);
    await sleep(300);
    for (const letter of name) typeKey(empty, letter);
    const row = await rowFor(row => row.innerText.trim().split('\n').pop().trim().toLowerCase() === lower);
    if (!row) { await putBack(uuid, words); return notify(`“${name}” could not be found to show here.`, 'warning'); }
    press(row);
    await sleep(300);
    await logseq.Editor.exitEditingMode();
  } catch (error) {
    await putBack(uuid, words).catch(() => {});
    throw error;
  }
}

async function make(box) {
  const uuid = app.uuidOf(box), name = nameIn(box.value);
  if (!name) return notify('Write the page’s name in the bullet first.');
  if (!canName(name)) return notify('A page’s name cannot hold a link.', 'warning');
  const [page] = await db.pagesNamed([name.toLowerCase()]);
  if (page?.uuid === uuid) return;
  if (page) return showPage(box, uuid, page.title);
  return becomePage(box, uuid, name);
}

let busy = false;
function onKey(event) {
  if (event.isComposing || !app.keyMatches(event, setting('pageKeys')) || !app.isBlockBox(event.target) || app.editorPopupOpen()) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (busy) return;
  busy = true;
  make(event.target).catch(error => { warnOnce('the bullet could not be made a page', error); notify('The bullet could not be made a page', 'warning'); }).finally(() => { busy = false; });
}

// A press on the words of a bullet that is a page, or shows one, opens the page; with Shift, in the right sidebar. Its words are changed on the page.
const PAGE_ROW = ':is(.embed-block:not(.embed-block .embed-block) > .block-main-container, .block-main-container:not(.is-page-title-row):has(> .block-control-wrap :is(.ls-icon-file, .ls-icon-page)))';
function onPress(event) {
  const words = event.target?.closest?.('.block-title-wrap');
  if (!words || event.target.closest('a, button') || !words.closest(PAGE_ROW)) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (event.type !== 'click') return;
  const uuid = words.closest('.ls-block[blockid]')?.getAttribute('blockid');
  if (event.shiftKey) logseq.Editor.openInRightSidebar(uuid); else logseq.App.pushState('page', { name: uuid });
}

function start() {
  const win = host().defaultView;
  app.listen(win, ['keydown'], onKey, true);
  app.listen(win, ['pointerdown', 'mousedown', 'mouseup', 'click'], onPress, true);
}
Flow.pageHere = { start, nameIn, canName, showPage };
})();
