/* Ontology's property groups, decided. No Logseq here. As 0.5.17 had them (the owner, 28 November 2026, "B. Groups, as in
   0.5.17"): named groups for order only, which fold and may stand inside one another, each property in one group or in none.
   Nothing of it is written to the graph: the place keeps it on this computer. Every change answers a new record and leaves the
   one it was given as it was, so the place can keep the one before for its Undo; a change that cannot be made answers the
   record it was given, the very same object.
     clean(kept)                 what was kept, made safe: { list: [{ id, name, under, open }], of: { ident: id } }; a group under
                                 one that is gone stands at the top, a property in a group that is gone is in none
     carry(now, old)             groups made in 0.5.17 (old: what it kept for the graph, the same shape) to keep now, where nothing
                                 is kept for the graph yet (now: undefined); null where there is nothing to carry. Kept once: a
                                 graph's record stays, empty, when its last group is taken away, so they are not carried again
     named(g, name)              the group of that name (any letter case), or null
     make(g, name, id, under)    a group made, open, at the end (under: the group it stands in, or null)
     rename(g, id, name)         a group named anew
     put(g, idents, id)          properties put into a group (id), or into none (null); a folded group they go into opens
     inside(g, id, under)        a group put inside another (under), or at the top (null), at the end there; never inside
                                 itself or a group within it
     drop(g, id)                 a group taken away: what it held, groups and properties, goes up a level
     fold(g, id, open)           a group folded (false) or unfolded (true)
     step(g, what, out)          the outline's Tab and Shift-Tab. what: { ident } a property, or { group: id }. In (out false): a
                                 property into the last group inside the one it stands in (the group just above it, since a
                                 group's properties stand after its groups), a group into the group before it at its level. Out:
                                 one level up, a group just after the group it stood in
     tree(g)                     every group in order as an outline: [{ id, name, depth }]
     layout(g, rows, identOf, finding)   the table in groups: rows (in the table's order) answered as
                                 [{ kind: 'group', id, name, depth, n, open, under } | { kind: 'row', row, depth, in }] (in: the row's group, or null): each group, then
                                 inside it its groups and its rows one step in; then the rows in no group, at the top level.
                                 n: the rows a group holds at any depth. A folded group's insides are left out. With no group
                                 made, the rows alone. finding: the rows are what a search found, and a group holding none is
                                 left out */
(function (root) {
const clean = kept => {
  const list = Array.isArray(kept?.list) ? kept.list.filter(one => one && typeof one.id === 'string' && one.id && typeof one.name === 'string') : [];
  const ids = new Set(list.map(one => one.id));
  const out = list.map(one => ({ id: one.id, name: one.name, under: ids.has(one.under) && one.under !== one.id ? one.under : null, open: one.open !== false }));
  // A ring of groups each inside the next (a record broken by hand) is cut where it closes.
  for (const one of out) { const seen = new Set([one.id]); for (let up = out.find(x => x.id === one.under); up; up = out.find(x => x.id === up.under)) { if (seen.has(up.id)) { one.under = null; break; } seen.add(up.id); } }
  const of = {};
  if (kept?.of && typeof kept.of === 'object') for (const [ident, id] of Object.entries(kept.of)) if (ids.has(id)) of[ident] = id;
  return { list: out, of };
};
const carry = (now, old) => { if (now != null) return null; const g = clean(old); return g.list.length ? g : null; };
const copy = g => ({ list: g.list.map(one => ({ ...one })), of: { ...g.of } });
const named = (g, name) => { const want = String(name || '').trim().toLowerCase(); return want ? g.list.find(one => one.name.toLowerCase() === want) || null : null; };
const make = (g, name, id, under = null) => {
  const words = String(name || '').trim();
  if (!words || !id || g.list.some(one => one.id === id)) return g;
  const next = copy(g); next.list.push({ id, name: words, under: g.list.some(one => one.id === under) ? under : null, open: true });
  return next;
};
const rename = (g, id, name) => {
  const words = String(name || '').trim(), was = g.list.find(one => one.id === id);
  if (!words || !was || was.name === words) return g;
  const next = copy(g); next.list.find(one => one.id === id).name = words;
  return next;
};
const put = (g, idents, id) => {
  if (id != null && !g.list.some(one => one.id === id)) return g;
  const next = copy(g);
  for (const ident of idents) { if (id == null) delete next.of[ident]; else next.of[ident] = id; }
  if (id != null) next.list.find(one => one.id === id).open = true;
  return next;
};
const within = (g, id, of) => { for (let at = g.list.find(one => one.id === id); at; at = g.list.find(one => one.id === at.under)) if (at.id === of) return true; return false; };
const inside = (g, id, under) => {
  const was = g.list.find(one => one.id === id);
  if (!was || (under != null && (!g.list.some(one => one.id === under) || within(g, under, id)))) return g;
  const next = copy(g), it = next.list.find(one => one.id === id);
  it.under = under; next.list = [...next.list.filter(one => one !== it), it];
  if (under != null) next.list.find(one => one.id === under).open = true;
  return next;
};
const drop = (g, id) => {
  const was = g.list.find(one => one.id === id);
  if (!was) return g;
  const next = copy(g);
  for (const one of next.list) if (one.under === id) one.under = was.under;
  for (const [ident, at] of Object.entries(next.of)) if (at === id) { if (was.under) next.of[ident] = was.under; else delete next.of[ident]; }
  next.list = next.list.filter(one => one.id !== id);
  return next;
};
const fold = (g, id, open) => {
  const was = g.list.find(one => one.id === id);
  if (!was || was.open === !!open) return g;
  const next = copy(g); next.list.find(one => one.id === id).open = !!open;
  return next;
};
const step = (g, what, out) => {
  if (what.ident != null) {
    const at = g.of[what.ident] ?? null;
    if (out) return at == null ? g : put(g, [what.ident], g.list.find(one => one.id === at)?.under ?? null);
    const above = kids(g, at).pop();
    return above ? put(g, [what.ident], above.id) : g;
  }
  const it = g.list.find(one => one.id === what.group);
  if (!it) return g;
  if (!out) { const before = kids(g, it.under).filter((one, i, all) => all.indexOf(it) > i).pop(); return before ? inside(g, it.id, before.id) : g; }
  if (it.under == null) return g;
  const parent = g.list.find(one => one.id === it.under), next = copy(g), moved = next.list.find(one => one.id === it.id);
  moved.under = parent.under;
  next.list = next.list.filter(one => one !== moved);
  next.list.splice(next.list.findIndex(one => one.id === parent.id) + 1, 0, moved);
  return next;
};
const kids = (g, id) => g.list.filter(one => one.under === id);
const tree = g => { const out = [], walk = (id, depth) => { for (const one of kids(g, id)) { out.push({ id: one.id, name: one.name, depth }); walk(one.id, depth + 1); } }; walk(null, 0); return out; };
const layout = (g, rows, identOf, finding = false) => {
  if (!g.list.length) return rows.map(row => ({ kind: 'row', row, depth: 0, in: null }));
  const groupOf = row => g.of[identOf(row)] ?? null, out = [];
  const count = id => rows.filter(row => groupOf(row) === id).length + kids(g, id).reduce((n, one) => n + count(one.id), 0);
  const walk = (id, depth) => {
    for (const one of kids(g, id)) {
      const n = count(one.id);
      if (finding && !n) continue;
      out.push({ kind: 'group', id: one.id, name: one.name, depth, n, open: one.open, under: one.under });
      if (!one.open) continue;
      walk(one.id, depth + 1);
      for (const row of rows) if (groupOf(row) === one.id) out.push({ kind: 'row', row, depth: depth + 1, in: one.id });
    }
  };
  walk(null, 0);
  for (const row of rows) if (groupOf(row) == null) out.push({ kind: 'row', row, depth: 0, in: null });
  return out;
};
const api = { clean, carry, named, make, rename, put, inside, drop, fold, step, tree, layout, within };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).groups = api;
})(typeof window !== 'undefined' ? window : globalThis);
