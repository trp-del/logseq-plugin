/* The owner, 24 November 2026, of a tag's right-click menu on Ontology, sent as a picture: "Go to this tag -> Open", "Oven everything
   under -> Expand", "remove: tick, show its nodes". A tag's menu starts Open, Expand, and has no Tick and no Show its nodes; a
   property's menu starts with the same word, Open. The same day, of "Add a property to all beneath…": "isn't Add a property to all
   beneath redudnant since children take on their parents properties". The item is gone too. */
/* Later that day the owner said yes to the drawn menus with fewer lines: the case holds those lines out as well. */
module.exports = {
  parts: ['structure'],
  name: 'Ontology: a tag\'s menu starts Open, Expand, without Tick or Show its nodes; a property\'s starts Open',
  from: '24 Nov: "Go to this tag -> Open", "remove: tick, show its nodes"',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box;
    const words = () => page.evaluate(() => [...document.querySelectorAll('.st-menu .lk-item')].filter(e => !e.classList.contains('gap')).map(e => (e.childNodes[0]?.textContent || '').trim()));
    const done = async v => { for (let i = 0; i < 2; i++) { await page.keyboard.press('Escape'); await T.sleep(150); } const back = await page.$('#main-content-container .st-views .lk-view'); if (back) { await back.click(); await T.sleep(600); } return v; };
    await page.evaluate(() => { location.hash = '#/structure'; }); await T.sleep(3000);
    const name = await page.evaluateHandle(() => [...document.querySelectorAll('#main-content-container .nm')].find(e => e.textContent.trim() === 'Bills') || null);
    if (!name.asElement()) return { ok: false, said: 'Bills is not in Ontology\'s map' };
    let r = await name.asElement().boundingBox();
    await page.mouse.click(r.x + 10, r.y + r.height / 2, { button: 'right' }); await T.sleep(800);
    const tag = await words();
    await page.keyboard.press('Escape'); await T.sleep(300);
    if (tag[0] !== 'Open' || tag[1] !== 'Expand') return done({ ok: false, said: `a tag's menu starts “${tag.slice(0, 2).join('”, “') || 'nothing'}”, not Open, Expand` });
    const gone = tag.filter(w => /^(Tick|Untick|Show its nodes|Go to this tag|Open everything under|Add a property to all beneath…|Add a property…)$/.test(w));
    if (gone.length) return done({ ok: false, said: `a tag's menu still has ${gone.join(', ')}` });
    const tab = await page.$('#main-content-container .st-views [data-show="table"]');
    if (!tab) return done({ ok: false, said: 'no Properties tab on Ontology' });
    await tab.click(); await T.sleep(1500);
    const row = await page.$('#main-content-container [data-prop]');
    if (!row) return done({ ok: false, said: 'no property row under Properties' });
    r = await row.boundingBox(); await page.mouse.click(r.x + 20, r.y + r.height / 2, { button: 'right' }); await T.sleep(800);
    const prop = await words();
    if (prop[0] !== 'Open') return done({ ok: false, said: `a property's menu starts “${prop[0] || 'nothing'}”, not Open` });
    // The same day: "Most of the actions of Ontology are not used", and yes to the drawn menus: a property's menu keeps Open, Rename,
    // Merge…, Turn into dates… and Remove from its tag (or Put on a tag…); a tag's has no "Add a property…".
    const cut = prop.filter(w => /^(Split into two properties…|Specify node tags…|Pull up to .*|Move from .* to another tag…|Split .* by value…)$/.test(w));
    if (cut.length) return done({ ok: false, said: `a property's menu still has ${cut.join(', ')}` });
    return done({ ok: true, said: `a tag's menu: ${tag.slice(0, 4).join(', ')}…; a property's starts Open` });
  },
};
