/* The owner, 24 November 2026, on the drawing of "Choose tag": "there should be a visual indication these are tags, otherwise it
   is unclear if you are typying the value. Property should be in mono everywhere, tags should remain the serif, and normal text
   and input should be what it is. Suggested or predicted should be regular italic with dots underneath. this should be universal
   everywhere". Read here from the screen: a property's name on a page's lines, in Relations, in a table's column heads and in the
   list under "+ Add property"; a tag in the list after #, in Find's kinds and after a name in the list of pages to link; the
   words of a bullet plain; a guess (the library's lk-pencil) italic with dots, in the face of its own kind of word. */
module.exports = {
  parts: ['look', 'structure', 'find', 'shared', 'predictive', 'threads'],
  name: 'One face for each kind of word: a property’s name in mono, a tag in its serif, the words plain, a guess italic with dots',
  from: '24 Nov: "Property should be in mono everywhere, tags should remain the serif… Suggested or predicted should be regular italic with dots underneath. this should be universal everywhere"',
  graph: 'Illness Test Graph',
  async check(box, T) {
    const { page } = box, f = box.frame(), out = [];
    const esc = async () => { for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await T.sleep(150); } };
    // The faces of what a selector finds: [words, family, style, underline].
    const faces = (sel, n = 6) => page.evaluate(([sel, n]) => [...document.querySelectorAll(sel)].filter(e => e.checkVisibility() && (e.matches('input, textarea') || e.textContent.trim())).slice(0, n).map(e => { const c = getComputedStyle(e); return [(e.value ?? e.textContent).trim().slice(0, 24) || 'the field', c.fontFamily, c.fontStyle, c.textDecorationLine + ' ' + c.textDecorationStyle]; }), [sel, n]);
    const mono = x => /mono|menlo|consolas|courier/i.test(x[1]), serif = x => /new york|georgia|(^|[ ,"])serif/i.test(x[1]) && !/^-apple-system|sans/i.test(x[1]), plain = x => !mono(x) && !serif(x);
    const want = async (what, sel, is, how) => { const got = await faces(sel); if (!got.length) out.push(`${what}: none on the screen`); else { const bad = got.filter(x => !is(x)); if (bad.length) out.push(`${what} not ${how}: “${bad[0][0]}”${bad.length > 1 ? ` and ${bad.length - 1} more` : ''}`); } };
    await esc();
    await T.go(page, 'Dr. Mei Chen'); await T.sleep(2200);
    await want('a property’s name on a page’s lines', '.ls-page-properties a.property-k', mono, 'in mono');
    // The face itself, as the Mac draws it (the owner, 24 November 2026, of the face first built: "What mono font is that? I'm not crazy about
    // it", it was Menlo; then of eight drawn faces "I like the light version of mono but allow to change this in settings"): SF Mono
    // Light by default; Look's setting changes it at once, and back.
    const drawn = async () => { try { await box.cdp.send('DOM.enable'); await box.cdp.send('CSS.enable'); const { root } = await box.cdp.send('DOM.getDocument', { depth: 0 }); const { nodeId } = await box.cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.ls-page-properties a.property-k' }); const f = await box.cdp.send('CSS.getPlatformFontsForNode', { nodeId }); return (f.fonts || []).map(x => x.postScriptName || x.familyName).join(', '); } catch (e) { return ''; } };
    const hasFace = await page.evaluate(() => document.fonts.check('300 16px "LK SF Mono"') && [...document.fonts].some(f => f.family.replace(/"/g, '') === 'LK SF Mono'));
    const first = await drawn();
    if (!hasFace) out.push('the library names no SF Mono of the Mac’s own for a property’s name');
    else if (first && !/SFMono-Light/.test(first)) out.push(`a property’s name is drawn in ${first} (SF Mono Light)`);
    else if (first) {
      await f.evaluate(() => logseq.updateSettings({ propFace: 'Menlo' })); await T.sleep(900);
      const menlo = await drawn();
      await f.evaluate(() => logseq.updateSettings({ propFace: 'SF Mono Light' })); await T.sleep(900);
      const back = await drawn();
      // The faces the plugin carries (the owner, 24 November 2026: "add them to the plugin as options"): each is drawn from its own file.
      for (const [choice, want] of [['Source Code Pro Light', /SourceCodePro-Light/], ['Source Code Pro', /SourceCodePro-Regular/], ['IBM Plex Mono Light', /IBMPlexMono-Light/], ['JetBrains Mono Light', /JetBrainsMono\w*-Light/], ['Fira Mono', /FiraMono-Regular/]]) {
        await f.evaluate(c => logseq.updateSettings({ propFace: c }), choice); await T.sleep(900);
        const got = await drawn();
        if (!want.test(got)) out.push(`with the setting on ${choice} a property’s name is drawn in ${got}`);
      }
      await f.evaluate(() => logseq.updateSettings({ propFace: 'SF Mono Light' })); await T.sleep(900);
      if (!/Menlo/.test(menlo)) out.push(`with the setting on Menlo a property’s name is drawn in ${menlo}`);
      if (!/SFMono-Light/.test(back)) out.push(`set back to SF Mono Light, a property’s name is drawn in ${back}`);
    }
    await want('a property’s name over a Relations list', '.th-two-way .th-tw-name.lk-prop', mono, 'in mono');
    await want('the words of a Relations row', '.th-two-way .th-ol-name', plain, 'plain');
    const add = page.getByText('Add property', { exact: true }).first();
    if (await add.count()) { await add.click(); await T.sleep(900); await want('a property’s name in the list under “+ Add property”', '.ui__popover-content .ls-property-dialog .menu-link span[title*="property/"]', mono, 'in mono'); await want('what is typed in that list’s field', '.ui__popover-content .ls-property-dialog input', plain, 'plain'); await esc(); }
    else out.push('Dr. Mei Chen shows no “Add property”');
    await T.go(page, 'Doctor'); await T.sleep(2600);
    await want('a table’s column heads', '#main-content-container .ls-table-header-cell', mono, 'in mono');
    await want('a name in a table’s cell', '#main-content-container .ls-table-row .ls-table-cell .block-content, #main-content-container .ls-table-row .ls-table-cell a.page-ref', plain, 'plain');
    // Find's kinds.
    await page.keyboard.press('Meta+k'); await T.sleep(1500);
    await want('a kind in Find', 'dialog[open].fd .fd-choices .lk-ch:first-child .lk-view', serif, 'in the tag’s serif');
    await want('Find’s field', 'dialog[open].fd input', plain, 'plain');
    await esc();
    // The lists on the line being written.
    const PAGE = 'FOLFOX side effects, what to expect';
    await T.go(page, PAGE); await T.sleep(1800);
    const got = await page.evaluate(async () => { const el = [...document.querySelectorAll('#main-content-container .page-blocks-inner .ls-block[blockid]')][2]; if (!el) return null; const uuid = el.getAttribute('blockid'), b = await window.logseq.api.get_block(uuid); return { uuid, text: b?.title ?? '' }; });
    if (!got) out.push(`${PAGE} shows no third bullet to write in`);
    else {
      const back = async () => { await esc(); await f.evaluate(([u, t]) => logseq.Editor.updateBlock(u, t), [got.uuid, got.text]).catch(() => {}); await T.sleep(300); };
      const LIST = '.ui__popover-content[data-editor-popup-ref]';
      await page.evaluate(([u, pos]) => window.logseq.api.edit_block(u, { pos }), [got.uuid, got.text.length]); await T.sleep(700);
      await page.keyboard.type(' #'); await T.sleep(1300);
      await want('a tag in the list after #', `${LIST} .menu-link-wrap:not(.st-plain, .st-last) .menu-link`, serif, 'in the tag’s serif');
      await back();
      await page.evaluate(([u, pos]) => window.logseq.api.edit_block(u, { pos }), [got.uuid, got.text.length]); await T.sleep(700);
      await page.keyboard.type(' [[re'); await T.sleep(1400);
      await want('a page’s tag in the list of pages to link', `${LIST} .menu-link .lk-tag-on-line`, serif, 'in the tag’s serif');
      const hashed = await page.evaluate(sel => [...document.querySelectorAll(sel + ' .menu-link')].filter(a => a.checkVisibility() && / #\S/.test(a.textContent)).map(a => a.textContent.trim().slice(0, 40)), LIST);
      if (hashed.length) out.push(`the list of pages to link writes a tag as words with a #: “${hashed[0]}”`);
      await back();
    }
    // A guess, as the library draws it for every part: on words, on a tag, on a property's name.
    const pen = await page.evaluate(() => {
      const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-999px;top:0';
      host.innerHTML = '<span class="lk-pencil">Oct 14</span><span class="lk-pencil"><span class="lk-tag">Report</span></span><span class="lk-prop lk-pencil">Date</span>';
      document.body.append(host);
      const read = e => { const c = getComputedStyle(e); return [e.textContent, c.fontFamily, c.fontStyle, c.textDecorationLine + ' ' + c.textDecorationStyle, c.fontWeight]; };
      const got = [host.children[0], host.children[1].firstChild, host.children[2]].map(read), under = read(host.children[1]); host.remove(); return { got, under };
    });
    const [words, tag, prop] = pen.got;
    if (words[2] !== 'italic' || !/underline dotted/.test(words[3]) || !plain(words) || Number(words[4]) > 400) out.push(`a guessed value is ${words[2]}, ${words[3]}, ${mono(words) ? 'mono' : serif(words) ? 'serif' : 'plain'} (italic, dotted underline, plain, regular)`);
    if (tag[2] !== 'italic' || !serif(tag) || !/underline dotted/.test(pen.under[3])) out.push(`a guessed tag is ${tag[2]}, ${serif(tag) ? 'serif' : mono(tag) ? 'mono' : 'plain'} (italic, in the tag’s serif, dots under it)`);
    if (prop[2] !== 'italic' || !mono(prop)) out.push(`a guessed property’s name is ${prop[2]}, ${mono(prop) ? 'mono' : 'not mono'} (italic, mono)`);
    return out.length ? { ok: false, said: out.join('; ') } : { ok: true, said: 'property names in mono, tags in the serif, words and fields plain, a guess italic with dots' };
  },
};
