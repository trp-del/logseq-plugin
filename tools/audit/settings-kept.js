#!/usr/bin/env node
/* node settings-kept.js   Goalpost line 6.4: a fresh install from the release works, and an update keeps every choice you made.
   The proof run's Logseq is a fresh install: a new home, the plugin loaded from a copy of the code (the last commit, or the
   folder given), all seven parts started (fresh.js says so). Before the plugin was first loaded, fresh.js wrote choices of the
   owner's kind into its settings (readingWidth Narrow, Apple's tools off). Read now: every one is still what was written, and
   the screen follows it (the reading column is narrow). */
const { connect, go, finish, fail } = require('./kit');
(async () => {
  const { browser, page, frame } = await connect();
  const st = await frame().evaluate(() => ({ s: JSON.parse(JSON.stringify(logseq.settings || {})), parts: (window.PluginDoor.started || []).map(m => m.key) }));
  await go(page, 'Dr. Mei Chen', 2000);
  const w = await page.evaluate(() => Math.round(document.querySelector('#main-content-container .cp__sidebar-main-content')?.getBoundingClientRect().width || 0));
  const want = { readingWidth: 'Narrow', proposalsModel: false };
  const lost = Object.entries(want).filter(([k, v]) => st.s[k] !== v);
  const ok = !lost.length && st.parts.length >= 7 && w > 0 && w <= 44 * 16 + 2;
  console.log(`parts started: ${st.parts.join(', ')}; choices kept: ${Object.keys(want).filter(k => !lost.some(l => l[0] === k)).join(', ')}; reading column ${w} px`);
  await finish(browser, { '6.4': { ok, said: ok ? `a fresh install starts all ${st.parts.length} parts, and choices made before it (a narrow reading column, Apple's tools off) are kept and followed: the column is ${w} px` : `after the install: ${lost.length ? 'choices lost: ' + lost.map(l => l[0]).join(', ') : ''} parts ${st.parts.length}, column ${w} px` } });
})().catch(fail);
