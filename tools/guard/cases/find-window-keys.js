/* 22 November 2026, before 0.5 gives Find a second way to show (a small panel under the line): the Find window itself must keep
   every key it has. The owner: "what about the Find window I already have?" The plan's promise is "not a key, not a pixel". */
module.exports = {
  parts: ['find', 'shared'],
  name: 'The Find window keeps its keys: Cmd-K, Tab, Escape step by step, Right and Left, Enter, Shift-Enter, Cmd-Enter',
  from: '22 Nov: 0.5, the Find window must not change',
  graph: 'Illness Test Graph',
  async check(box, T) {
    const { page } = box; const f = box.frame();
    const state = () => page.evaluate(() => {
      const d = document.querySelector('dialog[open].fd');
      if (!d) return { open: false, hash: decodeURIComponent(location.hash), side: document.querySelectorAll('#right-sidebar .sidebar-item').length };
      return { open: true, input: d.querySelector('.fd-input')?.value ?? null, rows: d.querySelectorAll('.fd-r').length, lit: d.querySelector('.fd-r.on')?.textContent || '', dug: d.querySelectorAll('.fd-node[data-th-node]').length, foot: (d.querySelector('.fd-foot')?.innerText || '').replace(/\s+/g, ' ') };
    });
    const press = async (key, wait = 1100) => { await page.keyboard.press(key); await T.sleep(wait); return state(); };
    const type = async (words, wait = 1500) => { await page.keyboard.type(words, { delay: 50 }); await T.sleep(wait); return state(); };
    const where = () => page.evaluate(() => (document.querySelector('#main-content-container .ls-page-title .title, #main-content-container .ls-page-title')?.innerText || '').split('\n')[0].trim());
    const dropPages = () => f.evaluate(async () => { const rows = await logseq.DB.datascriptQuery('[:find ?n :where [?p :block/name ?n] [(clojure.string/includes? ?n "guardkeys")]]'); for (const [n] of rows || []) await logseq.Editor.deletePage(n).catch(() => {}); });
    const done = async verdict => { for (let i = 0; i < 5; i++) { await page.keyboard.press('Escape'); await T.sleep(120); } await page.evaluate(() => window.logseq.api.clear_right_sidebar_blocks?.()).catch(() => {}); await f.evaluate(() => logseq.App.setRightSidebarVisible(false)).catch(() => {}); await dropPages(); return verdict; };
    const no = said => done({ ok: false, said });
    await dropPages();
    await T.go(page, 'Consultation'); await T.sleep(1500);

    let s = await press('Meta+k');
    if (!s.open) return no('Cmd-K did not open the Find window');
    if (!/narrow/.test(s.foot) || !/open .+ ↩/.test(s.foot)) return no(`the foot at first: “${s.foot}”`);
    s = await type('cons');
    if (!/narrow to Consultation ⇥/.test(s.foot) || !/dig →/.test(s.foot) || !/make a page “cons” ⌘ ↩/.test(s.foot)) return no(`the foot after “cons”: “${s.foot}”`);
    s = await press('Tab');
    if (s.input !== '' || !/take Consultation off ⌫/.test(s.foot)) return no(`Tab did not take the choice Consultation (line “${s.input}”, foot “${s.foot}”)`);
    s = await press('Tab');
    if (!/back to the rows ⎋/.test(s.foot)) return no(`a second Tab did not step into the choices (foot “${s.foot}”)`);
    s = await press('Escape');
    if (!s.open || !s.lit || /back to the rows/.test(s.foot)) return no('Escape in the choices did not come back to the rows');
    s = await press('Escape');
    if (s.open) return no('Escape on the rows did not close the window');

    await press('Meta+k'); s = await type('mei chen');
    if (!/Dr\. Mei Chen/.test(s.lit)) return no(`“mei chen” did not light Dr. Mei Chen (lit “${s.lit.slice(0, 40)}”)`);
    s = await press('ArrowRight', 2000);
    if (s.dug !== 1) return no('Right arrow did not open the row in place');
    await press('Home', 200);   // with letters typed, Left closes only from the start of the line (in the letters it moves the caret)
    s = await press('ArrowLeft', 1200);
    if (s.dug !== 0 || !s.open) return no('Left arrow did not close the opened row');
    s = await press('Enter', 1800);
    let at = await where();
    if (s.open || at !== 'Dr. Mei Chen') return no(`Enter did not open the page (on “${at}”)`);

    await T.go(page, 'Consultation'); await T.sleep(1200);
    await press('Meta+k'); await type('mei chen');
    s = await press('Shift+Enter', 2000);
    at = await where();
    if (s.open || s.side < 1 || at !== 'Consultation') return no(`Shift-Enter did not open it in the sidebar and stay on the page (sidebar ${s.side}, on “${at}”)`);

    s = await press('Meta+k'); if (!s.open) return no('Cmd-K did not open the window again');
    s = await press('Meta+k'); if (s.open) return no('Cmd-K on the open window did not close it');

    await press('Meta+k'); await type('GUARDKEYS zq page');
    s = await press('Meta+Enter', 2200);
    const made = await f.evaluate(async () => !!(await logseq.Editor.getPage('GUARDKEYS zq page')));
    if (!made) return no('Cmd-Enter did not make the page');
    return done({ ok: true, said: 'Cmd-K, Tab, Tab, Escape, Escape, Right, Left, Enter, Shift-Enter and Cmd-Enter each did what they do' });
  },
};
