/* A bullet's tag, right-clicked (14 November 2026): the tags around it, to change the bullet to one of them without deleting the
   tag and typing # again. Its parent, the tags beside it and its child tags, each a line; choosing one gives the bullet that
   tag in place of this one, with the plugin's faded Undo arrow beside the tags. Under them stand the three lines Logseq's own
   menu has there (Go to, Open in sidebar, Remove tag), so nothing Logseq offers is lost. "Change to another tag…" opens the whole
   tree (where.js's picker) for any tag at all. A tag of Logseq's own (Task) keeps Logseq's menu. The menu is the library's (PluginDoor.menu), with its keys. */
(function () {
const S = window.Structure;
const Mo = S.model;
const Door = window.PluginDoor;
const MANY = 12;

function start(app, doc) {
  const M = () => app.tray.model;
  const tagsPlace = uuid => doc.querySelector(`.ls-block[blockid="${uuid}"] .block-tags`) || doc.querySelector(`.ls-page-title .ls-block[blockid="${uuid}"] .lk-tag`);
  const holds = async (uuid, tagUuid) => (await Door.query(`[:find ?t :where [?b :block/uuid #uuid "${uuid}"] [?b :block/tags ?t] [?t :block/uuid #uuid "${tagUuid}"]]`)).length > 0;
  const shows = (uuid, tagUuid) => [...(tagsPlace(uuid)?.querySelectorAll('a.tag[data-uuid]') || [])].some(a => String(a.dataset.uuid).toLowerCase() === String(tagUuid).toLowerCase());   // the bullet's tags as drawn, so a change does not wait on a question first
  // One tag in place of another on one bullet. The new tag is given first, so a failure never leaves the bullet with neither.
  async function change(uuid, from, to) {
    try {
      if (!shows(uuid, to.uuid)) await Door.write.addTag(uuid, to.uuid);
      await Door.write.removeTag(uuid, from.uuid);
    } catch (error) { S.base.warnOnce('the tag could not be changed', error); return Door.notify(`The tag could not be changed to ${to.title}`, 'warning'); }
    Door.undo.offer({ owner: 'structure', key: `structure:tag:${uuid}`, node: uuid, at: () => tagsPlace(uuid), text: `${from.title} back in place of ${to.title}`,
      run: async () => { if (!await holds(uuid, from.uuid)) await Door.write.addTag(uuid, from.uuid); if (await holds(uuid, to.uuid)) await Door.write.removeTag(uuid, to.uuid); },
      onFail: error => { S.base.warnOnce('the tag could not be put back', error); Door.notify(`${from.title} could not be put back`, 'warning'); } });
  }
  async function takeOff(uuid, tag) {
    try { await Door.write.removeTag(uuid, tag.uuid); }
    catch (error) { S.base.warnOnce('the tag could not be taken off', error); return Door.notify('The tag could not be taken off', 'warning'); }
    Door.undo.offer({ owner: 'structure', key: `structure:tag:${uuid}`, node: uuid, at: () => tagsPlace(uuid) || doc.querySelector(`.ls-block[blockid="${uuid}"] .block-content-inner`), text: `${tag.title} back on the bullet`,
      run: async () => { if (!await holds(uuid, tag.uuid)) await Door.write.addTag(uuid, tag.uuid); },
      onFail: error => { S.base.warnOnce('the tag could not be put back', error); Door.notify(`${tag.title} could not be put back`, 'warning'); } });
  }
  // The lines: each group only when it has a tag; a long group shows its first twelve by name.
  function parts(uuid, t, link) {
    const m = M(), up = Mo.parentOf(m, t.id), beside = (up != null ? Mo.kids(m, up) : Mo.tops(m)).filter(id => id !== t.id), under = Mo.kids(m, t.id);
    const lines = (ids) => [...ids.slice(0, MANY).map(id => ({ word: m.tags.get(id).title, take: () => change(uuid, t, m.tags.get(id)) })), ...(ids.length > MANY ? [{ word: `and ${ids.length - MANY} more`, off: true }] : [])];
    const out = [];
    if (up != null) out.push({ group: 'Change to its parent' }, ...lines([up]));
    if (beside.length) out.push({ group: 'Change to a tag beside it' }, ...lines(beside));
    if (under.length) out.push({ group: 'Change to a child tag' }, ...lines(under));
    // Any tag at all, from the whole tree (18 November 2026, the owner: "can we right click to change to any tag?").
    out.push({ word: 'Change to another tag…', take: () => app.where && S.whereTool?.pick({ ask: { before: 'Change ', tag: t.title, after: ' to' }, near: link?.isConnected ? link : tagsPlace(uuid), now: t.id, onPick: row => { const to = row.id != null && m.tags.get(row.id); if (to && to.id !== t.id) change(uuid, t, to); } }) });
    out.push({ gap: true },
      { word: `Go to #${t.title}`, take: () => logseq.App.pushState('page', { name: t.uuid }) },
      { word: 'Open in sidebar', take: () => logseq.Editor.openInRightSidebar(t.uuid) },
      { word: 'Remove tag', take: () => takeOff(uuid, t) });
    return out;
  }
  /* The tag a right-click is on: a bullet's tag, or a page's own tag at its title row (18 November 2026, the owner: "the custom tag
     menubar still doesn't appear everywhere"), where Look draws the tag and its path in place of Logseq's tag; only the page's own
     tags take the menu there, not the tags of the path above them. */
  function tagAt(target) {
    const link = target.closest?.('.block-tags a.tag[data-uuid]');
    if (link) return link;
    const own = target.closest?.('.ls-page-title .lk-tag[data-uuid]'), title = own?.closest('.ls-page-title');
    if (!own || ![...title.querySelectorAll('a.tag[data-uuid]')].some(a => String(a.dataset.uuid).toLowerCase() === String(own.dataset.uuid).toLowerCase())) return null;
    return own;
  }
  function onMenu(e) {
    const link = tagAt(e.target);
    const uuid = link?.closest('.ls-block[blockid]')?.getAttribute('blockid');
    if (!uuid) return;
    const id = String(link.dataset.uuid).toLowerCase(), t = [...M().tags.values()].find(x => String(x.uuid).toLowerCase() === id);
    const lines = t && parts(uuid, t, link);
    if (!lines) return;                       // Logseq's own menu
    e.preventDefault(); e.stopImmediatePropagation();
    // Hung from the tag's holder, not its link: the menu hands the keys back to what opened it, and Enter on the link would open the tag's page.
    Door.menu(link.closest('.block-tag') || link, lines, { align: 'right' });
  }
  const off = S.base.listen(doc, 'contextmenu', onMenu, true);
  return () => { off?.(); Door.menu.close(); };
}
S.tagMenu = { start };
})();
