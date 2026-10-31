// Logseq keeps a plugin's entry script cached between reloads (this file, under the address package.json names), so an
// edit to it would not show up until Logseq's cache is cleared. So this file never changes: it loads files.js (the list
// of files, in order) under a new address every start, then each file under a new address too, in order (async = false
// keeps the order).
(() => {
  const here = document.currentScript.src, stamp = Date.now();
  const load = (file, onload) => {
    const script = document.createElement('script');
    script.async = false;
    script.src = new URL(file + '?t=' + stamp, here).href;
    script.onerror = () => console.error('Logseq Plugin: could not load ' + file);
    if (onload) script.onload = onload;
    document.body.appendChild(script);
  };
  load('files.js', () => { for (const file of window.PluginFiles || []) load(file); });
})();
