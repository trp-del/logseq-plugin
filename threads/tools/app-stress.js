#!/usr/bin/env node
/* The real Logseq under stress (2026-10-23, docs/history/FINISHING-PROMPT-2026-10-23.md section 4), over its debugging port
   (tools/app-door.js), on the Illness Test Graph: the two scratch graphs are made with the command line and Logseq
   lists only graphs it made itself, so they cannot be opened in the app (DECISIONS-AUTONOMOUS.md, 8). Each part can be
   run alone: node tools/app-stress.js pages | typing | undo | view | reloads | dark   (none: all, in that order).

   pages    Thirty pages one after another at 300 ms (inside Logseq's busy half second after a page change), then at
            1 s, each set twice. Fails on: two-way rows for a page other than the one whose title shows (stale);
            any of the plugin's pieces drawn twice; after the storm, marks on the last page other than a single slow
            visit leaves; settling more than 200 ms slower than a single visit; the plugin's clean-up steps, watchers or
            hooks differing from after a single visit; the JS heap after the 60th visit more than 10% above after the
            5th, beyond what Logseq alone grows by in the same storm with the plugin off.
   typing   Three hundred letters at 30 ms into a scratch bullet on today's journal, with two [[links]], a #tag, a day
            in words and a number beside a number property's name; Escape; the same into a second bullet and Enter;
            the same into a third at 100 ms. Fails on: words that differ from what the same typing gives with the
            plugin off (a dropped or doubled key); a proposal shown and gone more than once between two keys; a long
            frame (over 50 ms) with the plugin's code; the proposals after the fast typing differing from after the
            slow. The scratch bullets are removed and the graph compared with its fingerprint.
   undo     Turn into links on Location (its three address pages are in Logseq's Recycle from an earlier try): the pages
            must come back from the Recycle and be used, never linked while still in it; Undo; again; Undo. Proposals
            accepted with Enter in six bullets on each of five journal days, each undone through its faded arrow, newest
            first: the bullet's properties as before. Ten nodes added through a two-way row's +, each undone. Everything
            the test made is removed (pages it made, for good, from the Recycle too) and the graph compared.
   view     On Dr. Mei Chen, plugin off then on: the theme light/dark ten times, the right sidebar open/shut ten times,
            the window from 900 to 1600 px wide and back in 100 px steps. Fails on: any flash of the plugin's; a jump of
            the plugin's while the theme changes; a horizontal scroll bar; a piece of the plugin's outside the window;
            a colour of the plugin's own that is the same in light and dark (a grey not mixed from the text colour).
   reloads  Twenty reloads of the plugin, five seconds apart, each taking effect (a new start time); then on five pages
            the marks, stylesheets, clean-up steps, watchers and hooks exactly as after a cold start. Then Foundation
            only on, reload, off, reload, five times: every reload takes effect and the two-way rows go and come back.
   dark     Every pop-up and window the plugin has, opened in dark mode and photographed into check.log/frames/dark/
            (to be looked at; nothing in the notes is changed: questions are cancelled, plans closed).
   The app is put back as it was (theme, page, plugin on, Foundation only off, sidebar, window size), also on Ctrl-C. */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const K = require('../../tools/frame-kit');
const D = require('./app-door');
const gate = require('./quiet');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'check.log/stress');
const which = process.argv.slice(2).filter(a => !a.startsWith('--'));
const want = name => !which.length || which.includes(name);
const { sleep } = D;
const problems = [], lines = [];
const problem = text => { problems.push(text); console.log('PROBLEM: ' + text); };
const say = text => { lines.push(text); console.log(text); };

// The DOM still for `quietMs` (no change by Logseq or the plugin), at most `most` ms: when a page has settled.
const settled = (page, quietMs = 300, most = 5000) => page.evaluate(([q, most]) => new Promise(resolve => {
  const t0 = performance.now(); let last = t0;
  const obs = new MutationObserver(() => { last = performance.now(); });
  obs.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
  const tick = () => { const now = performance.now(); if (now - last >= q || now - t0 >= most) { obs.disconnect(); resolve(Math.round(last - t0)); } else setTimeout(tick, 25); };
  setTimeout(tick, 25);
}), [quietMs, most]);
// The two-way rows as shown: each field's words and how many nodes it lists (empty while they wait unseen).
const rowsNow = page => page.evaluate(() => {
  const boxes = [...document.querySelectorAll('#main-content-container .refinement-two-way')];
  const title = document.querySelector('#main-content-container .ls-page-title')?.textContent?.trim() || '';
  const shown = boxes.filter(b => !b.hasAttribute('data-rf-waiting'));
  return { title, boxes: boxes.length, rows: shown.flatMap(b => [...b.querySelectorAll('.rf-tw-row')].map(r => `${r.querySelector('.rf-tw-name')?.textContent?.trim()}|${r.querySelectorAll('[data-uuid].rf-tw-item, .rf-tw-line[data-uuid], .rf-tw-toggle').length}`)).join(' ; '),
    chains: document.querySelectorAll('#main-content-container .rf-tag-path').length,
    doubled: [...document.querySelectorAll('.property-m')].filter(b => b.querySelectorAll(':scope > .rf-kind').length > 1).length };
});
const titleKey = text => String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();

async function pagesPart(page, session) {
  say('pages, many and fast:');
  // Thirty pages tagged with the owner's own tags (people, places, symptoms …), by name.
  const names = (await page.evaluate(async () => {
    const rows = await window.logseq.api.datascript_query('[:find ?n ?t :where [?p :block/name ?n] [?p :block/title ?t] [?p :block/tags ?c] [?c :db/ident ?i] [(namespace ?i) ?ns] [(= ?ns "user.class")]]');
    return (rows || []).map(r => r[1]).filter(t => t && !/^\d/.test(t));
  })).sort().filter((n, i, a) => a.indexOf(n) === i).slice(0, 30);
  if (names.length < 30) { problem(`only ${names.length} tagged pages found for the storm`); if (!names.length) return; }
  // A single slow visit of each: its rows, its marks, how long it takes to settle; then the counts after them.
  const ref = new Map();
  for (const name of names) {
    await D.graphOk(page);
    await D.go(page, 'all-pages'); await sleep(800);
    await D.go(page, name); const quietAt = await settled(page); await sleep(2600); // past the rows' two-second settle
    const now = await rowsNow(page);
    ref.set(titleKey(now.title), { rows: now.rows, marks: (await D.counts(page)).marks, settle: quietAt, name });
  }
  const after1 = await D.counts(page);
  // The storm: each set twice, at 300 ms then 1 s; at every stop just before leaving it, what shows is checked.
  let stale = 0, doubled = 0, slowSettles = [];
  const heapAt = {};
  let visit = 0;
  for (const interval of [300, 300, 1000, 1000]) {
    for (const name of names) {
      await D.go(page, name);
      visit++;
      if (interval === 1000) { const q = await settled(page, 300, 950); const r = [...ref.values()].find(x => x.name === name); if (r && q > r.settle + 200) slowSettles.push(`${name}: ${q} ms (alone ${r.settle} ms)`); }
      await sleep(interval === 1000 ? 50 : interval);
      const now = await rowsNow(page);
      if (now.boxes > 1 || now.chains > 1 || now.doubled) { doubled++; if (doubled <= 3) problem(`drawn twice on ${now.title}: ${now.boxes} two-way boxes, ${now.chains} tag chains, ${now.doubled} property buttons with two kind icons`); }
      const r = ref.get(titleKey(now.title));
      if (r && now.rows && now.rows !== r.rows) { stale++; if (stale <= 3) problem(`stale two-way rows on ${now.title} after ${interval} ms: “${now.rows.slice(0, 120)}”, alone “${r.rows.slice(0, 120)}”`); }
      if (visit === 5 || visit === 60) heapAt[visit] = await D.heap(session);
    }
  }
  await sleep(2500);
  const last = await rowsNow(page), lastRef = ref.get(titleKey(last.title));
  const marks = (await D.counts(page)).marks;
  if (lastRef && JSON.stringify(marks) !== JSON.stringify(lastRef.marks)) problem(`after the storm, ${last.title} has other marks than after a single visit: ${JSON.stringify(marks).slice(0, 200)} against ${JSON.stringify(lastRef.marks).slice(0, 200)}`);
  if (slowSettles.length) problem(`settled more than 200 ms slower than alone: ${slowSettles.slice(0, 4).join('; ')}`);
  const after2 = await D.counts(page);
  for (const key of ['cleanUps', 'hooks']) if (JSON.stringify(after2.door?.[key]) !== JSON.stringify(after1.door?.[key])) problem(`the plugin's ${key} grew over the storm: ${JSON.stringify(after1.door?.[key])} → ${JSON.stringify(after2.door?.[key])}`);
  if (after2.door?.watchers !== after1.door?.watchers || after2.door?.popups || after2.door?.undos) problem(`watchers ${after1.door?.watchers} → ${after2.door?.watchers}, pop-ups ${after2.door?.popups}, Undo arrows ${after2.door?.undos} after the storm`);
  if (after2.styles !== after1.styles) problem(`stylesheets ${after1.styles} → ${after2.styles}`);
  // The heap: the same storm with the plugin off says how much Logseq alone grows.
  await D.setPlugin(page, false);
  const heapOff = {};
  visit = 0;
  for (const interval of [300, 300, 1000, 1000]) for (const name of names) { await D.go(page, name); visit++; await sleep(interval); if (visit === 5 || visit === 60) heapOff[visit] = await D.heap(session); }
  await D.setPlugin(page, true);
  const growOn = heapAt[60] - heapAt[5], growOff = heapOff[60] - heapOff[5];
  say(`  ${names.length} pages, 120 visits: ${stale} stale, ${doubled} drawn twice; heap from the 5th to the 60th visit ${(growOn / 1e6).toFixed(1)} MB with the plugin, ${(growOff / 1e6).toFixed(1)} MB without`);
  if (growOn - Math.max(0, growOff) > heapAt[5] * 0.1) problem(`the heap grew ${(growOn / 1e6).toFixed(1)} MB from the 5th to the 60th visit, ${(growOff / 1e6).toFixed(1)} MB without the plugin (more than 10% of ${(heapAt[5] / 1e6).toFixed(0)} MB)`);
}

const TEXT = 'Saw [[Dr. Mei Chen]] today about the [[Nausea]] and the tingling, booked for Friday, cycle 5 went fine, more notes on the plan and what comes next week with the family #Consultation';
/* Logseq's own list stays open after a typed #tag; as a person does, the tag is picked from it with Enter first, and
   only then does Enter finish the bullet (2026-10-23: an Enter while the list was open went to the list, and with the
   tag typed first it made a new tag of the whole sentence, removed at once). Returns false, pressing nothing more, if
   the list is still open. */
async function pickTagThenEnter(page) {
  const open = () => page.evaluate(() => !!document.querySelector('#ui__ac'));
  if (await open()) { await page.keyboard.press('Enter'); await sleep(900); }
  if (await open()) return false;
  await page.keyboard.press('Enter'); await sleep(1500);
  return true;
}
async function typeInto(page, uuid, text, delay, marks) {
  await page.evaluate(u => window.logseq.api.edit_block(u, { pos: 0 }), uuid);
  await sleep(400);
  const times = [];
  for (const ch of text) {
    if (marks) await page.evaluate(() => window.__rfFrames?.input('key', false));
    await page.keyboard.type(ch);
    times.push(Date.now());
    await sleep(delay);
  }
  await sleep(900);
}
async function contentOf(page, uuid) { return page.evaluate(async u => (await window.logseq.api.get_block(u))?.title ?? (await window.logseq.api.get_block(u))?.content ?? '', uuid); }
async function scratch(page) {
  const today = await page.evaluate(async () => (await window.logseq.api.get_today_page())?.name || (await window.logseq.api.get_today_page())?.originalName);
  if (!today) throw new Error('today\'s journal page could not be found');
  await D.go(page, today); await sleep(1500);
  const b = await page.evaluate(async t => (await window.logseq.api.append_block_in_page(t, ''))?.uuid, today);
  if (!b) throw new Error('a scratch bullet could not be made');
  return { today, uuid: b };
}
const ghosts = page => page.evaluate(() => [...document.querySelectorAll('.rfs-ghost')].map(g => g.closest('[data-property-title], .bottom-property-pill')?.textContent?.trim() || g.textContent.trim()).sort().join(' · '));

async function typingPart(page, session) {
  say('typing storm:');
  const made = [];
  try {
    // A: the plugin off, the words the typing gives.
    await D.setPlugin(page, false);
    const a = await scratch(page); made.push(a.uuid);
    await typeInto(page, a.uuid, TEXT, 30);
    await page.keyboard.press('Escape'); await sleep(400);
    const wordsOff = await contentOf(page, a.uuid);
    await D.setPlugin(page, true);
    // B: fast, with the ledger watching the proposals.
    const b = await scratch(page); made.push(b.uuid);
    await page.evaluate(`(${K.ledgerSource()})(...${JSON.stringify(K.ledgerArgs())})`);
    await typeInto(page, b.uuid, TEXT, 30, true);
    const shownFast = await ghosts(page);
    const ledger = await page.evaluate(() => { const l = window.__rfFrames.take(); window.__rfFrames.stop(); delete window.__rfFrames; return l; });
    await page.keyboard.press('Escape'); await sleep(400);
    const wordsOn = await contentOf(page, b.uuid);
    if (wordsOn !== wordsOff) problem(`the words typed differ with the plugin on: “${wordsOn}” against “${wordsOff}”`);
    // A proposal shown and gone more than once between two keys.
    const keys = ledger.inputs.map(([t]) => t);
    let toggles = 0;
    for (const [id, line] of K.timelines(ledger)) {
      if (!/rfs-ghost|data-refinement-proposal/.test(ledger.names[id])) continue;
      for (let k = 1; k < keys.length; k++) {
        const between = line.filter(([t]) => t > keys[k - 1] && t <= keys[k]);
        let flips = 0; for (let i = 1; i < between.length; i++) if (K.shownRow(between[i][1]) !== K.shownRow(between[i - 1][1])) flips++;
        if (flips > 1) toggles++;
      }
    }
    if (toggles) problem(`a proposal came and went more than once between two keys, ${toggles} times`);
    if (!ledger.loafs.length) say('  long frames: none reported (Logseq\'s Chromium sends long-animation-frame entries only for frames over 50 ms; none came, or none were measured)');
    const long = ledger.loafs.filter(l => l.d > 50 && l.scripts.some(s => /logseq-plugin|refinements|lsp:\/\/logseq\.com\/external/.test(s.url)));
    if (long.length) problem(`${long.length} long frames with the plugin's code while typing: ${long.slice(0, 3).map(l => `${l.d} ms (${l.scripts.map(s => s.fn || '?').join(', ')})`).join('; ')}`);
    // Again, fast, and Enter: what is proposed is filled in; then slow, for the comparison.
    const c = await scratch(page); made.push(c.uuid);
    await typeInto(page, c.uuid, TEXT, 30);
    if (!await pickTagThenEnter(page)) problem('Logseq\'s tag list stayed open after picking; the bullet was left as typed');
    // The bullet Enter made is the test's too.
    const next = await page.evaluate(async u => (await window.logseq.api.get_next_sibling_block(u))?.uuid, c.uuid).catch(() => null);
    if (next) made.push(next);
    await page.keyboard.press('Escape'); await sleep(300);
    const d = await scratch(page); made.push(d.uuid);
    await typeInto(page, d.uuid, TEXT, 100);
    const shownSlow = await ghosts(page);
    await page.keyboard.press('Escape'); await sleep(400);
    if (shownFast !== shownSlow) problem(`the proposals after fast typing differ from after slow typing: “${shownFast}” against “${shownSlow}”`);
    say(`  ${TEXT.length} letters at 30 ms and at 100 ms: the words the same with the plugin off and on; proposals shown: ${shownFast || 'none'}`);
  } finally {
    // Every bullet the test made removed (only those: the scratch bullets and the one Enter made), with what was filled in.
    await page.keyboard.press('Escape').catch(() => {});
    for (const u of made) await page.evaluate(u => window.logseq.api.remove_block(u), u).catch(() => {});
  }
}

async function viewPart(page, session) {
  say('theme, sidebar and size, on Dr. Mei Chen:');
  // Logseq's debugging port cannot move or size its window (Browser.getWindowForTarget is not there in Electron), so the
  // page is shown at each width instead (Emulation.setDeviceMetricsOverride), which lays it out the same.
  const height = await page.evaluate(() => innerHeight);
  const width = w => session.send('Emulation.setDeviceMetricsOverride', { width: w, height, deviceScaleFactor: 0, mobile: false });
  const was = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, system: localStorage.getItem('system-theme?') === 'true', sidebar: !!document.querySelector('#right-sidebar.open') }));
  const results = {};
  try {
    for (const on of [false, true]) {
      await D.setPlugin(page, on);
      await D.go(page, 'Dr. Mei Chen'); await sleep(2000);
      await page.evaluate(`(${K.ledgerSource()})(...${JSON.stringify(K.ledgerArgs())})`);
      const steps = { theme: [], sidebar: [], size: [] }, faults = [];
      const look = async what => {
        const r = await page.evaluate(() => {
          const main = document.querySelector('#main-content-container');
          const out = [];
          if (main && main.scrollWidth > main.clientWidth + 1) out.push(`a horizontal scroll bar (${main.scrollWidth} > ${main.clientWidth})`);
          const frame = [...document.querySelectorAll('iframe')].find(f => /logseq-plugin_index/.test(f.src));
          const shared = frame?.contentWindow?.Threads.shared;
          if (shared) for (const el of document.querySelectorAll('#main-content-container *')) if (shared.isOwnMark(el)) { const b = el.getBoundingClientRect(); if (b.width && b.right > innerWidth + 1) { out.push(`${el.className} reaches ${Math.round(b.right)} px in a window ${innerWidth} px wide`); break; } }
          return out;
        });
        for (const x of r) faults.push(`${what}: ${x}`);
      };
      for (let k = 0; k < 10; k++) { await page.evaluate(() => window.__rfFrames.input('theme', false)); await page.evaluate(t => window.logseq.api.set_theme_mode(t), k % 2 ? 'light' : 'dark'); await sleep(500); await look('theme'); }
      // The theme part's own record: while the theme changes nothing may move. The sidebar and the widths move
      // Logseq's own layout, and the plugin's rows with it; there only flashes are judged.
      const themeLedger = await page.evaluate(() => window.__rfFrames.take());
      for (let k = 0; k < 10; k++) { await page.evaluate(() => window.__rfFrames.input('sidebar', true)); await page.evaluate(v => window.logseq.api.set_right_sidebar_visible(v), k % 2 === 0); await sleep(500); await look('sidebar'); }
      for (const w of [900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1500, 1400, 1300, 1200, 1100, 1000, 900]) {
        await page.evaluate(() => window.__rfFrames.input('size', true));
        await width(w);
        await sleep(400); await look(`${w} px`);
      }
      await session.send('Emulation.clearDeviceMetricsOverride');
      await sleep(400);
      const ledger = await page.evaluate(() => { const l = window.__rfFrames.take(); window.__rfFrames.stop(); delete window.__rfFrames; return l; });
      results[on ? 'on' : 'off'] = { ledger, themeLedger, faults };
    }
    const off = results.off, on = results.on;
    for (const f of on.faults) if (!off.faults.includes(f)) problem(f);
    for (const lg of [on.themeLedger, on.ledger]) for (const f of K.elementFlashes(lg)) if (!f.name.startsWith('landmark: ')) problem(`a flash of the plugin's: ${f.name}, ${f.what}`);
    // While the theme changes nothing moves: those inputs are not exempt, so any move of the plugin's is a jump.
    for (const j of K.jumps(on.themeLedger)) if (!j.name.startsWith('landmark: ')) problem(`${j.name} moved ${j.dy || j.dx} px while the theme changed`);
    // A colour of the plugin's own the same in both themes.
    const colours = {};
    for (const theme of ['light', 'dark']) {
      await page.evaluate(t => window.logseq.api.set_theme_mode(t), theme); await sleep(700);
      colours[theme] = await page.evaluate(() => {
        const frame = [...document.querySelectorAll('iframe')].find(f => /logseq-plugin_index/.test(f.src));
        const shared = frame?.contentWindow?.Threads.shared, out = {};
        for (const el of document.querySelectorAll('#main-content-container *')) if (shared?.isOwnMark(el) && el.childNodes.length && [...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim())) { const k = [...el.classList].filter(c => shared.MARK_CLASS.test(c)).join('.'); if (k && !(k in out)) out[k] = getComputedStyle(el).color; }
        return out;
      });
    }
    const same = Object.keys(colours.light).filter(k => colours.dark[k] && colours.dark[k] === colours.light[k]);
    if (same.length) problem(`the same colour in light and dark: ${same.map(k => `${k} ${colours.light[k]}`).join('; ')}`);
    say(`  theme ten times, sidebar ten times, 900 to 1600 px and back: ${Object.keys(colours.light).length} kinds of the plugin's words checked in both themes`);
  } finally {
    await session.send('Emulation.clearDeviceMetricsOverride').catch(() => {});
    await page.evaluate(v => window.logseq.api.set_right_sidebar_visible(v), was.sidebar).catch(() => {});
    await page.evaluate(w => window.logseq.api.set_theme_mode(w.system ? 'system' : (w.theme || 'light')), was).catch(() => {});
    await page.evaluate(() => { window.__rfFrames?.stop(); delete window.__rfFrames; }).catch(() => {});
  }
}

async function undoPart(page) {
  say('undo depth:');
  const frame = D.plugin(page);
  const forGood = uuids => page.evaluate(async list => { for (const u of list) { try { await window.logseq.api.delete_recycled_page_permanently(u); } catch (error) { /* already gone */ } } }, uuids.filter(Boolean));
  // 1. Turn into links, twice, each undone.
  const made = [];
  for (const round of [1, 2]) {
    const r = await frame.evaluate(async round => {
      const TM = window.Threads.shared.feature('tagMap'), m = window.Threads.core.provided, out = { round };
      const data = await TM.loadTags();
      const prop = [...(await m.propInfo()).values()].find(p => p.title === 'Location');
      if (!prop) return { error: 'no property Location' };
      const tag = prop.givenBy?.find(t => !t.builtIn) || [...data.tags.values()].find(t => (t.propList || []).some(p => p.id === prop.id));
      const plan = await TM.planLinks(tag, data.propInfo?.get?.(prop.id) || prop, data);
      out.titles = plan.titles; out.recycled = [...(plan.recycled?.keys() || [])]; out.live = [...plan.pages.keys()];
      let result;
      try { result = await TM.runLinks(plan, 'Zz Address kind', 'Zz Location link'); } catch (error) { return { ...out, error: 'runLinks: ' + error.message }; }
      out.made = [result.done.newProp?.uuid, result.done.madeTag?.uuid, ...result.done.made];
      // Whatever the checks find, or if one throws, the change is undone before anything else.
      try {
        out.linkedInRecycle = [];
        for (const title of plan.titles) { const p = await m.getPage(title); if (!p || await m.inRecycle(p.uuid)) out.linkedInRecycle.push(title); }
        out.filled = result.done.filled.length; out.nodes = plan.byNode.size;
      } catch (error) { out.error = 'checking: ' + error.message; }
      finally { await result.undo(); }
      if (out.error) return out;
      out.backInRecycle = [];
      for (const title of out.recycled) { const p = await m.getPage(title); if (p && await m.inRecycle(p.uuid)) out.backInRecycle.push(title); }
      return out;
    }, round);
    made.push(...(r.made || []));
    if (r.error) { problem(`Turn into links, round ${round}: ${r.error}`); break; }
    if (r.linkedInRecycle.length) problem(`Turn into links, round ${round}: nodes linked to pages still in the Recycle: ${r.linkedInRecycle.join(', ')}`);
    if (r.filled !== r.nodes) problem(`Turn into links, round ${round}: ${r.filled} of ${r.nodes} nodes got their link`);
    if (r.backInRecycle.length !== r.recycled.length) problem(`Turn into links, round ${round}: after Undo ${r.backInRecycle.length} of ${r.recycled.length} pages back in the Recycle`);
    say(`  Turn into links on Location, round ${round}: ${r.titles.length} pages (${r.recycled.length} brought back from the Recycle), ${r.filled} nodes linked, undone`);
  }
  await forGood(made);
  await page.keyboard.press('Escape');
  // 2. Proposals accepted in six bullets on each of five journal days, each undone through its arrow.
  const days = await page.evaluate(async () => {
    const rows = await window.logseq.api.datascript_query('[:find ?d ?t :where [?p :block/journal-day ?d] [?p :block/title ?t]]');
    const today = Number(new Date().toISOString().slice(0, 10).replace(/-/g, ''));
    return (rows || []).filter(([d]) => d <= today).sort((a, b) => b[0] - a[0]).slice(0, 5).map(([, t]) => t);
  });
  const VARIANTS = ['Saw [[Dr. Mei Chen]] about [[Nausea]] #Consultation', 'Talked with [[Dr. Raj Patel]] about the [[Fatigue]] #Consultation', 'Saw [[Dr. Mei Chen]] about [[Tingling fingers]] #Consultation'];
  const bullets = [];
  let undone = 0, wrong = 0;
  for (const day of days) {
    await D.go(page, day); await sleep(1500);
    const here = [];
    for (let k = 0; k < 6; k++) {
      const uuid = await page.evaluate(async t => (await window.logseq.api.append_block_in_page(t, ''))?.uuid, day);
      if (!uuid) { problem(`a bullet could not be made on ${day}`); break; }
      here.push(uuid); bullets.push(uuid);
      await typeInto(page, uuid, VARIANTS[k % VARIANTS.length], 20);
      if (!await pickTagThenEnter(page)) { problem(`Logseq's tag list stayed open on ${day}; stopped there`); break; }
      const next = await page.evaluate(async u => (await window.logseq.api.get_next_sibling_block(u))?.uuid, uuid).catch(() => null);
      if (next) bullets.push(next);
      await page.keyboard.press('Escape'); await sleep(300);
    }
    // Each bullet's arrow, newest first: its properties go back to none.
    for (const uuid of [...here].reverse()) {
      const clicked = await page.evaluate(u => { const a = document.querySelector(`[data-rf-undo="proposals:${u}"]`); a?.click(); return !!a; }, uuid);
      if (!clicked) { wrong++; if (wrong <= 3) problem(`no Undo arrow for a bullet on ${day}`); continue; }
      await sleep(900);
      const props = await page.evaluate(async u => Object.keys((await window.logseq.api.get_block_properties(u)) || {}).filter(k => /^:?user\.property|^[a-z]/.test(k) && !/^:?logseq/.test(k)), uuid);
      if (props.length) { wrong++; if (wrong <= 3) problem(`after Undo a bullet on ${day} still holds ${props.join(', ')}`); } else undone++;
    }
  }
  for (const u of bullets) await page.evaluate(u => window.logseq.api.remove_block(u), u).catch(() => {});
  say(`  proposals accepted in ${days.length * 6} bullets on ${days.length} journal days; ${undone} undone through their arrows`);
  // 3. Ten nodes added through a two-way row's +, each undone.
  await D.go(page, 'all-pages'); await sleep(600); await D.go(page, 'Dr. Mei Chen'); await sleep(2500);
  let added = 0, addUndone = 0;
  for (let k = 1; k <= 10; k++) {
    const name = `Zz stress note ${k}`;
    const plus = await page.evaluate(() => { const b = document.querySelector('.refinement-two-way .rf-tw-add'); if (!b) return false; b.click(); return true; });
    if (!plus) { problem('no + on the two-way rows of Dr. Mei Chen'); break; }
    await sleep(400);
    const field = await page.evaluate(() => { const i = document.querySelector('.refinement-two-way .rf-tw-draft-name'); i?.focus(); return !!i; });
    if (!field) { problem('the + opened no line to type in'); break; }
    await page.keyboard.type(name, { delay: 15 }); await page.keyboard.press('Enter'); await sleep(500); await page.keyboard.press('Enter'); await sleep(1500);
    const found = await page.evaluate(async n => (await window.logseq.api.datascript_query(`[:find ?u :where [?b :block/title "${n}"] [?b :block/uuid ?u]]`)) || [], name);
    if (!found.length) { problem(`“${name}” was not made`); continue; }
    added++;
    const arrow = await page.evaluate(() => { const keys = [...document.querySelectorAll('[data-rf-undo^="two-way:"]')]; const a = keys.at(-1); a?.click(); return !!a; });
    await sleep(1200);
    const left = await page.evaluate(async n => ((await window.logseq.api.datascript_query(`[:find ?u :where [?b :block/title "${n}"] [?b :block/uuid ?u] (not [?b :logseq.property/deleted-at _])]`)) || []).length, name);
    if (arrow && !left) addUndone++; else problem(`“${name}” is still there after its Undo`);
  }
  // Anything named so left anywhere, the Recycle too, removed for good.
  const leftovers = await page.evaluate(async () => (await window.logseq.api.datascript_query('[:find ?u ?n :where [?b :block/title ?n] [(clojure.string/starts-with? ?n "Zz stress note")] [?b :block/uuid ?u]]')) || []);
  for (const [u] of leftovers) { await page.evaluate(u => window.logseq.api.remove_block(u), String(u)).catch(() => {}); await forGood([String(u)]); }
  say(`  ten nodes through the two-way +: ${added} made, ${addUndone} undone`);
}

const PAGES5 = ['Dr. Mei Chen', 'Nausea', 'Oxaliplatin', 'Northgate Cancer Center', 'Tingling fingers'];
async function countsOn(page, name) { await D.go(page, 'all-pages'); await sleep(600); await D.go(page, name); await sleep(2600); const c = await D.counts(page); return { marks: c.marks, styles: c.styles, cleanUps: c.door?.cleanUps, watchers: c.door?.watchers, hooks: c.door?.hooks, dbJobs: c.door?.dbJobs }; }
async function reloadsPart(page) {
  say('reloads:');
  const frameCounts = async () => (await D.counts(page)).door;
  // A cold start: off and on.
  await D.setPlugin(page, false); await D.setPlugin(page, true);
  const cold = {}; for (const n of PAGES5) cold[n] = await countsOn(page, n);
  let missed = 0, last = (await frameCounts())?.startedAt;
  for (let k = 0; k < 20; k++) {
    await page.evaluate(id => window.LSPluginCore.reload(id), D.PLUGIN);
    await sleep(5000);
    const now = (await frameCounts())?.startedAt;
    if (!now || now === last) missed++;
    last = now;
  }
  if (missed) problem(`${missed} of 20 reloads did not take effect (the start time stayed)`);
  for (const n of PAGES5) { const c = await countsOn(page, n); if (JSON.stringify(c) !== JSON.stringify(cold[n])) problem(`after twenty reloads ${n} differs from a cold start: ${JSON.stringify(c).slice(0, 300)} against ${JSON.stringify(cold[n]).slice(0, 300)}`); }
  // Foundation only on and off, five times.
  const setFoundation = v => page.evaluate(([id, v]) => window.LSPluginCore.registeredPlugins.get(id).settings.set('foundationOnly', v), [D.PLUGIN, v]);
  let foundationMissed = 0;
  try {
    for (let k = 0; k < 5; k++) {
      for (const v of [true, false]) {
        await setFoundation(v);
        const before = (await frameCounts())?.startedAt;
        await page.evaluate(id => window.LSPluginCore.reload(id), D.PLUGIN);
        await sleep(5000);
        const after = (await frameCounts())?.startedAt;
        await D.go(page, 'all-pages'); await sleep(500); await D.go(page, 'Dr. Mei Chen'); await sleep(2500);
        const rows = await page.evaluate(() => document.querySelectorAll('#main-content-container .refinement-two-way .rf-tw-row').length);
        if (!after || after === before || (v ? rows : !rows)) { foundationMissed++; problem(`Foundation only ${v ? 'on' : 'off'}, try ${k + 1}: the reload ${after && after !== before ? 'took effect' : 'did not take effect'}, ${rows} two-way rows shown`); }
      }
    }
  } finally {
    // Back off, and reloaded, so the copy running is the whole plugin again whatever the loop stopped on.
    await setFoundation(false);
    await page.evaluate(id => window.LSPluginCore.reload(id), D.PLUGIN).catch(() => {});
    await sleep(5000);
  }
  say(`  twenty reloads, ${20 - missed} took effect; five pages as after a cold start; Foundation only on and off five times, ${10 - foundationMissed} of 10 reloads right`);
}

async function darkPart(page) {
  say('dark mode, every pop-up photographed:');
  const dir = path.join(root, 'check.log/frames/dark');
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f));
  const was = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, system: localStorage.getItem('system-theme?') === 'true' }));
  const frame = D.plugin(page);
  const shot = async name => { await sleep(400); await page.screenshot({ path: path.join(dir, name + '.png') }); };
  const closeAll = async () => { await frame.evaluate(() => { window.Threads.shared.popups.closeAll(); document.querySelector('dialog')?.close?.(); }).catch(() => {}); await page.evaluate(() => { for (const d of document.querySelectorAll('dialog.rf-dialog, dialog.refinement-settings')) { d.close?.(); d.remove(); } }); await page.keyboard.press('Escape'); await sleep(200); };
  try {
    await page.evaluate(() => window.logseq.api.set_theme_mode('dark')); await sleep(800);
    await D.go(page, 'Dr. Mei Chen'); await sleep(2500);
    await shot('page-dr-mei-chen');
    await frame.evaluate(() => window.Threads.core.provided.settingsPanel.open()); await shot('settings-window'); await closeAll();
    await frame.evaluate(() => window.Threads.core.provided.diagnostics.openTroubleshooting?.()); await shot('troubleshooting'); await closeAll();
    await frame.evaluate(() => window.Threads.core.provided.diagnostics.checkWhatIsFound()); await shot('report'); await closeAll();
    // The two-way rows: a right-click on a field's name, the hover card on a node, a tick and the picking bar.
    await page.evaluate(() => { const n = document.querySelector('.refinement-two-way .rf-tw-field'); n?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: n.getBoundingClientRect().left + 5, clientY: n.getBoundingClientRect().top + 5 })); }); await shot('two-way-rename'); await closeAll();
    const rec = await page.evaluate(() => { const r = document.querySelector('.refinement-two-way .rf-tw-record')?.getBoundingClientRect(); return r ? [r.left + 10, r.top + 6] : null; });
    if (rec) { await page.mouse.move(rec[0], rec[1]); await sleep(1200); await shot('two-way-card'); await page.mouse.move(5, 5); await sleep(400); }
    await page.evaluate(() => document.querySelector('.refinement-two-way input.rf-check')?.click()); await shot('two-way-picking-bar');
    await page.evaluate(() => document.querySelector('.refinement-two-way [data-act="page-menu"], .refinement-two-way .rf-tw-bar .lk-btn')?.click()); await shot('two-way-bar-menu'); await closeAll();
    await page.keyboard.press('Escape'); await sleep(300);
    // The tag map: a tag's menu, a property's menu, its kind menu, a question.
    await D.go(page, '#/refinement-tags'); await sleep(2000); await shot('tag-map');
    await page.evaluate(() => { const row = document.querySelector('.refinement-tags .rtg-row .rtg-main'); row?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: row.getBoundingClientRect().left + 40, clientY: row.getBoundingClientRect().top + 8 })); }); await shot('tag-map-tag-menu'); await closeAll();
    await page.evaluate(() => { const row = document.querySelector('.refinement-tags .rtg-prow, .refinement-tags [data-key*="|"] .rtg-main'); row?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: row.getBoundingClientRect().left + 60, clientY: row.getBoundingClientRect().top + 8 })); }); await shot('tag-map-property-menu'); await closeAll();
    await page.evaluate(() => document.querySelector('.refinement-tags .rf-kind')?.click()); await shot('tag-map-kind-menu'); await closeAll();
    await page.evaluate(() => [...document.querySelectorAll('.refinement-tags .rtg-by')][1]?.click()); await shot('tag-map-properties-view');
    await page.evaluate(() => [...document.querySelectorAll('.refinement-tags .rtg-by')][0]?.click()); await sleep(300);
    say(`  ${fs.readdirSync(dir).length} pictures in check.log/frames/dark/ (to be looked at)`);
  } finally {
    await closeAll().catch(() => {});
    await page.evaluate(w => window.logseq.api.set_theme_mode(w.system ? 'system' : (w.theme || 'light')), was).catch(() => {});
  }
}

(async () => {
  const { browser, page, graph } = await D.connect('app-stress');
  const session = await page.context().newCDPSession(page);
  await session.send('Performance.enable');
  const mac = await gate.waitQuiet({ minutes: process.argv.includes('--no-wait') ? 0 : 10 });
  say(`app-stress on ${graph}${mac.quiet ? '' : ` (the Mac busy, load ${mac.load.toFixed(2)}: times are read with that in mind)`}`);
  const was = await page.evaluate(() => ({ hash: location.hash, theme: document.documentElement.dataset.theme, system: localStorage.getItem('system-theme?') === 'true' }));
  const sidebarWas = await D.sidebarNow(page);
  let fingerprintSaved = false;
  const env = { ...process.env, GRAPH: graph }; // the graph the app has open, not the default
  try { execSync('node tools/graph-check.js save', { cwd: root, stdio: 'ignore', env }); fingerprintSaved = true; } catch (error) { problem('the graph\'s fingerprint could not be saved'); }
  const restore = async () => {
    await D.setPlugin(page, true).catch(() => {});
    const foundation = await page.evaluate(id => window.LSPluginCore.registeredPlugins.get(id)?.settings?.get?.('foundationOnly'), D.PLUGIN).catch(() => false);
    if (foundation) {
      await page.evaluate(id => window.LSPluginCore.registeredPlugins.get(id)?.settings?.set('foundationOnly', false), D.PLUGIN).catch(() => {});
      await page.evaluate(id => window.LSPluginCore.reload(id), D.PLUGIN).catch(() => {}); await sleep(5000);
    }
    await page.evaluate(() => { window.__rfFrames?.stop(); delete window.__rfFrames; }).catch(() => {});
    await session.send('Emulation.clearDeviceMetricsOverride').catch(() => {});
    await page.evaluate(w => window.logseq.api.set_theme_mode(w.system ? 'system' : (w.theme || 'light')), was).catch(() => {});
    await D.sidebarBack(page, sidebarWas).catch(() => {});
    await page.evaluate(h => { location.hash = h; }, was.hash).catch(() => {});
  };
  // Stopped: the part in flight is given two seconds to finish its step, then the app is put back.
  const onSignal = async () => { console.log('app-stress: stopped; putting the app back'); await sleep(2000); await restore(); await browser.close().catch(() => {}); process.exit(130); };
  process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);
  try {
    for (const [name, part] of [['pages', pagesPart], ['typing', typingPart], ['undo', undoPart], ['view', viewPart], ['reloads', reloadsPart], ['dark', darkPart]]) {
      if (!want(name)) continue;
      await D.graphOk(page);
      try { await part(page, session); } catch (error) { problem(`${name}: stopped: ${error.message}`); }
    }
  } finally {
    await restore();
    await browser.close().catch(() => {});
  }
  if (fingerprintSaved) {
    try { const out = execSync('node tools/graph-check.js compare', { cwd: root, env }).toString(); if (!/as it was/.test(out)) problem('the graph changed: ' + out.trim().split('\n').slice(0, 6).join(' | ')); else say('  the graph is as it was'); }
    catch (error) { problem('the graph changed: ' + String(error.stdout || error.message).trim().split('\n').slice(0, 8).join(' | ')); }
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'app-stress.txt'), [...lines, ...problems.map(p => 'PROBLEM: ' + p)].join('\n') + '\n');
  console.log(problems.length ? `app-stress: FAILED (${problems.length})` : 'app-stress: OK');
  process.exit(problems.length ? 1 : 0);
})().catch(error => { console.log('PROBLEM: ' + (error?.stack || error)); process.exit(1); });
