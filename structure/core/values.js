/* A property's values moved into another property, as a merge does: which of them the kept property can take, in what form,
   and what a node would end up holding. A value is { id, title, raw, day }: the entity it points at (a node, a page, a day, a
   choice, the words of a text value), its words, a raw value (yes or no), the journal day of a date. Pure: no Logseq, no screen.
   A value the kept property cannot take is not lost: it stays on the property merged away. */
(function () {
const S = (window.Structure ||= {});

// How a property's values are written: ids of what they point at, the words themselves, or one raw value.
const family = type => ['node', 'page', 'date', 'datetime'].includes(type) ? 'ref' : type === 'checkbox' ? 'raw' : type === 'number' ? 'num' : 'text';
const YES = /^(yes|true|1|done|checked)$/i, NO = /^(no|false|0|unchecked)$/i;
const words = v => v.raw != null ? String(v.raw) : String(v.title ?? '').trim();
// A day in the words, as Logseq writes one or as people do: 2026-11-04, Nov 4th, 2026, 4 November 2026.
function dayOf(text) {
  const t = String(text).replace(/(\d)(st|nd|rd|th)\b/g, '$1').trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  const d = iso ? new Date(+iso[1], iso[2] - 1, +iso[3]) : /\d{4}/.test(t) ? new Date(t) : null;
  return d && !isNaN(d) ? d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() : null;
}

/* One value as the kept property takes it, or null. into: { type, choice, choices: Map of lowercase words to the choice's id }.
   What comes back says how it is written: { id } a node, day or choice that already is one; { page } a node of these words, made
   at Apply where the graph has none; { day } a journal day; { text }, { num }, { raw }. */
function convert(from, into, v) {
  const f = family(from.type), w = words(v);
  if (into.choice) { const id = into.choices?.get(w.toLowerCase()); return id != null ? { id } : null; }
  switch (into.type) {
    case 'node': case 'page': return f === 'ref' && v.id != null ? { id: v.id } : f === 'raw' || !w ? null : { page: w };
    case 'date': case 'datetime': { if (v.day) return v.id != null ? { id: v.id } : { day: v.day }; const d = dayOf(w); return d ? { day: d } : null; }
    case 'number': { const n = Number(w.replace(/,/g, '')); return w && isFinite(n) ? { num: n } : null; }
    case 'checkbox': return YES.test(w) ? { raw: true } : NO.test(w) ? { raw: false } : null;
    case 'url': return /^https?:\/\/\S+$/i.test(w) ? { text: w } : null;
    default: return w ? { text: w } : null;
  }
}

/* What a merge of several properties into one does to the nodes, before anything is written: for each property merged away,
   how many of its values move, which nodes keep values on it, and which nodes would hold more than one value in a kept property
   that takes one. Each merge sees what the ones before it brought, as Apply will.
   values: Map of ident to Map of node id to [value]. */
function preview(froms, into, values) {
  const held = new Map([...(values.get(into.ident) || new Map())].map(([n, list]) => [n, list.length]));
  return froms.map(from => {
    let moved = 0, kept = 0; const left = [], gave = [], clash = new Set();
    for (const [n, list] of values.get(from.ident) || new Map()) {
      const ok = list.filter(v => convert(from, into, v));
      moved += ok.length; kept += list.length - ok.length;
      if (ok.length < list.length) left.push(n);
      if (ok.length) gave.push(n);
      const now = (held.get(n) || 0) + ok.length;
      if (!into.many && now > 1) clash.add(n);
      if (ok.length) held.set(n, now);
    }
    return { prop: from.id, moved, kept, left, gave, clash: [...clash] };
  });
}

// The words for what a change of kind does to the values, when the two kinds differ: said once in the merge's ask.
const kindWord = p => p.choice ? 'choices' : ({ node: 'nodes', page: 'nodes', date: 'dates', datetime: 'dates', number: 'numbers', checkbox: 'yes or no', url: 'links' })[p.type] || 'words';
function becomes(from, into) {
  const a = kindWord(from), b = kindWord(into);
  if (a === b) return '';
  const A = a[0].toUpperCase() + a.slice(1);
  if (b === 'nodes' && a !== 'yes or no') return `${A} become nodes: the node of that name, made where there is none`;
  if (b === 'words') return `${A} become words: ${a === 'nodes' ? 'the name of each' : 'each as it reads'}`;
  return `${A} become ${b} where they read as ${b === 'yes or no' ? 'yes or no' : b === 'choices' ? `one of ${into.title}'s choices` : b}`;
}

S.values = { family, convert, preview, dayOf, becomes };
})();
