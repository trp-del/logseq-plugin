/* The owner, 24 November 2026, with the symbols drawn on the Mac in use: "i did this but mant don't seem changed", then pictures
   ("it is there but some doquiquit"): a node's right-click menu, Logseq's Settings window, the ··· after a Relations group and
   the mark before a property that points at a node all stood in the old drawing beside menus that were all symbols. A name was
   swapped only in the place it had first been seen. One name gets one symbol wherever it stands: with the symbols drawn, every
   icon in those four places is drawn from the file.
   The pictures here are a stand-in of this case's own, a plain square: Apple's drawings never enter the repository. */
const fs = require('node:fs'), path = require('node:path');
const SQUARE = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M2 2h6v6h-6z"/></svg>').toString('base64');
// Every icon inside `scope`, with whether it is drawn from the file: Logseq's drawn icons, the icon font's glyphs, the library's own.
const icons = (page, scope) => page.evaluate(([scope, SQUARE]) => {
  const root = document.querySelector(scope); if (!root) return null;
  const from = (el, pseudo) => { const s = getComputedStyle(el, pseudo || null); return (s.webkitMaskImage || s.maskImage || '').includes(SQUARE); };
  const out = [];
  for (const svg of root.querySelectorAll('.ui__icon > svg')) out.push({ name: [...svg.parentElement.classList].find(c => c.startsWith('ls-icon-'))?.slice(8) || 'svg', swapped: from(svg) });
  for (const glyph of root.querySelectorAll('.ti[class*="ti-"]')) out.push({ name: [...glyph.classList].find(c => c.startsWith('ti-'))?.slice(3), swapped: from(glyph, '::before') });
  for (const own of root.querySelectorAll('[class*="lk-i-"]')) out.push({ name: [...own.classList].find(c => c.startsWith('lk-i-')), swapped: from(own, '::before') });
  for (const line of root.matches('[data-lk-menu-icon]') ? [root] : root.querySelectorAll('[data-lk-menu-icon]:not([data-lk-menu-icon="none"])')) out.push({ name: line.getAttribute('data-lk-menu-icon'), swapped: from(line, '::before') });
  return out;
}, [scope, SQUARE]);

module.exports = {
  parts: ['shared', 'look', 'settings', 'threads', 'todo'],
  name: 'With the Mac’s symbols drawn, a node’s right-click menu, Logseq’s Settings, a Relations group’s ··· and a node property’s mark are all symbols',
  from: '24 Nov: “i did this but mant don’t seem changed”, “it is there but some doquiquit”',
  graph: 'Illness Test Graph',
  async check(box, T) {
    const { page } = box, file = path.join(box.home, '.logseq', 'storages', 'logseq-plugin', 'mac-symbols.json');
    const had = fs.existsSync(file) ? fs.readFileSync(file) : null;
    const read = () => box.frame().evaluate(() => window.PluginDoor.symbols.read());
    const old = (list, keep = []) => (list || []).filter(i => !i.swapped && !keep.includes(i.name)).map(i => i.name);
    try {
      const names = await box.frame().evaluate(() => window.PluginDoor.symbols.names());
      fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify({ symbols: Object.fromEntries(names.map(n => [n, SQUARE])) }));
      await read();
      const faults = [];
      // 1. A page: the mark before a property that points at a node, and the ··· after a Relations group.
      await T.go(page, 'Dr. Mei Chen'); await T.still(page); await T.sleep(800);
      const web = await page.evaluate(SQUARE => { const svg = document.querySelector('.lk-icon.lk-web > svg'); return svg ? (getComputedStyle(svg).webkitMaskImage || '').includes(SQUARE) : null; }, SQUARE);
      if (web === null) return { ok: false, said: 'the page shows no property that points at a node' };
      if (!web) faults.push('the mark before a property that points at a node');
      const more = await icons(page, '.th-tw-groupby');
      if (!more?.length) return { ok: false, said: 'the page shows no ··· after a Relations group' };
      if (old(more).length) faults.push('the ··· after a Relations group');
      // 2. A node's right-click menu (the plugin's, the same in Todo, Find, Relations and the sidebar).
      await T.route(page, '#/todo');
      for (let i = 0; i < 40 && !(await page.$('.td-row')); i++) await T.sleep(250);
      const row = await page.$('.td-row'); if (!row) return { ok: false, said: 'Todo shows no task to right-click' };
      await row.click({ button: 'right' }); await T.sleep(600);
      const menu = await icons(page, '.lk-menu');
      await page.keyboard.press('Escape'); await T.sleep(200);
      if (!menu?.length) return { ok: false, said: 'the right-click menu did not open' };
      // A status's and a priority's own marks are saved in the graph, as a task's circle is: they stay.
      const menuOld = old(menu, ['circle', 'circle-check', 'circle-half-2', 'circle-x', 'circle-dotted', 'antenna-bars-1', 'antenna-bars-2', 'antenna-bars-3', 'antenna-bars-4', 'antenna-bars-5', 'square-rounded-letter-u', 'alert-square-filled', 'cell-signal-1', 'cell-signal-2', 'cell-signal-3', 'cell-signal-4', 'cell-signal-5']);
      if (menuOld.length) faults.push('in a node’s right-click menu: ' + [...new Set(menuOld)].join(', '));
      // 3. Logseq's Settings window: its sections and its close.
      await T.go(page, 'Dr. Mei Chen'); await T.sleep(600);
      await page.click('#head .toolbar-dots-btn'); await T.sleep(500);
      const line = await page.$('.ui__dropdown-menu-content [role="menuitem"]:has(.ls-icon-settings)'); if (!line) return { ok: false, said: 'the ··· menu shows no Settings line' };
      await line.click();
      for (let i = 0; i < 30 && !(await page.$('.cp__settings-inner .settings-menu-link')); i++) await T.sleep(200);
      await T.sleep(500);
      const sections = await icons(page, '.cp__settings-inner aside'), close = await icons(page, '.ui__dialog-content:has(.cp__settings-inner) .ui__dialog-close, .ui__dialog-content:has(.cp__settings-inner) [class*="close"]');
      for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await T.sleep(150); }
      if (!sections?.length) return { ok: false, said: 'Logseq’s Settings window did not open' };
      if (old(sections).length) faults.push('Logseq’s Settings, its sections: ' + old(sections).join(', '));
      if (close && old(close).length) faults.push('Logseq’s Settings, its close');
      // 4. A property the owner picked a symbol for ("3a 4a": Description, Notes) shows it over its own icon, told by the property's
      // name; another property carrying the same letter keeps the letter. Tried on rows made here, so nothing is written to the graph.
      const named = await page.evaluate(SQUARE => {
        const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:-999px;top:0';
        const row = title => `<div class="property-pair" data-property-title="${title}"><button class="property-m"><span class="ls-icon-letter-n ui__icon ti"><svg width="15" height="15"><path d="M0 0"/></svg></span></button></div>`;
        box.innerHTML = row('Notes') + row('Description') + row('Nurse');
        document.body.appendChild(box);
        const out = [...box.querySelectorAll('svg')].map(svg => (getComputedStyle(svg).webkitMaskImage || '').includes(SQUARE));
        box.remove(); return out;
      }, SQUARE);
      if (!named[0] || !named[1]) faults.push('the owner’s own icon on ' + [!named[0] && 'Notes', !named[1] && 'Description'].filter(Boolean).join(' and '));
      if (named[2]) return { ok: false, said: 'a property the owner picked no symbol for lost the letter the owner gave it' };
      if (faults.length) return { ok: false, said: 'still in the old drawing with the symbols drawn: ' + faults.join('; ') };
      return { ok: true, said: `symbols on the node property’s mark, the Relations ···, ${menu.length} icons of a node’s right-click menu and ${sections.length} sections of Logseq’s Settings` };
    } finally {
      for (let i = 0; i < 3; i++) await page.keyboard.press('Escape').catch(() => {});
      if (had) fs.writeFileSync(file, had); else fs.rmSync(file, { force: true });
      await read().catch(() => {});
    }
  },
};
