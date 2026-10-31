// Prepares the inputs the two page builders read: the kit's stylesheet and the loaded parts' own (pulled from their
// source), the kit's icon list (what each icon means and its name in Logseq's font), and Logseq's Tabler icon font with
// the codepoints the pages use (from the app's bundle on this Mac). Run from the repo root:
//   node tools/pages/prepare.js <dir> && node tools/pages/build-elements.js <dir> && node tools/pages/capture-tagmap.js <dir> && node tools/pages/build-views.js <dir>
const fs = require('fs'), path = require('path');
const dir = process.argv[2];
if (!dir) { console.error('usage: node tools/pages/prepare.js <scratch dir>'); process.exit(1); }
fs.mkdirSync(path.join(dir, 'css'), { recursive: true });
// 1. the stylesheets: the kit's, then each loaded part's own layout (0.4.319: nothing but layout is left in them)
const want = { 'parts/shared.js': ['kitCss'], 'parts/two-way.js': ['twoWayCss'], 'parts/tags.js': ['css'], 'parts/shadow.js': ['css'], 'parts/settings-panel.js': ['css'], 'parts/picker.js': ['css'] };
for (const [file, names] of Object.entries(want)) {
  const src = fs.readFileSync(file, 'utf8');
  for (const n of names) {
    const m = src.match(new RegExp('const ' + n + ' = `([\\s\\S]*?)`;'));
    if (!m) { console.error('no', n, 'in', file); process.exit(1); }
    fs.writeFileSync(path.join(dir, 'css', file.replace('parts/', '').replace('.js', '') + (n === 'css' ? '' : '-' + n) + '.css'), m[1]);
  }
}
// 2. the kit's icon list: ICONS in parts/shared.js, a meaning and the name of the icon in Logseq's font
const shared = fs.readFileSync('parts/shared.js', 'utf8');
const iconsSrc = shared.match(/const ICONS = \{([\s\S]*?)\};/);
if (!iconsSrc) { console.error('no ICONS in parts/shared.js'); process.exit(1); }
const icons = {};
for (const m of iconsSrc[1].matchAll(/([A-Za-z]+): '([^']+)'/g)) icons[m[1]] = m[2];
const kindWords = {};
const kw = shared.match(/const KIND_WORDS = \{([\s\S]*?)\};/);
if (kw) for (const m of kw[1].matchAll(/([A-Za-z]+): '([^']+)'/g)) kindWords[m[1]] = m[2];
// the shapes the font lacks, drawn by the kit (DRAWN: a node property's three dots joined in a triangle)
const drawn = {};
const dr = shared.match(/const DRAWN = \{([\s\S]*?)\n\};/);
if (dr) for (const m of dr[1].matchAll(/([A-Za-z]+): '([^']+)'/g)) drawn[m[1]] = m[2];
fs.writeFileSync(path.join(dir, 'icons.json'), JSON.stringify({ icons, kindWords, drawn }, null, 1));
// 3. Logseq's icon font and the codepoints, from the app's bundle (asar: an 8-byte header, a JSON index, the files)
const A = '/Applications/Logseq.app/Contents/Resources/app.asar';
const fd = fs.openSync(A, 'r'); const h = Buffer.alloc(16); fs.readSync(fd, h, 0, 16, 0);
const jsonSize = h.readUInt32LE(12); const jb = Buffer.alloc(jsonSize); fs.readSync(fd, jb, 0, jsonSize, 16); const idx = JSON.parse(jb.toString());
const base = 8 + h.readUInt32LE(4);
const list = (n, pre, out) => { for (const [k, v] of Object.entries(n.files || {})) { if (v.files) list(v, pre + k + '/', out); else out.push([pre + k, v]); } return out; };
const all = list(idx, '', []);
const read = p => { const f = all.find(([q]) => q.endsWith(p))?.[1]; if (!f) { console.error('not in the bundle:', p); process.exit(1); } const b = Buffer.alloc(f.size); fs.readSync(fd, b, 0, f.size, base + Number(f.offset)); return b; };
const tcss = read('css/tabler-icons.min.css').toString('utf8');
const names = [...new Set([...Object.values(icons).filter(n => !drawn[n]), 'chevron-down', 'chevron-left', 'pencil', 'list', 'hash', 'circle', 'point', 'brackets'])];
const map = {};
for (const n of names) { const m = tcss.match(new RegExp('\\.ti-' + n + ':before\\{content:"\\\\([0-9a-f]+)"')); if (!m) { console.error('no icon', n); process.exit(1); } map[n] = m[1]; }
fs.writeFileSync(path.join(dir, 'tabler.json'), JSON.stringify({ map, font: read('css/fonts/tabler-icons.woff2').toString('base64') }));
console.log('prepared', dir, 'with', Object.keys(icons).length, 'icons');
