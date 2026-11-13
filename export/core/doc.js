/* The document: what the adapter (logseq/db.js) reads out of a page or some blocks, and what every writer (Markdown,
   HTML) reads. Nothing of Logseq's ids survives here but a node's uuid: a link is a name, a property a name with values
   as words, a date a number. Pure, runs in Node; test/graph.js makes one by hand.

   document = { title, kind: 'page' | 'blocks', journalDay, tags: [name], properties: [prop], nodes: [node], tagged: [node] }
     tagged: on a tag's page, the nodes carrying the tag (Logseq lists them under the page), after the page's own nodes.
   prop = { ident, name, type, values: [value] }   value = { text, day?, ms?, url?, id? }
     type as Logseq names it: default (words), number, date, datetime, checkbox, url, node, page, or a choice's property.
   node = { uuid, kind, text, heading, display, lang, tags, task, properties, numbered, journalDay, children, image, file, highlight, query }
     kind: 'block' (words), 'image' (a picture in the graph's assets), 'file' (a PDF or other file), 'highlight' (a PDF
       highlight: text is the passage, highlight = { page, pdf, area }), 'query' (query = { text, columns, rows }),
       'embed' (another node shown here: children are what it holds), 'value' (a property's value kept as a block;
       never shown), 'template' (never shown).
     text: the words, with links as [[Name]], tags as #[[Name]] (core/inline.js reads them).
     heading: 0 or 1..6.  display: '' | 'code' | 'quote' | 'math'.  lang: a code block's language.
     task: null, or { status, priority, deadline, scheduled }; status one of todo, doing, done, canceled, in-review,
       backlog or '' (a task with no status yet); deadline and scheduled a day number, milliseconds, or null.
     numbered: the node's children are a numbered list.  journalDay: the day of the journal page the node is on. */
(function () {
const E = (window.DbExport ||= {});
const { dates } = E;

const node = (over = {}) => ({ uuid: '', kind: 'block', text: '', heading: 0, display: '', lang: '', tags: [], task: null, properties: [],
  numbered: false, journalDay: null, children: [], image: null, file: null, highlight: null, query: null, ...over });
const document = (over = {}) => ({ title: '', kind: 'blocks', journalDay: null, tags: [], properties: [], nodes: [], tagged: [], ...over });

const shown = n => n && n.kind !== 'value' && n.kind !== 'template';
const kids = n => (n.children || []).filter(shown);
const isEmpty = n => !String(n.text || '').trim() && !kids(n).length && !n.image && !n.file && !n.query && n.kind !== 'embed';
function collect(nodes, out = []) {
  for (const n of nodes || []) { if (!shown(n)) continue; out.push(n); collect(n.children, out); if (n.query) collect(n.query.rows, out); }
  return out;
}

// A property's values as words: "Provider: Dr. Mei Chen, Dr. Kim". A date reads through core/dates.js.
const valueText = (v, locale) => v.day != null ? dates.fmt.day(v.day, locale) : v.ms != null ? dates.fmt.day(v.ms, locale) + (dates.fmt.time(v.ms, locale) ? ' ' + dates.fmt.time(v.ms, locale) : '') : String(v.text ?? '');
const propertyText = (p, locale) => { const vs = p.values.map(v => valueText(v, locale)).filter(Boolean); return vs.length ? `${p.name}: ${vs.join(', ')}` : ''; };
// The properties to write for a node, by the chosen set (null: all), each as words.
/* A node whose properties count as the head's: for an export of blocks, the blocks chosen themselves (a page's own properties are doc.properties). */
const headNode = (doc, n) => doc.kind === 'blocks' && (doc.nodes || []).includes(n);
const metaOf = (n, shownSet, locale, leave = []) => (n.properties || []).filter(p => (!shownSet || shownSet.has(p.ident)) && !leave.includes(p.ident)).map(p => propertyText(p, locale)).filter(Boolean);

// Every property found in the document, with how many nodes hold it: the export window lists them to tick.
/* The properties a document carries, each once with how often. role: 'head' for the page's own (for blocks, the chosen
   blocks'), 'nodes' for those of the nodes under, nothing for all. */
function propertiesIn(doc, role) {
  const found = new Map();
  const add = p => { const e = found.get(p.ident) || { ident: p.ident, name: p.name, type: p.type, count: 0 }; e.count += 1; found.set(p.ident, e); };
  if (role !== 'nodes') for (const p of doc.properties || []) add(p);
  for (const n of collect([...doc.nodes, ...(doc.tagged || [])])) { const head = headNode(doc, n); if (role === 'head' ? head : role === 'nodes' ? !head : true) for (const p of n.properties || []) add(p); }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/* Dates a dated layout can place nodes by: the document's own date properties, then Logseq's task dates, then the journal
   day. 'auto' tries them in that order on each node (an End or Until date last: it closes a stay, it does not open one). */
const isEnd = ident => /(^|[-/])(end|ends|until|to|finish|finished|discharged?|out)([-]|$)/i.test(ident.split('/').pop());
function dateChoices(doc) {
  const all = propertiesIn(doc).filter(p => p.type === 'date' || p.type === 'datetime');
  const nodes = collect([...doc.nodes, ...(doc.tagged || [])]);
  const choices = all.map(p => ({ key: p.ident, name: p.name }));
  if (nodes.some(n => n.task?.deadline != null)) choices.push({ key: 'deadline', name: 'Deadline' });
  if (nodes.some(n => n.task?.scheduled != null)) choices.push({ key: 'scheduled', name: 'Scheduled' });
  if (nodes.some(n => n.journalDay != null) || doc.journalDay != null) choices.push({ key: 'journal', name: 'Journal day' });
  return choices;
}
const autoKeys = doc => { const c = dateChoices(doc).map(d => d.key); return [...c.filter(k => !isEnd(k) && k !== 'journal'), ...c.filter(k => k === 'journal'), ...c.filter(isEnd)]; };
function dateOf(n, key) {
  if (key === 'journal') return n.journalDay ?? null;
  if (key === 'deadline') return n.task?.deadline ?? null;
  if (key === 'scheduled') return n.task?.scheduled ?? null;
  const p = (n.properties || []).find(p => p.ident === key);
  const v = p?.values?.[0];
  return v ? (v.day ?? v.ms ?? null) : null;
}
/* The entries of a dated layout: every node with a date of its own, with its children; a node without one that holds
   dated nodes is passed through; one with nothing dated goes under "No date". A query's rows take its place. Sorted
   earliest first, or newest first; the undated last. Each entry says which key dated it and a later own date (End). */
function entries(doc, { dateKey = 'auto', newestFirst = false } = {}) {
  const keys = dateKey === 'auto' ? autoKeys(doc) : [dateKey];
  const dated = n => { for (const k of keys) { const w = dateOf(n, k); if (w != null) return { when: w, key: k }; } return null; };
  const hasDated = n => kids(n).some(c => dated(c) || hasDated(c)) || (n.query?.rows || []).some(r => dated(r));
  const out = [];
  const walk = nodes => {
    for (const n of nodes || []) {
      if (!shown(n) || isEmpty(n)) continue;
      if (n.query) { walk(n.query.rows); continue; }
      if (n.kind === 'embed') { walk(n.children); continue; }
      const d = dated(n);
      if (d) {
        let end = null;
        for (const p of n.properties || []) {
          if (p.ident === d.key || !(p.type === 'date' || p.type === 'datetime')) continue;
          const w = p.values[0] ? (p.values[0].day ?? p.values[0].ms ?? null) : null;
          if (w != null && dates.scale(w) > dates.scale(d.when)) { end = { when: w, key: p.ident }; break; }
        }
        out.push({ node: n, when: d.when, key: d.key, end });
      } else if (hasDated(n)) walk(n.children);
      else out.push({ node: n, when: null, key: null, end: null });
    }
  };
  walk([...doc.nodes, ...(doc.tagged || [])]);
  out.sort((a, b) => (a.when == null) - (b.when == null) || (newestFirst ? dates.scale(b.when) - dates.scale(a.when) : dates.scale(a.when) - dates.scale(b.when)));
  return out;
}

// The tags to write after a node's words: those not already written in them as #[[Name]].
const tagsToAppend = n => (n.tags || []).filter(t => !String(n.text || '').includes(`#[[${t}]]`));
/* The tags a row carries: while task boxes are drawn, a task row's tag Task is left off, since the box says it; with no
   boxes the tag stays, then the only sign. `all`: every tag (a table's Tags column), not only those to write after the words. */
const tagsOf = (n, boxes, all = false) => (all ? n.tags || [] : tagsToAppend(n)).filter(t => !(boxes && n.task && t === 'Task'));

const taskDone = t => t && (t.status === 'done' || t.status === 'canceled');

// The layouts, as the export window offers them.
const layouts = [
  { key: 'document', name: 'Document', about: 'Paragraphs, like a report. A short line with lines under it becomes a heading.' },
  { key: 'outline', name: 'Outline', about: 'Bullets, nested as in Logseq.' },
  { key: 'prose', name: 'Prose', about: 'Flowing paragraphs under your # headings, each citation a number, the notes at the end.' },
  { key: 'timeline', name: 'Timeline', about: 'Every dated node under its date, earliest first, months as headings.' },
  { key: 'calendar', name: 'Calendar', about: 'One row per day: the day on the left, that day’s nodes on the right.' },
];
const dated = key => key === 'timeline' || key === 'calendar';
// In the document layout, a short top-level line with lines under it reads as a section heading.
const readsAsHeading = (n, depth, meta) => depth === 0 && kids(n).length > 0 && n.display === '' && !n.task && E.inline.words(n.text).length <= 70 && !/[.!?:,;]$/.test(n.text.trim()) && !meta.length;

/* Prose: the page as flowing paragraphs. Only a bullet started with # is a heading; every other line of words is a paragraph,
   and what stands by itself (a picture, code, a quotation, a query, a task with its box, a numbered list) stays as it is.
   The pieces, in the order of the page, for both writers:
     { kind: 'heading', node, depth, number }   depth 1.. by the headings it sits under (a ### right under a # is 2), number "2.1"
     { kind: 'para', parts: [node] }            the lines whose words make one paragraph, the first its own line
     { kind: 'block', node }                    a thing that stands by itself
     { kind: 'list', nodes, numbered }          bullets kept as a list
     { kind: 'rule' }                           between a tag's page and the nodes carrying the tag
   children: what the bullets under a line become: 'join' (sentences of its paragraph), 'each' (a paragraph each), 'list'
   (they stay bullets). tasks: a task keeps its box, so it stands alone. hasMeta(node): the node shows properties, so it
   starts a paragraph of its own, where they can stand under it. */
const PROSE_CHILDREN = ['join', 'each', 'list'];
function outline() {
  const levels = [], counts = [];
  return level => {
    while (levels.length && levels[levels.length - 1] >= level) levels.pop();
    const depth = levels.length + 1;
    counts[depth - 1] = (counts[depth - 1] || 0) + 1; counts.length = depth; levels.push(level);
    return { depth, number: counts.join('.') };
  };
}
function prose(doc, { children = 'join', tasks = true, hasMeta = () => false } = {}) {
  const pieces = [], next = outline();
  let para = null;
  const plain = n => n.kind === 'block' && !n.display && !n.query && !(n.task && tasks) && String(n.text || '').trim();
  const walk = (nodes, under) => {
    for (const n of (nodes || []).filter(n => shown(n) && !isEmpty(n))) {
      if (n.kind === 'embed') { walk(n.children, under); continue; }
      if (n.heading && plain(n)) { para = null; pieces.push({ kind: 'heading', node: n, ...next(n.heading) }); walk(kids(n), null); para = null; continue; }
      if (!plain(n)) {
        para = null; pieces.push({ kind: 'block', node: n });
        if (!n.query && kids(n).length) pieces.push({ kind: 'list', nodes: kids(n), numbered: n.numbered });
        continue;
      }
      if (under && children === 'join' && para && !hasMeta(n)) para.parts.push(n);
      else { para = { kind: 'para', parts: [n] }; pieces.push(para); }
      const ks = kids(n);
      if (ks.length && (n.numbered || children === 'list')) { pieces.push({ kind: 'list', nodes: ks, numbered: n.numbered }); para = null; }
      else if (ks.length) walk(ks, n);
      if (!under) para = null;
    }
  };
  walk(doc.nodes, null);
  if (doc.tagged?.length) { if (pieces.length) pieces.push({ kind: 'rule' }); para = null; walk(doc.tagged, null); }
  return pieces;
}
/* The notes of a document: each citation numbered as it comes, the same source at the same page once (as Endnotes numbers them). */
function notebook() {
  const seen = new Map(), list = [];
  return { list, number(tok) { const key = `${tok.id}|${tok.page}`; if (!seen.has(key)) { seen.set(key, list.length + 1); list.push({ n: list.length + 1, tok }); } return seen.get(key); } };
}
const proseOpts = p => ({ children: PROSE_CHILDREN.includes(p?.children) ? p.children : 'join', contents: p?.contents !== false, numbered: p?.numbered !== false, titleSheet: !!p?.titleSheet, sectionSheets: !!p?.sectionSheets,
  runIn: !!p?.runIn, notesHead: typeof p?.notesHead === 'string' ? p.notesHead.trim() : 'Notes' });   // runIn: a heading under a # leads its first paragraph, in bold; notesHead: the words over the notes, none when empty

E.doc = { prose, notebook, proseOpts, PROSE_CHILDREN, tagsToAppend, tagsOf, node, document, shown, kids, isEmpty, collect, valueText, propertyText, metaOf, headNode, propertiesIn, dateChoices, autoKeys, dateOf, entries, taskDone, layouts, dated, readsAsHeading };
})();
