/* Reading the shape of a graph: which properties a tag gives, whether a page fits a property, which properties are "wide".
   A schema is { props, byId, classProps: Map(tagId -> [propId]), parentsOf: Map(tagId -> [tagId]), builtIn: Set(tagId) },
   a prop { id, ident, title, lower, type, many, classes: [{ id, title, uuid }], choices }. Pure. */
(function () {

// The properties the tags give, own first, then what they inherit, without repeats.
function fieldsOfTags(tagIds, schema) {
  const seen = new Set(), fields = [], queue = [...tagIds];
  while (queue.length) {
    const c = queue.shift();
    if (seen.has(c)) continue;
    seen.add(c);
    for (const p of schema.classProps.get(c) || []) { const prop = schema.byId.get(p); if (prop && !fields.includes(prop)) fields.push(prop); }
    queue.push(...(schema.parentsOf.get(c) || []));
  }
  return fields;
}

// A page fits a link property when one of its tags, or a tag that tag extends, is a tag the property takes.
function fits(page, classIds, schema) {
  const seen = new Set(), queue = page.tags.map(t => t.id);
  while (queue.length) {
    const c = queue.shift();
    if (seen.has(c)) continue;
    seen.add(c);
    if (classIds.has(c)) return true;
    queue.push(...(schema.parentsOf.get(c) || []));
  }
  return false;
}

/* A wide property: one that takes tags from two or more separate families, a family being the top of a tag's chain of
   extends (a Topic taking Symptom, Decision, Person and Visit). Almost any link fits such a property, so fitting says
   little: a link is only a guess for it, a name in plain words is never taken for it, and it is the last to claim a
   link. The engine's votes still count: what earlier lines like this one had in it is real evidence. Learned from the
   graph's own tag tree, so it needs no list of property names. */
const wideCache = new WeakMap();
function wide(prop, schema) {
  if (!prop?.classes?.length) return false;
  let byProp = wideCache.get(schema);
  if (!byProp) wideCache.set(schema, byProp = new Map());
  if (byProp.has(prop.ident)) return byProp.get(prop.ident);
  const tops = new Set();
  for (const c of prop.classes) {
    const seen = new Set(), queue = [c.id];
    while (queue.length) {
      const t = queue.shift();
      if (seen.has(t)) continue;
      seen.add(t);
      const up = (schema.parentsOf.get(t) || []).filter(id => !schema.builtIn?.has(id));
      if (!up.length) tops.add(t);
      queue.push(...up);
    }
  }
  const answer = tops.size >= 2;
  byProp.set(prop.ident, answer);
  return answer;
}

// The top-level tag a tag sits under: up its first parent of yours until none is left (the tag itself when it is at the top).
function topOf(tagId, schema) {
  let at = tagId;
  for (let guard = 0; guard < 64; guard++) { const up = (schema.parentsOf?.get(at) || []).filter(id => !schema.builtIn?.has(id) && id !== at); if (!up.length) break; at = up[0]; }
  return at;
}
// Items (each with tag.id) put in groups by the top-level tag their tag sits under: the groups in the order their best item came,
// the items of a group in the order they came. Each item gets top (that tag's id); a tag that is itself at the top is its own.
function byTop(items, schema) {
  const groups = new Map();
  for (const item of items) { const top = topOf(item.tag.id, schema); if (!groups.has(top)) groups.set(top, []); groups.get(top).push({ ...item, top }); }
  return [...groups.values()].flat();
}

// A page with no tag of yours (only Logseq's own, such as Page).
const untagged = page => !page.isTag && !page.tags.some(t => !/^logseq\.class\//.test(t.ident || ''));

const isNumberProp = p => p.type === 'number';
const isDateProp = p => p.type === 'date';
const isChoiceProp = p => p.type !== 'node' && p.choices?.length > 0;
const isLinkProp = p => p.type === 'node' && p.classes?.length > 0;
// Logseq's own properties that records take (Deadline, Scheduled, Status, Priority): proposed only with evidence.
const isBuiltInProp = p => /^logseq\.property\//.test(p.ident);

const api = { fieldsOfTags, topOf, byTop, fits, wide, untagged, isNumberProp, isDateProp, isChoiceProp, isLinkProp, isBuiltInProp };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') (window.Flow ||= {}).schema = api;
})();
