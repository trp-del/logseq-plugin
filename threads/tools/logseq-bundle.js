// Reads files out of Logseq's own bundle on this Mac (the app's asar: an 8-byte header, a JSON index, the files), for the
// checks and the page builders that want what Logseq's page has: its Tabler icon font and the codepoints of its icons.
// tabler() returns { css, font } (the icon stylesheet and the woff2 as base64) or null when the app is not installed.
const fs = require('fs');
const APP = '/Applications/Logseq.app/Contents/Resources/app.asar';
function open() {
  if (!fs.existsSync(APP)) return null;
  const fd = fs.openSync(APP, 'r'); const h = Buffer.alloc(16); fs.readSync(fd, h, 0, 16, 0);
  const jsonSize = h.readUInt32LE(12); const jb = Buffer.alloc(jsonSize); fs.readSync(fd, jb, 0, jsonSize, 16); const idx = JSON.parse(jb.toString());
  const base = 8 + h.readUInt32LE(4);
  const list = (n, pre, out) => { for (const [k, v] of Object.entries(n.files || {})) { if (v.files) list(v, pre + k + '/', out); else out.push([pre + k, v]); } return out; };
  const all = list(idx, '', []);
  const read = p => { const f = all.find(([q]) => q.endsWith(p))?.[1]; if (!f) throw new Error('not in the bundle: ' + p); const b = Buffer.alloc(f.size); fs.readSync(fd, b, 0, f.size, base + Number(f.offset)); return b; };
  return { read, files: all.map(([q]) => q) };
}
function tabler() {
  const bundle = open();
  if (!bundle) return null;
  return { css: bundle.read('css/tabler-icons.min.css').toString('utf8'), font: bundle.read('css/fonts/tabler-icons.woff2').toString('base64') };
}
// The icon stylesheet with the font embedded, ready for a page of its own.
function tablerStyle() {
  const t = tabler();
  if (!t) return '';
  return `@font-face { font-family: "tabler-icons"; src: url(data:font/woff2;base64,${t.font}) format("woff2"); font-weight: 400; font-style: normal; }\n` + t.css.replace(/@font-face\{[^}]*\}/g, '');
}
module.exports = { open, tabler, tablerStyle };
