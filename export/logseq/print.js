/* The PDF: the document's HTML on a page styled by its look (core/themes.js), in a frame put into Logseq's own document
   (beside the export window, which is drawn there too; the plugin's own frame stays hidden), handed to the system's
   print dialog, where "Save as PDF" writes the file with the title as its name. Pictures are waited for before
   printing. The same page, with the look's screen rules, is what the export window previews. */
(function () {
const E = (window.DbExport ||= {});
const esc = s => E.inline.escapeHtml(s);
function pageHtml({ body, look, page, title, extraCss = '' }) {
  const css = E.themes.stylesheet(look, page);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(E.files.fileName(title || 'Export'))}</title><style>${css}\n${extraCss}</style></head><body><div class="x-doc">${body}</div></body></html>`;
}
const settle = (doc, ms = 4000) => new Promise(resolve => {
  const imgs = [...doc.images].filter(i => !i.complete);
  if (!imgs.length) return resolve();
  let left = imgs.length;
  const one = () => { if (--left <= 0) resolve(); };
  imgs.forEach(i => { i.addEventListener('load', one); i.addEventListener('error', one); });
  setTimeout(resolve, ms);
});
function print(html) {
  return new Promise(resolve => {
    const hostDoc = E.ui.host();
    const frame = hostDoc.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.className = 'xp-print';
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:1000px;border:0;';
    hostDoc.body.appendChild(frame);
    const doc = frame.contentDocument;
    doc.open(); doc.write(html); doc.close();
    settle(doc).then(() => setTimeout(() => {
      try { frame.contentWindow.focus(); frame.contentWindow.print(); }   // returns when the print window closes
      catch (error) { console.error(error); logseq.UI.showMsg(`Could not open the print window: ${error.message}`, 'error'); }
      setTimeout(() => { frame.remove(); resolve(); }, 500);
    }, 150));
  });
}
E.print = { pageHtml, print, settle };
})();
