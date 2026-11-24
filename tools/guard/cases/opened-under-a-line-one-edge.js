/* Found by hand, 24 November 2026, on the node opened under a line (Option-L, picture 1A), 700 px wide: inside the ground the property
   lines started about 36 px right of the place line ("Bank Account / Continuant"); and a node dug open inside the ground hung from the
   value column, so its ground was narrow and a tag wrapped onto a second line ("Chase / Organization"). The place line and the
   node's lines share one left edge; a node opened inside takes the whole width of the outer ground's lines. */
module.exports = {
  parts: ['find', 'threads', 'look', 'shared'],
  name: 'A node opened under a line: its place line and its lines share one left edge, and a node opened inside it takes the whole width',
  from: '24 Nov, hand test: "the property lines start about 36 px to the right of the place line"',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box; const f = box.frame();
    const clean = () => f.evaluate(async () => { const rows = await logseq.DB.datascriptQuery('[:find ?u :where [?b :block/title ?t] [?b :block/uuid ?u] [(clojure.string/includes? ?t "GUARDEDGE")]]'); for (const [u] of rows || []) await logseq.Editor.removeBlock(u).catch(() => {}); });
    const done = async verdict => { for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await T.sleep(150); } await clean(); return verdict; };
    const no = said => done({ ok: false, said });
    await clean();
    await T.go(page, 'Amex Gold'); await T.sleep(1500);
    const words = 'GUARDEDGE paid from [[Chase Checking]] today';
    const uuid = await f.evaluate(async w => { const p = await logseq.Editor.getPage('Amex Gold'); return (await logseq.Editor.appendBlockInPage(p.uuid, w)).uuid; }, words);
    await T.sleep(700);
    await page.evaluate(([u, at]) => { window.logseq.api.edit_block(u, { pos: at }); return 1; }, [uuid, words.indexOf(']]') + 2]); await T.sleep(900);
    await page.keyboard.press('Alt+KeyL'); await T.sleep(2500);
    // The left edge of a ground's place line (its first word) and of its lines (a property's icon, a bullet, a heading's words).
    const edges = () => page.evaluate(() => {
      const h = document.querySelector('[data-lk-under]'); if (!h) return null;
      const L = e => e ? Math.round(e.getBoundingClientRect().left) : null;
      const placeOf = g => L(g.querySelector(':scope > .lk-ground-top .lk-path a.lk-tag, :scope > .th-ol-in > .lk-ground-top .lk-path a.lk-tag'));
      const inner = h.querySelector('.th-tw-ground');
      const own = s => [...h.querySelectorAll(s)].filter(e => !inner || !inner.contains(e));
      const icon = own('.th-ol-prop > .th-ol-pname .th-kind')[0];
      const out = { place: placeOf(h), line: L(icon), right: Math.round(h.getBoundingClientRect().right) };
      if (inner) {
        const ir = inner.getBoundingClientRect(), top = inner.querySelector('.lk-ground-top'), tagLine = inner.querySelector('.lk-ground-top .lk-path');
        const tags = [...inner.querySelectorAll('.lk-ground-top .lk-path a.lk-tag')].map(a => Math.round(a.getBoundingClientRect().top));
        out.inner = { left: Math.round(ir.left), right: Math.round(ir.right), place: placeOf(inner), line: L(inner.querySelector('.th-ol-prop > .th-ol-pname .th-kind, .th-ol-bullet .th-ol-dot')), topRows: tags.length ? 1 + tags.filter((t, i) => i && t - tags[i - 1] > 10).length : 0, top: !!top, tagLine: !!tagLine };
      }
      return out;
    });
    let e = await edges();
    if (!e) return no('the node did not open under the line');
    if (e.place == null || e.line == null) return no(`the ground has no place line or no property line to measure (${JSON.stringify(e)})`);
    if (Math.abs(e.place - e.line) > 3) return no(`the place line starts at ${e.place}px and the node's lines at ${e.line}px: not one left edge`);
    // Open the first value that is a node, inside the opened node.
    // Open the first value that is a node holding more (as Chase / Organization), or else the first node in its Relations.
    const arrow = () => page.evaluate(() => { const c = document.querySelector('[data-lk-under] .th-ol-prop .th-ol-pv > .th-chev[data-dig]') || document.querySelector('[data-lk-under] .th-tw-lkids .th-ol-line > .th-chev[data-dig]'); if (!c) return null; const r = c.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; return [x, y, c.contains(document.elementFromPoint(x, y))]; });
    let xy = null;
    for (let i = 0; i < 20 && !xy; i++) { xy = await arrow(); if (!xy) await T.sleep(250); }
    if (!xy) return no('the opened node has no value that opens');
    if (!xy[2]) { await page.evaluate(() => { const h = document.querySelector('[data-lk-under]'), m = document.getElementById('main-content-container'); m.scrollTop += h.getBoundingClientRect().top - m.getBoundingClientRect().top - 60; }); await T.sleep(600); }
    await page.mouse.move(xy[0], xy[1]); await T.sleep(400); xy = await arrow();
    if (!xy?.[2]) return no('the value\'s fold arrow could not be reached to press');
    await page.mouse.click(xy[0], xy[1]); await T.sleep(2000);
    e = await edges();
    if (!e?.inner) return no('the value did not open on a ground of its own inside the node');
    if (Math.abs(e.inner.left - (e.line - 0)) > 30 || e.inner.left > e.line + 3) return no(`the node opened inside hangs from ${e.inner.left}px, not from the outer lines' edge (${e.line}px)`);
    if (e.right - e.inner.right > 20) return no(`the node opened inside ends ${e.right - e.inner.right}px short of the outer ground's right side`);
    if (e.inner.place == null || e.inner.line == null || Math.abs(e.inner.place - e.inner.line) > 3) return no(`inside the inner ground the place line (${e.inner.place}px) and its lines (${e.inner.line}px) do not share one edge`);
    if (e.inner.topRows > 1) return no('the inner ground\'s place line wraps onto a second line');
    return done({ ok: true, said: `the place line and the lines start together (${e.place}px); the node opened inside runs from ${e.inner.left}px to ${e.right - e.inner.right}px short of the right side, its own place line and lines together` });
  },
};
