/* The words of one block, read once into tokens, then written as HTML, Markdown or plain text. Loaded first; the other
   files find it on window.DbExport.inline. Pure: no Logseq, no screen, runs in Node for the tests.

   What a block's text can hold in a Logseq DB graph, after the adapter has swapped stored ids for names:
     [[Page]]  #[[Tag]]  [label]([[Page]])  [label](url)  ![alt](url)  bare URLs  `code`  **bold**  __bold__  *italic*
     _italic_  ~~struck~~  ==marked==  ^^marked^^  $math$  line breaks.
   A citation, as /Cite writes it and Endnotes reads it (look/logseq/links.js): ([[Page]], p. 3)  ([title](url))  (*words*, p. 2).
   A bare #word is plain text: a real tag is stored as #[[id]] and comes here as #[[Name]]. */
(function () {
const E = (window.DbExport ||= {});

const URL_RE = /https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/y;
const rules = [
  ['br', /\n|<br\s*\/?>/y, m => ({ t: 'br' })],
  ['code', /`([^`\n]+)`/y, m => ({ t: 'code', s: m[1] })],
  ['image', /!\[([^\]]*)\]\(([^)\s]+)\)/y, m => ({ t: 'image', alt: m[1], url: m[2] })],
  // A citation: a source in brackets with an optional page. id is what Endnotes tells sources apart by; k the source as written.
  ['cite', /\((\[\[([^[\]]+)\]\]|\[([^\]]+)\]\((https?:[^)\s]+)\)|\*([^*]+)\*)(?:, p\. (\d+))?\)/y, m => ({ t: 'cite', k: parse(m[1]), page: m[6] || '',
    url: m[4] || '', id: m[2] ? m[2].toLowerCase() : m[4] ? m[4].toLowerCase() : `words:${m[5].toLowerCase()}` })],
  // [label]([[Page]]) is a page link with its own words; [label](((id))) a block link, read as its label.
  ['link', /\[([^\]]+)\]\((\[\[[^\]]*\]\]|\(\([^)]*\)\)|[^)\s]+)\)/y, m => /^\[\[(.*)\]\]$/.test(m[2])
    ? { t: 'page', name: m[2].slice(2, -2), k: parse(m[1]) } : /^\(\(/.test(m[2]) ? { t: 'text', s: m[1] } : { t: 'link', k: parse(m[1]), url: m[2] }],
  ['tag', /#\[\[([^\]]*)\]\]/y, m => ({ t: 'tag', name: m[1] })],
  ['page', /\[\[([^\]]*)\]\]/y, m => ({ t: 'page', name: m[1] })],
  ['strong', /\*\*(.+?)\*\*/y, m => ({ t: 'strong', k: parse(m[1]) })],
  ['strong', /__(.+?)__/y, m => ({ t: 'strong', k: parse(m[1]) })],
  ['strike', /~~(.+?)~~/y, m => ({ t: 'strike', k: parse(m[1]) })],
  ['mark', /(==|\^\^)(.+?)\1/y, m => ({ t: 'mark', k: parse(m[2]) })],
  ['url', URL_RE, m => ({ t: 'link', k: [{ t: 'text', s: m[0] }], url: m[0] })],
];
// Emphasis and math need a look at what comes before: *a* inside a word (2*3*4) is not emphasis.
const EM = /\*(?!\s)(.+?)(?<!\s)\*(?!\w)/y, EM2 = /_(?!\s)(.+?)(?<!\s)_(?!\w)/y, MATH = /\$(?!\s)([^$\n]+?)(?<!\s)\$(?![\w$])/y;
const before = (text, i) => i === 0 ? '' : text[i - 1];
const wordy = ch => /[\w*_$]/.test(ch);

function parse(text) {
  const out = [];
  let buf = '';
  const flush = () => { if (buf) out.push({ t: 'text', s: buf }); buf = ''; };
  const s = String(text ?? '');
  let i = 0;
  while (i < s.length) {
    let token = null, end = 0;
    for (const [, re, make] of rules) {
      re.lastIndex = i;
      const m = re.exec(s);
      if (m) { end = re.lastIndex; token = make(m); break; } // the end first: make() may parse inner words with these same regexes
    }
    if (!token && !wordy(before(s, i))) {
      for (const [re, t] of [[EM, 'em'], [EM2, 'em'], [MATH, 'math']]) {
        re.lastIndex = i;
        const m = re.exec(s);
        if (m) { end = re.lastIndex; token = t === 'math' ? { t: 'math', s: m[1] } : { t: 'em', k: parse(m[1]) }; break; }
      }
    }
    if (token) { flush(); out.push(token); i = end; }
    else { buf += s[i]; i += 1; }
  }
  flush();
  return out;
}

const escapeHtml = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* HTML. `cls(name)` gives the attribute for a named piece: a class for a stylesheet, or an inline style (core/html.js).
   Options: tags (false leaves #Tag out), images (a function url → src, or false to leave pictures out). */
function toHtml(tokens, opts = {}) {
  const cls = opts.cls || (name => ` class="x-${name}"`);
  const go = list => list.map(tok => {
    switch (tok.t) {
      case 'text': return escapeHtml(tok.s);
      case 'br': return '<br>';
      case 'code': return `<code${cls('code')}>${escapeHtml(tok.s)}</code>`;
      case 'strong': return `<strong>${go(tok.k)}</strong>`;
      case 'em': return `<em>${go(tok.k)}</em>`;
      case 'strike': return `<s>${go(tok.k)}</s>`;
      case 'mark': return `<span${cls('mark')}>${go(tok.k)}</span>`;
      case 'math': return `<span${cls('math')}>${escapeHtml(tok.s)}</span>`;
      case 'link': return `<a${cls('a')} href="${escapeHtml(tok.url)}">${go(tok.k)}</a>`;
      case 'cite': return opts.cite ? opts.cite(tok) : `(${go(tok.k)}${tok.page ? `, p. ${tok.page}` : ''})`;   // as written, unless the caller numbers it
      case 'page': return tok.k ? go(tok.k) : escapeHtml(tok.name); // a link to a page reads as its words
      case 'tag': return opts.tags === false ? '' : `<span${cls('tag')}>${escapeHtml(tok.name)}</span>`;
      case 'image': return opts.images === false ? '' : `<img${cls('img')} src="${escapeHtml(opts.images ? opts.images(tok.url) : tok.url)}" alt="${escapeHtml(tok.alt)}">`;
      default: return '';
    }
  }).join('');
  return go(tokens).replace(/ +(<br>)/g, '$1');
}

/* Markdown. Options: links: 'plain' (a page's name as words), 'wiki' ([[Page]]), 'file' ([Page](Page.md));
   tags: false leaves them out, else #Tag (#[[Two words]] when the name has spaces). */
const mdEscape = s => String(s).replace(/([\\`*_~\[\]<>])/g, '\\$1').replace(/^([#>+-])(\s)/, '\\$1$2').replace(/^(\d+)([.)])(\s)/, '$1\\$2$3');
const fileName = name => String(name).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
function toMarkdown(tokens, opts = {}) {
  const links = opts.links || 'plain';
  const go = list => list.map(tok => {
    switch (tok.t) {
      case 'text': return mdEscape(tok.s);
      case 'br': return '  \n';
      case 'code': return '`' + tok.s + '`';
      case 'strong': return `**${go(tok.k)}**`;
      case 'em': return `*${go(tok.k)}*`;
      case 'strike': return `~~${go(tok.k)}~~`;
      case 'mark': return `==${go(tok.k)}==`;
      case 'math': return `$${tok.s}$`;
      case 'link': { const label = go(tok.k); return label === tok.url ? `<${tok.url}>` : `[${label}](${tok.url})`; }
      case 'cite': return opts.cite ? opts.cite(tok) : `(${go(tok.k)}${tok.page ? `, p. ${tok.page}` : ''})`;
      case 'page': {
        const words = tok.k ? go(tok.k) : mdEscape(tok.name);
        if (links === 'wiki') return tok.k ? `[[${tok.name}|${words}]]` : `[[${tok.name}]]`;
        if (links === 'file') return `[${words}](${encodeURI(fileName(tok.name))}.md)`;
        return words;
      }
      case 'tag': return opts.tags === false ? '' : /\s/.test(tok.name) ? `#[[${tok.name}]]` : `#${tok.name}`;
      case 'image': return opts.images === false ? '' : `![${tok.alt}](${opts.images ? opts.images(tok.url) : tok.url})`;
      default: return '';
    }
  }).join('');
  return go(tokens).replace(/ +(  \n)/g, '$1');
}

function toPlain(tokens, opts = {}) {
  const go = list => list.map(tok => {
    switch (tok.t) {
      case 'text': case 'code': case 'math': return tok.s;
      case 'br': return '\n';
      case 'link': return go(tok.k) === tok.url ? tok.url : `${go(tok.k)} (${tok.url})`;
      case 'cite': return `(${go(tok.k)}${tok.page ? `, p. ${tok.page}` : ''})`;
      case 'page': return tok.k ? go(tok.k) : tok.name;
      case 'tag': return opts.tags === false ? '' : `#${tok.name}`;
      case 'image': return opts.images === false ? '' : `[${tok.alt || 'picture'}]`;
      default: return tok.k ? go(tok.k) : '';
    }
  }).join('');
  return go(tokens);
}

/* The words made ready for a numbered reference where each citation stood: the space before a citation goes, and a full
   stop or comma after it moves before it ("cycle ([[X]])." reads "cycle.¹"). close: the words end as a sentence, for a
   line joined to others in one paragraph: a full stop is added where none is, before any citation or tag that ends the line. */
const ENDS = /[.!?:;…]["'”’)\]]*$/;
function refs(tokens, close = false) {
  let out = tokens.map(tok => tok.k && tok.t !== 'cite' ? { ...tok, k: refs(tok.k) } : { ...tok });
  out.forEach((tok, i) => { if (tok.t === 'cite' && out[i - 1]?.t === 'text') out[i - 1].s = out[i - 1].s.replace(/\s+$/, ''); });
  out = out.filter(tok => tok.t !== 'text' || tok.s);
  for (let i = 0; i < out.length; i++) {
    if (out[i].t !== 'cite') continue;
    let j = i; while (out[j + 1]?.t === 'cite') j += 1;
    const next = out[j + 1], m = next?.t === 'text' && /^[.,;:!?]+/.exec(next.s);
    if (m) { next.s = next.s.slice(m[0].length); out.splice(i, 0, { t: 'text', s: m[0] }); j += 1; }
    i = j;
  }
  if (close) {
    let k = out.length - 1;
    while (k >= 0 && (out[k].t === 'cite' || out[k].t === 'tag' || out[k].t === 'br' || out[k].t === 'text' && !out[k].s.trim())) k -= 1;
    if (k >= 0) {
      if (out[k].t === 'text') { const s = out[k].s.replace(/\s+$/, ''), tail = out[k].s.slice(s.length); out[k].s = (ENDS.test(s) ? s : s + '.') + (out[k + 1]?.t === 'tag' ? tail || ' ' : ''); }
      else out.splice(k + 1, 0, { t: 'text', s: '.' });
    }
  }
  return out.filter(tok => tok.t !== 'text' || tok.s);
}

// The words only, with nothing of the markup: for a file name, a heading test, a search.
const words = text => toPlain(parse(text)).replace(/\s+/g, ' ').trim();

E.inline = { parse, refs, toHtml, toMarkdown, toPlain, words, escapeHtml, mdEscape, fileName };
})();
