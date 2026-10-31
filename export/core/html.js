/* The document as HTML, one shape for every use: the PDF (with a theme's stylesheet, core/themes.js), the live preview,
   and the clipboard (the same HTML with the theme's rules written inline, since a pasting app ignores stylesheets).
   Every element carries a named class, x-<name>; `cls(name)` makes the attribute, so a caller can write a style instead.
   Pure, runs in Node. Options as core/markdown.js, plus cls and images (a function from a file path to a URL the
   picture loads from). */
(function () {
const E = (window.DbExport ||= {});
const { inline, doc: D, dates } = E;
const esc = inline.escapeHtml;

function toHtml(doc, o = {}) {
  const opts = { layout: 'document', tags: true, tasks: true, shown: null, shownHead: undefined, shownNodes: undefined, images: f => f, locale: undefined, cls: null, ...o };
  // shown: one Set of property idents for both (null: all); shownHead / shownNodes: a Set for the head's and the nodes' apart.
  const setHead = opts.shownHead !== undefined ? opts.shownHead : opts.shown, setNodes = opts.shownNodes !== undefined ? opts.shownNodes : opts.shown;
  const shownOf = n => D.headNode(doc, n) ? setHead : setNodes;   // the head's properties and the nodes' are switched apart
  const cls = opts.cls || (name => ` class="${name.split(' ').map(n => 'x-' + n).join(' ')}"`);
  const html = text => inline.toHtml(inline.parse(text), { cls, tags: opts.tags, images: opts.images });
  const out = [];
  const push = (...s) => out.push(...s);
  const title = doc.title ? html(doc.title) : '';

  // The head.
  const tb = opts.titleBlock || {};
  const pageMeta = D.metaOf({ properties: doc.properties }, setHead, opts.locale);
  const byline = [tb.date ? dates.fmt.long(tb.date, opts.locale) : '', tb.preparedBy ? `Prepared by ${tb.preparedBy}` : ''].filter(Boolean);
  if (title || tb.kicker || byline.length) {
    push(`<header${cls('head')}>`);
    if (tb.kicker) push(`<p${cls('kicker')}>${html(tb.kicker)}</p>`);
    if (title) push(`<h1${cls('title')}>${title}</h1>`);
    if (tb.subtitle) push(`<p${cls('subtitle')}>${html(tb.subtitle)}</p>`);
    if (byline.length) push(`<p${cls('byline')}>${byline.map(esc).join(' · ')}</p>`);
    const tagLine = opts.tags && doc.tags.length ? doc.tags.map(t => `<span${cls('tag')}>${esc(t)}</span>`).join(' ') : '';
    if (pageMeta.length || tagLine) push(`<p${cls('props')}>${[...pageMeta.map(esc), tagLine].filter(Boolean).join('<br>')}</p>`);
    push('</header>');
  }

  const taskMark = n => {
    if (!n.task || !opts.tasks) return '';
    const done = D.taskDone(n.task);
    return `<span${cls(done ? 'task done' : 'task')}>${done ? '☑' : '☐'}</span> `;
  };
  const tagsOf = n => opts.tags && D.tagsToAppend(n).length ? ' ' + D.tagsToAppend(n).map(t => `<span${cls('tag')}>${esc(t)}</span>`).join(' ') : '';
  const taskMeta = n => {
    if (!n.task || !opts.tasks) return [];
    const parts = [];
    if (n.task.deadline != null) parts.push(`Deadline: ${dates.fmt.day(n.task.deadline, opts.locale)}`);
    if (n.task.scheduled != null) parts.push(`Scheduled: ${dates.fmt.day(n.task.scheduled, opts.locale)}`);
    if (n.task.priority) parts.push(`Priority: ${n.task.priority}`);
    return parts;
  };
  const metaHtml = (n, leave = []) => { const m = [...D.metaOf(n, shownOf(n), opts.locale, leave), ...taskMeta(n)]; return m.length ? `<span${cls('meta')}>${m.map(esc).join(' · ')}</span>` : ''; };
  const struck = (n, h) => opts.tasks && n.task?.status === 'canceled' ? `<s>${h}</s>` : h;
  const codeHtml = text => esc(String(text).replace(/\n$/, ''));

  // One node's own content, no children: a flowing piece (words) or a standing one (a picture, code, a quotation).
  function body(n, { leave = [], inItem = false } = {}) {
    const meta = metaHtml(n, leave);
    const after = meta ? '<br>' + meta : '';   // the properties on their own line under the words
    if (n.kind === 'image') return { block: true, html: `<figure${cls('figure')}><img${cls('img')} src="${esc(opts.images(n.image.file))}" alt="${esc(n.image.name || '')}"${n.image.width ? ` width="${n.image.width}"` : ''}>${n.image.name ? `<figcaption${cls('caption')}>${esc(n.image.name)}</figcaption>` : ''}</figure>` };
    if (n.kind === 'file') return { block: false, html: `<a${cls('a file')} href="${esc(opts.images(n.file.file))}">${esc(n.file.name || n.file.file)}</a>${after}` };
    if (n.kind === 'highlight') {
      const cite = `<cite${cls('cite')}>${esc(n.highlight.pdf || 'PDF')}, p. ${esc(n.highlight.page)}</cite>`;
      if (n.highlight.area) return { block: true, html: `<figure${cls('figure')}><img${cls('img')} src="${esc(opts.images(n.highlight.area.file))}" alt="">` + `<figcaption${cls('caption')}>${cite}</figcaption></figure>` };
      return { block: true, html: `<blockquote${cls('quote')}>${html(n.text)} ${cite}</blockquote>` };
    }
    if (n.display === 'code' || n.display === 'math') return { block: true, html: `<pre${cls('pre')}><code>${codeHtml(n.text)}</code></pre>` };
    if (n.display === 'quote') return { block: true, html: `<blockquote${cls('quote')}>${html(n.text)}</blockquote>` };
    const words = struck(n, html(n.text).trim());
    return { block: false, html: `${taskMark(n)}${n.heading && inItem ? `<strong>${words}</strong>` : words}${tagsOf(n)}${after}` };
  }

  // A query: its words, then its rows as the table of its view (when it has columns), else a list.
  function query(n, inItem) {
    const label = inline.words(n.text);
    const rows = n.query.rows.filter(D.shown);
    let s = label ? (inItem ? `${html(n.text)}` : `<p${cls('p query')}><strong>${html(n.text)}</strong></p>`) : '';
    if (n.query.columns?.length) {
      const cols = n.query.columns;
      const cell = (r, c) => {
        const name = c.toLowerCase();
        if (name === 'name' || name === 'block' || name === 'title') return { h: taskMark(r) + struck(r, html(r.text.split('\n')[0])), name: true };
        if (name === 'tags') return { h: opts.tags ? esc(r.tags.join(', ')) : '' };
        const p = (r.properties || []).find(p => p.name.toLowerCase() === name);
        return { h: p ? esc(p.values.map(v => D.valueText(v, opts.locale)).join(', ')) : '' };
      };
      s += `<table${cls('table')}><thead><tr>${cols.map(c => `<th${cls('th')}>${esc(c)}</th>`).join('')}</tr></thead><tbody>`;
      for (const r of rows) s += `<tr>${cols.map(c => { const x = cell(r, c); return `<td${cls(x.name ? 'td name' : 'td')}>${x.h}</td>`; }).join('')}</tr>`;
      s += '</tbody></table>';
    } else {
      s += `<ul${cls('ul')}>${rows.map(r => `<li${cls('li')}>${taskMark(r)}${struck(r, html(r.text.split('\n')[0]))}${tagsOf(r)}${metaHtml(r) ? '<br>' + metaHtml(r) : ''}</li>`).join('')}</ul>`;   // rows carry their properties and task dates like any node
    }
    return s;
  }

  // The document and outline layouts.
  function render(nodes, depth, numbered = false) {
    const items = nodes.filter(n => D.shown(n) && !D.isEmpty(n));
    if (!items.length) return;
    const asList = opts.layout === 'outline' || depth > 1 || numbered;
    if (asList) push(`<${numbered ? 'ol' : 'ul'}${cls(numbered ? 'ol' : 'ul')}>`);
    for (const n of items) {
      if (n.kind === 'embed') { if (asList) push(`<li${cls('li embed')}>`); render(n.children, asList ? depth + 1 : depth, n.numbered); if (asList) push('</li>'); continue; }
      if (asList) {
        const b = n.query ? { html: query(n, true), block: false } : body(n, { inItem: true });
        push(`<li${cls(b.html.startsWith('<figure') ? 'li pic' : 'li')}>${b.html}`);   // a picture's item has no bullet: nothing to put it beside
        render(n.children, depth + 1, n.numbered);
        push('</li>');
        continue;
      }
      if (n.query) { push(query(n, false)); render(n.children, depth + 1); continue; }
      const b = body(n);
      const meta = metaHtml(n);
      if (b.block) push(b.html, meta ? `<p${cls('p meta-line')}>${meta}</p>` : '');
      else if (n.heading) { const level = Math.min(n.heading + (title ? 1 : 0), 4); push(`<h${level}${cls('h' + level)}>${b.html}</h${level}>`); }
      else if (opts.layout === 'document' && D.readsAsHeading(n, depth, meta ? [meta] : [])) push(`<h2${cls('h2')}>${b.html}</h2>`);
      else push(`<p${cls('p')}>${b.html}</p>`);
      render(n.children, depth + 1, n.numbered);
    }
    if (asList) push(`</${numbered ? 'ol' : 'ul'}>`);
  }

  // The timeline: month headings, then each entry with its day on the left. The calendar: a table per month, a row per day.
  function renderDated() {
    const es = D.entries(doc, { dateKey: opts.dateKey || 'auto', newestFirst: !!opts.newestFirst });
    let month = null, day = null, open = false;
    const closeDay = () => { if (open) push('</td></tr>'); open = false; };
    for (const e of es) {
      const n = e.node;
      const m = e.when == null ? 'No date' : dates.fmt.month(e.when, opts.locale);
      if (m !== month) {
        closeDay();
        if (month !== null && opts.layout === 'calendar') push('</tbody></table>');
        push(`<h2${cls('month')}>${esc(m)}</h2>`);
        if (opts.layout === 'calendar') push(`<table${cls('cal')}><tbody>`);
        month = m; day = null;
      }
      const leave = [e.key, e.end?.key, opts.under].filter(Boolean);
      const under = opts.under ? (n.properties || []).find(p => p.ident === opts.under) : null;
      const underText = under ? under.values.map(v => D.valueText(v, opts.locale)).join(', ') : '';
      const b = body(n, { leave, inItem: true });
      const children = () => { const before = out.length; render(n.children, 2, n.numbered); return out.splice(before).join(''); };
      if (opts.layout === 'calendar') {
        const d = e.when == null ? 'none' : dates.fmt.iso(e.when);
        if (d !== day) {
          closeDay();
          push(`<tr${cls('calrow')}><td${cls('calday')}>${e.when == null ? 'No date' : `<span${cls('weekday')}>${esc(dates.fmt.weekday(e.when, opts.locale))}</span><span${cls('date')}>${esc(dates.fmt.short(e.when, opts.locale))}</span>`}</td><td${cls('calitems')}>`);
          day = d; open = true;
        }
        const time = e.when == null ? '' : dates.fmt.time(e.when, opts.locale);
        push(`<div${cls('calitem')}>${time ? `<span${cls('time')}>${esc(time)}</span> ` : ''}${b.html}${children()}</div>`);
      } else {
        const what = `<div${cls('what')}>${b.block ? b.html : `<p${cls('p')}>${b.html}</p>`}${children()}</div>`;
        if (e.when == null) push(`<div${cls('entry')}>${what}</div>`);   // under "No date", no date column
        else push(`<div${cls(e.end ? 'entry stay' : 'entry')}><div${cls('date')}>${esc(`${dates.fmt.weekday(e.when, opts.locale)} ${dates.fmt.span(e.when, e.end?.when, opts.locale)}`)}${underText ? `<span${cls('under')}>${esc(underText)}</span>` : ''}</div>${what}</div>`);
      }
    }
    closeDay();
    if (month !== null && opts.layout === 'calendar') push('</tbody></table>');
  }

  if (D.dated(opts.layout)) renderDated();
  else { render(doc.nodes, 0); if (doc.tagged?.length) { if (doc.nodes.length) push(`<hr${cls('hr')}>`); render(doc.tagged, 0); } }
  return out.filter(Boolean).join('\n');
}

E.html = { toHtml };
})();
