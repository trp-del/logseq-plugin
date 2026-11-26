/* What an export holds, decided. No Logseq here. A page, or some bullets, comes in as the facts the ground read, and both
   writers (core/markdown.js, core/paper.js) draw it from what is decided here, so the two never differ in what they say.
   A sheet: { kind: 'page' | 'blocks', title, tags: [name], properties: [property], nodes: [node], tagged: [node], names }
     names: uuid -> a node's name; title and a node's words are as stored, a link as [[uuid]].
     tagged: on a tag's page, the nodes carrying the tag, after the page's own.
   A property: { ident, name, type, values: [{ text, day?, time?, url? }] }   day: 20261004; time: milliseconds
     node(facts)                a node: { uuid, kind, words, heading, display, lang, tags, task, properties, numbered, image,
                                file, highlight, query, children }; kind 'block' | 'image' | 'file' | 'highlight' | 'query' |
                                'embed' (another node shown here) | 'value' and 'template' (never written)
     layout(sheet, options)     what is written, in order: { node, level } (level 0 a paragraph, 1 to 4 a heading, with
                                { under } nothing: a paragraph's own lines follow it) and { list, numbered, items:
                                [{ node, under }] }. A short top line with lines under it reads as a heading, and bullets
                                begin one level further in.
     head(sheet, options)       { kicker, title, subtitle, byline: [words], tags, properties: [{ name, value }] }
     meta(sheet, node, options) what is said under a node's words: its shown properties, its task's days and priority
     tags(node, options, all)   the tags written after its words (all: every tag, for a table's column)
     state(task)                'todo' | 'doing' | 'done' | 'off', Logseq's four
     inline(words, names)       the words in parts, as core/words.js reads them, with { kind: 'math' | 'image' } beside
     propertiesIn(sheet, role)  every property the sheet carries, with how often: role 'head' (the page's own; for bullets,
                                the chosen bullets') or 'nodes' (those under)
     choices(saved)             what the export window keeps, from the words it was saved as, each value one it offers
     options(sheet, choices, today)   the choices as the writers take them
     lines(choices, sheet), withLines(choices, sheet, lines)   the line above and under the title, kept for each page
     fileName(sheet), freeName(name, taken)   the file's name; the next free one, "Notes 2.md" */
(function (root) {
const W = typeof module !== 'undefined' && module.exports ? require('./words.js') : root.PluginDoor.words;
const IMAGE = /^(png|jpe?g|gif|webp|svg|avif|heic|bmp|tiff?)$/i;
const UUID = '[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}';

function node(f) {
  const n = { uuid: f.uuid || '', kind: 'block', words: String(f.words ?? ''), heading: 0, display: f.display || '', lang: f.lang || '', tags: [...(f.tags || [])],
    task: f.task || null, properties: f.properties || [], numbered: !!f.numbered, image: null, file: null, highlight: null, query: null, children: [] };
  const marked = n.words.match(/^(#{1,6})\s+([\s\S]*)$/);
  n.heading = marked ? marked[1].length : typeof f.heading === 'number' ? Math.min(6, Math.max(0, f.heading)) : f.heading === true ? 1 : 0;
  if (marked) n.words = marked[2];
  if (n.task && !n.tags.includes('Task')) n.tags.push('Task');   // where no mark is drawn the tag is the only sign
  const asset = String(f.asset || '');
  if (f.template) n.kind = 'template';
  else if (f.value && !asset) n.kind = 'value';
  else if (asset) {
    const file = `assets/${n.uuid}.${asset}`;
    if (IMAGE.test(asset)) { n.kind = 'image'; n.image = { file, name: n.words, width: Number(f.width) || 0 }; }
    else { n.kind = 'file'; n.file = { file, name: n.words }; }
  } else if (f.highlight) { n.kind = 'highlight'; n.highlight = f.highlight; }
  else if (f.query != null) { n.kind = 'query'; n.query = { text: String(f.query), columns: null, rows: [] }; }
  else if (f.embed) n.kind = 'embed';
  return n;
}
const written = n => !!n && n.kind !== 'value' && n.kind !== 'template';
const kids = n => (n.children || []).filter(written);
const empty = n => !n.words.trim() && !kids(n).length && !n.image && !n.file && !n.query && n.kind !== 'embed';
function all(nodes, out = []) {
  for (const n of nodes || []) { if (!written(n)) continue; out.push(n); all(n.children, out); if (n.query) all(n.query.rows, out); }
  return out;
}
const everything = sheet => all([...(sheet.nodes || []), ...(sheet.tagged || [])]);
const headNode = (sheet, n) => sheet.kind === 'blocks' && (sheet.nodes || []).includes(n);

const dayDate = day => new Date(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100);
// A day as the Mac writes it: "4 Oct 2026"; a date with a time says the time too.
function said(value, locale) {
  if (value.day) return dayDate(value.day).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  if (value.time) { const at = new Date(value.time), time = at.getHours() || at.getMinutes() ? ' ' + at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '';
    return at.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) + time; }
  return String(value.text ?? '');
}
const longDay = (day, locale) => dayDate(day).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
const valuesSaid = (property, locale) => property.values.map(value => said(value, locale)).filter(Boolean).join(', ');
const among = (shown, property) => !shown || shown.has(property.ident);
function meta(sheet, n, options) {
  const shown = headNode(sheet, n) ? options.shownHead : options.shownNodes;
  const out = n.properties.filter(p => among(shown, p)).map(p => { const value = valuesSaid(p, options.locale); return value ? `${p.name}: ${value}` : ''; }).filter(Boolean);
  if (n.task && options.tasks) {
    for (const [name, key] of [['Deadline', 'deadline'], ['Scheduled', 'scheduled']]) if (n.task[key]) out.push(`${name}: ${said(n.task[key], options.locale)}`);
    if (n.task.priority) out.push(`Priority: ${n.task.priority}`);
  }
  return out;
}
// The tags a row carries: those its words do not already say; while task marks are drawn, a task leaves off the tag Task.
function tags(n, options, every = false) {
  if (!options.tags) return [];
  const inWords = every ? new Set() : new Set(inline(n.words, options.names).filter(part => part.kind === 'tag').map(part => part.text));
  return n.tags.filter(tag => !inWords.has(tag) && !(options.tasks && n.task && tag === 'Task'));
}
const state = task => task.status === 'canceled' ? 'off' : task.status === 'done' ? 'done' : task.status === 'doing' || task.status === 'in-review' ? 'doing' : 'todo';

// Another node shown in place stands for what it holds.
const flat = nodes => (nodes || []).flatMap(n => !written(n) || empty(n) ? [] : n.kind === 'embed' ? flat(n.children) : [n]);
const plainBlock = n => n.kind === 'block' && !n.display;
function readsAsHeading(sheet, n, options) {
  const words = inline(n.words, options.names).map(part => part.text).join('').trim();
  return plainBlock(n) && !n.task && kids(n).length > 0 && words.length > 0 && words.length <= 70 && !/[.!?:,;]$/.test(words) && !meta(sheet, n, options).length;
}
function blocks(sheet, nodes, depth, options) {
  const items = flat(nodes), out = [];
  const listed = n => depth > 1 || n.numbered;
  for (let i = 0; i < items.length; i++) {
    const n = items[i];
    if (listed(n)) {
      // One list for the bullets of one kind that stand together: numbered, or not.
      const group = [n];
      while (i + 1 < items.length && listed(items[i + 1]) && items[i + 1].numbered === n.numbered) group.push(items[++i]);
      out.push({ list: true, numbered: n.numbered, items: group.map(one => ({ node: one, under: blocks(sheet, one.children, Math.max(depth, 1) + 1, options) })) });
      continue;
    }
    const level = plainBlock(n) && n.heading ? Math.min(n.heading + (sheet.title ? 1 : 0), 4) : depth === 0 && readsAsHeading(sheet, n, options) ? 2 : 0;
    out.push({ node: n, level }, ...blocks(sheet, n.children, depth + 1, options));
  }
  return out;
}
const layout = (sheet, options) => ({ blocks: blocks(sheet, sheet.nodes, 0, options), tagged: blocks(sheet, sheet.tagged, 0, options) });

function head(sheet, options) {
  const lines = options.title || {};
  return { kicker: lines.kicker || '', title: sheet.title || '', subtitle: lines.subtitle || '',
    byline: [lines.date ? longDay(lines.date, options.locale) : '', lines.preparedBy ? `Prepared by ${lines.preparedBy}` : ''].filter(Boolean),
    tags: options.tags ? sheet.tags || [] : [],
    properties: (sheet.properties || []).filter(p => among(options.shownHead, p)).map(p => ({ ident: p.ident, name: p.name, value: valuesSaid(p, options.locale) })).filter(p => p.value) };
}

/* The words in parts. Mathematics between dollars is one part, kept as written; a picture written into the words is one part;
   a reference to a bullet reads as its words. */
function inline(words, names) {
  const read = String(words ?? '').replace(new RegExp(`\\[([^\\]\\n]+)\\]\\(\\(\\((${UUID})\\)\\)\\)`, 'g'), '$1')
    .replace(new RegExp(`\\(\\((${UUID})\\)\\)`, 'g'), (whole, uuid) => String(names?.get(uuid.toLowerCase()) || '…'));
  const out = [];
  const pieces = read.split(/(!\[[^\]\n]*\]\([^)\s]+\)|(?<![\w$\\])\$(?!\s)[^$\n]+?(?<!\s)\$(?![\w$]))/);
  pieces.forEach((piece, i) => {
    if (!piece) return;
    if (i % 2 === 0) out.push(...W.parts(piece, names));
    else if (piece.startsWith('!')) { const [, alt, href] = piece.match(/^!\[([^\]\n]*)\]\(([^)\s]+)\)$/); out.push({ kind: 'image', text: alt, href }); }
    else out.push({ kind: 'math', text: piece.slice(1, -1) });
  });
  return out;
}

function propertiesIn(sheet, role) {
  const found = new Map();
  const add = p => { const one = found.get(p.ident) || { ident: p.ident, name: p.name, type: p.type, count: 0 }; one.count += 1; found.set(p.ident, one); };
  if (role !== 'nodes') for (const p of sheet.properties || []) add(p);
  for (const n of everything(sheet)) if (!role || headNode(sheet, n) === (role === 'head')) for (const p of n.properties) add(p);
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const OFFERED = {
  target: [['pdf', 'PDF'], ['md', 'Markdown']],
  paper: [['A4', 'A4'], ['Letter', 'Letter']],
  margins: [['narrow', 'Narrow'], ['normal', 'Normal'], ['wide', 'Wide']],
  size: [['small', 'Small'], ['normal', 'Normal'], ['large', 'Large']],
  links: [['plain', 'Links as words'], ['wiki', '[[Wikilinks]]'], ['file', 'Links to .md files']],
  zoom: [['fit', 'Fit the window'], ['75', '75%'], ['100', '100%'], ['125', '125%'], ['150', '150%']],
};
const DEFAULTS = { target: 'pdf', paper: 'A4', margins: 'normal', size: 'normal', links: 'plain', zoom: 'fit', footer: '', preparedBy: '', folder: '',
  pageNumbers: true, tags: true, tasks: true, titleDate: true, frontMatter: false, side: false, hiddenHead: [], hiddenNodes: [], titles: {} };
function choices(saved) {
  let kept = saved;
  if (typeof saved === 'string') { try { kept = JSON.parse(saved); } catch (error) { kept = null; } }
  if (!kept || typeof kept !== 'object' || Array.isArray(kept)) kept = {};
  const out = {};
  for (const [key, fallback] of Object.entries(DEFAULTS)) {
    const value = kept[key];
    if (OFFERED[key]) out[key] = OFFERED[key].some(([k]) => k === value) ? value : fallback;
    else if (Array.isArray(fallback)) out[key] = Array.isArray(value) ? value.filter(one => typeof one === 'string') : [];
    else if (key === 'titles') out[key] = value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
    else out[key] = typeof value === typeof fallback ? value : fallback;
  }
  return out;
}
const lines = (chosen, sheet) => { const kept = sheet.title ? chosen.titles[sheet.title] : null; return { kicker: String(kept?.kicker || ''), subtitle: String(kept?.subtitle || '') }; };
function withLines(chosen, sheet, next) {
  if (!sheet.title) return chosen;
  const titles = { ...chosen.titles };
  if (next.kicker || next.subtitle) titles[sheet.title] = { kicker: next.kicker || '', subtitle: next.subtitle || '' }; else delete titles[sheet.title];
  return { ...chosen, titles };
}
const shownBut = (sheet, role, hidden) => hidden.length ? new Set(propertiesIn(sheet, role).map(p => p.ident).filter(ident => !hidden.includes(ident))) : null;
function options(sheet, chosen, today, locale) {
  return { tags: chosen.tags, tasks: chosen.tasks, links: chosen.links, frontMatter: chosen.frontMatter, names: sheet.names, locale,
    shownHead: shownBut(sheet, 'head', chosen.hiddenHead), shownNodes: shownBut(sheet, 'nodes', chosen.hiddenNodes),
    title: sheet.title ? { ...lines(chosen, sheet), date: chosen.titleDate ? today : 0, preparedBy: chosen.preparedBy.trim() } : null };
}

const clean = name => String(name ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').replace(/^\.+/, '').trim().slice(0, 120).trim();
const plainWords = (sheet, words) => inline(words, sheet.names).map(part => part.text).join('').split('\n')[0];
const fileName = sheet => clean(sheet.title ? plainWords(sheet, sheet.title) : plainWords(sheet, flat(sheet.nodes)[0]?.words || '').slice(0, 60)) || 'Logseq export';
// A file of that name is left alone: the new one gets the next number. taken(name) answers whether there is one.
async function freeName(name, taken) {
  const [, stem, ending = ''] = name.match(/^(.*?)(\.[^.]*)?$/);
  let next = name;
  for (let n = 2; await taken(next); n++) next = `${stem} ${n}${ending}`;
  return next;
}

const api = { node, written, kids, empty, all, everything, said, meta, tags, state, layout, head, inline, propertiesIn, OFFERED, choices, lines, withLines, options, fileName, freeName };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).export = api;
})(typeof window !== 'undefined' ? window : globalThis);
