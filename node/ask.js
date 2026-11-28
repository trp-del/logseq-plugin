/* NODE: the question before a change that reaches far and may not come back whole. A box under the line it answers for: what
   goes, what that takes with it, then a red yes and Cancel (the owner, 25 November 2026: "that color should be red and leave it
   should be cancel"; a question inside a page is an outlined box). The keys wait on Cancel: Enter and Escape leave it, and
   only a press on the red yes goes ahead. One question at a time.
     G.ask.gone(row, { words, note, yes, take })   words: the question; note: what it takes with it; yes: the red press's
                                                   word; take(): the change, answering a promise. Gives back what closes it.
   What Logseq does with a deleted page (read in its own code, logseq.outliner.page/delete!, and its guide, 27 November 2026): a
   tag's and a property's page are deleted for good, with what is written on them; today's journal keeps its page and loses
   every bullet on it, for good; every other page, another day's journal too, goes to Logseq's Recycle with its bullets and
   can be restored from there; one of Logseq's own cannot be deleted. So every delete of a page asks first, and says which.
     G.ask.pageKind(uuid)       'tag' | 'property' | 'today' | 'page' for a page, '' for a bullet
     G.ask.remove(row, uuids)   the one way a tag or a property is deleted, from every place (a row's Delete… in any list or
                                table, Ontology's row of actions): the red question under row counts what truly goes (the
                                nodes that hold a tag itself, its child tags, the bullets written on its page; for a property
                                the nodes that hold a value under it; core/tags.js going), and on the yes they are deleted.
                                uuids: tags, or properties (those of the first one's kind are taken). The Undo arrow is set
                                only after tags that took nothing with them; after anything else none stands, the older one
                                neither. Answers whether the question was asked
     G.ask.removed(fn)          fn({ kind, gone: [title], steps, arrow }) after each such delete (arrow: the uuid the Undo arrow
                                stands for, '' where none); gives back what stops it. A place that keeps a line of what was
                                changed (Ontology's History) hears every delete here, whichever way it was started
     G.ask.page(row, uuid)      the question before any other page is deleted from a row: where it goes, then the delete */
(function () {
const G = window.PluginDoor;
let shut = null;
function gone(row, { words, note = '', yes = 'Delete', take }) {
  shut?.();
  const doc = row.ownerDocument, box = doc.createElement('div'); box.className = 'lk-ask lk-ask-gone'; box.setAttribute('role', 'alertdialog'); box.setAttribute('aria-label', words);
  box.innerHTML = `<div class="lk-ask-head">${G.esc(words)}</div>${note ? `<div class="lk-ask-note">${G.esc(note)}</div>` : ''}<div class="lk-answers"><button type="button" class="lk-del" data-do="yes">${G.esc(yes)}</button><button type="button" class="lk-btn lk-low" data-do="no">Cancel</button></div>`;
  row.appendChild(box);
  const close = (refocus = true) => { if (shut !== close) return; shut = null; box.remove(); doc.removeEventListener('pointerdown', outside, true); if (refocus) row.querySelector(':scope > .lk-line')?.focus({ preventScroll: true }); };
  const outside = event => { if (!box.contains(event.target)) close(false); };
  box.addEventListener('click', async event => {
    const does = event.target.closest('[data-do]')?.dataset.do;
    if (!does) return;
    event.preventDefault(); event.stopPropagation();
    if (does === 'no') return close();
    box.querySelectorAll('button').forEach(button => { button.disabled = true; });
    try { await take(); } catch (error) { G.write.refused('It could not be done', error); }
    close(false);
  });
  for (const type of ['keydown', 'contextmenu', 'mousedown']) box.addEventListener(type, event => {
    if (type === 'keydown' && event.key === 'Escape') { event.preventDefault(); close(); }
    event.stopPropagation();   // nothing in the box is a press or a key on the line it stands under
  });
  doc.addEventListener('pointerdown', outside, true);
  shut = close;
  box.querySelector('[data-do="no"]').focus({ preventScroll: true });
  box.scrollIntoView({ block: 'nearest' });
  return close;
}
const closed = row => row.dispatchEvent(new (row.ownerDocument.defaultView.CustomEvent)('lk-closed', { bubbles: true }));   // Logseq does not always tell of a page that went: the list is asked to read again
async function pageKind(uuid) {
  const asked = await G.read.opened(uuid);
  if (!asked?.isPage) return '';
  if (asked.kind) return asked.kind;
  const node = await G.read.node(uuid);
  return node?.day && node.day === G.days.number(new Date()) ? 'today' : 'page';
}
const heard = new Set(), removed = fn => { heard.add(fn); return () => heard.delete(fn); };
async function remove(row, uuids) {
  try {
    G.read.forget();   // counted afresh: the question says what goes
    const asked = (await Promise.all(uuids.map(uuid => G.read.opened(uuid)))).filter(one => one?.kind), kind = asked[0]?.kind;
    const [tags, pairs, props, holding] = await Promise.all([G.read.tags(), G.read.tagPairs(), G.read.properties(), G.read.holding()]);
    const mine = new Map(kind === 'tag' ? [...tags.values()].map(tag => [tag.uuid, tag]) : [...props.values()].map(prop => [String(prop.uuid).toLowerCase(), prop]));
    const rows = asked.filter(one => one.kind === kind), own = rows.filter(one => mine.has(one.uuid));
    if (!rows.length) return false;
    if (own.length < rows.length) { G.write.refused(`“${rows.find(one => !mine.has(one.uuid)).title}” was not deleted`, Object.assign(new Error('that is one of Logseq’s own, which cannot be deleted'), { plain: true })); return false; }
    const going = new Set(own.map(one => one.id)), held = new Set();
    // The bullets on its page, at any depth, empty ones left out; where the page's outline answers nothing, the bullets the graph says stand on it.
    const written = async one => { const lines = await G.read.outline(one.uuid, true); return lines.length ? lines.filter(line => String(line.words).trim()).length : (await G.read.reach(one.id)).bullets.length; };
    const things = await Promise.all(own.map(async one => {
      const bullets = await written(one);
      if (kind === 'property') return { kind, title: one.title, nodes: new Set(holding.get(mine.get(one.uuid).ident) || []).size, kids: 0, bullets };
      const nodes = pairs.filter(([tag]) => tag === one.id).map(([, node]) => node); for (const node of nodes) held.add(node);
      return { kind, title: one.title, nodes: new Set(nodes).size, kids: [...tags.values()].filter(tag => tag.parents.includes(one.id) && !going.has(tag.id)).length, bullets };
    }));
    const asks = G.tags.going(things, kind === 'tag' ? held.size : undefined);
    gone(row, { words: asks.words, note: asks.note, yes: asks.yes, take: async () => {
      const went = []; let failed = null;
      try { for (const one of own) { await G.write.remove(one.uuid, true); went.push(one.title); } } catch (error) { failed = error; }
      const arrow = went.length && asks.whole ? own[0].uuid : '';
      if (arrow) G.undo.mark(arrow, went.length); else if (went.length) G.undo.clear();   // no arrow where it would not bring all of it back, nor an older one left standing
      if (went.length) for (const fn of [...heard]) { try { fn({ kind, gone: went, steps: went.length, arrow }); } catch (error) { console.error('Logseq Plugin: a place could not follow a delete', error); } }
      if (failed) G.write.refused(own.length === 1 ? 'It could not be deleted' : 'They could not all be deleted', failed);
      closed(row);
    } });
    return true;
  } catch (error) { G.write.refused('What a delete would take with it could not be read', error, 'Nothing was deleted.'); return false; }
}
async function page(row, uuid) {
  try {
    const [asked, what] = await Promise.all([G.read.opened(uuid), pageKind(uuid)]);
    if (what === 'tag' || what === 'property') return remove(row, [uuid]);
    const title = asked?.title || row.querySelector('.lk-words')?.textContent.trim() || 'this page';
    if (what === 'today') gone(row, { words: 'Delete everything written on today’s journal? This cannot be undone.', note: 'Logseq keeps today’s page itself and deletes every bullet on it, for good.', yes: 'Delete its bullets',
      take: async () => { await G.write.remove(uuid, true); G.undo.clear(); closed(row); } });
    else gone(row, { words: `Delete the page “${title}”?`, note: 'It goes to Logseq’s Recycle with its bullets, and can be restored from there.', yes: 'Delete the page',
      take: async () => { await G.undo.after(uuid, G.write.remove(uuid, true)); closed(row); } });
    return true;
  } catch (error) { G.write.refused('The page could not be read', error, 'Nothing was deleted.'); return false; }
}
G.ask = { gone, pageKind, remove, removed, page };
G.ask.CSS = `
.lk-row > .lk-ask-gone { grid-column: 2 / -1; max-width: 420px; margin: 4px 0 10px; padding: 12px; border-radius: var(--lk-corner-float); box-shadow: 0 0 0 1px var(--lk-line); display: flex; flex-direction: column; gap: 6px; font-family: var(--ls-font-family, inherit); font-size: var(--lk-line-size); line-height: var(--lk-line-lead); }
.lk-ask-gone .lk-ask-head { font-weight: 600; }
.lk-ask-gone .lk-ask-note { color: var(--lk-quiet); font-size: var(--lk-small); }
.lk-ask-gone .lk-answers { display: flex; align-items: center; gap: 8px; margin-top: 4px; }`;
})();
