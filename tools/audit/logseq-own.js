#!/usr/bin/env node
/* node logseq-own.js   Goalpost line 6.3 (everything Logseq itself does still works with the plugin on, Cmd-Z included), in the
   checks' own Logseq (9333), on a throwaway copy only. The same list of Logseq's own actions is done by real keys on a new page,
   once with the plugin off and once with it on, and what the page holds after each action is compared.
   The two pages it makes go to the Recycle by their ids. */
const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const { browser, page, graph } = await require('./kit').connect();   // refuses any graph but a copy made for the checks, and guards the Mac
  const errors = []; let phase = '';
  page.on('console', m => { if (m.type() === 'error') errors.push(phase + ': ' + m.text().slice(0, 160)); });
  const setPlugin = async on => { await page.evaluate(async on => { const core = window.LSPluginCore, pl = core.registeredPlugins.get('logseq-plugin'); if (on && pl.disabled) await core.enable('logseq-plugin'); if (!on && !pl.disabled) await core.disable('logseq-plugin'); }, on); await sleep(on ? 6000 : 2500); };
  const tree = name => page.evaluate(async name => { const walk = (bs, d) => (bs || []).flatMap(b => [`${'  '.repeat(d)}${b.title ?? b.content ?? ''}${b['collapsed?'] || b.collapsed ? ' [folded]' : ''}`, ...walk(b.children, d + 1)]); return walk(await window.logseq.api.get_page_blocks_tree(name), 0).join('\n'); }, name);
  const key = async k => { await page.keyboard.press(k); await sleep(350); };
  const type = async t => { await page.keyboard.type(t, { delay: 25 }); await sleep(350); };
  const run = async label => {
    phase = label;
    const name = 'ZZ own ' + label + ' ' + Date.now();
    const made = await page.evaluate(async name => { const p = await window.logseq.api.create_page(name, {}, { redirect: true }); return p?.uuid; }, name);
    await sleep(2500);
    const first = await page.$('#main-content-container .ls-block .block-content, #main-content-container .ls-block');
    if (first) await first.click(); await sleep(600);
    const steps = [];
    const note = async what => steps.push([what, await tree(name)]);
    await type('first line'); await key('Enter'); await type('second line'); await note('two bullets typed');
    await key('Tab'); await note('second indented with Tab');
    await key('Enter'); await type('third line'); await note('a third under the first');
    await key('Shift+Tab'); await note('third outdented with Shift-Tab');
    await key('Meta+z'); await note('Cmd-Z once');
    await key('Meta+z'); await note('Cmd-Z twice');
    await key('Meta+Shift+z'); await note('Cmd-Shift-Z');
    await key('Enter'); await type('a line with [[Dr. Mei Chen'); await key('Enter'); await sleep(500); await key('Escape'); await sleep(500); await note('a link taken from Logseq\'s own list');
    const el = await page.$('#main-content-container .ls-block'); if (el) { await el.click(); await sleep(400); }
    await key('Meta+a'); await key('Meta+a'); await key('Escape'); await note('select all and Escape');
    await key('Escape');
    await page.evaluate(async u => { try { await window.logseq.api.delete_page(u); } catch (e) {} }, made);
    return steps;
  };
  await setPlugin(false); const off = await run('off');
  await setPlugin(true); const on = await run('on');
  const out = [];
  for (let i = 0; i < off.length; i++) out.push({ step: off[i][0], same: off[i][1] === (on[i] || [])[1], off: off[i][1], on: (on[i] || [])[1] });
  console.log(`${out.filter(o => o.same).length} of ${out.length} steps left the page the same with the plugin on as off; console errors: ${errors.length}`);
  for (const o of out) if (!o.same) console.log('DIFFERS: ' + o.step + '\n  off:\n' + o.off.split('\n').map(l => '    ' + l).join('\n') + '\n  on:\n' + String(o.on).split('\n').map(l => '    ' + l).join('\n'));
  for (const e of errors.slice(0, 6)) console.log('console', e);
  const same = out.filter(o => o.same).length, mine = errors.filter(e => !/net::ERR_/.test(typeof e === 'string' ? e : JSON.stringify(e)));
  require('./kit').result({ '6.3': { ok: same === out.length && out.length >= 5 && !mine.length, said: same === out.length && !mine.length ? `${out.length} of Logseq's own steps (typing, indenting, Cmd-Z) leave the page the same with the plugin on as off` : `${out.length - same} of ${out.length} of Logseq's own steps differ with the plugin on${mine.length ? '; the console said ' + mine.length + ' thing(s)' : ''}` } });
  await browser.close();
})().catch(e => { console.error(String(e)); process.exit(2); });
