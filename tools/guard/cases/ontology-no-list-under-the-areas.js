/* The owner, 24 November 2026, of the list of relations in words under the areas on Ontology ("Company  Part of: Investments  11",
   "and 5 more"), sent as a picture: "this is not even useful to me. remove". Press a tag on the map: no such list stands under
   the areas. */
module.exports = {
  parts: ['structure'],
  name: 'Ontology: pressing a tag draws no list of relations under the areas',
  from: '24 Nov: "this is not even useful to me. remove"',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box;
    await page.evaluate(() => { location.hash = '#/structure'; }); await T.sleep(3000);
    const seen = [];
    for (const tag of ['Continuant', 'Bills']) {
      const name = await page.evaluateHandle(t => [...document.querySelectorAll('#main-content-container .nm')].find(e => e.textContent.trim() === t) || null, tag);
      if (!name.asElement()) return { ok: false, said: `${tag} is not in Ontology's map` };
      await name.asElement().scrollIntoViewIfNeeded(); const r = await name.asElement().boundingBox();
      await page.mouse.click(r.x + r.width + 30, r.y + r.height / 2); await T.sleep(1200);
      const got = await page.evaluate(() => ({ lists: document.querySelectorAll('#main-content-container .st-rel').length, lit: document.querySelector('#main-content-container [data-row].on .nm, #main-content-container [data-row].cur .nm')?.textContent.trim() || '', head: document.querySelector('#main-content-container .st-focus')?.innerText.replace(/\s+/g, ' ').slice(0, 60) || '' }));
      if (got.lists) return { ok: false, said: `with ${tag} pressed, a list of relations stands under the areas (“${got.head}”)` };
      seen.push(tag);
    }
    return { ok: true, said: `no list of relations under the areas with ${seen.join(' or ')} pressed` };
  },
};
