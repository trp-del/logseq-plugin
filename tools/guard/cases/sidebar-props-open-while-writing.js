/* 22 November 2026, the owner: "the properties of side section are not showing up by default. i have to press open properties. i
   want them open by default". A page opened in the sidebar while a bullet was being written stood with its properties closed: the
   plugin held back its press for as long as any bullet was being written. */
module.exports = {
  parts: ['look', 'sidebar'],
  name: 'A page opened in the sidebar while writing shows its properties',
  from: '22 Nov: properties of a sidebar section closed until pressed open',
  graph: 'Personal Finance',
  async check(box, T) {
    await T.go(box.page, 'Chase Checking'); await T.sleep(1500);
    const r = await box.page.evaluate(async () => {
      const api = window.logseq.api;
      await api.set_right_sidebar_visible(true);
      const here = await api.get_current_page(); const tree = await api.get_page_blocks_tree(here.uuid);
      const made = !tree?.[0], at = tree?.[0] || await api.append_block_in_page(here.uuid, '');
      await api.edit_block(at.uuid); await new Promise(r => setTimeout(r, 700));
      const page = await api.get_page('gas bill'); await api.open_in_right_sidebar(page.uuid);
      await new Promise(r => setTimeout(r, 4000));
      const item = [...document.querySelectorAll('#right-sidebar .sidebar-item.item-type-page')].find(i => /Gas bill/i.test(i.querySelector('.sidebar-item-header')?.innerText || ''));
      const props = item?.querySelector('.ls-sidebar-page-properties');
      const writing = document.activeElement?.tagName === 'TEXTAREA';
      // Left as found: nothing being written, the sidebar empty and shut, no bullet of the case's own left behind.
      await api.exit_editing_mode();
      await api.clear_right_sidebar_blocks?.(); await api.set_right_sidebar_visible(false);
      if (made) await api.remove_block(at.uuid);
      await new Promise(r => setTimeout(r, 800));
      return { writing, found: !!props, closed: !!props && props.children.length === 1 };
    });
    if (!r.found) return { ok: false, said: 'Gas bill did not open in the sidebar' };
    return r.closed ? { ok: false, said: 'its properties stand closed while a bullet is being written' } : { ok: true, said: `properties open${r.writing ? ', the bullet still being written' : ''}` };
  },
};
