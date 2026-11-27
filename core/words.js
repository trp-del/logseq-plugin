/* A node's words as stored, read into parts a line can draw. No Logseq here: runs in Node for its test.
   Logseq keeps a link in the words as [[uuid]], a tag as #[[uuid]], a link with its own words as [words]([[uuid]]); words
   brought in from elsewhere may name a page outright, [[Its name]], and that reads as a link too (name, no uuid).
   parts(words, names) answers a flat list of { kind, text, uuid? | name?, href?, marks? }:
     kind 'text' | 'link' (a node) | 'tag' | 'url'; marks: a set of 'b' 'i' 'code' 'del' 'mark' the part stands in.
   names: uuid -> the node's name. A node no name is known for reads as "…", never as its id. */
(function (root) {
const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const TOKEN = new RegExp([
  `\\[([^\\]\\n]+)\\]\\(\\[\\[(${UUID})\\]\\]\\)`,      // 1,2  [words]([[uuid]])
  `\\[([^\\]\\n]+)\\]\\(((?:https?|file|assets):[^)\\s]+)\\)`,   // 3,4  [words](address)
  `#\\[\\[(${UUID})\\]\\]`,                              // 5    #[[uuid]]
  `\\[\\[(${UUID})\\]\\]`,                               // 6    [[uuid]]
  `\\(\\((${UUID})\\)\\)`,                               // 7    ((uuid))
  `(https?:\\/\\/[^\\s<>)\\]]+)`,                        // 8    a bare address
  '`([^`\\n]+)`',                                        // 9    code
  '\\*\\*([^\\n]+?)\\*\\*',                              // 10   bold
  '~~([^\\n]+?)~~',                                      // 11   struck
  '(?:==|\\^\\^)([^\\n]+?)(?:==|\\^\\^)',                // 12   highlight
  '(?<![\\w*])\\*(?!\\s)([^*\\n]+?)(?<!\\s)\\*(?![\\w*])', // 13 italic, stars
  '(?<![\\w_])_(?!\\s)([^_\\n]+?)(?<!\\s)_(?![\\w_])',     // 14 italic, underscores
  '#\\[\\[([^\\[\\]\\n]+)\\]\\]',                          // 15   #[[A name]]
  '\\[\\[([^\\[\\]\\n]+)\\]\\]',                           // 16   [[A name]]
].join('|'), 'g');
const nameOf = (names, uuid) => { const name = names && names.get(String(uuid).toLowerCase()); return name == null || name === '' ? '…' : String(name); };

function parts(words, names, marks = []) {
  const out = [], text = String(words == null ? '' : words);
  const push = part => { if (part.text !== '') out.push(marks.length ? { ...part, marks: [...marks] } : part); };
  let at = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > at) push({ kind: 'text', text: text.slice(at, m.index) });
    at = m.index + m[0].length;
    if (m[2]) push({ kind: 'link', uuid: m[2].toLowerCase(), text: m[1] });
    else if (m[4]) push({ kind: 'url', href: m[4], text: m[3] });
    else if (m[5]) push({ kind: 'tag', uuid: m[5].toLowerCase(), text: nameOf(names, m[5]) });
    else if (m[6]) push({ kind: 'link', uuid: m[6].toLowerCase(), text: nameOf(names, m[6]) });
    else if (m[7]) push({ kind: 'link', uuid: m[7].toLowerCase(), text: nameOf(names, m[7]) });
    else if (m[8]) { const href = m[8].replace(/[.,;:!?]+$/, ''); push({ kind: 'url', href, text: href }); at -= m[8].length - href.length; }
    else if (m[9] != null) push({ kind: 'text', text: m[9], marks: undefined, code: true });
    else if (m[15] != null) push({ kind: 'tag', name: m[15], text: m[15] });
    else if (m[16] != null) push({ kind: 'link', name: m[16], text: m[16] });
    else {
      const mark = m[10] != null ? 'b' : m[11] != null ? 'del' : m[12] != null ? 'mark' : 'i';
      const inner = m[10] ?? m[11] ?? m[12] ?? m[13] ?? m[14];
      for (const part of parts(inner, names, [...marks, mark])) out.push(part);
    }
  }
  if (at < text.length) push({ kind: 'text', text: text.slice(at) });
  return out.map(part => { if (part.code) { const { code, ...rest } = part; return { ...rest, marks: [...(rest.marks || marks), 'code'] }; } return part; });
}
// Every node the words name, for the names to be read before the words are drawn.
function named(words) {
  const found = new Set();
  for (const m of String(words == null ? '' : words).matchAll(new RegExp(`(?:\\[\\[|\\(\\()(${UUID})(?:\\]\\]|\\)\\))`, 'g'))) found.add(m[1].toLowerCase());
  return [...found];
}
// The words as one plain line, links read as their names: what a name inside another node's words is drawn from.
const plain = (words, names) => parts(words, names).map(part => part.text).join('');
// The first line of the words, and whether more follow.
function firstLine(words) {
  const text = String(words == null ? '' : words).replace(/^\s+/, ''), cut = text.indexOf('\n');
  return cut < 0 ? { line: text, more: false } : { line: text.slice(0, cut), more: text.slice(cut).trim() !== '' };
}
/* A value that is one web address and nothing else, said very short: the site's name, with … when the address goes further
   ("theirc.wd1.myworkdayjobs.com/en-US/…" reads "myworkdayjobs.com/…"). '' for anything else. */
function shortAddress(value) {
  const m = String(value == null ? '' : value).trim().match(/^https?:\/\/(?:[^\s\/?#@]*@)?([^\s\/?#:]+)(?::\d+)?(\S*)$/i);
  if (!m) return '';
  const names = m[1].replace(/\.$/, '').split('.'), number = /^\d+$/.test(names[names.length - 1]);
  const two = names.length > 2 && names[names.length - 1].length === 2 && /^(com|co|org|net|gov|edu|ac)$/i.test(names[names.length - 2]);   // bbc.co.uk keeps three
  return (number ? names : names.slice(two ? -3 : -2)).join('.') + (m[2].replace(/^\/$/, '') ? '/…' : '');
}
const api = { parts, named, plain, firstLine, shortAddress };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).words = api;
})(typeof window !== 'undefined' ? window : globalThis);
