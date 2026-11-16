/* Choosing a tag for a bullet that has none, with a key (core/propose.js, tagChoices).

   The key (Option-T as it comes; the setting "Keys for choosing a tag") opens a short list under the bullet: the tags that the pages the line
   names (linked, or in plain words) could take, best first by the words, with what each would add. Up and Down move, Enter picks,
   a click picks, anything else closes it and goes on typing, a digit like any other key (no key that writes is a key you might be typing). Picking gives the bullet the tag and the bullet's properties are proposed as
   they are for any tagged bullet; a faded arrow puts the tag back. Nothing is ever written until one is picked, and it is only there when
   asked, so plain notes that happen to name a person stay quiet. With Apple's model on this Mac, the tag it reads the line as
   comes first, said so in its row. When the guesses sit under more than one top-level tag, each group stands under that tag's name,
   so it shows where a guess sits in your tags; the keys pass over the names. */
(function () {
const Flow = (window.Flow ||= {});
const { app, db, propose } = Flow;
const { setting, host, warnOnce, notify } = app;
const P = Flow.proposeUi;

let open = null;   // { box, uuid, items, at, list }
const { el } = window.PluginDoor;

function close() { open?.list.remove(); open = null; }
function draw() {
  const { box, items, at, list } = open, doc = box.ownerDocument, rect = box.getBoundingClientRect();
  // Under the top-level tag each sits under (14 November 2026), once the guesses come from more than one: a heading the keys pass over.
  const split = new Set(items.map(item => item.top)).size > 1;
  list.replaceChildren(
    ...items.flatMap((item, i) => {
      // Why this tag: the property of it that would take the pages the line names ("Spoke with: Ruth Okoro, Amara Okoro"), which is
      // the reason and what picking fills; else how it was read, and the properties it brings.
      const takes = (item.takes || []).slice(0, 2).map(t => `${t.prop}: ${t.pages.join(', ')}`).join(' · ');
      const note = item.how === 'mentioned' && takes ? takes : [item.how === 'model' ? 'by Apple’s model' : item.how === 'meaning' ? 'by its meaning' : item.how === 'mentioned' ? item.via.join(', ') : 'by its words', item.fields.slice(0, 3).join(', ')].filter(Boolean).join(' · ');
      const row = el(doc, 'div', { class: 'flow-pick-row lk-item' + (i === at ? ' on' : ''), role: 'option', 'aria-selected': String(i === at), 'data-i': String(i) },
        el(doc, 'span', { class: 'flow-pick-tag lk-tag' }, item.tag.title), el(doc, 'span', { class: 'flow-pick-note lk-note' }, note));
      const head = split && item.top !== item.tag.id && item.top !== items[i - 1]?.top ? open.titleOf(item.top) : '';
      return head ? [el(doc, 'div', { class: 'lk-group' }, head), row] : [row];
    }));
  Object.assign(list.style, { left: rect.left + 'px', top: (rect.bottom + 4) + 'px', maxWidth: Math.min(Math.max(360, rect.width), doc.documentElement.clientWidth - rect.left - 16) + 'px' });
  if (!list.isConnected) doc.body.append(list);
}

async function show(box) {
  if (!app.isBlockBox(box)) return;
  const uuid = app.uuidOf(box);
  if (!uuid) return;
  if (!await app.allowed()) return notify('Proposals are off in this graph, so no tag is offered', 'warning');
  const ctx0 = await app.context({ wait: false });
  if (!ctx0) return notify('Still reading the graph; try again in a moment');
  const ctx = await app.freshLinks(ctx0, box.value);
  const block = await db.pullBlock(uuid);
  if (!block) return;
  const bullet = db.bulletOf(block, box.value, ctx.schema);
  if (bullet.tags.length) return notify('This bullet already has a tag');
  const items = propose.tagChoices(ctx, bullet), words = box.value;
  // Apple's model, when it is on this Mac: the tag it reads the line as goes first (core/model.js, tagRequest). The list waits
  // for it a moment rather than move a row under the pointer once it is open.
  // Apple's model, when it is on this Mac: the tag it reads the line as goes first (core/model.js, tagRequest); the tag the earlier
  // notes nearest in meaning carry (core/meaning.js) before it. The list waits for them a moment rather than move a row under
  // the pointer once it is open.
  const on = app.setting('proposalsModel');
  const [meant, read] = on ? await Promise.all([Flow.meaningAsk ? Flow.meaningAsk.tagFor(ctx, bullet).catch(() => null) : null, Flow.modelAsk ? Flow.modelAsk.tagFor(ctx, bullet).catch(() => null) : null]) : [null, null];
  for (const [found, how] of [[read, 'model'], [meant, 'meaning']]) {
    if (!found) continue;
    const at = items.findIndex(item => item.tag.id === found.id), was = at < 0 ? null : items.splice(at, 1)[0];
    items.unshift({ ...(was || { score: 0, via: [], fields: Flow.schema.fieldsOfTags([found.id], ctx.schema).map(p => p.title) }), tag: { id: found.id, uuid: found.uuid, title: found.title }, how });
    if (items.length > 5) items.length = 5;
  }
  if (!items.length) return notify('No tag to suggest for this line');
  if (host().activeElement !== box || box.value !== words) return;   // moved on while it was being worked out
  close();
  // The best guess stays first; the rest follow under their top-level tags, each group where its best guess came.
  open = { box, uuid, items: Flow.schema.byTop(items, ctx.schema), at: 0, titleOf: id => ctx.byId.get(id)?.title || '', list: el(box.ownerDocument, 'div', { class: 'flow-pick lk-pop lk-menu', role: 'listbox' }) };
  draw();
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

/* Hyper alone (16 November 2026, the owner): Cmd, Control, Option and Shift held together and let go with no other key between, on a
   bullet with no tag guess showing, opens the same list as the key above. Taken on the first of the four let go, so it is quick. Hyper
   is only modifiers, so nothing is typed and the cursor stays mid-word; Look's key sheet answers Option alone, never Hyper. */
let hyper = false;
const allFour = event => event.metaKey && event.ctrlKey && event.altKey && event.shiftKey;
function onHyper(event) {
  if (event.type === 'keydown') { hyper = MODIFIER_ONLY(event) ? hyper || allFour(event) : false; return; }
  if (!hyper || !MODIFIER_ONLY(event)) return;
  hyper = false;
  if (open || !setting('proposalsTagHyper') || !app.isBlockBox(event.target)) return;
  const row = event.target.closest('.ls-block');
  if (row?.querySelector('.flow-tag-ghost')) return;   // a tag guess is showing: Enter takes it, Hyper leaves it be
  show(event.target).catch(error => warnOnce('the tags could not be worked out', error));
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
  app.listen(win, ['keydown', 'keyup'], onHyper, true);
  app.listen(win, ['blur'], () => { hyper = false; }, false);
  app.listen(win, ['pointerdown', 'mousedown', 'mouseup', 'click'], onPress, true);
  app.listen(win, ['scroll', 'resize', 'focusout'], () => { if (open) close(); }, true);
  app.onStop(close);
  app.onStop(logseq.App.onRouteChanged?.(close));
  logseq.App.registerCommandPalette?.({ key: 'flow-choose-tag', label: 'Predictive: choose a tag for this bullet' }, () => { const box = host().activeElement; if (app.isBlockBox(box)) show(box); else notify('Put the cursor in a bullet first'); });
}
Flow.tagPick = { start, close, state: () => open };   // state(): the open list, whose Escape comes before the grey words' (link-ui.js)
})();
