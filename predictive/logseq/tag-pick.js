/* Choosing a tag for a bullet that has none, with a key (core/propose.js, tagChoices).

   The key (Option-T as it comes; the setting "Keys for choosing a tag") opens a short list under the bullet: the tags that the pages the line
   names (linked, or in plain words) could take, best first by the words, with what each would add. Up and Down move, Enter picks,
   a click picks, anything else closes it and goes on typing, a digit like any other key (no key that writes is a key you might be typing). Picking gives the bullet the tag and the bullet's properties are proposed as
   they are for any tagged bullet; a faded arrow puts the tag back. Nothing is ever written until one is picked, and it is only there when
   asked, so plain notes that happen to name a person stay quiet. When the guesses sit under more than one top-level tag, each group stands under that tag's name,
   so it shows where a guess sits in your tags; the keys pass over the names. */
(function () {
const Flow = (window.Flow ||= {});
const { app, db, propose } = Flow;
const { setting, host, warnOnce, notify } = app;
const P = Flow.proposeUi;

let open = null;   // { box, uuid, items, at, list }
const { el } = window.PluginDoor;

function close() { open?.list.remove(); open = null; }
// Why this tag: the property of it that would take the pages the line names ("Spoke with: Ruth Okoro, Amara Okoro"), which is
// the reason and what picking fills; else how it was read, and the properties it brings. The Alfred panel says the same (outside-note.js).
function reasonOf(item) {
  const takes = (item.takes || []).slice(0, 2).map(t => `${t.prop}: ${t.pages.join(', ')}`).join(' · ');
  return item.how === 'mentioned' && takes ? takes : [item.how === 'twin' ? 'written like this before' : item.how === 'mentioned' ? item.via.join(', ') : 'by its words', item.fields.slice(0, 3).join(', ')].filter(Boolean).join(' · ');
}
function draw() {
  const { box, items, at, list } = open, doc = box.ownerDocument, rect = box.getBoundingClientRect();
  // Under the top-level tag each sits under (14 November 2026), once the guesses come from more than one: a heading the keys pass over.
  const split = new Set(items.map(item => item.top)).size > 1;
  list.replaceChildren(
    ...items.flatMap((item, i) => {
      const note = reasonOf(item);
      const row = el(doc, 'div', { class: 'flow-pick-row lk-item' + (i === at ? ' on' : ''), role: 'option', 'aria-selected': String(i === at), 'data-i': String(i) },
        el(doc, 'span', { class: 'flow-pick-tag lk-tag' }, item.tag.title), el(doc, 'span', { class: 'flow-pick-note lk-note' }, note));
      const head = split && item.top !== item.tag.id && item.top !== items[i - 1]?.top ? open.titleOf(item.top) : '';
      return head ? [el(doc, 'div', { class: 'lk-group' }, head), row] : [row];
    }));
  Object.assign(list.style, { left: rect.left + 'px', top: (rect.bottom + 4) + 'px', maxWidth: Math.min(Math.max(360, rect.width), doc.documentElement.clientWidth - rect.left - 16) + 'px' });
  if (!list.isConnected) doc.body.append(list);
}

/* The tags a bullet could be, best first, worked out once for whoever shows them: the list here, and Find's panel under the line
   (0.5, the owner, 22 November 2026: the list a Hyper tap opened goes "Into the panel"). say: what to tell the person when there
   is nothing to show (the list says it; the panel just has no tag line). */
async function choicesFor(box, say = () => {}) {
  if (!app.isBlockBox(box)) return null;
  const uuid = app.uuidOf(box);
  if (!uuid) return null;
  if (!await app.allowed()) return say('Proposals are off in this graph, so no tag is offered', 'warning'), null;
  const ctx0 = await app.context({ wait: false });
  if (!ctx0) return say('Still reading the graph; try again in a moment'), null;
  const ctx = await app.freshLinks(ctx0, box.value);
  const block = await db.pullBlock(uuid);
  if (!block) return null;
  const bullet = db.bulletOf(block, box.value, ctx.schema);
  if (bullet.tags.length) return say('This bullet already has a tag'), null;
  const items = propose.tagChoices(ctx, bullet);
  if (!items.length) return say('No tag to suggest for this line'), null;
  // The best guess stays first; the rest follow under their top-level tags, each group where its best guess came.
  return { uuid, items: Flow.schema.byTop(items, ctx.schema), titleOf: id => ctx.byId.get(id)?.title || '' };
}
async function show(box) {
  const got = await choicesFor(box, notify);
  if (!got || host().activeElement !== box) return;
  close();
  open = { box, uuid: got.uuid, items: got.items, at: 0, titleOf: got.titleOf, list: el(box.ownerDocument, 'div', { class: 'flow-pick lk-pop lk-menu', role: 'listbox' }) };
  draw();
}
// The same choices for Find's panel: asked through the door with the bullet's box; taken by their place in the answer.
let offered = null;   // { box, uuid, items } the panel was last told
async function choicesAsked(box) {
  const got = await choicesFor(box).catch(() => null);
  offered = got ? { box, uuid: got.uuid, items: got.items } : null;
  return got ? got.items.map(item => ({ title: item.tag.title, reason: reasonOf(item) })) : [];
}
async function takeAsked(box, i) {
  if (!offered || offered.box !== box || !offered.items[i]) return false;
  const was = offered; offered = null;
  open = { box: was.box, uuid: was.uuid, items: was.items, at: i, list: el(box.ownerDocument, 'div', {}) };
  await pick(i);
  return true;
}

/* The kinds a new page named after these words is likely to be (core/newkind.js), for Find's panel: the earlier lines that link a
   page right after the same last word are read, and the tags of the pages they link counted. Logseq's own tags say no kind. */
const NO_KIND = ['Page', 'Journal', 'Tag', 'Property', 'Asset', 'Whiteboard', 'Task', 'Template', 'Query', 'Card'];
async function kindsFor(before) {
  try {
    const cue = Flow.newkind.lastWords(before, 1)[0];
    if (!cue || /["\\]/.test(cue)) return [];
    const rows = await logseq.DB.datascriptQuery(`[:find ?t :where [?b :block/title ?t] [(clojure.string/includes? ?t " ${cue} [[")]]`) || [];
    const lines = rows.map(r => String(r[0] || '')).slice(0, 600);
    const ids = [...new Set(lines.flatMap(l => l.match(/\[\[[0-9a-f-]{36}\]\]/gi) || []).map(x => x.slice(2, -2).toLowerCase()))].slice(0, 400);
    if (!ids.length) return [];
    const got = await logseq.DB.datascriptQuery(`[:find ?u ?tu ?tt :in $ [?u ...] :where [?p :block/uuid ?u] [?p :block/tags ?tg] [?tg :block/uuid ?tu] [?tg :block/title ?tt]]`, `[${ids.map(u => `#uuid "${u}"`).join(' ')}]`) || [];
    const tags = new Map();
    for (const [u, tu, tt] of got) { const k = String(u).toLowerCase(); if (!tags.has(k)) tags.set(k, []); tags.get(k).push({ uuid: String(tu), title: String(tt) }); }
    return Flow.newkind.kindsAfter(before, lines, u => tags.get(u), { skip: NO_KIND });
  } catch (error) { warnOnce('the kinds for a new page could not be worked out', error); return []; }
}

async function pick(i) {
  const chosen = open, item = chosen?.items[i];
  if (!item) return;
  close();
  try {
    await db.addTag(chosen.uuid, item.tag.uuid);
  } catch (error) { warnOnce('the tag could not be given', error); return notify('The tag could not be given', 'warning'); }
  P.rememberUndo(chosen.uuid, chosen.uuid, [{ kind: 'tag', ident: 'block/tags', ids: [item.tag.id], tag: item.tag, shown: '#' + item.tag.title }], () => db.removeTag(chosen.uuid, item.tag.uuid));
  P.soon(chosen.box, { asked: true });   // the bullet has the tag now: its properties are proposed as for any tagged bullet
}

const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']);
function onKey(event) {
  if (event.isComposing) return;
  const asked = app.keyMatches(event, setting('proposalsTagKeys'));
  if (open) {
    if (MODIFIER_ONLY(event)) return;
    const swallow = () => { event.preventDefault(); event.stopImmediatePropagation(); };
    if (asked || event.key === 'Escape') { swallow(); return close(); }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { swallow(); open.at = (open.at + (event.key === 'ArrowDown' ? 1 : open.items.length - 1)) % open.items.length; return draw(); }
    if (event.key === 'Enter' && !event.shiftKey) { swallow(); return pick(open.at); }
    return close();   // any other key: back to writing
  }
  if (!asked || !app.isBlockBox(event.target)) return;
  event.preventDefault(); event.stopImmediatePropagation();
  show(event.target).catch(error => warnOnce('the tags could not be worked out', error));
}
const MODIFIER_ONLY = event => MODIFIERS.has(event.key);

/* Hyper alone (16 November 2026, the owner), the second job of the one Hyper tap that link-ui.js hears: with no grey page name to
   take, the same list as the key above. Hyper is only modifiers, so nothing is typed and
   the cursor stays mid-word. (0.3.136 listened for Hyper here too and opened the list right after the tap had taken a grey
   name: the owner typed "Infe", tapped Hyper, and got both.) */
function fromHyper(box) {
  if (open || !setting('proposalsTagHyper') || !app.isBlockBox(box)) return false;
  show(box).catch(error => warnOnce('the tags could not be worked out', error));
  return true;
}

// A click on a row picks it; the press is held back so the bullet keeps the keyboard.
function onPress(event) {
  const row = event.target?.closest?.('.flow-pick-row');
  if (!row) { if (open && !event.target?.closest?.('.flow-pick')) close(); return; }
  event.preventDefault(); event.stopImmediatePropagation();
  if (event.type === 'click') pick(Number(row.dataset.i));
}

/* The picker is the library's pop-up and menu (lk-pop, lk-menu, a row lk-item lit with on, its note lk-note); here its place under the bullet. */
const css = `
.flow-pick { position: fixed; z-index: 30; min-width: 240px; width: max-content; user-select: none; }
.flow-pick-row { align-items: baseline; cursor: pointer; white-space: normal; }
.flow-pick-tag { white-space: nowrap; }
.flow-pick-note { padding-left: 1em; text-align: right; min-width: 0; }
`;

function start() {
  app.sendStyle('flow-tag-pick', css);
  const win = host().defaultView;
  app.listen(win, ['keydown'], onKey, true);
  app.listen(win, ['pointerdown', 'mousedown', 'mouseup', 'click'], onPress, true);
  app.listen(win, ['scroll', 'resize', 'focusout'], () => { if (open) close(); }, true);
  app.onStop(close);
  app.onStop(window.PluginDoor.offerAsk('predictive:tagChoices', choicesAsked));
  app.onStop(window.PluginDoor.offerAsk('predictive:tagTake', takeAsked));
  app.onStop(window.PluginDoor.offerAsk('predictive:kindsFor', kindsFor));
  app.onStop(logseq.App.onRouteChanged?.(close));
  logseq.App.registerCommandPalette?.({ key: 'flow-choose-tag', label: 'Predictive: choose a tag for this bullet' }, () => { const box = host().activeElement; if (app.isBlockBox(box)) show(box); else notify('Put the cursor in a bullet first'); });
}
Flow.tagPick = { start, close, fromHyper, reasonOf, state: () => open };   // state(): the open list, whose Escape comes before the grey words' (link-ui.js)
})();
