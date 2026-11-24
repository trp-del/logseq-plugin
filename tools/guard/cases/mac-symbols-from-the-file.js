/* The owner, 23 November 2026: "can you look at replacing most of the symbols of logseq with macos particularly sf symbols",
   then of the proposal, "ok lets do your way". The Mac's own symbols stand in place of the icons only while this Mac has drawn
   them into the plugin's storage (mac-symbols.json) and the switch is on; with no file, a broken file or the switch off, every
   icon is the drawing it was. The kinds left alone never change: a task's status circle, the Ontology toolbar button, Add a
   child, the bullet, the fold arrow, the tick box, the mark of the graph.
   The pictures here are a stand-in of this case's own, a plain square: Apple's drawings never enter the repository. */
const fs = require('node:fs'), path = require('node:path');
const SQUARE = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M2 2h6v6h-6z"/></svg>').toString('base64');

// What each icon is drawn with now: its mask, and the box it stands in. Read on Logseq's page, with probes for the library's own.
const read = page => page.evaluate(() => {
  const doc = document, win = window, probes = doc.createElement('div');
  probes.style.cssText = 'position:fixed;left:-999px;top:0';
  probes.innerHTML = '<span class="lk-i-plus" data-p="plus"></span><span class="lk-i-bin" data-p="bin"></span><span class="lk-i-child" data-p="child"></span><button class="lk-fold" data-p="fold"></button><input type="checkbox" class="lk-tick" checked data-p="tick"><span class="lk-bul" data-p="bul"></span><i class="ti ti-search" data-p="glyph"></i><i class="ti ti-heart" data-p="other"></i>';
  doc.body.appendChild(probes);
  const mask = (el, pseudo) => { if (!el) return null; const s = win.getComputedStyle(el, pseudo || null), r = el.getBoundingClientRect(); return { mask: s.webkitMaskImage || s.maskImage || 'none', w: Math.round(r.width), h: Math.round(r.height) }; };
  const p = name => probes.querySelector(`[data-p="${name}"]`);
  const out = {
    // One from each of the five groups the owner approved.
    'Search, in the top bar': mask(doc.querySelector('#head .ls-icon-search > svg')),
    'Delete page, in the ··· menu': mask(doc.querySelector('.ui__dropdown-menu-content [data-lk-menu-icon="trash"]'), '::before'),
    'Settings, in the ··· menu': mask(doc.querySelector('.ui__dropdown-menu-content .ls-icon-settings > svg')),
    'a property’s kind': mask(doc.querySelector('.lk-kind .lk-icon.ti'), '::before'),
    'the Todo toolbar button': mask(doc.querySelector('#head .lk-tool[title="Todo"] > svg')),
    'the mark of a property that points at a node': mask(doc.querySelector('.lk-icon.lk-web > svg')),
    'the library’s plus': mask(p('plus'), '::before'),
    'the library’s bin': mask(p('bin'), '::before'),
    'the plugin’s search glyph': mask(p('glyph'), '::before'),
    // The kinds left alone.
    'KEEP the Ontology toolbar button': mask(doc.querySelector('#head .lk-tool[title^="Ontology"] > svg')),
    'KEEP Add a child': mask(p('child'), '::before'),
    'KEEP the fold arrow': mask(p('fold'), '::before'),
    'KEEP the tick box': mask(p('tick'), '::before'),
    'KEEP the bullet': mask(p('bul'), '::before'),
    'KEEP the mark of the graph': mask(doc.querySelector('#left-sidebar .ls-icon-topology-star > svg')),
    'KEEP a task’s status circle': mask(doc.querySelector('.lk-status svg, .lk-status .ti, .ls-icon-Todo svg, .ls-icon-circle svg')),
    'KEEP an icon outside the list': mask(p('other'), '::before'),
  };
  probes.remove();
  return out;
});

module.exports = {
  parts: ['shared', 'look', 'settings'],
  name: 'The Mac’s symbols stand in place of the icons only from the file, and the kinds left alone never change',
  from: '23 Nov: “replacing most of the symbols of logseq with macos particularly sf symbols”, “ok lets do your way”',
  graph: 'Illness Test Graph',
  async check(box, T) {
    const { page } = box, file = path.join(box.home, '.logseq', 'storages', 'logseq-plugin', 'mac-symbols.json');
    const errors = []; const hear = m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); }; page.on('console', hear);
    const had = fs.existsSync(file) ? fs.readFileSync(file) : null;
    const put = text => { if (text == null) fs.rmSync(file, { force: true }); else { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); } };
    const again = async () => { const said = await box.frame().evaluate(() => window.PluginDoor.symbols ? window.PluginDoor.symbols.read().then(() => '') : 'the library has no piece for the Mac’s symbols').catch(e => String(e.message || e).slice(0, 120)); await T.sleep(250); return said; };
    const menu = async open => { const up = () => page.evaluate(() => !!document.querySelector('.ui__dropdown-menu-content [data-lk-menu-icon="trash"]')); if (await up() === open) return; if (open) await page.click('#head .toolbar-dots-btn'); else await page.keyboard.press('Escape'); for (let i = 0; i < 20 && (await up()) !== open; i++) await T.sleep(100); await T.sleep(200); };
    const look = async () => { await menu(true); const seen = await read(page); await menu(false); return seen; };
    try {
      await T.go(page, 'Dr. Mei Chen'); await T.still(page); await T.sleep(600);
      const names = await box.frame().evaluate(() => window.PluginDoor.symbols?.names?.() || []);
      const standIn = JSON.stringify({ symbols: Object.fromEntries(names.map(n => [n, SQUARE])) });
      // 1. No file: today's drawings.
      put(null); let said = await again(); if (said) return { ok: false, said };
      const before = await look();
      const missing = Object.entries(before).filter(([k, v]) => !v && !/status circle/.test(k)).map(([k]) => k);
      if (missing.length) return { ok: false, said: 'not on the screen to be read: ' + missing.join(', ') };
      const squares = seen => Object.entries(seen).filter(([, v]) => v && v.mask.includes(SQUARE)).map(([k]) => k);
      if (squares(before).length) return { ok: false, said: 'with no file, drawn from a file all the same: ' + squares(before).join(', ') };
      // 2. The file there: each of the five groups from the file, the kinds left alone as they were, every box the size it was.
      put(standIn); said = await again(); if (said) return { ok: false, said };
      const withFile = await look();
      const swapped = Object.keys(before).filter(k => !k.startsWith('KEEP')), kept = Object.keys(before).filter(k => k.startsWith('KEEP'));
      const notSwapped = swapped.filter(k => !withFile[k]?.mask.includes(SQUARE));
      if (notSwapped.length) return { ok: false, said: 'the file is there, yet still today’s drawing: ' + notSwapped.join(', ') };
      const changed = kept.filter(k => JSON.stringify(withFile[k]) !== JSON.stringify(before[k]));
      if (changed.length) return { ok: false, said: 'left alone, yet changed: ' + changed.map(k => k.replace('KEEP ', '')).join(', ') };
      const resized = swapped.filter(k => withFile[k].w !== before[k].w || withFile[k].h !== before[k].h);
      if (resized.length) return { ok: false, said: 'the symbol’s box is not the icon’s: ' + resized.map(k => `${k} ${before[k].w}×${before[k].h} → ${withFile[k].w}×${withFile[k].h}`).join(', ') };
      // 3. The switch off: today's drawings at once, with the file still there; on again, the symbols.
      const flip = async on => { await box.frame().evaluate(on => logseq.updateSettings({ macSymbols: on }), on); await T.sleep(500); };
      await flip(false);
      const off = await look();
      await flip(true);
      if (JSON.stringify(off) !== JSON.stringify(before)) return { ok: false, said: 'the switch is off, yet not today’s drawings: ' + Object.keys(before).filter(k => JSON.stringify(off[k]) !== JSON.stringify(before[k])).join(', ') };
      if ((await look())['Search, in the top bar'].mask.includes(SQUARE) === false) return { ok: false, said: 'the switch back on did not bring the symbols back' };
      // 4. A file cut off halfway, then no file: today's drawings, and nothing said in the console.
      for (const [what, text] of [['a file cut off halfway', standIn.slice(0, 300)], ['a file that is not a list of pictures', '{"symbols":{"plus":"javascript:alert(1)","trash":"url(x)"}}'], ['the file removed', null]]) {
        put(text); said = await again(); if (said) return { ok: false, said };
        const now = await look();
        if (JSON.stringify(now) !== JSON.stringify(before)) return { ok: false, said: `${what}, yet not today’s drawings: ` + Object.keys(before).filter(k => JSON.stringify(now[k]) !== JSON.stringify(before[k])).join(', ') };
      }
      if (errors.length) return { ok: false, said: 'the console said: ' + errors[0] };
      return { ok: true, said: `${swapped.length} icons from the five groups are drawn from the file while it is there and the switch is on, in the box each had; ${kept.length} left alone never changed; off, cut off or removed, all are today’s` };
    } finally {
      page.off('console', hear);
      await menu(false).catch(() => {});
      await box.frame().evaluate(() => logseq.updateSettings({ macSymbols: true })).catch(() => {});
      put(had); await again().catch(() => {});
    }
  },
};
