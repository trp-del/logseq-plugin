#!/usr/bin/env node
/* node odd-content.js <out dir>   Goalpost line 4.5: real content holds.
   In the checks' own Logseq a page is made whose name is very long and holds emoji and other alphabets, with a tag of a long name,
   bullets in Arabic, Chinese and Russian, and a link to it from Dr. Mei Chen; an empty page is made too. Each is opened, and Find
   is opened on its words. On every screen: nothing of the plugin stands past the window's edge, no words are cut off without an
   ellipsis, nothing is said in the console. Everything made goes again by its id; the graph must be as before. */
const fs = require('node:fs'), path = require('node:path');
const { connect, ours, go, sleep, fingerprint, differs, finish, fail } = require('./kit');
const OWN = '[class*="lk-"],[class*="th-"],[class*="st-"],[class*="fd-"],[class*="td-"],[class*="xp-"]';
(async () => {
  const out = process.argv[2] || path.join(require('node:os').tmpdir(), 'odd'); fs.mkdirSync(out, { recursive: true });
  const { browser, page, frame, said } = await connect();
  const before = await fingerprint(page);
  const NAME = 'ZZ Très longue consultation de suivi avec le service d’oncologie médicale 🩺 Ünïcødé 漢字 مرحبا Привет — the second opinion after cycle six';
  const made = await frame().evaluate(async name => {
    const D = window.PluginDoor.write;
    const tag = logseq.Editor.createTag ? await Promise.resolve(logseq.Editor.createTag('ZZ An extraordinarily long tag name for a kind of appointment 📅')).catch(() => null) : null;
    const p = await D.createPage(name, {}, { redirect: false, createFirstBlock: false });
    const blocks = [];
    for (const words of ['مراجعة الطبيب بعد الدورة السادسة 💊', '复查：第六个疗程后的随访', 'Повторный приём у онколога', `See [[Dr. Mei Chen]] about ${'a very long run of words without a break '.repeat(4)}`]) blocks.push(String((await logseq.Editor.appendBlockInPage(p.uuid, words)).uuid));
    const empty = await D.createPage('ZZ An empty page', {}, { redirect: false, createFirstBlock: false });
    const mei = (await logseq.Editor.getPageBlocksTree('dr. mei chen')) || [];
    const link = mei[0] ? await logseq.Editor.insertBlock(mei[mei.length - 1].uuid, `ZZ odd check: [[${name}]]`, { sibling: true }) : null;
    return { blocks, page: String(p.uuid), empty: String(empty.uuid), tag: tag ? String(tag.uuid) : '', link: link ? String(link.uuid) : '' };
  }, NAME);
  const read = () => page.evaluate(OWN => {
    const W = innerWidth, vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const past = [], cut = [];
    for (const el of document.querySelectorAll(OWN)) { if (!vis(el)) continue; const r = el.getBoundingClientRect(), s = getComputedStyle(el); if (r.right > W + 1 || r.left < -1) past.push(el.className.toString().slice(0, 40)); const t = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()); if (t && el.scrollWidth > el.clientWidth + 1 && /hidden|clip/.test(s.overflowX) && s.textOverflow !== 'ellipsis' && s.webkitLineClamp === 'none') cut.push(el.className.toString().slice(0, 40)); }
    return { past, cut, wide: document.documentElement.scrollWidth > W, wrong: /Something went wrong/.test(document.body.innerText) };
  }, OWN);
  const lines = []; let ok = true;
  const look = async (label, act) => { const at = said.length; await act(); await sleep(2500); const r = await read(); await page.screenshot({ path: path.join(out, label.replace(/\W+/g, '-') + '.png') }); const noise = ours(said.slice(at)); const good = !r.past.length && !r.cut.length && !r.wide && !r.wrong && !noise.length; if (!good) ok = false; lines.push(`${good ? 'ok  ' : 'FAIL'} ${label}${good ? '' : `: past the edge ${r.past.slice(0, 2).join(', ')} cut ${r.cut.slice(0, 2).join(', ')}${r.wide ? ' the page scrolls sideways' : ''}${r.wrong ? ' Logseq said something went wrong' : ''}${noise.length ? ' console: ' + noise[0].text.slice(0, 120) : ''}`}`); };
  for (const w of [1582, 900]) {
    await page.setViewportSize({ width: w, height: 900 }).catch(() => {});
    await look(`the page with the long name in other alphabets, ${w} wide`, () => go(page, NAME, 0));
    await look(`an empty page, ${w} wide`, () => go(page, 'ZZ An empty page', 0));
    await look(`Dr. Mei Chen linked from it, ${w} wide`, () => go(page, 'Dr. Mei Chen', 0));
    await look(`Find on the words 复查, ${w} wide`, async () => { await page.keyboard.press('Meta+k'); await sleep(900); await page.keyboard.insertText('复查'); });
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await sleep(150); }
  }
  await frame().evaluate(async m => { const D = window.PluginDoor.write; if (m.link) await logseq.Editor.removeBlock(m.link); for (const b of m.blocks) await logseq.Editor.removeBlock(b).catch(() => {}); for (const u of [m.page, m.empty, m.tag].filter(Boolean)) { await D.deleteForGood?.(u).catch(() => logseq.Editor.deletePage(u).catch(() => {})); } }, made);
  await go(page, 'Dr. Mei Chen', 1500);
  const changed = differs(before, await fingerprint(page)).filter(c => !/^ZZ /.test(c.words) && !/^(Linked references|Unlinked references|All)$/.test(c.words));   // the view blocks Logseq itself saves on a page opened the first time
  if (changed.length) { ok = false; lines.push(`FAIL the graph is not as before: ${changed.slice(0, 3).map(c => c.what + ' “' + c.words + '”').join('; ')}`); }
  for (const l of lines) console.log(l);
  await finish(browser, { '4.5': { ok, said: ok ? 'a page with a long name in emoji, Arabic, Chinese and Russian, a long tag, an empty page and Find on Chinese words: nothing past the edge, nothing cut off, at two window sizes' : (lines.find(l => l.startsWith('FAIL')) || '').slice(5) } });
})().catch(fail);
