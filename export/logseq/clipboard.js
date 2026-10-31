/* The clipboard: rich text (HTML with its styles inline, and the Markdown as the plain-text form) or Markdown alone.
   Tried through the plugin's own window, then Logseq's, with the clipboard API and then the copy event. */
(function () {
const E = (window.DbExport ||= {});
const host = () => { try { return window.parent?.document?.defaultView || null; } catch (error) { return null; } };
async function write({ html, text }) {
  const wins = [window, host()].filter(Boolean);
  for (const win of wins) {
    try {
      const parts = { 'text/plain': new win.Blob([text], { type: 'text/plain' }) };
      if (html) parts['text/html'] = new win.Blob([html], { type: 'text/html' });
      await win.navigator.clipboard.write([new win.ClipboardItem(parts)]);
      return true;
    } catch (error) { /* the next way */ }
  }
  for (const win of wins) {
    const doc = win.document;
    let done = false;
    const onCopy = event => { if (html) event.clipboardData.setData('text/html', html); event.clipboardData.setData('text/plain', text); event.preventDefault(); done = true; };
    doc.addEventListener('copy', onCopy, true);
    try { doc.execCommand('copy'); } catch (error) { /* the next way */ } finally { doc.removeEventListener('copy', onCopy, true); }
    if (done) return true;
  }
  for (const win of wins) { try { await win.navigator.clipboard.writeText(text); return true; } catch (error) { /* give up */ } }
  return false;
}
E.clipboard = { write };
})();
