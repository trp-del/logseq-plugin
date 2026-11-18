#!/usr/bin/env node
/* node tools/app-checks/row-view.js   The table's row view, by real presses in the checks' own Logseq (18 November 2026).
   Release 0.3.163 went out with a row view where a press on a cell "just flashes and cannot edit", and no check saw it. This one
   drives the row view as a person does, with the mouse and the keys, and reads what it wrote back from the graph:
     1. the toolbar's Row view button turns the row view on (sidebar open, button pressed, the waiting line, Ontology folded) and
        off again (all of it gone, the sidebar's stack as before, a press in the table Logseq's own again);
     2. a row pressed shows first in the sidebar with "N of M" and keeps its outline; the down and up arrows move it, and the row's
        section never stands blank in between (watched at every frame);
     3. a double press on a cell of each kind in the graph's tables (a node's words, a choice, a number, a date) opens an editor in
        the row's section; a new value is typed and confirmed as Logseq does, read back from the graph, and taken back with Logseq's
        own Undo, so the graph ends as it began (every fact compared);
     4. nothing from the plugin in the console.
   Needs LOGSEQ_PORT pointing at a Logseq started by tools/audit/fresh.js (a throwaway copy of the Illness Test Graph). It leaves
   that Logseq as it found it: the row view off, the sidebar as it was, no list or editor open, the same page.
   Prints "ok …" or "PROBLEM: …" per line, then "row-view: OK" (exit 0) or "row-view: FAILED (n)" (exit 1); exit 2 when Logseq
   cannot be reached. ROWVIEW_SHOTS=<folder> saves pictures of its key moments there. */
const path = require('node:path');
const kit = require('../audit/kit');
const { sleep } = kit;
const SHOTS = process.env.ROWVIEW_SHOTS || '';
const ROW = '#main-content-container .ls-table-row[blockid]';
const BUTTON = '.lk-tool[data-on-click="rowView"]';
const t0 = Date.now();
let problems = 0, page, shotProblem = false;
const ok = s => console.log('ok  ' + s);
const problem = async s => {
  problems++; console.log('PROBLEM: ' + s);
  if (SHOTS && !shotProblem && page) { shotProblem = true; await page.screenshot({ path: path.join(SHOTS, 'row-view-4-problem.png') }).catch(() => {}); }
};
const check = (cond, good, bad) => (cond ? ok(good) : problem(bad));
const shot = name => (SHOTS ? page.screenshot({ path: path.join(SHOTS, name) }).catch(() => {}) : null);
const waitFor = async (fn, ms = 3000, step = 100) => { const end = Date.now() + ms; let v; while (Date.now() < end) { v = await fn(); if (v) return v; await sleep(step); } return v; };

// What the screen says of the row view, read in Logseq's window.
const state = () => page.evaluate(([BUTTON, ROW]) => {
  const side = document.getElementById('right-sidebar');
  const items = [...document.querySelectorAll('#right-sidebar .sidebar-item-list > .sidebar-item')].filter(i => !i.classList.contains('st-item-hold'));
  const seen = i => i.getClientRects().length > 0 && i.getBoundingClientRect().height > 0;
  const key = i => i.classList.contains('item-type-page') ? 'page:' + (i.querySelector('.sidebar-item-header .page-title')?.textContent || '').trim() : i.classList.contains('item-type-plugin') ? 'plugin:' + (i.querySelector('.sidebar-item-header')?.textContent || '').trim() : 'block:' + (i.querySelector('.sidebar-panel-content .ls-block[blockid]')?.getAttribute('blockid') || '');
  const sec = items.find(i => i.hasAttribute('data-st-item'));
  const ont = items.find(i => i.classList.contains('item-type-plugin') && /Ontology/.test(i.querySelector('.sidebar-item-header')?.textContent || ''));
  const list = document.querySelector('#right-sidebar .sidebar-item-list');
  const picked = [...document.querySelectorAll(ROW + '[data-st-picked]')];
  let open = null; try { open = !!window.logseq.api.get_state_from_store('ui/sidebar-open?'); } catch (e) { /* unknown */ }
  return {
    pressed: document.querySelector(BUTTON)?.getAttribute('aria-pressed') || '',
    rows: !!side?.hasAttribute('data-lk-rows'), open,
    waiting: list ? getComputedStyle(list, '::before').content.replace(/^"|"$/g, '') : '',
    ontFolded: ont ? ont.classList.contains('collapsed') : null,
    stack: items.filter(i => !i.classList.contains('item-type-plugin') && !i.classList.contains('lk-side') && !i.classList.contains('lk-own')).map(key),   // Logseq's own items: the plugin's own parts (Outline, Links) come and go with the sidebar
    sec: sec ? { node: sec.querySelector('.sidebar-panel-content .ls-block[blockid]')?.getAttribute('blockid') || '', where: getComputedStyle(sec).getPropertyValue('--st-where').trim().replace(/^"|"$/g, ''), seen: seen(sec), head: (sec.querySelector('.sidebar-item-header')?.textContent || '').trim().slice(0, 40) } : null,
    picked: picked.map(r => r.getAttribute('blockid')),
    outline: picked[0] ? parseFloat(getComputedStyle(picked[0], '::after').borderTopWidth) || 0 : 0,
    editing: window.logseq.api.check_editing() || '',
    popups: document.querySelectorAll('[role="menu"], [role="listbox"], [role="dialog"], .ls-property-date-picker').length,
  };
}, [BUTTON, ROW]);

// A real press on the toolbar's Row view button.
async function pressButton() {
  const b = await page.$(BUTTON); if (!b) return false;
  const r = await b.boundingBox(); if (!r) return false;
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  return true;
}
/* The point a person presses on a cell of a row: the column brought into the table's view with the wheel (the table is wider than
   the window), the row into the page's view, and on the Name column a spot of plain words (a link there would be followed by
   Logseq on a press with the row view off, and Logseq's own two buttons stand at the name's end under the pointer). */
async function cellPoint(uuid, column) {
  for (let i = 0; i < 6; i++) {
    const at = await page.evaluate(([ROW, uuid, column]) => {
      const heads = [...document.querySelectorAll('#main-content-container .ls-table-header .ls-table-header-cell')];
      const col = heads.findIndex(h => h.textContent.trim() === column);
      const row = document.querySelector(`${ROW}[blockid="${uuid}"]`);
      if (col < 0 || !row) return { missing: col < 0 ? 'column' : 'row' };
      const cell = row.querySelectorAll('.ls-table-cell')[col];
      const box = row.closest('.ls-table-rows').getBoundingClientRect(), main = document.getElementById('main-content-container').getBoundingClientRect();
      const r = cell.getBoundingClientRect();
      const left = Math.max(box.left, main.left), right = Math.min(box.right, main.right);
      const dx = r.left < left + 4 ? r.left - left - 8 : r.right > right - 4 ? Math.min(r.right - right + 8, r.left - left - 8) : 0;
      const dy = r.top < main.top + 120 ? r.top - main.top - 160 : r.bottom > innerHeight - 20 ? r.bottom - innerHeight + 80 : 0;
      let x = r.left + Math.min(r.width / 2, 60), y = r.top + r.height / 2;
      if (column === 'Name') {
        const w = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
        for (let t = w.nextNode(); t; t = w.nextNode()) {
          if (!t.textContent.trim() || t.parentElement.closest('a, .page-ref, [data-ref], button, .absolute')) continue;
          const range = document.createRange(); range.setStart(t, 0); range.setEnd(t, Math.min(4, t.textContent.length));
          const q = range.getBoundingClientRect(); if (q.width) { x = q.left + q.width / 2; y = q.top + q.height / 2; break; }
        }
      }
      return { dx, dy, x, y, mx: (left + right) / 2, my: r.top + r.height / 2 };
    }, [ROW, uuid, column]);
    if (at.missing) return at;
    if (!at.dx && !at.dy) return at;
    await page.mouse.move(at.mx, Math.min(Math.max(at.my, 200), 600));
    await page.mouse.wheel(at.dx, at.dy); await sleep(450);
  }
  return { missing: 'a place in view' };
}
const blur = () => page.evaluate(() => { document.activeElement?.blur?.(); });
// Where the keyboard is, and whether that is inside the row's section in the sidebar.
const focusIn = () => page.evaluate(() => { const a = document.activeElement; return { tag: a?.tagName || '', inSection: !!a?.closest?.('#right-sidebar .sidebar-item[data-st-item]'), value: a?.value ?? '' }; });

// A cell's value as the graph holds it.
const valueOf = (uuid, ident) => page.evaluate(async ([uuid, ident]) => {
  const b = await window.logseq.api.get_block(uuid); if (!b) return null;
  if (!ident) return b.title ?? b.content ?? '';
  const v = b[ident]; if (v == null) return null;
  if (typeof v !== 'object') return v;
  return v.journalDay ?? v[':logseq.property/value'] ?? v.title ?? null;
}, [uuid, ident]);

/* Taken back with Logseq's own Undo, as a person would, only when the graph shows the change (an Undo with nothing of ours to take
   back would take back something older). */
async function undoTo(uuid, ident, was, label) {
  await page.keyboard.press('Escape'); await sleep(150); await blur();
  if (JSON.stringify(await valueOf(uuid, ident)) === JSON.stringify(was)) return true;
  if (process.env.ROWVIEW_DEBUG) console.log('  before Undo:', JSON.stringify(await page.evaluate(() => ({ act: document.activeElement.tagName + '.' + String(document.activeElement.className).slice(0, 30), ed: window.logseq.api.check_editing(), sel: document.querySelectorAll('.ls-block.selected').length }))));
  /* Logseq keeps words typed in steps (it saves while you type), so the words may need an Undo or two more; each further Undo is
     pressed only while the graph still holds part of what the check typed (for words: the old words with some of the new after them). */
  let back = false;
  for (let i = 0; i < 5 && !back; i++) {
    const now = await valueOf(uuid, ident);
    if (i && !(typeof was === 'string' && typeof now === 'string' && now.startsWith(was))) break;
    await page.keyboard.press('Meta+z');
    back = await waitFor(async () => JSON.stringify(await valueOf(uuid, ident)) === JSON.stringify(was), i ? 1200 : 2500);
    if (process.env.ROWVIEW_DEBUG) console.log('  after Undo:', JSON.stringify(await valueOf(uuid, ident)));
    // Logseq's Undo puts the cursor back into the words it restored: left with Escape, as a person would.
    if (await page.evaluate(() => window.logseq.api.check_editing())) { await page.keyboard.press('Escape'); await sleep(200); }
    await page.keyboard.press('Escape'); await blur(); await sleep(150);
  }
  if (!back) await problem(`${label}: Logseq's Undo did not put the value back (the graph holds ${JSON.stringify(await valueOf(uuid, ident))}, it held ${JSON.stringify(was)})`);
  return back;
}

/* One kind of cell: a double press on it, the editor that opens, a new value typed and confirmed, the graph read, the value taken
   back. how.opened says what counts as the editor being open; how.write types and confirms. */
async function cellKind(label, tag, uuid, column, ident, how) {
  if (!uuid) return problem(`${label}: no row to try on the ${tag} page`);
  const was = await valueOf(uuid, ident);
  const at = await cellPoint(uuid, column);
  if (at.missing) return problem(`${label}: the ${column} cell could not be brought into view on the ${tag} page (no ${at.missing})`);
  // What the two presses landed on, heard before the plugin hears them: their row, the cell's place in it and how far apart in time.
  await page.evaluate(() => {
    window.__rowPresses = [];
    if (!window.__rowPressHeard) { window.__rowPressHeard = true; window.addEventListener('click', e => { const cell = e.target?.closest?.('.ls-table-cell'), row = cell?.closest('.ls-table-row'); if (window.__rowPresses) window.__rowPresses.push({ t: Math.round(e.timeStamp), row: row?.getAttribute('blockid')?.slice(-4) || '', at: row ? [...row.querySelectorAll('.ls-table-cell')].indexOf(cell) : -1, n: row ? row.querySelectorAll('.ls-table-cell').length : 0 }); }, true); }
  });
  await page.evaluate(id => {
    const w = window.__rowSeen = { from: performance.now(), at: 0 };
    const look = () => { if (window.__rowSeen !== w || performance.now() - w.from > 4000) return; const open = !!document.querySelector('.ui__popover-content, .ls-property-date-picker') || window.logseq.api.check_editing(); if (open && !w.open) w.open = Math.round(performance.now() - w.from); if (!open && w.open && !w.shut) w.shut = Math.round(performance.now() - w.from); requestAnimationFrame(look); };
    requestAnimationFrame(look);
    const tick = () => { if (window.__rowSeen !== w || w.at || performance.now() - w.from > 4000) return; const s = document.querySelector('#right-sidebar .sidebar-item[data-st-item]:not(.st-item-hold)'); const key = s && (s.classList.contains('item-type-page') ? 'page' : s.querySelector('.sidebar-panel-content .ls-block[blockid]')?.getAttribute('blockid')); if (s && (key === id || (key === 'page' && s.querySelector('.sidebar-panel-content')?.textContent.trim()))) w.at = Math.round(performance.now() - w.from); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }, uuid);
  // A double press as a hand makes it: two presses about 90 ms apart (Playwright's own double click lands both in the same millisecond).
  await page.mouse.move(at.x, at.y); await page.mouse.down(); await page.mouse.up(); await sleep(90);
  await page.mouse.down({ clickCount: 2 }); await page.mouse.up({ clickCount: 2 });
  const opened = await waitFor(() => how.opened(uuid), 2500);
  if (!opened) {
    const p = await page.evaluate(() => window.__rowPresses || []);
    const heard = p.length < 2 ? `only ${p.length} press reached the table` : `the presses were ${p[1].t - p[0].t} ms apart, on the cell at place ${p[0].at} of ${p[0].n} then ${p[1].at} of ${p[1].n} in row …${p[1].row}`;
    const { at: seen, open: flashOpen, shut: flashShut } = await page.evaluate(() => window.__rowSeen || {});
    if (process.env.ROWVIEW_DEBUG) console.log('  no editor:', JSON.stringify(await state()), JSON.stringify(await focusIn()), JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('[role="menu"], [role="listbox"], [role="dialog"]')].map(m => m.textContent.slice(0, 80)))));
    await problem(`${label}: a double press on the ${column} cell of the ${tag} table opened no editor in the row's section (${heard}; the row's own section stood drawn ${seen ? seen + ' ms' : 'not even 4 s'} after the presses${flashOpen ? `; an editor did open at ${flashOpen} ms and closed at ${flashShut} ms` : '; no editor opened at any frame'})`);
    await page.keyboard.press('Escape'); await sleep(200); await page.keyboard.press('Escape');
    return;
  }
  await sleep(250);   // a cell that "just flashes" closes its editor within a moment of opening it
  const still = await how.opened(uuid);
  if (!still) { await problem(`${label}: the ${column} editor opened and closed again at once ("just flashes"), nothing can be typed`); await page.keyboard.press('Escape'); return; }
  if (how.shot) await shot(how.shot);
  const want = await how.write(was);
  const got = await waitFor(async () => { const v = await valueOf(uuid, ident); return JSON.stringify(v) === JSON.stringify(want) ? v ?? true : null; }, 2500);
  if (got) ok(`${label}: a double press on ${column} opened its editor in the row's section; ${JSON.stringify(want)} typed is in the graph`);
  else await problem(`${label}: the ${column} editor opened, but what was typed is not in the graph (wanted ${JSON.stringify(want)}, the graph holds ${JSON.stringify(await valueOf(uuid, ident))})`);
  if (await undoTo(uuid, ident, was, label)) how.after?.(was);
}
/* Logseq 2.0.2's number editor keeps the number typed and writes it once more when its section closes, after Undo had taken it back
   (seen 18 November 2026 with the plugin switched off too, on a journal page: type a number, Enter, Cmd+Z, leave the page). That is
   Logseq's, not the row view's, so it is said in a note and taken back with Undo once more. */
let numberBack = null;
async function settleNumber() {
  if (!numberBack) return;
  const { uuid, ident, was } = numberBack; numberBack = null;
  await sleep(300);
  const now = await valueOf(uuid, ident);
  if (JSON.stringify(now) === JSON.stringify(was)) return;
  console.log(`note: Logseq's own number editor wrote ${JSON.stringify(now)} again as its section closed, after Undo had taken it back (Logseq 2.0.2 does this with the plugin off too); taken back with Undo once more`);
  await blur(); await page.keyboard.press('Meta+z');
  if (!(await waitFor(async () => JSON.stringify(await valueOf(uuid, ident)) === JSON.stringify(was), 2500))) await problem(`Number: the value written again by Logseq could not be taken back (the graph holds ${JSON.stringify(await valueOf(uuid, ident))}, it held ${JSON.stringify(was)})`);
}

(async () => {
  let conn;
  try { conn = await kit.connect(); } catch (error) { console.log(`row-view: cannot reach the checks' own Logseq on port ${kit.PORT}: ${String(error.message || error).split('\n')[0]}`); process.exit(2); }
  const { browser, said } = conn; page = conn.page;
  const startHash = await page.evaluate(() => location.hash);
  const startOpen = (await state()).open;
  const before = await kit.fingerprint(page);
  let after = before;
  try {
    // The graph read: which kinds of property the tag tables show, and a row of each.
    const kinds = await page.evaluate(async () => {
      const q = s => window.logseq.api.datascript_query(s);
      const typed = await q('[:find ?tag ?pt ?ident ?type :where [?t :logseq.property.class/properties ?p] [?t :block/title ?tag] [?p :block/title ?pt] [?p :db/ident ?ident] [?p :logseq.property/type ?type] [(namespace ?ident) ?ns] [(= ?ns "user.property")]]');
      const closed = new Set((await q('[:find ?ident :where [?c :block/closed-value-property ?p] [?p :db/ident ?ident]]')).map(r => String(r[0])));
      // A tag's table shows its parents' properties too (Symptom Log's Date is Occurrence's).
      const up = await q('[:find ?ct ?pt :where [?c :logseq.property.class/extends ?p] [?c :block/title ?ct] [?p :block/title ?pt]]');
      const parents = new Map(up.map(([c, p]) => [c, p]));
      const own = typed.map(([tag, title, ident, type]) => ({ tag, title, ident: String(ident), type: closed.has(String(ident)) ? 'choice' : String(type).replace(/^:/, '') }));
      const out = [];
      for (const tag of new Set(own.map(k => k.tag))) for (let t = tag, i = 0; t && i < 8; t = parents.get(t), i++) for (const k of own.filter(k => k.tag === t)) out.push({ ...k, tag });
      return out;
    });
    // The tag whose table shows a number and a date beside each other is the home of the check; the choice may be on another tag.
    const both = kinds.find(k => k.type === 'number' && kinds.some(o => o.tag === k.tag && o.type === 'date'));
    const num = both || kinds.find(k => k.type === 'number');
    const date = kinds.find(k => k.type === 'date' && (!num || k.tag === num.tag)) || kinds.find(k => k.type === 'date');
    const choice = kinds.find(k => k.type === 'choice');
    const dateOnNumTag = !!date && (!num || date.tag === num.tag);
    const home = num ? num.tag : date ? date.tag : 'Consultation';
    console.log(`(tables tried: ${home} for the words${num ? ', ' + num.title + ' (a number)' : ''}${date ? ', ' + date.title + ' (a date)' : ''}; ${choice ? choice.tag + ' for ' + choice.title + ' (a choice)' : 'no choice'})`);

    // 1. On, by the toolbar's button.
    let s0 = await state();
    if (s0.rows) { await problem('the row view was already on when the check began; turned off first'); await pressButton(); await sleep(1500); s0 = await state(); }
    await kit.go(page, home, 2500);
    const stackBefore = (await state()).stack;
    if (!(await pressButton())) { await problem(`no Row view button in the toolbar on the ${home} page`); throw new Error('stop'); }
    const on = await waitFor(async () => { const s = await state(); return s.rows && s.pressed === 'true' && s.open ? s : null; }, 2500) || await state();
    await check(on.rows && on.pressed === 'true' && on.open, 'the Row view button turns the row view on: the sidebar opens and the button reads as pressed', `the Row view button did not turn the row view on (button pressed: ${on.pressed || 'no'}, sidebar open: ${on.open}, row view mark: ${on.rows})`);
    if (!on.rows) throw new Error('stop');
    await check(/Press a row in the table/.test(on.waiting) && !on.sec, 'with no row pressed, one faint line says "Press a row in the table to see it here."', `with no row pressed the sidebar does not say "Press a row in the table to see it here." (it says "${on.waiting}"${on.sec ? ', and a row is shown' : ''})`);
    await check(on.ontFolded === true, 'Ontology stands folded under it', `Ontology is ${on.ontFolded === null ? 'not in the sidebar' : 'not folded'} as the row view comes on`);

    // 2. A row pressed, then the arrows, watched at every frame.
    const rowIds = await page.evaluate(ROW => [...document.querySelectorAll(ROW)].slice(0, 6).map(r => r.getAttribute('blockid')), ROW);
    if (rowIds.length < 3) { await problem(`the ${home} table shows fewer than three rows`); throw new Error('stop'); }
    await page.evaluate(() => {
      const w = window.__rowWatch = { seen: false, frames: 0, blank: 0, stop: false };
      const tick = () => {
        if (w.stop) return;
        const s = document.querySelector('#right-sidebar .sidebar-item[data-st-item]');
        const shown = !!s && s.getClientRects().length > 0 && s.getBoundingClientRect().height > 8 && !!(s.querySelector('.sidebar-panel-content')?.textContent || '').trim();
        if (shown) w.seen = true; else if (w.seen) w.blank++;
        w.frames++; requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const first = rowIds[1];
    let at = await cellPoint(first, 'Name');
    await page.mouse.click(at.x, at.y);
    const shownRow = async (id, n) => waitFor(async () => { const s = await state(); return s.sec && s.sec.node === id && s.sec.seen && /^\d+ of \d+$/.test(s.sec.where) && s.picked.length === 1 && s.picked[0] === id ? s : null; }, 3000);
    const s1 = await shownRow(first) || await state();
    const ofM = s1.sec?.where || '';
    await check(s1.sec?.node === first && /^\d+ of \d+$/.test(ofM), `a single press shows the row first in the sidebar, "${ofM}" on its head`, `a single press on a row did not show it in the sidebar (shown: ${s1.sec ? (s1.sec.node || 'nothing yet') + ' "' + s1.sec.where + '"' : 'no row section'})`);
    await check(s1.picked.length === 1 && s1.picked[0] === first && s1.outline > 0, 'the pressed row keeps its outline in the table', `the pressed row has no outline in the table (outlined: ${s1.picked.length} rows, line ${s1.outline}px)`);
    await check(!s1.editing && !s1.popups, 'a single press only selects: nothing opens for writing', `a single press opened ${s1.editing ? 'an editor' : 'a list'}, as only a double press should`);
    await shot('row-view-1-row-shown.png');
    const n1 = Number(ofM.split(' ')[0]);
    await page.keyboard.press('ArrowDown');
    const s2 = await shownRow(rowIds[2]) || await state();
    await check(s2.sec?.node === rowIds[2] && s2.sec.where === `${n1 + 1} of ${ofM.split(' of ')[1]}`, `ArrowDown moves the selection to the next row and the section follows ("${s2.sec?.where}")`, `ArrowDown did not move the row view to the next row (shown: ${s2.sec?.node === first ? 'the same row' : s2.sec?.node || 'nothing'}, "${s2.sec?.where || ''}", outlined ${s2.picked.join(',') || 'none'})`);
    await page.keyboard.press('ArrowUp');
    const s3 = await shownRow(first) || await state();
    await check(s3.sec?.node === first && s3.sec.where === ofM, 'ArrowUp moves it back and the section follows', `ArrowUp did not move the row view back (shown "${s3.sec?.where || 'nothing'}")`);
    const watch = await page.evaluate(() => { const w = window.__rowWatch; w.stop = true; return w; });
    await check(watch.seen && watch.blank === 0, `the row's section never stood blank between rows (${watch.frames} frames watched)`, `the row's section stood blank in ${watch.blank} of ${watch.frames} frames between rows`);

    // 3. Each kind of cell, by a double press.
    const rowsOf = (tag, idents) => page.evaluate(async ([ROW, idents]) => {
      const out = [];
      for (const r of [...document.querySelectorAll(ROW)].slice(0, 10)) {
        const id = r.getAttribute('blockid'), b = await window.logseq.api.get_block(id);
        if (b && idents.every(i => b[i] != null) && !/\[\[/.test(b.title || '')) out.push(id);
      }
      return out;
    }, [ROW, idents]);
    const plain = (await rowsOf(home, [num?.ident, date?.ident].filter(Boolean)));
    const target = plain.find(id => id !== first) || plain[0];
    // Name: the node's words, written in the row's section's own editor; Escape leaves it, as in Logseq.
    await cellKind('Name', home, target, 'Name', '', {
      opened: async uuid => { const [s, f] = [await state(), await focusIn()]; return s.editing === uuid && f.tag === 'TEXTAREA' && f.inSection; },
      write: async was => { await page.keyboard.press('Meta+ArrowDown'); await page.keyboard.type(' checked'); await sleep(150); await page.keyboard.press('Escape'); return was + ' checked'; },
    });
    if (num) await cellKind('Number', home, target, num.title, num.ident, {
      shot: 'row-view-2-cell-editor.png',
      after: was => { numberBack = { uuid: target, ident: num.ident, was }; },
      opened: async () => { const f = await focusIn(); return f.tag === 'INPUT' && f.inSection; },
      write: async was => { const want = Number(was) === 7 ? 8 : 7; await page.keyboard.press('Meta+a'); await page.keyboard.type(String(want)); await page.keyboard.press('Enter'); return want; },
    }); else await problem('Number: not present: no table of the graph shows a number column');
    if (date && dateOnNumTag) await cellKind('Date', home, target, date.title, date.ident, {
      opened: async () => (await page.evaluate(() => { const p = document.querySelector('.ls-property-date-picker'); return !!p && p.getClientRects().length > 0; })),
      write: async was => {
        const d = new Date(Date.UTC(Math.floor(was / 10000), Math.floor(was / 100) % 100 - 1, was % 100 + 2));
        const want = d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
        const box = await (await page.$('.ls-property-date-picker input[placeholder]'))?.boundingBox();
        if (box) await page.mouse.click(box.x + 40, box.y + box.height / 2);
        await page.keyboard.type(`${d.toLocaleString('en', { month: 'short', timeZone: 'UTC' })} ${d.getUTCDate()} ${d.getUTCFullYear()}`); await sleep(200);
        await page.keyboard.press('Enter');
        return want;
      },
    }); else await problem('Date: not present: no table of the graph shows a date column beside a number');
    if (choice) {
      // The first tag with a choice column whose table shows a row with a value in it.
      let chosen = '';
      for (const k of kinds.filter(k => k.type === 'choice')) { await kit.go(page, k.tag, 2500); await settleNumber(); chosen = (await rowsOf(k.tag, [k.ident]))[0]; if (chosen) { Object.assign(choice, k); break; } }
      const options = await page.evaluate(async ident => (await window.logseq.api.datascript_query(`[:find ?t :where [?p :db/ident ${ident}] [?c :block/closed-value-property ?p] [?c :block/title ?t]]`)).map(r => r[0]), choice.ident);
      await cellKind('Choice', choice.tag, chosen, choice.title, choice.ident, {
        opened: async () => (await page.evaluate(names => [...document.querySelectorAll('[role="menu"], [role="listbox"], [role="dialog"]')].some(m => m.getClientRects().length && names.filter(n => m.textContent.includes(n)).length >= 2), options)),
        write: async was => { const want = options.find(o => o !== was); await page.keyboard.type(want); await sleep(250); await page.keyboard.press('Enter'); await sleep(300); await page.keyboard.press('Escape'); return want; },
      });
    } else await problem('Choice: not present: no table of the graph shows a property with set choices');
    await page.keyboard.press('Escape'); await sleep(200);
    if (numberBack) { await kit.go(page, (kinds.find(k => k.tag !== home) || { tag: 'Contents' }).tag, 2000); await settleNumber(); }
    after = await kit.fingerprint(page);
    const diff = kit.differs(before, after);
    await check(!diff.length, 'every value typed was taken back: the graph is as it began, fact for fact', `the graph is not as it began: ${diff.slice(0, 3).map(d => `${d.what} “${d.words}” ${d.was.join(' ')} → ${d.now.join(' ')}`).join('; ')}`);

    // 1 again: off by the same button.
    await kit.go(page, home, 2500);
    await pressButton();
    const off = await waitFor(async () => { const s = await state(); return !s.rows && s.pressed === 'false' ? s : null; }, 2500) || await state();
    await check(!off.rows && off.pressed === 'false', 'pressed again, the Row view button turns the row view off', `pressed again, the row view stayed on (button pressed: ${off.pressed}, row view mark: ${off.rows})`);
    await check(off.ontFolded !== true, 'Ontology unfolds again', 'Ontology stayed folded after the row view went off');
    // The row's view the row view opened is closed by the plugin as the view goes off: how long it stands is measured, up to 8 s.
    const offAt = Date.now();
    const settled = await waitFor(async () => { const s = await state(); return JSON.stringify(s.stack) === JSON.stringify(stackBefore) && !s.sec && !s.picked.length ? s : null; }, 8000) || await state();
    const took = Date.now() - offAt;
    await check(JSON.stringify(settled.stack) === JSON.stringify(stackBefore) && !settled.sec && !settled.picked.length && took < 2500, `the sidebar's stack is as before (in ${took} ms): the row's view closed, no outline in the table`, `after the row view went off the sidebar's stack ${took >= 8000 ? 'is still not' : 'took ' + took + ' ms to be'} as before (${JSON.stringify(settled.stack)} against ${JSON.stringify(stackBefore)}${settled.picked.length ? ', a row still outlined' : ''})`);
    if (!off.rows) {
      const stackOff = (await state()).stack;
      at = await cellPoint(rowIds[2], 'Name');
      await page.mouse.click(at.x, at.y); await sleep(1200);
      const s4 = await state();
      await check(!s4.sec && !s4.picked.length && JSON.stringify(s4.stack) === JSON.stringify(stackOff), 'with the row view off, a press in the table opens nothing in the sidebar', `with the row view off, a press in the table still opened something in the sidebar (${s4.sec ? 'the row section; ' : ''}${s4.picked.length ? 'an outline; ' : ''}stack ${JSON.stringify(s4.stack)} where it was ${JSON.stringify(stackOff)})`);
      await page.keyboard.press('Escape'); await sleep(200); await page.keyboard.press('Escape'); await sleep(200);
      const after2 = kit.differs(after, await kit.fingerprint(page));
      if (after2.length) await problem(`the press with the row view off changed the graph: ${after2.slice(0, 2).map(d => d.words).join('; ')}`);
    }
  } catch (error) {
    if (error.message !== 'stop') await problem('the check stopped: ' + String(error.message || error).split('\n')[0]);
  } finally {
    // Left as found: the row view off, nothing open, the sidebar as it was, the page it started on.
    try {
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
      if ((await state()).rows) { await pressButton(); await sleep(1200); }
      if ((await state()).rows) await page.evaluate(() => document.querySelector('.lk-tool[data-on-click="rowView"]')?.click());
      if (await page.evaluate(() => location.hash) !== startHash) { await page.evaluate(hash => { location.hash = hash; }, startHash); await sleep(1500); }
      for (let i = 0; i < 3; i++) {
        const open = (await state()).open;
        if (open === startOpen) break;
        await page.evaluate(open => window.logseq.api.set_right_sidebar_visible(open), startOpen); await sleep(800);
      }
      const end = await state(), endHash = await page.evaluate(() => location.hash);
      if (end.rows || end.open !== startOpen || endHash !== startHash || end.popups || end.editing) { problems++; console.log(`PROBLEM: Logseq was not left as found (row view ${end.rows ? 'on' : 'off'}, sidebar ${end.open ? 'open' : 'shut'} where it was ${startOpen ? 'open' : 'shut'}, page ${endHash || 'home'} where it was ${startHash || 'home'}${end.popups ? ', a list open' : ''}${end.editing ? ', an editor open' : ''})`); }
    } catch (error) { console.log('PROBLEM: Logseq could not be left as found: ' + error.message); problems++; }
  }
  // 4. The console.
  const mine = kit.ours(said);
  await check(!mine.length, 'nothing from the plugin in the console', `the console said: ${mine.slice(0, 3).map(s => s.text.slice(0, 160)).join(' | ')}`);
  console.log(problems ? `row-view: FAILED (${problems})` : 'row-view: OK');
  console.log(`(${Math.round((Date.now() - t0) / 1000)} s)`);
  await browser.close();
  process.exit(problems ? 1 : 0);
})().catch(error => { console.log('row-view: cannot run: ' + String(error && error.message || error)); process.exit(2); });
