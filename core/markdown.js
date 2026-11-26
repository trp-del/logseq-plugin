/* Markdown. No Logseq here. A node and its bullets for the clipboard (Alfred), and a whole export as a file.
     outline(lines)                            the bullets as a nested list
     page({ title, tags, properties, lines })  a node whole: its name as a heading, its tags on a line, each property that holds
                                               something on a line of its own, then its bullets
     sheet(sheet, options)                     an export (core/export.js says what a sheet and the options are), as CommonMark
                                               with GitHub's extras: task boxes, tables, struck words, fenced code. options
                                               also takes links ('plain' a page's name as words, 'wiki' [[Page]], 'file'
                                               [Page](Page.md)) and frontMatter (the page's properties as YAML at the top).
   lines: [{ depth, words, task }], in the order they stand; depth 0 is the first level; task '' (no task), 'open' or 'done'.
   words: as a person reads them, a link as [[its name]]. A link is written as its name alone, and a tag in the words as #Name.
   A bullet of several lines keeps them, the later ones set in under the first. */
(function (root) {
const E = typeof module !== 'undefined' && module.exports ? require('./export.js') : root.PluginDoor.export;
const plain = words => String(words == null ? '' : words).replace(/#\[\[([^\[\]\n]+)\]\]/g, (all, name) => '#' + name.replace(/\s+/g, '-')).replace(/\[\[([^\[\]\n]+)\]\]/g, '$1');
function outline(lines) {
  const list = (lines || []).filter(line => line), least = Math.min(...list.map(line => Number(line.depth) || 0), Infinity);
  return list.map(line => {
    const pad = '  '.repeat(Math.max(0, (Number(line.depth) || 0) - least)), mark = line.task === 'done' ? '- [x] ' : line.task ? '- [ ] ' : '- ';
    const [first, ...rest] = plain(line.words).split('\n');
    return [pad + mark + first.trim(), ...rest.map(more => pad + '  ' + more.trim())].join('\n');
  }).join('\n');
}
function page({ title, tags = [], properties = [], lines = [] } = {}) {
  const head = ['# ' + plain(String(title || 'Untitled').split('\n')[0])];
  if (tags.length) head.push(tags.map(tag => '#' + String(tag).replace(/\s+/g, '-')).join(' '));
  const held = properties.filter(prop => prop && (prop.values || []).length).map(prop => `${prop.name}: ${prop.values.map(plain).join(', ')}`);
  return [head.join('\n'), held.join('\n'), outline(lines)].filter(Boolean).join('\n\n');
}

// Words that would be read as Markdown, told apart from it.
const escape = text => String(text).replace(/([\\`*_~\[\]<>])/g, '\\$1');
const escapeStart = line => line.replace(/^([#>+-])(\s)/, '\\$1$2').replace(/^(\d+)([.)])(\s)/, '$1\\$2$3');
const hashed = tag => /\s/.test(tag) ? `#[[${tag}]]` : `#${tag}`;
const address = url => String(url).replace(/ /g, '%20').replace(/\)/g, '%29');
const MARKS = { b: '**', i: '*', del: '~~', mark: '==' };
function words(text, options) {
  const one = part => {
    if (part.marks?.includes('code')) return '`' + part.text + '`';
    if (part.kind === 'text') return escape(part.text).replace(/\n/g, '  \n');
    if (part.kind === 'math') return `$${part.text}$`;
    if (part.kind === 'image') return `![${escape(part.text)}](${part.href})`;
    if (part.kind === 'url') return part.text === part.href ? `<${part.href}>` : `[${escape(part.text)}](${address(part.href)})`;
    if (part.kind === 'tag') return options.tags ? hashed(part.text) : '';
    const name = part.uuid ? options.names?.get(part.uuid) || part.text : part.name, shown = escape(part.text);
    if (options.links === 'wiki') return part.text === name ? `[[${name}]]` : `[[${name}|${shown}]]`;
    if (options.links === 'file') return `[${shown}](${address(encodeURI(String(name).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()))}.md)`;
    return shown;
  };
  // Parts standing in one mark are written inside one pair of its signs.
  const run = (parts, depth) => {
    let out = '';
    for (let i = 0; i < parts.length;) {
      const mark = (parts[i].marks || []).filter(m => m !== 'code')[depth];
      if (!mark) { out += one(parts[i++]); continue; }
      const group = [];
      while (i < parts.length && (parts[i].marks || []).filter(m => m !== 'code')[depth] === mark) group.push(parts[i++]);
      const inner = run(group, depth + 1), [, before, body, after] = inner.match(/^(\s*)([\s\S]*?)(\s*)$/);   // a sign beside a space marks nothing
      out += body ? before + MARKS[mark] + body + MARKS[mark] + after : inner;
    }
    return out;
  };
  return run(E.inline(text, options.names), 0).split('\n').map(escapeStart).join('\n').trim();
}

const yaml = text => /^[\p{L}\p{N}_ .,'()-]*$/u.test(text) && !/^(true|false|null|yes|no|~|\d.*|[ ,'-].*)$/i.test(text) ? text : JSON.stringify(text);
const yamlKey = name => name.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'property';

function sheet(held, given = {}) {
  const options = { tags: true, tasks: true, links: 'plain', frontMatter: false, names: held.names, ...given };
  const out = [], push = (...lines) => out.push(...lines);
  const blank = () => { if (out.length && out[out.length - 1] !== '') push(''); };
  const head = E.head(held, options), md = text => words(text, options);
  const title = head.title ? md(head.title).replace(/\s*\n\s*/g, ' ') : '';

  if (options.frontMatter && (head.properties.length || head.tags.length)) {
    push('---');
    if (title) push(`title: ${yaml(E.inline(head.title, options.names).map(part => part.text).join(''))}`);
    if (head.tags.length) push(`tags: [${head.tags.map(yaml).join(', ')}]`);
    for (const property of held.properties) {
      const shown = head.properties.find(one => one.ident === property.ident);
      if (!shown) continue;
      const values = property.values.map(value => E.said(value, options.locale)).filter(Boolean);
      push(`${yamlKey(property.name)}: ${values.length === 1 ? yaml(values[0]) : `[${values.map(yaml).join(', ')}]`}`);
    }
    push('---', '');
  }
  if (head.kicker) push(escape(head.kicker), '');
  if (title) push(`# ${title}`);
  if (head.subtitle) push(`*${escape(head.subtitle)}*  `);
  if (head.byline.length) push(head.byline.map(escape).join(' · '));
  blank();
  if (!options.frontMatter) {
    const lines = [...head.properties.map(p => escape(`${p.name}: ${p.value}`)), head.tags.map(hashed).join(' ')].filter(Boolean);
    if (lines.length) push(...lines.map((line, i) => i < lines.length - 1 ? line + '  ' : line), '');
  }

  const box = n => options.tasks && n.task ? (['done', 'off'].includes(E.state(n.task)) ? '[x] ' : '[ ] ') : '';
  const struck = (n, text) => options.tasks && n.task && E.state(n.task) === 'off' && text ? `~~${text}~~` : text;
  const after = n => { const list = E.tags(n, options); return list.length ? ' ' + list.map(hashed).join(' ') : ''; };
  const under = n => E.meta(held, n, options).map(escape).join(' · ');
  const path = file => address(encodeURI(file));

  function query(n, item) {
    const lines = [], label = md(n.words), rows = n.query.rows.filter(E.written);
    if (label) lines.push(`**${label}**`, ...(item ? [] : ['']));
    const columns = n.query.columns;
    if (columns?.length && !item) {
      const cell = (row, column) => {
        const name = column.toLowerCase();
        if (name === 'name' || name === 'block' || name === 'title') return md(row.words.split('\n')[0]);
        if (name === 'tags') return E.tags(row, options, true).map(escape).join(', ');
        const property = row.properties.find(p => p.name.toLowerCase() === name);
        return property ? escape(property.values.map(value => E.said(value, options.locale)).join(', ')) : '';
      };
      const line = cells => `| ${cells.map(c => String(c).replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ')} |`;
      lines.push(line(columns.map(escape)), line(columns.map(() => '---')), ...rows.map(row => line(columns.map(c => cell(row, c)))));
    } else for (const row of rows) { const more = under(row); lines.push(`- ${box(row)}${struck(row, md(row.words.split('\n')[0]))}${after(row)}${more ? `  \n  *${more}*` : ''}`); }
    return lines.join('\n');
  }
  // One node's own lines: its words (or what it is), then its properties as a line in italics.
  function body(n, { item = false, level = 0 } = {}) {
    if (n.query) return query(n, item);
    const lines = [], more = under(n);
    if (n.kind === 'image') lines.push(`![${escape(n.image.name)}](${path(n.image.file)})`);
    else if (n.kind === 'file') lines.push(`[${escape(n.file.name || n.file.file)}](${path(n.file.file)})`);
    else if (n.kind === 'highlight') {
      const from = `(${escape(n.highlight.pdf)}, p. ${n.highlight.page})`;
      if (n.highlight.area) lines.push(`![${escape(n.highlight.pdf)}, p. ${n.highlight.page}](${path(n.highlight.area)})  `, from);
      else lines.push(`> “${md(n.words)}”`, `> — ${from}`);
    } else if (n.display === 'code') {
      const fence = '`'.repeat(Math.max(3, ...(n.words.match(/`+/g) || []).map(run => run.length + 1)));
      lines.push(fence + n.lang, ...n.words.replace(/\n$/, '').split('\n'), fence);
    } else if (n.display === 'math') lines.push('$$', ...n.words.trim().split('\n'), '$$');
    else if (n.display === 'quote') lines.push(...md(n.words).split('\n').map(line => '> ' + line));
    else if (n.words.trim()) {
      const text = struck(n, md(n.words));
      lines.push((level && !item ? '#'.repeat(level) + ' ' : '') + box(n) + (item && n.heading ? `**${text}**` : text) + after(n));
    } else if (after(n)) lines.push(box(n) + after(n).trim());
    if (more) {
      const last = lines[lines.length - 1] || '';
      if (/^(>|```|\$\$|!\[|\()/.test(last)) lines.push('');   // after a quotation, code or a picture: a paragraph of its own
      else if (lines.length) lines[lines.length - 1] = last.replace(/ *$/, '  ');   // a hard break: the words, then what is said under them
      lines.push(`*${more}*`);
    }
    return lines.join('\n');
  }
  const indent = (text, by) => text.split('\n').map((line, i) => (i && line ? by + line : line)).join('\n');
  const isTask = line => /^- \[/.test(line || '');
  // A blank line parts paragraphs and lists; the items of one list stand together, nested under their item's words.
  function render(blocks, lead) {
    for (const block of blocks) {
      if (block.list) {
        if (lead == null) blank();
        block.items.forEach((item, i) => {
          const bullet = block.numbered ? `${i + 1}. ` : '- ', start = lead || '', pad = start + ' '.repeat(bullet.length);
          push(start + bullet + indent(body(item.node, { item: true }), pad));
          render(item.under, pad);
        });
        if (lead == null) blank();
        continue;
      }
      const n = block.node, task = options.tasks && n.task && !block.level && n.kind === 'block' && !n.display;
      if (lead != null) { push(indent(lead + body(n, { item: true }), lead)); continue; }
      const text = task ? `- ${indent(body(n, { item: true }), '  ')}` : body(n, { level: block.level });
      if (!(task && isTask(out[out.length - 1]))) blank();
      push(text);
      if (!task) blank();
    }
  }
  const { blocks, tagged } = E.layout(held, options);
  render(blocks, null);
  if (tagged.length) { blank(); if (blocks.length) push('---', ''); render(tagged, null); }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
const api = { outline, page, sheet, plain };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).markdown = api;
})(typeof window !== 'undefined' ? window : globalThis);
