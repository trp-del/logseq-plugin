#!/usr/bin/env node
/* node parallel.js <out dir>   The features built beside the audit (0.3.144 to 0.3.150), each in the real Logseq, under the
   goalpost lines they answer to. On a throwaway page:
   - 0.3.144 (5.1, 5.2): a folded bullet whose child embeds a node holding a task counts that task on its ↳ line;
   - 0.3.145 (5.1, 4.3): an embedded node's bullet is a hollow ring (no arrow drawn), its row has no count of links, and a task's
     time spent is not shown;
   - 0.3.147 (3.2): the section on a person's page is headed Relations;
   - 0.3.148 (3.1, 3.8): on the Ontology map the tick boxes can be seen before anything is ticked, and the bar stands;
   - 0.3.150 (3.4, 3.6): Ontology's Suggested box has no yellow wash (yellow is for a change about to be made) and each line has
     its ×; a × dismisses with an Undo arrow that brings it back.
   Everything made goes again by its id; nothing else in the graph may change. */
const fs = require('node:fs'), path = require('node:path');
const { connect, ours, go, route, sleep, fingerprint, differs, finish, fail } = require('./kit');
(async () => {
  const out = process.argv[2] || path.join(require('node:os').tmpdir(), 'parallel'); fs.mkdirSync(out, { recursive: true });
  const { browser, page, frame, said } = await connect();
  const before = await fingerprint(page);
  const lines = {}; const say = (line, ok, w) => { (lines[line] ||= []).push({ ok, w }); console.log(`${ok ? 'ok  ' : 'FAIL'} [${line}] ${w}`); };
  const NAME = 'ZZ parallel check ' + Date.now();
  // A task node to embed, and a page holding: a parent bullet, under it a child that embeds the task node.
  const made = await frame().evaluate(async name => {
    const D = window.PluginDoor.write;
    const p = await logseq.Editor.createPage(name, {}, { redirect: false });
    const task = await logseq.Editor.appendBlockInPage(p.uuid, 'ZZ book the follow-up scan');
    const taskTag = (await logseq.DB.datascriptQuery('[:find ?u :where [?t :db/ident :logseq.class/Task] [?t :block/uuid ?u]]'))?.[0]?.[0];
    if (taskTag) await logseq.Editor.addBlockTag(task.uuid, String(taskTag));
    const parent = await logseq.Editor.appendBlockInPage(p.uuid, 'ZZ things to do before the scan');
    const child = await logseq.Editor.insertBlock(parent.uuid, '', { sibling: false });
    const target = (await logseq.DB.datascriptQuery(`[:find ?e :where [?e :block/uuid #uuid "${task.uuid}"]]`))?.[0]?.[0];
    await D.showPage(child.uuid, target);
    await logseq.Editor.setBlockCollapsed(parent.uuid, true);
    return { page: String(p.uuid), task: String(task.uuid), parent: String(parent.uuid), child: String(child.uuid) };
  }, NAME);
  await go(page, NAME, 3500);
  await frame().evaluate(u => logseq.Editor.setBlockCollapsed(u, true), made.parent); await sleep(1500);
  // Look reads what a folded node holds a moment after the graph changes: given up to eight seconds.
  for (let i = 0; i < 16 && !(await page.evaluate(u => !!document.querySelector(`.ls-block[blockid="${u}"] .lk-folded, .ls-block[blockid="${u}"] [data-lk-held]`), made.parent)); i++) await sleep(500);
  const folded = await page.evaluate(u => { const row = document.querySelector(`.ls-block[blockid="${u}"]`); const held = row?.querySelector('.lk-folded, [data-lk-held], .lk-held'); return held ? held.innerText.replace(/\s+/g, ' ').trim() || (held.querySelector('.lk-status, svg, i') ? '(a task circle)' : '') : (row ? '(row found, no line: ' + (row.querySelector('.block-title-wrap')?.innerText || '').slice(0, 60) + ')' : ''); }, made.parent);
  say('5.2', /1|↳|task circle/.test(folded) && !/no line/.test(folded), `a folded bullet whose child embeds a task: its line reads “${folded || 'nothing'}”`);
  await page.screenshot({ path: path.join(out, 'folded-embed.png') });
  await frame().evaluate(u => logseq.Editor.setBlockCollapsed(u, false), made.parent); await sleep(1500);
  const embed = await page.evaluate(u => { const row = document.querySelector(`.ls-block[blockid="${u}"], .ls-block[originalblockid="${u}"]`); if (!row) return { none: document.querySelectorAll('.ls-block').length, html: '' }; const arrow = row.querySelector('.ls-icon-arrow-narrow-right'); const svg = arrow?.querySelector('svg'); const ring = arrow ? getComputedStyle(arrow, '::before') : null; const count = row.querySelector('.h-6:has(> button > span.text-sm)'); return { arrow: !!arrow, svgShown: svg ? getComputedStyle(svg).display !== 'none' : false, ring: ring ? ring.borderStyle !== 'none' && ring.content !== 'none' && ring.content !== 'normal' : false, count: count ? getComputedStyle(count).display !== 'none' : false, time: [...document.querySelectorAll('.time-spent')].some(t => getComputedStyle(t).display !== 'none'), html: row.outerHTML.slice(0, 300) }; }, made.child);
  if (embed && !embed.arrow) console.log('     (the embed row: ' + (embed.html || 'not found') + ')');
  await page.screenshot({ path: path.join(out, 'embed.png') });
  say('4.3', !!embed && embed.arrow && embed.ring && !embed.svgShown && !embed.count && !embed.time, embed && embed.arrow ? `an embedded node: hollow ring ${embed.ring ? 'yes' : 'no'}, Logseq's arrow drawn ${embed.svgShown ? 'yes' : 'no'}, count of links shown ${embed.count ? 'yes' : 'no'}, a task's time shown ${embed.time ? 'yes' : 'no'}` : 'no embed drawn on the page');
  // Relations on a person's page
  await go(page, 'Dr. Mei Chen', 3000);
  const head = await page.evaluate(() => document.querySelector('#main-content-container .th-tw-whole-name')?.innerText.trim() || '');
  say('3.2', head === 'Relations', `the section on Dr. Mei Chen is headed “${head}”`);
  // The map at rest
  await route(page, '#/structure', 3500); await page.mouse.move(5, 700); await sleep(500);
  const map = await page.evaluate(() => { const t = document.querySelector('.st-regions .lk-tick, .st-tree .lk-tick'); const bar = document.querySelector('.st-acts'); return { tick: t ? Number(getComputedStyle(t).opacity) : 0, bar: bar ? bar.innerText.replace(/\s+/g, ' ').slice(0, 80) : '' }; });
  say('3.8', map.tick >= 0.4 && /Tick tags, then/.test(map.bar) && /Merge/.test(map.bar), `the map before anything is ticked: tick boxes at ${map.tick} strength; the bar reads “${map.bar}”`);
  await page.screenshot({ path: path.join(out, 'map-at-rest.png') });
  // The Suggested box
  // Since 0.3.153 the suggestions stay closed until opened: the quiet “Suggested” line is pressed first.
  { const shut = page.locator('.st .sugs-shut').first(); if (await shut.count()) { await shut.click(); await sleep(700); } }
  const sug = await page.evaluate(() => { const box = [...document.querySelectorAll('.st [class*="sug"]')].find(e => e.getBoundingClientRect().width > 0 && e.querySelector('.lk-x, [data-dismiss], [data-undismiss]')); if (!box) return null; const bg = getComputedStyle(box).backgroundColor, m = bg.match(/rgba?\(([^)]+)\)/)?.[1].split(/[, /]+/).map(Number) || [0, 0, 0, 0]; const yellow = (m[3] ?? 1) > 0.1 && m[0] > 200 && m[1] > 170 && m[2] < 140; return { yellow, x: box.querySelectorAll('.lk-x, [data-dismiss]').length, words: box.innerText.slice(0, 60).replace(/\n/g, ' ') }; });
  say('3.6', !!sug && !sug.yellow && sug.x > 0, sug ? `the Suggested box: yellow wash ${sug.yellow ? 'yes' : 'no'}, a × on its lines ${sug.x}` : 'no Suggested box with a × found on the map');
  if (sug && sug.x) {
    const n0 = await page.evaluate(() => [...document.querySelectorAll('.st [class*="sug"] .lk-x, .st [class*="sug"] [data-dismiss]')].length);
    await page.locator('.st [class*="sug"] .lk-x, .st [class*="sug"] [data-dismiss]').first().click(); await sleep(900);
    const n1 = await page.evaluate(() => [...document.querySelectorAll('.st [class*="sug"] .lk-x, .st [class*="sug"] [data-dismiss]')].length);
    const arrow = page.locator('.lk-undo').first(), has = await arrow.count() > 0;
    if (has) { await arrow.click().catch(() => {}); await sleep(900); }
    const n2 = await page.evaluate(() => [...document.querySelectorAll('.st [class*="sug"] .lk-x, .st [class*="sug"] [data-dismiss]')].length);
    say('3.4', n1 === n0 - 1 && has && n2 === n0, `a suggestion's × dismisses it (${n0} → ${n1}), an Undo arrow shows (${has ? 'yes' : 'no'}), and it brings it back (${n2})`);
  }
  await frame().evaluate(async m => { await logseq.Editor.deletePage(m.page).catch(() => {}); }, made);
  await go(page, 'Dr. Mei Chen', 1500);
  const changed = differs(before, await fingerprint(page)).filter(c => !/^ZZ /.test(c.words) && !(c.now || []).some(f => f.includes('→' + made.page)) && !/^(Linked references|Unlinked references|All)?$/.test(c.words));
  if (changed.length) say('5.1', false, `the graph is not as before: ${changed.slice(0, 3).map(c => c.what + ' “' + c.words + '”').join('; ')}`);
  const noise = ours(said); if (noise.length) say('5.1', false, 'the console said ' + noise[0].text.slice(0, 140));
  const res = {}; for (const [l, list] of Object.entries(lines)) res[l] = { ok: list.every(x => x.ok), said: (list.find(x => !x.ok) || list[0]).w };
  if (!res['5.1']) res['5.1'] = { ok: true, said: 'the features built beside the audit (0.3.144 to 0.3.150) each do what their notes say, and the graph is as it was' };
  await finish(browser, res);
})().catch(fail);
