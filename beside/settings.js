/* PAGE: Plugin settings, one short page: the menu lines hidden, each brought back by a press; the two keys the plugin takes;
   and each part, on or off (the owner, 26 November 2026: "bring back a simple settings"). Found in the corner's commands, in
   Logseq's top right menu, and by g then , outside a bullet. */
(function () {
const G = window.PluginDoor, H = G.hidden;
G.part({
  key: 'settings', title: 'Plugin settings', about: 'One short page: hidden menu items, the plugin’s keys, and each part on or off.',
  start(base) {
    base.style('settings', `
.lk-set-page { max-width: 36rem; margin: 0; padding: 0 16px 64px 0; font-size: var(--lk-line-size); line-height: var(--lk-line-lead); }
.lk-set-page h2:first-child { margin-top: 8px; }
.lk-set-page h2 { margin: 28px 0 6px; font-size: var(--lk-small); font-weight: 600; color: var(--lk-quiet); }
.lk-set-line { display: flex; align-items: center; gap: 10px; min-height: var(--lk-line-h); border-top: 1px solid var(--lk-hair); }
.lk-set-line > span:first-of-type { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lk-set-line small { color: var(--lk-quiet); font-size: var(--lk-small); white-space: nowrap; }
.lk-set-line input.lk-tick { margin: 0; opacity: 1; }
label.lk-set-line { cursor: pointer; }
.lk-set-note { color: var(--lk-quiet); padding: 4px 0; }`);
    let changed = false;
    const draw = el => {
      const hidden = H.list(G.setting('hiddenItems'));
      const tick = (key, title) => `<label class="lk-set-line"><input type="checkbox" class="lk-tick" data-key="${G.esc(key)}"${G.setting(key) !== false ? ' checked' : ''}><span>${G.esc(title)}</span></label>`;
      el.innerHTML = `<div class="lk-set-page"><h2>Hidden menu items</h2>${hidden.length ? hidden.map(one => `<div class="lk-set-line"><span>${G.esc(one.name)}</span><small>${G.esc(one.where)}</small><button type="button" class="lk-btn lk-low lk-i-undo" data-back="${G.esc(one.word)}">Bring back</button></div>`).join('') : '<div class="lk-set-note">Right-click a line in one of Logseq’s menus and choose Hide.</div>'}
<h2>Keys</h2>${tick('searchTakesSearchKey', 'Search opens on ⌘K')}${tick('cornerTakesCommandKey', 'The corner’s commands open on ⌘⇧P')}
<h2>Parts</h2>${G.parts.filter(part => part.key !== 'settings').map(part => tick(part.key + 'On', part.title)).join('')}
${changed ? '<div class="lk-set-note">A part switched on or off changes the next time the plugin is loaded.</div>' : ''}</div>`;
      el.onclick = async event => {
        const word = event.target.closest('[data-back]')?.dataset.back;
        if (word == null) return;
        await G.touch.keep({ hiddenItems: H.drop(G.setting('hiddenItems'), word) }); G.hiding?.again(); draw(el);
      };
      el.onchange = async event => {
        const key = event.target.dataset?.key; if (!key) return;
        await G.touch.keep({ [key]: event.target.checked }); if (key.endsWith('On')) changed = true; draw(el);
        el.querySelector(`[data-key="${key}"]`)?.focus();
      };
    };
    const page = G.touch.page('lk-settings', 'Plugin settings', el => { draw(el); });
    base.onStop(page.off);
    G.touch.command('lk-settings', 'Plugin settings', page.open, 'g ,');
  },
});
})();
