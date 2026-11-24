/* The owner, 24 November 2026: "What I want is to simply be able to select nodes and then have the values from one property placed in
   a pre-existing or new property and perhaps delete the values in original property"; of the first drawing of its box: "you write in
   plain text without having visual difference between properties values, etc."; then yes to the second. On Bills' page tick two
   rows: Logseq's own bar has "Move values…". Its box names From and Into, shows the picked nodes with each property's icon and
   lighter name, the node's value underlined and the new value in green, and its yes says "Copy 2 values". Taken, the two nodes hold
   the value in the new property as well, a row not ticked is left alone, and the Undo arrow takes all of it back, the property
   made for it included. */
module.exports = {
  parts: ['structure', 'threads', 'shared'],
  name: 'A table\'s ticked rows: Move values… copies their values into a new property, and Undo takes it back',
  from: '24 Nov: "select nodes and then have the values from one property placed in a pre-existing or new property"',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box; const f = box.frame();
    const NEW = 'Guard provider';
    const q = query => f.evaluate(query => logseq.DB.datascriptQuery(query), query);
    const made = async () => (await q(`[:find ?i :where [?p :db/ident ?i] [?p :block/title "${NEW}"]]`)).length;
    const held = async () => (await q(`[:find ?bt ?pt ?vt :where [?p :block/title ?pt] [?p :db/ident ?i] [(contains? #{"${NEW}" "Charged by"} ?pt)] [?b ?i ?v] [?v :block/title ?vt] [?b :block/title ?bt] [(contains? #{"Netflix bill" "Spotify bill" "iCloud bill"} ?bt)]]`)).map(r => r.join(':')).sort().join(' | ');
    const rowOf = name => page.evaluateHandle(name => [...document.querySelectorAll('#main-content-container .ls-table-row')].find(r => r.innerText.split('\n')[0].trim() === name) || null, name);
    const setTick = async (name, on) => { const row = (await rowOf(name)).asElement(); if (!row) return false; await row.scrollIntoViewIfNeeded(); const r = await row.boundingBox(); await page.mouse.move(r.x + 14, r.y + r.height / 2); await T.sleep(250); const label = await row.$('label[data-table-row-select]'); if (!label) return false; if (!!(await label.$('[aria-checked="true"]')) !== on) { await label.click(); await T.sleep(450); } return true; };
    const done = async verdict => { for (let i = 0; i < 2; i++) { await page.keyboard.press('Escape'); await T.sleep(150); } for (const n of ['Netflix bill', 'Spotify bill']) await setTick(n, false).catch(() => {});
      if (await made().catch(() => 0)) { const arrow = await page.$('.lk-undo-dock [data-lk-undo="structure"], .st-tray [data-lk-undo="structure"]'); if (arrow) { await arrow.click(); await T.sleep(800); const yes = await page.evaluateHandle(() => [...document.querySelectorAll('.lk-door-menu .lk-item')].find(e => /^Undo (it|all)/.test(e.textContent.trim())) || null); if (yes.asElement()) { await yes.asElement().click(); await T.sleep(5000); } } }
      return verdict; };
    const no = said => done({ ok: false, said });
    await T.go(page, 'Bills'); await T.still(page); await T.sleep(2500);
    if (await made()) return { ok: false, said: `a property named ${NEW} is already in the graph` };
    const before = await held();
    for (const n of ['Netflix bill', 'Spotify bill']) if (!await setTick(n, true)) return no(`${n} is not a row of Bills' table`);
    await page.mouse.move(360, 20); await T.sleep(500);
    const word = await page.$('#main-content-container .ls-table-actions [data-st-values]');
    if (!word) return no('no “Move values…” in Logseq\'s bar for the ticked rows');
    await word.click(); await T.sleep(1500);
    if (!await page.$('.st-values')) return no('“Move values…” opened no box');
    for (const [which, words] of [['from', 'Charged'], ['into', NEW]]) { const pick = await page.$(`.st-values [data-pick="${which}"]`); if (!pick) return no(`the box has no ${which === 'from' ? 'From' : 'Into'} to press`); await pick.click(); await T.sleep(900); await page.keyboard.type(words, { delay: 40 }); await T.sleep(600); await page.keyboard.press('Enter'); await T.sleep(which === 'into' ? 2500 : 1000); }
    const s = await page.evaluate(() => { const p = document.querySelector('.st-values'); if (!p) return null; const look = sel => [...p.querySelectorAll(sel)].map(e => e.textContent.trim()); return { picks: look('[data-pick] .tv-pn'), icons: p.querySelectorAll('.tv-rows .tv-k .st-pi').length, props: look('.tv-rows .lk-prop'), nodes: look('.tv-nh .lk-node'), tags: look('.tv-nh .lk-tag'), values: look('.tv-rows .lk-node'), coming: look('.tv-rows .tv-v.lk-coming, .tv-rows .tv-v .lk-coming'), going: p.querySelectorAll('.lk-going').length, yes: p.querySelector('[data-go]')?.textContent.trim() || '', waits: !!p.querySelector('[data-go].waits'), text: p.innerText.replace(/\s+/g, ' ').slice(0, 160) }; });
    if (!s) return no('the box closed before its yes');
    if (s.picks.join(',') !== `Charged by,${NEW}`) return no(`the box reads From and Into as “${s.picks.join('”, “')}”`);
    if (s.yes !== 'Copy 2 values' || s.waits) return no(`the yes reads “${s.yes}”${s.waits ? ', waiting' : ''} (${s.text})`);
    if (s.nodes.length !== 2 || !s.tags.includes('Bills')) return no(`the box shows ${s.nodes.length} picked nodes (${s.nodes.join(', ')}), their tag ${s.tags[0] || 'missing'}`);
    if (!s.icons || !s.props.includes('Charged by') || !s.props.includes(NEW)) return no(`a property in the box has no icon or no lighter name (${s.icons} icons; names ${s.props.join(', ')})`);
    if (!s.values.includes('Netflix') || !s.coming.length || s.going) return no(`the values do not read as values: underlined ${s.values.join(', ') || 'none'}, coming ${s.coming.length}, going ${s.going}`);
    await (await page.$('.st-values [data-go]')).click(); await T.sleep(7000);
    const after = await held(), prop = await made();
    const want = [...before.split(' | '), `Netflix bill:${NEW}:Netflix`, `Spotify bill:${NEW}:Spotify`].sort().join(' | ');
    if (!prop || after !== want) return no(`after the yes the graph holds: ${after || 'nothing'} (property made: ${prop})`);
    const arrow = await page.$('.lk-undo-dock [data-lk-undo="structure"], .st-tray [data-lk-undo="structure"]');
    if (!arrow) return no('the copy left no Undo arrow in view');
    await arrow.click(); await T.sleep(900);
    const yes = await page.evaluateHandle(() => [...document.querySelectorAll('.lk-door-menu .lk-item')].find(e => /^Undo (it|all)/.test(e.textContent.trim())) || null);
    if (!yes.asElement()) return no('the Undo arrow opened no “Undo it”');
    await yes.asElement().click(); await T.sleep(6000);
    const back = await held(), left = await made();
    if (back !== before || left) return no(`Undo left: ${back} (property still there: ${left})`);
    return done({ ok: true, said: 'two ticked bills copied Charged by into a new property, the third left alone; Undo took the values and the property back' });
  },
};
