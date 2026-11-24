/* The owner, 24 November 2026, of the box that asked before merging two ticked tags ("Merge Testing and Waiting into one tag. Keep
   which name?", the kept name in green, "Or a new name", a long sentence), sent as a picture: "Confusing"; then of the first
   redrawing: "you write in plain text without having visual difference between properties values, etc."; then yes to the second.
   Tick Budget and Tax Return, press Merge…: the box says the change once with the two tags as tags, shows a node with its tag
   going and the kept tag coming, asks for no name, and one press keeps the other name. Leave it writes nothing. */
module.exports = {
  parts: ['structure'],
  name: 'Ontology: the merge box says the change once, the tags as tags, with one press to keep the other name',
  from: '24 Nov: "Confusing"; "you write in plain text"',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box;
    const done = async v => { const leave = await page.$('#main-content-container .st-q [data-leave]'); if (leave) { await leave.click(); await T.sleep(400); } const clear = await page.$('#main-content-container [data-tbar="clear"]'); if (clear) { await clear.click(); await T.sleep(300); } return v; };
    await page.evaluate(() => { location.hash = '#/structure'; }); await T.sleep(3000);
    for (const tag of ['Budget', 'Tax Return']) {
      const tick = await page.evaluateHandle(t => [...document.querySelectorAll('#main-content-container [data-row]')].find(r => r.querySelector('.nm')?.textContent.trim() === t)?.querySelector('[data-tick]') || null, tag);
      if (!tick.asElement()) return done({ ok: false, said: `${tag} is not in Ontology's map` });
      await tick.asElement().click(); await T.sleep(400);
    }
    const merge = await page.$('#main-content-container [data-tbar="merge"]');
    if (!merge) return done({ ok: false, said: 'no Merge… in the bar with two tags ticked' });
    await merge.click(); await T.sleep(1800);
    const read = () => page.evaluate(() => { const q = document.querySelector('#main-content-container .st-q'); if (!q) return null; const h = q.querySelector('.h'); return { head: h?.innerText.replace(/\s+/g, ' ').trim() || '', tags: [...(h?.querySelectorAll('.lk-tag') || [])].map(e => e.textContent.trim()), fields: q.querySelectorAll('input').length, yes: q.querySelector('[data-stage]')?.textContent.trim() || '', swap: q.querySelector('[data-tkeep]')?.textContent.trim() || '', going: [...q.querySelectorAll('.lk-tag.lk-going')].map(e => e.textContent.trim()), coming: [...q.querySelectorAll('.lk-tag.lk-coming')].map(e => e.textContent.trim()), node: q.querySelector('.lk-node')?.textContent.trim() || '' }; });
    let s = await read();
    if (!s) return done({ ok: false, said: 'Merge… opened no box' });
    if (/Keep which name|into one tag/.test(s.head)) return done({ ok: false, said: `the box still asks “${s.head}”` });
    if (s.head !== 'Merge Tax Return into Budget' || s.tags.join(',') !== 'Tax Return,Budget') return done({ ok: false, said: `the box's first line is “${s.head}”, its tags as tags: ${s.tags.join(', ') || 'none'}` });
    if (s.fields) return done({ ok: false, said: 'the box still has a field for a new name' });
    if (!s.node || s.going.join() !== 'Tax Return' || s.coming.join() !== 'Budget') return done({ ok: false, said: `the node shown is “${s.node}”, its tag going: ${s.going.join(', ') || 'none'}, coming: ${s.coming.join(', ') || 'none'}` });
    if (s.yes !== 'Merge' || s.swap !== 'Keep the other name') return done({ ok: false, said: `the answers read “${s.yes}” and “${s.swap}”` });
    await (await page.$('#main-content-container .st-q [data-tkeep]')).click(); await T.sleep(600);
    s = await read();
    if (!s || s.head !== 'Merge Budget into Tax Return') return done({ ok: false, said: `Keep the other name left the first line “${s?.head || 'gone'}”` });
    return done({ ok: true, said: '“Merge Tax Return into Budget”, the tags as tags, a node with its tag changing; one press keeps the other name' });
  },
};
