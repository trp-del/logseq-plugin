/* NODE: the + line. The + on the head of a property's list (or of a group in it) opens a line to type in at the list's end,
   laid out as a row is: the + where a row has its bullet, the new node's name where a row has its words, the tag it will get
   after the name, and under it what it will hold: the list's property pointing at this page, and the group's value when it
   was begun from a group. As the plugin had it before the rebuild (the owner, 25 November 2026: "the actual feature were well
   developed").
     Enter   where most of the list's nodes are pages, the page is made at once. Otherwise the line asks where the node goes:
             today's journal, this page, or a page found by what is typed; Enter takes the lit one. From a group's +, no
             question: today's journal.
     Cmd-Enter  makes it and opens it in the sidebar.
     Escape  one step back, then lets the line go. A press elsewhere lets an empty line go.
     The tag after the name, pressed, lists the list's other kinds.
   What was made gets the Undo arrow, and the line stays open, empty, for the next one.
     G.adding.start(state, box, group)   opens the line for a list's box (group: one of its groups, or none); a second press shuts it
     G.adding.item(state, list, group)   true when the line is open for that list (and group)
     G.adding.el(state)                  the line's element, for the list to place
     G.adding.keep(state, box, list)     places the line at the end of a list's box, or takes it away */
(function () {
const G = window.PluginDoor;
const kindsOf = rows => { const n = new Map(); for (const row of rows) if (row.tag) n.set(row.tag, (n.get(row.tag) || 0) + 1); return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag]) => tag); };
const no = words => Object.assign(new Error(words), { plain: true });   // a refusal of the plugin's own, said as it is (G.write.refused)
const item = (state, list, group) => !!state.draft && state.draft.key === list.key && state.draft.group === (group ? group.key : null);
const field = d => d.el?.querySelector('.lk-draft-field');
const focus = d => { const at = field(d); if (at) { at.focus({ preventScroll: true }); at.setSelectionRange(at.value.length, at.value.length); } };
function drop(state, redraw = true) {
  const d = state.draft;
  if (!d) return;
  d.close?.(); d.off?.(); state.draft = null; d.el?.remove();
  if (redraw) state.redraw();
}
function propsHtml(d) {
  const one = (name, value) => `<span class="lk-draft-prop"><span class="lk-prop">${G.esc(name)}</span> <span class="lk-draft-value">${G.esc(value)}</span></span>`;
  return one(d.list.prop.title, d.here || 'this page') + (d.set ? one(d.set.name, d.set.text) : '');
}
function paint(d) {
  const kind = d.kind, an = /^[aeiou]/i.test(kind) ? 'n' : '';
  const typing = d.step === 'where'
    ? `<span class="lk-draft-typed">${G.esc(d.name)}</span><input class="lk-field lk-draft-field" data-step="where" type="text" placeholder="Where? Enter: ${G.esc(d.last?.word || 'today’s journal')}" aria-label="Where the new node goes" spellcheck="false" autocomplete="off">`
    : `<input class="lk-field lk-draft-field" data-step="name" type="text" placeholder="Add a${an} ${G.esc(kind || 'node')}" aria-label="Name of a new node" spellcheck="false" autocomplete="off">`;
  d.el.innerHTML = `<span class="lk-draft-room"></span><div class="lk-draft-line"><span class="lk-bul lk-draft-plus" aria-hidden="true">${G.touch.icon('plus', 12)}</span><span class="lk-dayin"></span><div class="lk-draft-body"><span class="lk-draft-main">${typing}<button type="button" class="lk-tag lk-draft-tag" title="The tag it gets (press for the others)">${G.esc(kind || 'no tag')}</button></span><div class="lk-draft-props">${propsHtml(d)}</div></div></div>`;
  field(d).value = d.step === 'where' ? d.where : d.name;
}
// The places a new node can go, under the line that asks: today's journal, this page, then the pages found by what is typed.
function places(d, found = []) {
  const want = d.where.trim().toLowerCase();
  const fixed = [{ act: 'journal', word: 'Today’s journal', icon: 'calendar' }, { act: 'here', word: d.here || 'This page', icon: 'file' }].filter(one => !want || one.word.toLowerCase().includes(want));
  return [...fixed, ...found.map(page => ({ act: `page:${page.uuid}`, word: page.words, icon: 'file' }))];
}
function offer(state, d, found = []) {
  const at = field(d);
  if (!at || d.step !== 'where') return;
  const rows = places(d, found);
  d.rows = rows;
  // The place chosen last is lit until what is typed says otherwise.
  const lit = Math.max(0, d.last && !d.where.trim() ? rows.findIndex(row => row.act === d.last.act) : 0);
  d.close?.();
  d.close = rows.length ? G.menu(at, rows.map(row => ({ word: row.word, icon: G.touch.icon(row.icon, 14), take: () => make(state, d, row, false) })), { quiet: true, lit }) : null;
}
async function look(state, d) {
  const words = d.where.trim(), turn = ++d.turn;
  offer(state, d);
  if (!words) return;
  const found = (await G.read.search(words).catch(() => [])).filter(node => node.isPage && node.uuid !== state.view.uuid && node.tag !== 'Tag' && node.tag !== 'Property').slice(0, 6);
  if (turn === d.turn && state.draft === d && d.step === 'where' && d.where.trim() === words && found.length) offer(state, d, found);
}
function step(state, d, to) {
  d.close?.(); d.close = null; d.step = to; if (to === 'name') d.where = '';
  paint(d); focus(d);
  if (to === 'where') look(state, d);
}
// The tag the new node gets, among the kinds the list holds; none is a choice too.
function tags(state, d, at) {
  d.close?.();
  d.close = G.menu(at, [...d.kinds, ''].map(kind => ({ word: kind || 'no tag', face: kind ? 'tag' : '', on: kind === d.kind, take: () => { d.kind = kind; paint(d); focus(d); } })));
}
async function make(state, d, place, beside) {
  const name = d.name.trim(), list = d.list;
  if (!name || d.making) return;
  d.making = true; d.close?.(); d.close = null;
  let made = null;
  try {
    const [all, here, schema] = await Promise.all([G.read.tags(), G.read.node(state.view.uuid), d.set ? G.read.schema() : null]);
    if (!here) throw no('this page could not be read');
    const those = d.kind ? [...all.values()].filter(tag => tag.title === d.kind) : [];
    if (d.kind && those.length !== 1) throw no(`no one tag is called ${d.kind}`);
    const tag = those[0]?.uuid || '';
    if (place.act === 'page') {
      // A page in the Recycle still answers to its name: it is brought back instead of made twice.
      const named = await G.read.pageNamed(name);
      if (named && !named.gone) { G.say(`A page named “${name}” already exists, so nothing was added.`, 'warning'); d.making = false; focus(d); return; }
      let steps = 1, uuid;
      if (named) {
        // Logseq answers whether it brought the page back: where it did not, nothing is tagged or pointed here under that name.
        if (!(await G.write.restore(named.uuid))) throw no(`the page “${name}” lies in Logseq’s Recycle and could not be brought back`);
        uuid = named.uuid;
      } else uuid = await G.write.newPage(name);
      if (tag) { await G.write.tag(uuid, tag); steps++; }
      await G.write.setNode(uuid, list.prop.ident, here.id); steps++;
      made = { uuid, steps };
    } else made = await G.write.addNode(tag, list.prop.ident, here.id, { words: name, page: place.act === 'journal' ? '' : place.act === 'here' ? here.uuid : place.act.slice(5) });
    if (d.set) {
      // Begun from a group: the new node holds what the group's nodes hold under the property the list is grouped by.
      const prop = [...schema.props.values()].find(one => one.title === d.set.name);
      const from = prop && (await G.read.holders(prop.ident)).find(one => one.uuid === d.set.from)?.values.find(value => value.text === d.set.text);
      if (prop && from) {
        if (prop.type === 'node' || prop.type === 'date') await G.write.setNode(made.uuid, prop.ident, from.raw);
        else await G.write.setText(made.uuid, prop.ident, prop.type === 'number' ? Number(d.set.text) : d.set.text);
        made.steps++;
      }
    }
  } catch (error) { G.write.refused('It could not be added', error); d.making = false; focus(d); return; }
  G.undo.mark(made.uuid, made.steps);
  if (beside) { G.touch.open(made.uuid, true); drop(state); return; }
  // The line stays open for the next one: empty, with the same tag, the place chosen last lit when it asks where.
  d.making = false; d.name = ''; d.where = ''; d.step = 'name'; d.last = place.act === 'page' ? null : { act: place.act, word: place.word };
  paint(d); focus(d);
}
function onKey(state, d, event) {
  const at = event.target;
  if (!at.matches?.('.lk-draft-field')) return;
  event.stopPropagation();
  if (event.isComposing) return;
  const where = at.dataset.step === 'where', beside = event.metaKey || event.ctrlKey;
  if (event.key === 'Escape') { event.preventDefault(); if (where) step(state, d, 'name'); else drop(state); return; }
  if (event.key !== 'Enter') return;
  event.preventDefault();
  if (!d.name.trim()) return;
  if (where) return void make(state, d, d.rows?.[0] || { act: 'journal', word: 'Today’s journal' }, beside);   // nothing lit (no place by those words): the first, else today's journal
  if (d.asPage) return void make(state, d, { act: 'page' }, beside);
  if (d.group != null) return void make(state, d, { act: 'journal', word: 'Today’s journal' }, beside);
  step(state, d, 'where');
}
function start(state, box, group = null) {
  const list = box?.lkList, doc = state.el.ownerDocument;
  if (!list?.prop || !state.view) return;
  if (item(state, list, group)) { drop(state); return; }
  drop(state, false);
  const kinds = kindsOf(list.rows), narrowed = state.view.kinds.get(list.key) || '';
  const d = state.draft = { key: list.key, list, group: group ? group.key : null, kinds, step: 'name', name: '', where: '', here: '', turn: 0, rows: null, last: null, close: null, making: false,
    kind: group?.tag ? group.key : group && group.byTag ? '' : (narrowed && !narrowed.startsWith('@') ? narrowed : kinds[0] || ''),
    asPage: list.rows.filter(row => row.isPage).length * 2 > list.rows.length,
    set: group && !group.byTag && group.key ? { name: group.by, text: group.name, from: group.rows[0]?.uuid || '' } : null };
  d.el = doc.createElement('div'); d.el.className = 'lk-draft';
  paint(d);
  G.read.names([state.view.uuid]).then(names => { const here = names.get(state.view.uuid); if (state.draft === d && here) { d.here = here; const box = d.el.querySelector('.lk-draft-props'); if (box) box.innerHTML = propsHtml(d); } }).catch(() => {});
  const on = (target, type, fn, capture) => { target.addEventListener(type, fn, capture); return () => target.removeEventListener(type, fn, capture); };
  const offs = [
    on(d.el, 'keydown', event => onKey(state, d, event)),
    on(d.el, 'keyup', event => event.stopPropagation()), on(d.el, 'keypress', event => event.stopPropagation()),
    on(d.el, 'input', event => { if (event.target.dataset.step === 'where') { d.where = event.target.value; look(state, d); } else d.name = event.target.value; }),
    on(d.el, 'click', event => { event.stopPropagation(); const tag = event.target.closest('.lk-draft-tag'); if (tag) tags(state, d, tag); else if (!event.target.closest('input')) focus(d); }),
    // Escape in the line that asks where steps back to the name, before the list of places takes the key for itself.
    // Cmd-Enter there takes the lit place and opens what is made in the sidebar: the list alone would only take the place.
    on(doc, 'keydown', event => {
      if (event.target !== field(d) || d.step !== 'where') return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); step(state, d, 'name'); }
      else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.isComposing) {
        const lit = [...doc.querySelectorAll('.lk-menu .lk-item')].findIndex(row => row.classList.contains('lit'));
        event.preventDefault(); event.stopImmediatePropagation(); make(state, d, d.rows?.[Math.max(0, lit)] || { act: 'journal', word: 'Today’s journal' }, true);
      }
    }, true),
    // A press elsewhere lets an empty line go; one with words in it stays until Escape. On the click, not the press down: the
    // line going away moves the rows, and what was pressed must still be under the pointer when the press ends.
    on(doc, 'click', event => { if (state.draft === d && !d.name.trim() && !d.making && !event.target.closest?.('.lk-draft, .lk-menu, .lk-plus')) drop(state); }, true),
  ];
  d.off = () => { for (const off of offs) off(); };
  state.redraw(); focus(d);
}
// The line begun from a list's own + stands at the list's end, after "Show more".
function keep(state, box, list) {
  const d = state.draft, mine = !!d && d.key === list.key && d.group == null;
  if (mine && !box.hidden) { if (d.el.parentElement !== box || d.el !== box.lastElementChild) { const had = box.ownerDocument.activeElement === field(d); box.appendChild(d.el); if (had) focus(d); } }
  else if (mine) drop(state, false);
}
G.adding = { start, item, keep, drop, el: state => state.draft?.el || null };
G.adding.CSS = `
/* The + line: a row's columns, so the name is typed where the rows' words start. */
.lk-draft { display: grid; grid-template-columns: var(--lk-daycol, 0px) 18px minmax(0, 1fr); align-items: start; }
.lk-draft > .lk-draft-room { grid-column: 2; }
.lk-draft > .lk-draft-line { grid-column: 3; min-width: 0; display: flex; align-items: flex-start; gap: 4px; padding: 2px 6px 2px 0; line-height: 24px; cursor: text; }
.lk-draft .lk-draft-plus::before { content: none; }
.lk-draft .lk-draft-plus { color: var(--lk-off); }
.lk-list:not(:has(.lk-row .lk-dayin)) .lk-draft .lk-dayin { display: none; }
.lk-draft-body { flex: 1; min-width: 0; }
.lk-draft-main { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.lk-draft-typed { flex: none; max-width: 50%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lk-draft input.lk-draft-field { field-sizing: content; min-width: 3ch; max-width: 100%; height: 24px; margin: 0; padding: 0; border: 0; border-radius: 0; outline: 0; box-shadow: none; background: none; color: inherit; font: inherit; line-height: 24px; }
.lk-draft input.lk-draft-field:focus { outline: 0; box-shadow: none; border: 0; }
.lk-draft input.lk-draft-field::placeholder { color: var(--lk-quiet); opacity: 1; }
.lk-draft .lk-draft-tag { flex: none; padding: 0; border: 0; background: none; cursor: pointer; white-space: nowrap; }
.lk-draft .lk-draft-tag:hover, .lk-draft .lk-draft-tag:focus-visible { color: var(--lk-text); outline: none; }
.lk-draft-props { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 16px; min-height: 21px; font-size: 14px; line-height: 21px; }
.lk-draft-value { color: var(--lk-text); }
/* A group's own + shows under the pointer, as it did. */
.lk-group-head > .lk-plus { opacity: 0; width: 18px; height: 18px; }
.lk-group-head:is(:hover, :focus-within) > .lk-plus { opacity: .55; }
.lk-group-head > .lk-plus:is(:hover, :focus-visible) { opacity: 1; }`;
})();
