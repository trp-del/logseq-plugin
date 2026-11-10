/* A bullet that is also a page: the one key (Cmd-; as it comes; the setting "Keys for making the bullet a page").

   The bullet's words are the page's name. With no page by that name the bullet becomes the page, by Logseq's own Page tag: it stays in the
   outline, its children are the page's, and it is left open, where Logseq folds it, with the cursor in its first child. With a page by that
   name the bullet shows that page, as Logseq's own Node embed does, with the page's children under it; its words stay in the graph. Either way the words read as a link,
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
const retype = (box, words) => window.PluginDoor.screen.insert(box, words);

// The bullet becomes the page by #Page typed in its words, which Logseq turns into the tag as the bullet is left: its API refuses that tag. Logseq folds a
// bullet as it gets the tag, so it is opened again once the tag has landed.
async function becomePage(box, uuid, name) {
  const tag = await pageTagUuid();
  retype(box, `${name} #Page`);
  await logseq.Editor.exitEditingMode();
  await sleep(400);
  await logseq.Editor.setBlockCollapsed(uuid, false);
  const block = await logseq.Editor.getBlock(uuid, { includeChildren: true });
  const child = block?.children?.[0]?.uuid || (await window.PluginDoor.write.insertBlock(uuid, '', { sibling: false }))?.uuid;
  if (tag) P.rememberUndo(uuid, uuid, [{ kind: 'tag', ident: 'block/tags', ids: [tag], tag: { title: 'Page' }, shown: '#Page' }], () => db.removeTag(uuid, tag));
  if (child) await logseq.Editor.editBlock(child);
}

/* The bullet shows a page that exists: Logseq's Node embed is the bullet's link to the page, and the door sets it in one write
   (10 November 2026). Until then the bullet's words were emptied in the graph and Logseq's menus driven by keys, and for those
   seconds the words lived only in memory. Now the words are never touched: they stay in the graph under the page shown, and
   the faded arrow takes the page off the bullet again, only while the bullet still shows that page. */
// Logseq draws a bullet that shows a page under the page's id and keeps the bullet's own as originalblockid.
const lineOf = uuid => { const row = host().querySelector(`.ls-block[originalblockid="${uuid}"], .ls-block[blockid="${uuid}"]`); return row && (row.querySelector('.block-title-wrap') || row); };
const shownIn = async uuid => (await db.dsQuery(`[:find ?l :where [?b :block/uuid #uuid "${uuid}"] [?b :block/link ?l]]`))[0]?.[0] ?? null;
async function showPage(uuid, page) {
  await logseq.Editor.exitEditingMode();
  if (page?.id == null) return notify(`“${page?.title || 'The page'}” could not be found to show here.`, 'warning');
  await window.PluginDoor.write.showPage(uuid, page.id);
  if (await shownIn(uuid) !== page.id) return notify(`“${page.title}” could not be shown here.`, 'warning');
  window.PluginDoor.undo.offer({ owner: 'predictive', key: `predictive:here:${uuid}`, at: () => lineOf(uuid), node: uuid, text: `“${page.title}” shown in this bullet`,
    run: async () => { if (await shownIn(uuid) !== page.id) return notify('The bullet has changed since, so it stays', 'warning'); await window.PluginDoor.write.unshowPage(uuid); },
    onFail: error => { warnOnce('the page could not be taken off the bullet again', error); notify('The page could not be taken off the bullet again', 'warning'); } });
}

async function make(box) {
  const uuid = app.uuidOf(box), name = nameIn(box.value);
  if (!name) return notify('Write the page’s name in the bullet first.');
  if (!canName(name)) return notify('A page’s name cannot hold a link.', 'warning');
  const [page] = await db.pagesNamed([name.toLowerCase()]);
  if (page?.uuid === uuid) return;
  if (page) return showPage(uuid, page);
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
  if (!words || event.target.closest('a, button, .lk-undo') || !words.closest(PAGE_ROW)) return;   // the Undo arrow at the end of the words is its own press
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
