/* A list grouped by a tag, a month or a property, with its + per group; and which lists stay open or folded, per page.
   A piece of Threads' two-way part: parts/two-way.js is the part (the rows, their drawing, the start) and holds twoWay,
   where its pieces meet. What this piece uses of the part or another piece it reaches through twoWay when it runs; what
   it gives them is listed at its end. */
(() => {
const twoWay = window.Threads.parts?.find(part => part.name === 'two-way')?.inner;
if (!twoWay) return;   // the two-way part did not load, so nothing of it runs
const shared = window.Threads.shared;
const { host, esc, iconHtml } = shared;
const { state, warnOnce } = twoWay;

/* Group a row by anything (0.4.369, the owner kept it from the ideas page): a list of nodes (more than three) can be
   grouped by their tag, their month, or the value of any property they hold (a claim's Confidence, a task's Project),
   each group folding, biggest first, those with none last. Chosen from the word after the count ("group", then "by
   Confidence") or from the right-click menu on the row's name, and remembered per property. Only how the row is shown:
   nothing is written. The values are read through the model (nodeValues) when a property is chosen and again whenever
   the rows are read, so a row grouped on a page opens grouped. */
const GROUP_KEY = 'refinementTwoWayGroup', GROUP_LISTED = 12;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const groupOf = group => state.group.get(group.name) || '';
const groupName = by => by === 'tag' ? 'tag' : by === 'month' ? 'month' : by.slice(2);
function readGroup() { try { state.group = new Map(Object.entries(JSON.parse(host().defaultView.localStorage.getItem(GROUP_KEY) || '{}'))); } catch { state.group = new Map(); } }
function setGroup(field, by) {
  if (by) state.group.set(field, by); else state.group.delete(field);
  try { host().defaultView.localStorage.setItem(GROUP_KEY, JSON.stringify(Object.fromEntries(state.group))); } catch { /* kept for this session */ }
}
function groupingOf(group, items) {
  const by = state.drawingTop ? '' : groupOf(group);
  if (!by) return null;
  const buckets = new Map();
  const put = (key, label, item, value, none) => { let b = buckets.get(key); if (!b) buckets.set(key, b = { key: String(key), label, items: [], value, none: !!none }); b.items.push(item); };
  if (by === 'tag') for (const item of items) { const none = !item.tag || item.tag === 'note'; put(none ? '' : item.tag, none ? 'No tag' : item.tag, item, null, none); }
  else if (by === 'month') for (const item of items) { if (!item.day) put('', 'No date', item, null, true); else { const m = Math.floor(item.day / 100); put(m, `${MONTH_NAMES[m % 100 - 1]} ${Math.floor(m / 100)}`, item, null); } }
  else if (by.startsWith('p:')) {
    const name = by.slice(2);
    // Not read yet: the plain list until it is.
    if (!items.some(item => state.values.has(item.uuid))) return null;
    for (const item of items) {
      const held = state.values.get(item.uuid)?.get(name);
      if (!held?.values.length) { put('', `No ${name}`, item, null, true); continue; }
      const seen = new Set();
      for (const v of held.values) {
        let label = v.day ? twoWay.dayText(v.day) : v.text;
        if (!label || seen.has(label)) continue;
        seen.add(label);
        // A bare number says nothing as a group's name: "Severity 3".
        put(label, /^-?\d+(\.\d+)?$/.test(label) ? `${name} ${label}` : label, item, { ident: held.ident, ...v });
      }
    }
  } else return null;
  // Biggest first; a month newest first; numbers, a scale, in order; those with none last.
  const parts = [...buckets.values()], numbers = by.startsWith('p:') && parts.filter(p => !p.none).every(p => p.value && typeof p.value.number === 'number');
  parts.sort((a, b) => a.none - b.none || (by === 'month' ? Number(b.key) - Number(a.key) : numbers ? a.value.number - b.value.number : b.items.length - a.items.length) || a.label.localeCompare(b.label));
  return { by, parts };
}
const groupKey = (group, by, part) => `${state.pageUuid}|${group.name}|${by}|${part.key}`;
function groupHtml(group, part, by) {
  const gkey = groupKey(group, by, part);
  const open = !!state.find.trim() || isOpen(gkey), all = state.all.has(gkey);
  const adding = state.draft?.field === group.name && state.draft.gkey === gkey;
  // The + puts a node here with the row's field pointing at this page and the group's value set (not for a month, nor for "none").
  const addable = group.ident && by !== 'month' && (by === 'tag' || !part.none);
  const plus = addable ? `<button type="button" class="lk-plus lk-reveal th-tw-gadd" data-gkey="${esc(gkey)}" data-field="${esc(group.name)}" title="Add a node here: “${esc(group.name)}” set to this page${by === 'tag' ? `, tagged ${esc(part.label)}` : `, ${esc(groupName(by))} set to ${esc(part.label)}`}">+</button>` : '';
  const shown = all ? part.items : part.items.slice(0, GROUP_LISTED);
  // The group's heading names the tag, or the list's does when it holds one kind (0.4.462).
  const bare = (by === 'tag' && !part.none) || new Set(group.items.map(item => item.tag)).size === 1;
  const tell = bare ? tellingProp(group, part.items, by.startsWith('p:') ? by.slice(2) : '') : '';
  const more = open && part.items.length > GROUP_LISTED ? shared.outline.more({ text: all ? 'show fewer' : 'show all', attrs: { 'data-more': gkey }, under: 'name' }) : '';
  // The arrow folds; the words do not. A tag is a tag: it opens its page.
  const label = by === 'tag' && !part.none ? `<a class="th-tag lk-tag th-tw-tag th-tw-gname" data-tag-page="${esc(part.label)}" href="#">${esc(part.label)}</a>` : `<span class="th-tw-gname">${esc(part.label)}</span>`;
  return `<div class="th-tw-group"${open ? ' data-open=""' : ''}><div class="th-tw-ghead${plus ? ' lk-reveals' : ''}">${shared.outline.chev({ open, label: part.label, attrs: { 'data-gkey': gkey } })}<span class="th-tw-gwords">${label}<span class="lk-note th-tw-gn lk-count">${part.items.length}</span></span>${plus}</div>${open && adding ? twoWay.draftLineHtml(group, state.draft) : ''}${open ? `<div class="th-tw-gitems">${shown.map(item => twoWay.itemHtml(group, item, `r:${group.name}`, '', bare, tell)).join('')}${more}</div>` : more}</div>`;
}
// A few nodes have nothing to group: Group shows above INLINE nodes, as the right-click's Group by… (1.0.2).
const groupBtn = group => { if (state.drawingTop || group.items.length <= twoWay.INLINE) return ''; const by = groupOf(group); return `<button type="button" class="lk-btn lk-low th-tw-groupby"${by ? ' data-on=""' : ''} data-field="${esc(group.name)}" title="Group the list by a tag, a month or a property">${by ? `By ${esc(groupName(by))}` : 'Group'}${iconHtml('chevron-down')}</button>`; };
// The values of these nodes, read through the model (400 at a time) into the cache the groups are made from.
async function readValues(uuids) {
  // The kinds of the properties, for the one telling a list's nodes apart (tellingProp).
  if (!state.schema) state.schema = await twoWay.provided.propSchema().catch(() => null);
  const need = [...new Set(uuids)].filter(uuid => twoWay.UUID.test(uuid));
  for (let at = 0; at < need.length; at += 400) {
    const part = need.slice(at, at + 400), found = await twoWay.provided.nodeValues(part);
    for (const uuid of part) state.values.set(uuid, found.get(uuid) || new Map());
  }
}
// Read ahead for every list (not the mentions): grouped by a property, or of one kind (by itself, or one tag's word
// picked), its lines say the property telling its nodes apart (0.4.462).
const groupedUuids = groups => groups.filter(g => g.items.length > twoWay.INLINE && !twoWay.isMentions(g)).flatMap(g => g.items.map(item => item.uuid));
/* The property that tells a list's nodes apart, said where the tag was once the heading names the tag (0.4.462, the
   owner's pick 3 of the two-way fixes; Severity under "13 Symptom Logs"): of the properties the nodes hold, not the one
   linking here, a number, a choice or a few words, never a node (its name is mostly in the node's own words already,
   the reviewer: "about Blood in stool Blood in stool") nor a day (the margin has it), held by at least half of them, with
   more than one value; the most held, then the fewest values (the easiest to compare). None: nothing is said. */
function tellingProp(group, items, not = '') {
  if (!items.some(item => state.values.has(item.uuid))) return '';
  const held = new Map();
  const NOT = new Set(['node', 'page', 'date', 'datetime', 'url']);
  for (const item of items) for (const [name, entry] of state.values.get(item.uuid) || []) {
    if (name === group.name || name === not || !entry.values.length || entry.values.some(v => v.day || !v.text || v.text.length > 24)) continue;
    const prop = state.schema?.props.find(x => x.ident === entry.ident);
    if (!prop || NOT.has(prop.type)) continue;
    if (!held.has(name)) held.set(name, { nodes: 0, values: new Set() });
    const h = held.get(name); h.nodes++;
    for (const v of entry.values) h.values.add(v.text);
  }
  const best = [...held].filter(([, h]) => h.nodes * 2 >= items.length && h.values.size > 1).sort((a, b) => b[1].nodes - a[1].nodes || a[1].values.size - b[1].values.size || a[0].localeCompare(b[0]))[0];
  return best ? best[0] : '';
}
// With its property's name, so it says what it is ("Severity 3", "Status Planned"); left out where the node's own
// words already say the value.
const tellHtml = (item, name) => {
  const values = state.values.get(item.uuid)?.get(name)?.values || [];
  const text = values.map(v => v.text).join(', ');
  if (!text || String(item.title || '').toLowerCase().includes(text.toLowerCase())) return '';
  return `<span class="th-tw-tell">${esc(name)} ${esc(text)}</span>`;
};
// What a row can be grouped by, as the kit's menu: nothing, the tag, the month, then each property its nodes hold.
async function groupMenu(group, anchor) {
  twoWay.closeAdd(); twoWay.hidePeek();
  await readValues(group.items.map(item => item.uuid)).catch(error => warnOnce('could not read the values to group by', error));
  const by = groupOf(group), held = new Map();
  for (const item of group.items) for (const [name, entry] of state.values.get(item.uuid) || []) {
    if (name === group.name) continue;
    if (!held.has(name)) held.set(name, { nodes: 0, values: new Set() });
    const h = held.get(name); h.nodes++;
    for (const v of entry.values) h.values.add(v.day ? `d${v.day}` : v.text);
  }
  const choose = to => { setGroup(group.name, to); if (state.draft?.gkey) { state.draft = null; twoWay.closeAdd(); } state.html = null; twoWay.draw(host()); };
  const items = [{ label: 'Nothing', chosen: !by, run: () => choose('') }];
  if (new Set(group.items.map(item => item.tag)).size > 1) items.push({ icon: 'tag', label: 'Tag', chosen: by === 'tag', run: () => choose('tag') });
  if (group.items.some(item => item.day)) items.push({ icon: 'date', label: 'Month', chosen: by === 'month', run: () => choose('month') });
  const props = [...held].filter(([, h]) => h.values.size > 1 || h.nodes < group.items.length).sort((a, b) => b[1].nodes - a[1].nodes || a[0].localeCompare(b[0]));
  if (props.length) items.push({ sep: true }, ...props.map(([name, h]) => ({ icon: 'property', label: name, right: `${h.values.size} ${h.values.size === 1 ? 'value' : 'values'}`, chosen: by === `p:${name}`, run: () => choose(`p:${name}`) })));
  else items.push({ note: 'These nodes hold no property to group by' });
  twoWay.adding.pop = shared.popup({ at: anchor, head: `Group “${group.label}” by`, width: 250, items, onClose: () => { twoWay.adding.pop = null; } });
}
// The + in a group: the line to type in opens under the group's name, with what the group has in common set when it is made.
function startGroupDraft(group, gkey) {
  const grouping = groupingOf(group, group.items);
  const part = grouping?.parts.find(p => groupKey(group, grouping.by, p) === gkey);
  if (!part) return;
  twoWay.closeAdd(); state.draft = null;
  const d = twoWay.draftFor(group);
  d.gkey = gkey; d.step = 'name';
  if (grouping.by === 'tag') d.kind = part.none ? '' : part.label;
  d.set = grouping.by.startsWith('p:') && !part.none ? part.value : null;
  setOpen(gkey, true);
  state.html = null; twoWay.draw(host()); twoWay.focusDraft();
}
// What a group has in common, put on the new node: a node, a choice or a day by its id, a number or words as they are.
async function setGroupValue(uuid, set) {
  const prop = (await twoWay.provided.propSchema()).props.find(p => p.ident === set.ident);
  if (!prop) return;
  const value = twoWay.heldById(prop) ? set.id : set.time ?? set.number ?? set.boolean ?? set.text;
  if (value == null) return;
  if (twoWay.heldById(prop)) await twoWay.setValues(uuid, prop, [value]); else await twoWay.model.setValue(uuid, prop.ident, value);
}

// Open or folded, per page and field, kept in Logseq's window storage (0.4.184): open unless you folded it.
/* Date first or name first per property (0.4.304 to 0.4.461) is gone (0.4.462, the owner's pick 1 of the two-way fixes):
   the day is always in the margin. What it kept is let go once. */
function forgetOrder() { try { host().defaultView.localStorage.removeItem('refinementTwoWayOrder'); } catch { /* nothing kept */ } }
const OPEN_KEY = 'refinementTwoWayOpen';
const isOpen = key => state.open.get(key) ?? true; // while finding, a row opens itself once narrowed (rowHtml, 0.4.458)
function readOpen() { try { state.open = new Map(Object.entries(JSON.parse(host().defaultView.localStorage.getItem(OPEN_KEY) || '{}'))); } catch { state.open = new Map(); } }
function setOpen(key, open) {
  state.open.delete(key);
  if (!open) state.open.set(key, false);
  while (state.open.size > 300) state.open.delete(state.open.keys().next().value);
  try { host().defaultView.localStorage.setItem(OPEN_KEY, JSON.stringify(Object.fromEntries(state.open))); } catch { /* kept for this session */ }
}

Object.assign(twoWay, { forgetOrder, groupBtn, groupHtml, groupMenu, groupName, groupOf, groupedUuids, groupingOf, isOpen, readGroup, readOpen, readValues, setGroupValue, setOpen, startGroupDraft, tellHtml, tellingProp });
})();
