#!/usr/bin/env node
/* node prep.js <step> [<step> …]   Gets the checks' own copy of a graph ready for the checks that write. Each step is one of:
     scratch    empties the scratch page "flow test", which the plugin's write check wants empty (the copy carries what older
                rounds left on the real graph's scratch page)
     sidebar    shuts the right sidebar and puts the theme on light
     sidebar-open   opens the right sidebar (some of the plugin's older tools expect it open)
     home       goes to Dr. Mei Chen and closes whatever is open
   Only ever in a copy made for the checks (kit.js refuses anything else). */
const { connect, sleep, fail } = require('./kit');
(async () => {
  const { browser, page, frame } = await connect();
  for (const step of process.argv.slice(2)) {
    if (step === 'scratch') {
      const n = await frame().evaluate(async () => { const tree = (await logseq.Editor.getPageBlocksTree('flow test')) || []; for (const b of tree) await logseq.Editor.removeBlock(b.uuid); return tree.length; }).catch(e => 'error: ' + e.message);
      console.log(`scratch page “flow test”: ${typeof n === 'number' ? n + ' bullet(s) taken out of the copy' : n}`);
    } else if (step === 'sidebar') {
      await frame().evaluate(() => logseq.App.setRightSidebarVisible(false)); await page.evaluate(() => window.logseq.api.set_theme_mode('light')); await sleep(600);
      console.log('right sidebar shut, light mode');
    } else if (step === 'guard') {
      console.log('what would leave the app is kept in the run: ' + await page.evaluate(() => (window.__outside ? 'guarded' : 'NOT guarded')));
    } else if (step === 'sidebar-open') {
      await frame().evaluate(() => logseq.App.setRightSidebarVisible(true)); await sleep(900);
      console.log('right sidebar open');
    } else if (step === 'home') {
      await page.evaluate(() => window.logseq.api.push_state('page', { name: 'dr. mei chen' })); await sleep(1500);
      for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await sleep(150); }
      console.log('on Dr. Mei Chen, nothing open');
    } else console.log('no such step: ' + step);
  }
  await browser.close();
})().catch(fail);
