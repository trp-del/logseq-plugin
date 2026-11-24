/* The Option-K hand test of 24 November 2026, the owner's window of 700 px, the right sidebar about 280 wide: under a sidebar bullet
   the small Find's kinds wrapped onto two lines and its foot onto two, and the first row, scrolled into view, hid the small name
   ("kind") of the line of choices under the find line. Every line of choices shows its name, and the first row shows whole, inside
   the panel's list, at rest and with letters typed. The second hand test (24 November 2026, a thread): the bullet lower in the
   sidebar (top about 320 of 560), the panel under it short, and "amex" typed showed the find line, a gap and a row and a half, the
   line "kind" scrolled out above; so the case also opens the panel there and types "amex". The third hand test (24 November 2026, a
   thread, the kind line pinned): there, with about 230 px under the bullet, the first row stood faded under the pinned kind line, and
   after Down the foot grew to three lines and no row showed at all. Where the room under the line cannot hold the find line, the
   pinned lines, three rows and the foot on one line, the panel opens above the line, as Logseq's own pop-ups do: the case looks for
   it above the bullet, clear of it, with the pinned lines named and three rows whole under them, before and after Down. */
module.exports = {
  parts: ['find', 'shared'],
  name: '0.5: in the narrow sidebar the small Find shows each line of choices with its name, and its first row whole; low in the window it opens above the line with three rows whole',
  from: '24 Nov: Option-K hand test, the word “kind” hidden under the input in the sidebar',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box; const f = box.frame();
    const clean = () => f.evaluate(async () => { const rows = await logseq.DB.datascriptQuery('[:find ?u :where [?b :block/title ?t] [?b :block/uuid ?u] [(clojure.string/includes? ?t "GUARDNARROWKIND")]]'); for (const [u] of rows || []) await logseq.Editor.removeBlock(u).catch(() => {}); });
    const done = async verdict => { for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await T.sleep(120); } await clean(); return verdict; };
    await clean();
    await box.cdp.send('Emulation.setDeviceMetricsOverride', { width: 700, height: 560, deviceScaleFactor: 1, mobile: false });
    await T.go(page, 'Amex Gold'); await T.sleep(1200);
    await T.inSidebar(box, 'Chase Checking'); await T.sleep(1500);
    const uuid = await f.evaluate(async () => { const p = await logseq.Editor.getPage('Chase Checking'); const b = await logseq.Editor.appendBlockInPage(p.uuid, 'GUARDNARROWKIND paid the card at');
      // Bullets under it, so the sidebar can bring it up to where the hand test had it (its top about 320 of 560).
      for (let i = 1; i <= 8; i++) await logseq.Editor.appendBlockInPage(p.uuid, 'GUARDNARROWKIND after ' + i);
      return b.uuid; });
    await T.sleep(900);
    const at = await page.evaluate(u => { const b = document.querySelector(`#right-sidebar .ls-block[blockid="${u}"] .block-content, .cp__right-sidebar .ls-block[blockid="${u}"] .block-content`); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return [r.left + 30, r.top + Math.min(r.height / 2, 12)]; }, uuid);
    if (!at) return done({ ok: false, said: 'the new bullet did not show in the right sidebar' });
    await T.sleep(500); await page.mouse.click(at[0], at[1]); await T.sleep(700);
    await page.keyboard.press('End'); await T.sleep(200);
    const inSide = await page.evaluate(() => !!document.activeElement?.closest?.('#right-sidebar, .cp__right-sidebar') && document.activeElement.tagName === 'TEXTAREA');
    if (!inSide) return done({ ok: false, said: 'the sidebar bullet could not be put in writing' });
    await f.evaluate(() => { window.PluginDoor.ask('find:panel', { box: window.PluginDoor.host().activeElement }); }); await T.sleep(1800);
    // Each name of a line of choices, and the first row, inside the panel's list as it shows.
    const look = () => page.evaluate(() => {
      const d = document.querySelector('dialog[open].fd.fd-panel'); if (!d) return null;
      const body = d.querySelector('.fd-body').getBoundingClientRect(), inside = r => r.height > 0 && r.top >= body.top - 0.5 && r.bottom <= body.bottom + 0.5;
      const names = [...d.querySelectorAll('.fd-body .lk-ck')].map(n => ({ text: n.textContent.trim(), ok: inside(n.getBoundingClientRect()) }));
      const first = d.querySelector('.fd-body .fd-r');
      const lines = new Set([...d.querySelectorAll('.fd-body .lk-choices .lk-ch:first-child .lk-view, .fd-body .lk-choices .lk-ch:first-child .lk-more')].map(v => Math.round(v.getBoundingClientRect().top))).size;
      return { names, first: first ? inside(first.getBoundingClientRect()) : null, lines, width: Math.round(d.getBoundingClientRect().width) };
    });
    const said = [];
    for (const [state, typing] of [['at rest', ''], ['with “chase” typed', 'chase']]) {
      if (typing) { await page.keyboard.type(typing, { delay: 60 }); await T.sleep(1600); }
      const s = await look();
      if (!s) return done({ ok: false, said: `the panel did not open under the sidebar bullet (${state})` });
      const hid = s.names.filter(n => !n.ok).map(n => `“${n.text}”`);
      if (hid.length) return done({ ok: false, said: `${state}, the name ${hid.join(', ')} of a line of choices is hidden under the find line (panel ${s.width} wide, the first line of choices on ${s.lines} lines)` });
      if (s.first === false) return done({ ok: false, said: `${state}, the first row is cut at the panel's foot` });
      said.push(`${state}: ${s.names.length} names shown, the first line of choices on ${s.lines} lines`);
    }
    // Low in the sidebar: the panel closed (Escape puts the caret back, and a bullet being written shows a box in place of its words,
    // so its row is looked for, not its words: run 3 of 24 November 2026 lost the bullet there), the bullet's top brought to 320, the panel opened again and "amex" typed.
    await page.keyboard.press('Escape'); await T.sleep(500);
    const low = await page.evaluate(([u, y]) => {
      const b = document.querySelector(`#right-sidebar .ls-block[blockid="${u}"] > .block-main-container, .cp__right-sidebar .ls-block[blockid="${u}"] > .block-main-container`); if (!b) return null;
      let sc = b.parentElement; while (sc && !(sc.scrollHeight > sc.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
      if (sc) sc.scrollTop += b.getBoundingClientRect().top - y;
      const r = b.getBoundingClientRect(), words = b.querySelector('.block-content'), w = words?.getBoundingClientRect();
      // Already in writing (Escape put the caret back): no click. Otherwise a click on its words, never on its bullet.
      return [Math.round(r.top), w ? w.left + 30 : null, w ? w.top + Math.min(w.height / 2, 12) : null];
    }, [uuid, 320]);
    if (!low) return done({ ok: false, said: 'the sidebar bullet was gone after the panel closed' });
    if (Math.abs(low[0] - 320) > 24) return done({ ok: false, said: `the sidebar bullet could not be brought to the hand test's place (its top at ${low[0]}, not about 320)` });
    await T.sleep(500);
    if (low[1] != null) { await page.mouse.click(low[1], low[2]); await T.sleep(700); }
    await page.keyboard.press('End'); await T.sleep(200);
    const still = await page.evaluate(() => !!document.activeElement?.closest?.('#right-sidebar, .cp__right-sidebar') && document.activeElement.tagName === 'TEXTAREA');
    if (!still) return done({ ok: false, said: 'the sidebar bullet low in the window could not be put in writing' });
    await f.evaluate(() => { window.PluginDoor.ask('find:panel', { box: window.PluginDoor.host().activeElement }); }); await T.sleep(1800);
    await page.keyboard.type('amex', { delay: 60 }); await T.sleep(1600);
    const s = await look();
    if (!s) return done({ ok: false, said: 'the panel did not open under the sidebar bullet low in the window' });
    // Too little room under the bullet: the panel stands above it, clear of the bullet and of the window's top.
    const side = () => page.evaluate(u => { const d = document.querySelector('dialog[open].fd.fd-panel'), b = document.querySelector(`#right-sidebar .ls-block[blockid="${u}"] > .block-main-container, .cp__right-sidebar .ls-block[blockid="${u}"] > .block-main-container`); if (!d || !b) return null; const p = d.getBoundingClientRect(), r = b.getBoundingClientRect(); return { above: p.bottom <= r.top + 0.5, top: Math.round(p.top), bottom: Math.round(p.bottom), line: Math.round(r.top) }; }, uuid);
    // The rows shown whole under the pinned lines of choices, inside the panel's list, and how many rows there are.
    const rowsSeen = () => page.evaluate(() => {
      const d = document.querySelector('dialog[open].fd.fd-panel'); if (!d) return null;
      const body = d.querySelector('.fd-body').getBoundingClientRect(), pin = d.querySelector('.fd-body > .fd-choices')?.getBoundingClientRect();
      const from = pin ? Math.max(body.top, pin.bottom) : body.top, rows = [...d.querySelectorAll('.fd-body .fd-r')];
      const whole = rows.filter(r => { const b = r.getBoundingClientRect(); return b.height > 0 && b.top >= from - 0.5 && b.bottom <= body.bottom + 0.5; }).length;
      return { whole, all: rows.length, foot: (d.querySelector('.fd-foot')?.innerText || '').split('\n').filter(Boolean).length };
    });
    for (const [state, key] of [['“amex” typed', ''], ['“amex” typed and Down pressed', 'ArrowDown']]) {
      if (key) { await page.keyboard.press(key); await T.sleep(900); }
      const where = `the bullet's top at ${low[0]}, ${state}`;
      const at = await side(), s = await look(), seen = await rowsSeen();
      if (!at || !s || !seen) return done({ ok: false, said: `${where}, the panel was not open` });
      if (!at.above) return done({ ok: false, said: `${where}, the panel opened under the bullet (its top at ${at.top}), where the room cannot hold three rows; it should open above the line` });
      if (at.top < 0) return done({ ok: false, said: `${where}, the panel's top is out of the window (${at.top})` });
      const hid = s.names.filter(n => !n.ok).map(n => `“${n.text}”`);
      if (!s.names.length) return done({ ok: false, said: `${where}, no line of choices shows in the panel` });
      if (hid.length) return done({ ok: false, said: `${where}, the name ${hid.join(', ')} of a line of choices is out of view (panel ${s.width} wide)` });
      const want = Math.min(3, seen.all);
      if (!want) return done({ ok: false, said: `${where}, the panel lists no row` });
      if (seen.whole < want) return done({ ok: false, said: `${where}, ${seen.whole} of ${want} rows show whole under the pinned lines (the foot on ${seen.foot} lines)` });
      said.push(`${where}: above the line, ${s.names.length} names shown, ${seen.whole} rows whole, the foot on ${seen.foot} lines`);
    }
    return done({ ok: true, said: said.join('; ') });
  },
};
