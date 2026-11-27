/* The one paper template: the old "Paper" (the owner, 26 November 2026: "I wanted paper or maybe it was report style", then
   the one on the right). No Logseq here. An export (core/export.js) as running text on the printed page: a serif, a centred
   title, the page's properties on one line, headings from the # bullets, justified paragraphs, and each citation in the
   words, ([[Page]], p. 3), ([title](url)) or (*words*, p. 2), as a raised number with its note at the end under Notes.
   Black on white with greys and hairlines, no colour. The same page is what the export window shows.
     html(sheet, options)        the page's words, every piece with a class x-<name>; options.picture(file) answers where a
                                 picture or a file of the graph loads from
     css(look)                   the template's stylesheet; look: { paper: 'A4' | 'Letter', margins: 'narrow' | 'normal' |
                                 'wide', size: 'small' | 'normal' | 'large', footer, pageNumbers }
     page(body, look, title)     the whole page for the preview and the print window
     sizes(look)                 { width, height, top, side, bottom } of a sheet, in the screen's pixels */
(function (root) {
const E = typeof module !== 'undefined' && module.exports ? require('./export.js') : root.PluginDoor.export;
const esc = text => String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TAG = { b: 'strong', i: 'em', del: 's', code: 'code', mark: 'mark' };
function words(text, options) {
  return E.inline(text, options.names).map(part => {
    let out = esc(part.text).replace(/\n/g, '<br>');
    if (part.kind === 'url') out = `<a class="x-a" href="${esc(part.href)}">${out}</a>`;
    else if (part.kind === 'tag') { if (!options.tags) return ''; out = `<span class="x-tag">${out}</span>`; }
    else if (part.kind === 'math') out = `<span class="x-math">${out}</span>`;
    else if (part.kind === 'image') return `<img class="x-img" src="${esc(part.href)}" alt="${esc(part.text)}">`;
    for (const mark of [...(part.marks || [])].reverse()) out = `<${TAG[mark]} class="x-${TAG[mark]}">${out}</${TAG[mark]}>`;
    return out;
  }).join('').trim();
}

const SOURCE = '(\\[\\[[^\\[\\]]+\\]\\]|\\[[^\\]\\n]+\\]\\(https?:[^)\\s]+\\)|\\*[^*\\n]+\\*)';
const CITE = new RegExp(`\\s*\\(${SOURCE}(?:, p\\. (\\d+))?\\)([.,;:!?])?`, 'g');
const TAIL = new RegExp(`(?:\\s*(?:\\(${SOURCE}(?:, p\\. \\d+)?\\)|#\\[\\[[^\\]\\n]+\\]\\]|(?<=\\s)#[^\\s#.,;:!?]+))*\\s*$`);
// A line joined to others in one paragraph ends as a sentence: a full stop where none is, before a citation or tag that ends it.
function sentence(text) {
  const tail = text.match(TAIL)[0], said = text.slice(0, text.length - tail.length);
  return said && !/[.!?:;,…]["'’”)]*$/.test(said) ? `${said}.${tail}` : text;
}

function html(held, given = {}) {
  const options = { tags: true, tasks: true, names: held.names, picture: file => file, ...given };
  const out = [], push = (...pieces) => out.push(...pieces);
  // Each source at a page is one note, numbered as it first comes; the number stands after the stop or comma that followed it.
  const notes = [], numbers = new Map();
  const rich = text => words(String(text ?? '').replace(CITE, (whole, source, page = '', stop = '') => {
    const key = `${source}|${page}`;
    if (!numbers.has(key)) { notes.push({ source, page }); numbers.set(key, notes.length); }
    return `${stop}\u0001${numbers.get(key)}\u0001`;
  }), options).replace(/\u0001(\d+)\u0001/g, '<sup class="x-ref">$1</sup>');
  const head = E.head(held, options);
  if (head.title || head.kicker || head.byline.length) {
    push('<header class="x-head">');
    if (head.kicker) push(`<p class="x-kicker">${esc(head.kicker)}</p>`);
    if (head.title) push(`<h1 class="x-title">${rich(head.title)}</h1>`);
    if (head.subtitle) push(`<p class="x-subtitle">${esc(head.subtitle)}</p>`);
    if (head.byline.length) push(`<p class="x-byline">${head.byline.map(esc).join(' · ')}</p>`);
    const line = head.properties.map(p => `<span class="x-prop">${esc(p.name)}: ${esc(p.value)}</span>`);
    if (head.tags.length) line.push(`<span class="x-prop">${head.tags.map(tag => `<span class="x-tag">${esc(tag)}</span>`).join(' ')}</span>`);
    if (line.length) push(`<p class="x-props">${line.join('')}</p>`);
    push('</header>');
  }

  /* A task's mark, Logseq's own four: nothing done yet, under way, done, given up. A circle the stylesheet draws. */
  const mark = n => !n.task || !options.tasks ? '' : `<span class="x-task x-${E.state(n.task)}" role="img" aria-label="${{ todo: 'To do', doing: 'Doing', done: 'Done', off: 'Canceled' }[E.state(n.task)]}"></span> `;
  const after = n => E.tags(n, options).map(tag => ` <span class="x-tag">${esc(tag)}</span>`).join('');
  const struck = (n, text) => options.tasks && n.task && E.state(n.task) === 'off' ? `<s>${text}</s>` : text;
  const under = n => { const list = E.meta(held, n, options); return list.length ? `<span class="x-meta">${list.map(esc).join(' · ')}</span>` : ''; };
  const figure = (file, alt, caption, width) => `<figure class="x-figure"><img class="x-img" src="${esc(options.picture(file))}" alt="${esc(alt)}"${width ? ` width="${Number(width)}"` : ''}>${caption ? `<figcaption class="x-caption">${caption}</figcaption>` : ''}</figure>`;

  function query(n, item) {
    const label = rich(n.words), rows = n.query.rows.filter(E.written), columns = n.query.columns;
    let text = label ? (item ? label : `<p class="x-p x-query"><strong>${label}</strong></p>`) : '';
    const named = column => /^(name|block|title)$/.test(column.toLowerCase());
    if (columns?.length) {
      const cell = (row, column) => {
        if (named(column)) return mark(row) + struck(row, rich(row.words.split('\n')[0]));
        if (column.toLowerCase() === 'tags') return esc(E.tags(row, options, true).join(', '));
        const property = row.properties.find(p => p.name.toLowerCase() === column.toLowerCase());
        return property ? esc(property.values.map(value => E.said(value, options.locale)).join(', ')) : '';
      };
      text += `<table class="x-table"><thead><tr>${columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${columns.map(c => `<td${named(c) ? ' class="x-name"' : ''}>${cell(row, c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    } else text += `<ul class="x-ul">${rows.map(row => { const more = under(row); return `<li class="x-li">${mark(row)}${struck(row, rich(row.words.split('\n')[0]))}${after(row)}${more ? '<br>' + more : ''}</li>`; }).join('')}</ul>`;
    return text;
  }
  // One node's own content: flowing words, or a thing that stands by itself (a picture, code, a quotation).
  function body(n, item) {
    if (n.query) return { stands: true, html: query(n, item) };
    const more = under(n), extra = more ? '<br>' + more : '';
    if (n.kind === 'image') return { stands: true, html: figure(n.image.file, n.image.name, esc(n.image.name), n.image.width) + more };
    if (n.kind === 'file') return { html: `<a class="x-a x-file" href="${esc(options.picture(n.file.file))}">${esc(n.file.name || n.file.file)}</a>${extra}` };
    if (n.kind === 'highlight') {
      const from = `<cite class="x-cite">${esc(n.highlight.pdf)}, p. ${Number(n.highlight.page)}</cite>`;
      return { stands: true, html: (n.highlight.area ? figure(n.highlight.area, '', from) : `<blockquote class="x-quote">${rich(n.words)} ${from}</blockquote>`) + more };
    }
    if (n.display === 'code' || n.display === 'math') return { stands: true, html: `<pre class="x-pre"><code>${esc(n.words.replace(/\n$/, ''))}</code></pre>${more}` };
    if (n.display === 'quote') return { stands: true, html: `<blockquote class="x-quote">${rich(n.words)}</blockquote>${more}` };
    const text = struck(n, rich(n.words));
    return { html: `${mark(n)}${n.heading && item ? `<strong>${text}</strong>` : text}${after(n)}${extra}` };
  }
  function render(blocks) {
    for (const block of blocks) {
      if (block.list) {
        const kind = block.numbered ? 'ol' : 'ul';
        push(`<${kind} class="x-${kind}">`);
        for (const { node, under: nested } of block.items) {
          const made = body(node, true);
          // A task's mark stands where its bullet would; a picture has nothing to put a bullet beside.
          const bare = made.html.startsWith('<figure') || (node.task && options.tasks && !block.numbered);
          push(`<li class="x-li${bare ? ' x-bare' : ''}">${made.html}`); render(nested); push('</li>');
        }
        push(`</${kind}>`);
        continue;
      }
      if (block.para) {
        const joined = block.para.length > 1, said = block.para.map(n => `${struck(n, rich(joined ? sentence(n.words) : n.words))}${after(n)}`).filter(Boolean).join(' ');
        const more = under(block.para[0]);
        push(`<p class="x-p">${said}${more ? '<br>' + more : ''}</p>`);
        continue;
      }
      const made = body(block.node, false);
      if (made.stands) push(made.html);
      else if (block.level) push(`<h${block.level} class="x-h${block.level}">${made.html}</h${block.level}>`);
      else push(`<p class="x-p">${made.html}</p>`);
    }
  }
  const { blocks, tagged } = E.prose(held, options);
  render(blocks);
  if (tagged.length) { if (blocks.length) push('<hr class="x-hr">'); render(tagged); }
  if (notes.length) {
    push('<h2 class="x-notes-head">Notes</h2>');
    // A web address is written out after its title.
    notes.forEach(({ source, page }, i) => { const url = source.match(/\]\((https?:[^)\s]+)\)$/)?.[1];
      push(`<p class="x-note"><span class="x-note-n">${i + 1}</span>${words(source, options)}${url ? ` ${esc(url)}` : ''}${page ? `, p. ${page}` : ''}.</p>`); });
  }
  return out.join('\n');
}

/* Static faces only, never the Mac's system face or a variable one: Chromium writes those into a PDF as outlines, and its
   words can then be neither selected nor searched (seen in Logseq 2.0.2, 29 October 2026). */
const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif', SERIF = 'Charter, "Iowan Old Style", Palatino, Georgia, serif', MONO = 'Menlo, Consolas, "Courier New", monospace';
const SIZES = { small: 9.5, normal: 10.5, large: 12 }, MARGINS = { narrow: [14, 15, 16], normal: [20, 20, 22], wide: [26, 30, 28] };   // points; mm at the top, the sides, the foot
const PAPERS = { A4: [210, 297], Letter: [215.9, 279.4] };   // mm
const pick = look => ({ paper: PAPERS[look?.paper] ? look.paper : 'A4', margins: MARGINS[look?.margins] ? look.margins : 'wide', size: SIZES[look?.size] ? look.size : 'normal', footer: String(look?.footer || '').trim(), pageNumbers: look?.pageNumbers !== false });
function sizes(look) {
  const { paper, margins } = pick(look), px = mm => mm * 96 / 25.4, [top, side, bottom] = MARGINS[margins];
  return { width: Math.round(px(PAPERS[paper][0])), height: Math.round(px(PAPERS[paper][1])), top: px(top), side: px(side), bottom: px(bottom) };
}
const cssString = text => `"${String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/</g, '\\3c ').replace(/\n/g, ' ')}"`;
function css(given) {
  const look = pick(given), k = n => `${+(n * SIZES[look.size] / 10.5).toFixed(2)}pt`, [top, side, bottom] = MARGINS[look.margins], margin = `${top}mm ${side}mm ${bottom}mm`;
  const ink = '#1a1a1a', quiet = '#666', soft = '#888', hair = '#ddd', rule = '#bbb', wash = '#f4f4f4';
  const box = `font-family: ${SANS}; font-size: 8pt; color: #999;`;
  const foot = [look.footer ? `@bottom-left { content: ${cssString(look.footer)}; ${box} }` : '', look.pageNumbers ? `@bottom-right { content: counter(page) " / " counter(pages); ${box} }` : ''].join(' ').trim();
  return `@page { size: ${look.paper}; margin: ${margin}; ${foot} }
html, body { margin: 0; padding: 0; background: #fff; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@media screen { body { padding: ${margin}; } }
* { box-sizing: border-box; }
.x-doc { font-family: ${SERIF}; font-size: ${k(11)}; line-height: 1.5; color: ${ink}; max-width: ${k(462)}; margin: 0 auto; overflow-wrap: break-word; }
.x-head { margin: 0 0 ${k(23)}; text-align: center; }
.x-kicker { margin: 0 0 ${k(10)}; font-size: ${k(8)}; letter-spacing: .14em; text-transform: uppercase; color: ${quiet}; }
.x-title { margin: 0 0 ${k(5)}; font-size: ${k(23)}; font-weight: 400; line-height: 1.2; }
.x-subtitle { margin: 0 0 ${k(8)}; font-size: ${k(12)}; font-style: italic; color: #444; }
.x-byline { margin: 0 0 ${k(4)}; font-size: ${k(9)}; color: #777; }
.x-props { margin: 0; padding: ${k(2)} 0 0; font-size: ${k(9)}; color: #777; }
.x-prop + .x-prop::before { content: "  ·  "; white-space: pre-wrap; }
.x-h1, .x-h2 { margin: ${k(24)} 0 ${k(8)}; font-size: ${k(13)}; font-weight: 600; line-height: 1.3; }
.x-h3, .x-h4 { margin: ${k(16)} 0 ${k(5)}; font-size: ${k(11.5)}; font-weight: 400; font-style: italic; line-height: 1.3; }
.x-p { margin: 0 0 ${k(8.5)}; text-align: justify; hyphens: auto; }
.x-ul, .x-ol { margin: 0 0 ${k(6.3)}; padding-left: ${k(18)}; }
.x-li { margin: 0 0 ${k(2.6)}; }
.x-li > .x-ul, .x-li > .x-ol { margin: ${k(3)} 0 0; }
.x-li.x-bare { list-style: none; }
.x-li.x-bare > .x-task { margin-left: -1.2em; }
.x-ref { font-size: .7em; line-height: 0; vertical-align: super; font-variant-numeric: tabular-nums; }
.x-notes-head { margin: ${k(30)} 0 ${k(7)}; font-size: ${k(9)}; font-weight: 400; letter-spacing: .14em; text-transform: uppercase; color: ${quiet}; }
.x-notes-head::before { content: ""; display: block; width: 30%; border-top: .5pt solid ${soft}; margin-bottom: ${k(9)}; }
.x-note { margin: 0 0 ${k(2.6)}; padding-left: ${k(20)}; text-indent: ${k(-20)}; font-size: ${k(9)}; color: #333; }
.x-note-n { display: inline-block; width: ${k(20)}; text-indent: 0; color: ${quiet}; font-variant-numeric: tabular-nums; }
.x-meta { font-size: ${k(8.5)}; color: ${soft}; }
.x-tag { font-family: ${MONO}; font-size: .85em; color: #999; }
.x-code { font-family: ${MONO}; font-size: .88em; background: ${wash}; padding: 0 .2em; }
.x-mark { background: #eee; color: inherit; }
.x-math { font-family: ${SERIF}; font-style: italic; }
.x-pre { font-family: ${MONO}; font-size: ${k(8.5)}; line-height: 1.45; background: ${wash}; padding: ${k(6)} ${k(8)}; margin: 0 0 ${k(8)}; white-space: pre-wrap; word-break: break-word; }
.x-quote { margin: 0 0 ${k(20)}; padding: 0 2.2em; color: #333; font-style: italic; text-align: center; }
.x-cite { font-style: normal; font-size: ${k(8.5)}; color: ${soft}; white-space: nowrap; }
.x-figure { margin: ${k(4)} 0 ${k(9)}; } .x-img { max-width: 100%; height: auto; display: block; }
.x-caption { margin-top: ${k(3)}; font-size: ${k(8.5)}; color: ${soft}; }
.x-a { color: inherit; text-decoration: underline; text-decoration-color: ${rule}; text-decoration-thickness: .5pt; text-underline-offset: 2px; }
.x-hr { border: 0; border-top: .5pt solid ${rule}; margin: ${k(16)} 0; }
.x-table { border-collapse: collapse; width: 100%; margin: ${k(3)} 0 ${k(10)}; font-size: ${k(9)}; }
.x-table th { text-align: left; font-weight: 400; font-size: ${k(8)}; color: ${soft}; padding: ${k(3.5)} ${k(8)} ${k(3.5)} 0; border-bottom: .5pt solid ${rule}; vertical-align: bottom; }
.x-table td { padding: ${k(4)} ${k(8)} ${k(4)} 0; border-bottom: .5pt solid ${hair}; vertical-align: top; } .x-table td.x-name { width: 40%; }
.x-task { display: inline-block; width: .8em; height: .8em; border: .9pt solid #555; border-radius: 50%; vertical-align: -.06em; margin-right: .1em; position: relative; overflow: hidden; }
.x-task.x-doing { background: linear-gradient(90deg, #555 50%, transparent 50%); }
.x-task.x-done { background: #555; }
.x-task.x-done::after { content: ""; position: absolute; left: 28%; top: 10%; width: 28%; height: 52%; border: solid #fff; border-width: 0 1.1pt 1.1pt 0; transform: rotate(40deg); }
.x-task.x-off { border-color: #999; } .x-task.x-off::after { content: ""; position: absolute; left: 15%; right: 15%; top: 46%; border-top: .9pt solid #999; }
.x-p, .x-li, .x-figure, .x-pre, .x-quote, tr, .x-props, .x-note { break-inside: avoid; }
.x-head, .x-title, .x-h1, .x-h2, .x-h3, .x-h4, .x-query, .x-notes-head { break-after: avoid; }`;
}
const page = (body, look, title) => `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css(look)}</style></head><body><div class="x-doc">${body}</div></body></html>`;

const api = { html, css, page, sizes };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).paper = api;
})(typeof window !== 'undefined' ? window : globalThis);
