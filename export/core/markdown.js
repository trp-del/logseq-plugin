/* The document as Markdown (CommonMark with the GitHub extras: task boxes, tables, strike-through). Pure, runs in Node.
   Options: layout (document, outline, timeline, calendar), links ('plain', 'wiki', 'file'; core/inline.js), tags (false
   leaves them out), tasks (false: a task's words only, no box), shown (a Set of property idents to write, null for all),
   frontMatter (the page's properties as YAML at the top), titleBlock { kicker, subtitle, date, preparedBy }, dateKey and
   newestFirst for the dated layouts, images (a function from a file path to what the link should say), locale. */
(function () {
const E = (window.DbExport ||= {});
const { inline, doc: D, dates } = E;

function toMarkdown(doc, o = {}) {
  const opts = { layout: 'document', links: 'plain', tags: true, tasks: true, shown: null, shownHead: undefined, shownNodes: undefined, frontMatter: false, images: f => f, locale: undefined, ...o };
  // shown: one Set of property idents for both (null: all); shownHead / shownNodes: a Set for the head's and the nodes' apart.
  const setHead = opts.shownHead !== undefined ? opts.shownHead : opts.shown, setNodes = opts.shownNodes !== undefined ? opts.shownNodes : opts.shown;
  const shownOf = n => D.headNode(doc, n) ? setHead : setNodes;
  // Prose: each citation is a footnote, [^1], and the footnotes are written after the text.
  const isProse = opts.layout === 'prose', pr = D.proseOpts(opts.prose), notes = D.notebook();
  const cite = isProse ? tok => `[^${notes.number(tok)}]` : null;
  const md = (text, close = false) => inline.toMarkdown(isProse ? inline.refs(inline.parse(text), close) : inline.parse(text), { links: opts.links, tags: opts.tags, images: opts.images, cite });
  const out = [];
  const push = (...lines) => out.push(...lines);
  const title = doc.title ? md(doc.title) : '';

  // The head: front matter or the title, the lines around it, the page's properties.
  const tb = opts.titleBlock || {};
  const pageMeta = D.metaOf({ properties: doc.properties }, setHead, opts.locale);
  if (opts.frontMatter && (doc.properties.length || doc.tags.length)) {
    push('---');
    if (doc.title) push(`title: ${yaml(inline.words(doc.title))}`);
    if (doc.tags.length) push(`tags: [${doc.tags.map(t => yaml(t)).join(', ')}]`);
    for (const p of doc.properties) if (!setHead || setHead.has(p.ident)) {
      const vs = p.values.map(v => D.valueText(v, opts.locale)).filter(Boolean);
      if (vs.length) push(`${yamlKey(p.name)}: ${vs.length === 1 ? yaml(vs[0]) : `[${vs.map(yaml).join(', ')}]`}`);
    }
    push('---', '');
  }
  if (tb.kicker) push(md(tb.kicker), '');
  if (title) push(`# ${title}`);
  if (tb.subtitle) push(`*${md(tb.subtitle)}*  `);
  const byline = [tb.date ? dates.fmt.long(tb.date, opts.locale) : '', tb.preparedBy ? `Prepared by ${tb.preparedBy}` : ''].filter(Boolean);
  if (byline.length) push(byline.map(inline.mdEscape).join(' · '));
  if (title || byline.length || tb.subtitle) push('');
  if (!opts.frontMatter) {
    const tagLine = opts.tags && doc.tags.length ? doc.tags.map(t => /\s/.test(t) ? `#[[${t}]]` : `#${t}`).join(' ') : '';
    if (pageMeta.length || tagLine) { push(...[...pageMeta.map(m => inline.mdEscape(m)), tagLine].filter(Boolean).map(l => l + '  '), ''); }
  }

  const indent = (text, by) => text.split('\n').map((l, i) => (l || i === 0 ? by + l : l)).join('\n');
  const box = n => opts.tasks && n.task ? (D.taskDone(n.task) ? '[x] ' : '[ ] ') : '';
  const struck = (n, text) => opts.tasks && n.task?.status === 'canceled' ? `~~${text}~~` : text;
  const tagsOf = n => { const ts = D.tagsOf(n, opts.tasks); return opts.tags && ts.length ? ' ' + ts.map(t => /\s/.test(t) ? `#[[${t}]]` : `#${t}`).join(' ') : ''; };
  const meta = (n, leave = []) => D.metaOf(n, shownOf(n), opts.locale, leave).map(inline.mdEscape).join(' · ');
  const taskMeta = n => {
    if (!n.task || !opts.tasks) return [];
    const parts = [];
    if (n.task.deadline != null) parts.push(`Deadline: ${dates.fmt.day(n.task.deadline, opts.locale)}`);
    if (n.task.scheduled != null) parts.push(`Scheduled: ${dates.fmt.day(n.task.scheduled, opts.locale)}`);
    if (n.task.priority) parts.push(`Priority: ${n.task.priority}`);
    return parts;
  };

  // One node's own lines (not its children), as a block of Markdown: text, then its properties as a quiet line.
  function body(n, { leave = [], asItem = false } = {}) {
    const lines = [];
    const m = [meta(n, leave), ...taskMeta(n)].filter(Boolean).join(' · ');
    if (n.kind === 'image') lines.push(`![${inline.mdEscape(n.image.name || '')}](${opts.images(n.image.file)})`);
    else if (n.kind === 'file') lines.push(`[${inline.mdEscape(n.file.name || n.file.file)}](${opts.images(n.file.file)})`);
    else if (n.kind === 'highlight') {
      const cite = `(${inline.mdEscape(n.highlight.pdf || 'PDF')}, p. ${n.highlight.page})`;
      if (n.highlight.area) lines.push(`![${inline.mdEscape(n.highlight.pdf || 'PDF')}, p. ${n.highlight.page}](${opts.images(n.highlight.area.file)})  `, cite);
      else lines.push(`> “${md(n.text).trim()}”`, `> — ${cite}`);
    } else if (n.display === 'code') lines.push('```' + (n.lang || ''), ...String(n.text).replace(/\n$/, '').split('\n'), '```');
    else if (n.display === 'math') lines.push('$$', ...String(n.text).trim().split('\n'), '$$');
    else if (n.display === 'quote') lines.push(...md(n.text).split('\n').map(l => '> ' + l));
    else if (n.text.trim()) {
      const text = struck(n, md(n.text).trim());
      const h = n.heading && !asItem ? '#'.repeat(Math.min(6, n.heading + (title ? 1 : 0))) + ' ' : '';
      lines.push(h + box(n) + (asItem && n.heading ? `**${text}**` : text) + tagsOf(n));
    } else if (n.tags.length && opts.tags) lines.push(box(n) + tagsOf(n).trim());
    if (m) {
      const last = lines[lines.length - 1] || '';
      if (/^(>|```|\$\$)/.test(last) || /^!\[/.test(last)) lines.push('');   // after a quotation, code or a picture: its own paragraph
      else if (lines.length) lines[lines.length - 1] = last.replace(/ *$/, '  ');   // a hard break: the words, then the properties under them
      lines.push(`*${m}*`);
    }
    return lines.join('\n');
  }

  // A query: its words in bold, then its rows as a table (the columns of its view) or a list.
  function queryLines(n, depth, asList) {
    const label = inline.words(n.text);
    const lines = [];
    if (label) lines.push(asList ? `**${md(n.text).trim()}**` : `**${md(n.text).trim()}**`, ...(asList ? [] : ['']));
    const rows = n.query.rows.filter(D.shown);
    if (n.query.columns?.length && !asList) {
      const cols = n.query.columns;
      const cell = (r, c) => {
        const name = c.toLowerCase();
        if (name === 'name' || name === 'block' || name === 'title') return md(r.text.split('\n')[0]).trim();
        if (name === 'tags') return opts.tags ? D.tagsOf(r, opts.tasks, true).join(', ') : '';
        const p = (r.properties || []).find(p => p.name.toLowerCase() === name);
        return p ? inline.mdEscape(p.values.map(v => D.valueText(v, opts.locale)).join(', ')) : '';
      };
      lines.push(`| ${cols.map(inline.mdEscape).join(' | ')} |`, `| ${cols.map(() => '---').join(' | ')} |`);
      for (const r of rows) lines.push(`| ${cols.map(c => cell(r, c).replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ')} |`);
    } else {
      for (const r of rows) { const m = [meta(r), ...taskMeta(r)].filter(Boolean).join(' · '); lines.push(`- ${box(r)}${struck(r, md(r.text.split('\n')[0]).trim())}${tagsOf(r)}${m ? `  \n  *${m}*` : ''}`); }
    }
    return lines.join('\n');
  }

  // The document and outline layouts. A blank line separates paragraphs and lists; items of one list stay together.
  // `level` is how deep a list is nested (its indent); a list starts where the layout says, and its items' children nest.
  const blank = () => { if (out.length && out[out.length - 1] !== '') push(''); };
  const para = n => n.task && opts.tasks && n.display === '' && n.kind === 'block' ? `- ${body(n, { asItem: true }).replace(/\n/g, '\n  ')}` : body(n);
  const isItem = s => /^- \[/.test(s || '');
  function render(nodes, depth, numbered = false, ind = null) {
    const items = nodes.filter(n => D.shown(n) && !D.isEmpty(n));
    if (!items.length) return;
    const asList = opts.layout === 'outline' || depth > 1 || numbered || ind != null;
    const lead = ind == null ? '' : ind;
    let k = 0;
    if (asList && ind == null) blank();
    for (const n of items) {
      if (n.kind === 'embed') { render(n.children, depth, n.numbered, asList ? lead : null); continue; }
      if (asList) {
        const bullet = numbered ? `${++k}. ` : '- ';
        const pad = ' '.repeat(bullet.length);
        const inner = n.query ? queryLines(n, depth, true) : body(n, { asItem: true });
        push(lead + bullet + indent(inner, lead + pad).replace(/^ +/, ''));
        render(n.children, depth + 1, n.numbered, lead + pad);   // nested under the item's words, as CommonMark reads it
        continue;
      }
      const m = meta(n);
      if (n.query) { blank(); push(queryLines(n, depth, false)); blank(); }
      else if (opts.layout === 'document' && !n.heading && D.readsAsHeading(n, depth, m ? [m] : [])) { blank(); push(`## ${struck(n, md(n.text).trim())}${tagsOf(n)}`); blank(); }
      else { const line = para(n); if (!(isItem(line) && isItem(out[out.length - 1]))) blank(); push(line); if (!isItem(line)) blank(); }
      render(n.children, depth + 1, n.numbered);
    }
    if (asList && ind == null) blank();
  }
  // The dated layouts: entries under month headings; the calendar groups a day's entries under its day.
  function renderDated() {
    const es = D.entries(doc, { dateKey: opts.dateKey || 'auto', newestFirst: !!opts.newestFirst });
    let month = null, day = null;
    for (const e of es) {
      const m = e.when == null ? 'No date' : dates.fmt.month(e.when, opts.locale);
      if (m !== month) { blank(); push(`## ${m}`, ''); month = m; day = null; }
      const n = e.node;
      const leave = [e.key, e.end?.key].filter(Boolean);
      const under = opts.under ? (n.properties || []).find(p => p.ident === opts.under) : null;
      const underText = under ? under.values.map(v => D.valueText(v, opts.locale)).join(', ') : '';
      if (opts.layout === 'calendar') {
        const d = e.when == null ? '' : `${dates.fmt.weekday(e.when, opts.locale)} ${dates.fmt.short(e.when, opts.locale)}`;
        if (d !== day) { blank(); if (d) push(`**${inline.mdEscape(d)}**`, ''); day = d; }
        const time = e.when == null ? '' : dates.fmt.time(e.when, opts.locale);
        const b = body(n, { leave: [...leave, opts.under], asItem: true }).replace(/\n/g, '\n  ');
        push('- ' + (time ? b.replace(/^(\[[ x]\] )?/, `$1${time} `) : b));   // the box first, then the time, then the words
        render(n.children, 2, n.numbered, '  ');
      } else {
        blank();
        if (e.when != null) push(`**${inline.mdEscape(`${dates.fmt.weekday(e.when, opts.locale)} ${dates.fmt.span(e.when, e.end?.when, opts.locale)}`)}**${underText ? ' · ' + inline.mdEscape(underText) : ''}  `);
        const b = n.task && opts.tasks && n.display === '' && n.kind === 'block' ? `- ${body(n, { leave: [...leave, opts.under], asItem: true }).replace(/\n/g, '\n  ')}` : body(n, { leave: [...leave, opts.under] });
        push(b);
        render(n.children, 2, n.numbered);
      }
    }
  }

  /* Prose: the pieces of core/doc.js, then the footnotes. No contents list: a Markdown reader makes its own from the headings. */
  function renderProse() {
    const pieces = D.prose(doc, { children: pr.children, tasks: opts.tasks, hasMeta: n => !!meta(n) });
    for (const [at, piece] of pieces.entries()) {
      if (piece.ranIn) continue;
      if (piece.kind === 'heading' && pr.runIn && piece.depth > 1 && pieces[at + 1]?.kind === 'para') pieces[at + 1].lead = piece, piece.ranIn = true;
      else if (piece.kind === 'heading') { const n = piece.node; blank(); push(`${'#'.repeat(Math.min(6, piece.depth + (title ? 1 : 0)))} ${pr.numbered ? piece.number + ' ' : ''}${struck(n, md(n.text).trim())}${tagsOf(n)}`); blank(); }
      else if (piece.kind === 'para') {
        const joined = piece.parts.length > 1, m = meta(piece.parts[0]);
        const lead = piece.lead ? `**${pr.numbered ? piece.lead.number + ' ' : ''}${md(piece.lead.node.text, true).trim()}** ` : '';
        blank(); push(lead + piece.parts.map(n => struck(n, md(n.text, joined).trim()) + tagsOf(n)).join(' ') + (m ? `  \n*${m}*` : '')); blank();
      } else if (piece.kind === 'block') { const n = piece.node; if (n.query) { blank(); push(queryLines(n, 0, false)); blank(); } else { const line = para(n); if (!(isItem(line) && isItem(out[out.length - 1]))) blank(); push(line); if (!isItem(line)) blank(); } }
      else if (piece.kind === 'list') render(piece.nodes, 2, piece.numbered);
      else if (piece.kind === 'rule') { blank(); push('---', ''); }
    }
    if (notes.list.length) {
      blank();
      for (const { n, tok } of notes.list) {
        const source = inline.toMarkdown(tok.k, { links: opts.links, tags: false, images: false });
        push(`[^${n}]: ${source}${tok.page ? `, p. ${tok.page}` : ''}.`);
      }
    }
  }

  if (D.dated(opts.layout)) renderDated();
  else if (isProse) renderProse();
  else { render(doc.nodes, 0); if (doc.tagged?.length) { if (doc.nodes.length) push('---', ''); render(doc.tagged, 0); } }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+$/gm, m => m.length >= 2 ? '  ' : '').trim() + '\n';
}

const yaml = s => /^[\w .,'()-]*$/.test(s) && !/^(true|false|null|yes|no|~|\d.*)$/i.test(s) ? s : JSON.stringify(s);
const yamlKey = s => s.replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'property';

E.markdown = { toMarkdown };
})();
