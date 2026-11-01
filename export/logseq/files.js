/* Files: where a picture or PDF in the graph's assets folder is, as a URL a page can load (Logseq serves the graph's
   files on its assets:// scheme), or as a data URL baked into the page; and saving a file the plugin made (the
   Markdown, the HTML) through the browser's own download, which Logseq's window turns into a save dialog. */
(function () {
const E = (window.DbExport ||= {});
let graph = null;
// Another graph: its folder and its pictures are not this one's.
const forget = () => { graph = null; dataUrls.clear(); };
async function currentGraph() {
  try { graph = await logseq.App.getCurrentGraph(); } catch (error) { graph = null; }
  return graph;
}
// assets/<uuid>.png → assets://<graph folder>/assets/<uuid>.png (an absolute path, which the scheme serves; seen loading
// as an <img> and through fetch in Logseq 2.0.2, 2026-10-29; logseq.Assets.makeUrl gives the same).
const assetUrl = file => graph?.path ? `assets://${encodeURI(String(graph.path).replace(/\/$/, ''))}/${file}` : file;
// The same file as a data URL, so the page carries the picture itself (the preview, the clipboard, a saved HTML page).
const dataUrls = new Map();
async function dataUrl(file) {
  const url = assetUrl(file);
  if (!/^assets:/.test(url)) return url;
  if (dataUrls.has(url)) return dataUrls.get(url);
  try {
    const blob = await (await fetch(url)).blob();
    const data = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(blob); });
    dataUrls.set(url, data);
    return data;
  } catch (error) { console.warn('DB Export: could not read', file, String(error.message || error)); return url; }
}
// Every picture named in a document, read once each; returns a function from file → data URL (or the assets URL when unread).
async function pictures(doc) {
  if (!graph) await currentGraph();
  const files = new Set();
  for (const n of E.doc.collect([...doc.nodes, ...(doc.tagged || [])])) {
    if (n.image) files.add(n.image.file);
    if (n.highlight?.area) files.add(n.highlight.area.file);
  }
  const map = new Map();
  await Promise.all([...files].map(async f => map.set(f, await dataUrl(f))));
  return f => map.get(f) || assetUrl(f);
}

const fileName = name => String(name).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'export';
/* Saves text as a file. In Logseq's desktop window a download from a plugin goes nowhere (seen 2026-10-29: no dialog, no
   file), so the file is written through the bridge Logseq's own exports use: its folder dialog (showOpenDialog), then
   writeFile, then the file shown in the Finder. The folder chosen is remembered. Elsewhere, a download link. */
const bridge = () => { try { return window.parent?.apis?.doAction ? window.parent.apis : null; } catch (error) { return null; } };
// A file of that name is left alone: the next free name, "Notes 2.md".
async function freePath(apis, dir, name) {
  const taken = async path => { try { return !!await apis.doAction(['stat', path]); } catch (error) { return false; } };
  const [, stem, ext] = name.match(/^(.*?)(\.[^.]*)?$/);
  let path = `${dir}/${name}`;
  for (let n = 2; await taken(path); n++) path = `${dir}/${stem} ${n}${ext || ''}`;
  return path;
}
async function save(name, text, type = 'text/plain') {
  const apis = bridge();
  if (apis) {
    const last = (() => { try { return typeof logseq.settings?.saveFolder === 'string' ? logseq.settings.saveFolder : ''; } catch (error) { return ''; } })();
    const picked = await apis.doAction(['showOpenDialog', { title: `Save ${name}`, message: `Choose the folder for ${name}`, buttonLabel: 'Save here', properties: ['openDirectory', 'createDirectory'], ...(last ? { defaultPath: last } : {}) }]);
    const dir = picked && !picked.canceled && picked.filePaths?.[0];
    if (!dir) return { saved: false };
    const path = await freePath(apis, String(dir).replace(/\/$/, ''), name);
    await apis.doAction(['writeFile', null, path, text]);
    try { logseq.updateSettings({ saveFolder: dir }); } catch (error) { /* not remembered */ }
    try { apis.doAction(['openFileInFolder', path]); } catch (error) { /* the file is saved all the same */ }
    return { saved: true, path };
  }
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 10000);
  return { saved: true, path: name };
}
E.files = { forget, freePath, currentGraph, assetUrl, dataUrl, pictures, fileName, save };
})();
