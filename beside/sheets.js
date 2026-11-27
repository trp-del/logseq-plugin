/* BESIDE: the export's paper as sheets in the preview. The page's pieces dealt onto sheets of the paper's size with its
   margins, each with its footer and page number, as the print will break them: a paragraph, a list item, a picture or a
   table row stays whole, and a heading never ends a sheet unless what follows it needs a sheet of its own. A piece higher
   than a sheet (a bullet with a hundred bullets under it, a paragraph of a hundred lines) begins where it stands and goes
   on over the next sheets, as it prints: the items under it one by one, its words line by line. Measured in the
   preview's own frame. The sheets can be written in: the pieces are moved onto them, not copied.
     sheets.paginate(doc, look)     deals the page (its .x-doc) onto sheets; look as core/paper.js takes it, with sizes
     sheets.gather(doc)             the page back in one piece, what went on over several sheets joined (a copy, for the export)
     sheets.repaginate(doc, look)   the sheets dealt again after writing, the caret kept
     sheets.PAPER                   the paper's white and the shadow it lies under, for whatever shows the paper */
(function () {
const G = window.PluginDoor;
const PAPER = { white: '#fff', shadow: '0 1px 2px rgba(0,0,0,.12), 0 10px 36px rgba(0,0,0,.22)' };
/* A piece that goes on over the next sheet: what stays of it (data-cut) ends flush with the sheet's foot, a justified line at
   the foot stays justified, and what goes on (data-goes-on) begins flush with the next sheet's top, an item without a second
   bullet. A table that goes on at the page's top level keeps the gap it had above it before this was written. */
const CSS = `:root { color-scheme: light; }
html, body { margin: 0; background: transparent; } body { padding: 0 20px 24px !important; } body:focus { outline: none; }
.sheet { position: relative; box-sizing: border-box; margin: 0 auto 24px; background: ${PAPER.white}; box-shadow: ${PAPER.shadow}; overflow: hidden; }
.sheet-body { height: 100%; overflow: hidden; display: flow-root; }
[data-cut] { margin-bottom: 0 !important; } [data-cut="open"], [data-cut="words"] { padding-bottom: 0 !important; } [data-cut="words"] { text-align-last: justify; }
[data-goes-on]:not(table), [data-goes-on] table[data-goes-on] { margin-top: 0 !important; padding-top: 0 !important; } li[data-goes-on] { list-style: none; }
.sheet-foot { position: absolute; display: flex; justify-content: space-between; gap: 16px; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 8pt; color: #999; user-select: none; }`;
const HEADS = 'h1, h2, h3, h4, .x-head, .x-query';
const isHead = el => el.matches(HEADS) || (el.matches('li') && !!el.querySelector(':scope > strong:first-child'));
const el = (doc, tag, name) => { const made = doc.createElement(tag); if (name) made.className = name; return made; };
// The last element of one, whatever blank text stands after it.
const lastOf = el => { let node = el.lastChild; while (node && node.nodeType === 3 && !node.data.trim()) node = node.previousSibling; return node?.nodeType === 1 ? node : null; };

// The pieces that can move between sheets: a list's items and a table's rows on their own, with what they belong to.
function pieces(page) {
  const out = [];
  for (const child of [...page.children]) {
    if (/^(UL|OL)$/.test(child.tagName)) [...child.children].forEach((item, n) => out.push({ el: item, wrap: child, n }));
    else if (child.tagName === 'TABLE') { const head = child.querySelector(':scope > thead'); [...child.querySelectorAll(':scope > tbody > tr')].forEach((row, n) => out.push({ el: row, wrap: child, head, n })); }
    else out.push({ el: child });
  }
  return out;
}
/* What of a piece higher than a sheet goes over the sheet's foot (limit), taken out of it and given back as the piece that goes
   on: the same element again, marked data-goes-on, holding what did not fit. As Chromium prints it (tried on 27 November
   2026): words go line by line; a part the paper keeps whole (an item, a paragraph: break-inside avoid) goes over whole
   when something stands before it, however high it is, and is broken on the next sheet; with nothing before it, or only
   headings, and higher than a sheet (full), it is broken where it stands; a list or a table is broken at any item. Null where
   nothing of the piece would stay on this sheet, or it cannot be broken (a picture, a table's row). cuts keeps where words
   were cut. */
const WHOLE = 'tr, thead, img, figure, svg, br, hr', NEAR = .05;   // what is never broken; how far under the foot still counts as on the sheet
const cuts = new Map();   // a text cut in two at the last dealing: its first part -> its second
function lineAt(range, text, limit, lead) {
  const foot = i => { range.setStart(text, 0); range.setEnd(text, i + 1); return range.getBoundingClientRect().bottom + lead; };
  let lo = 0, hi = text.length - 1;
  if (hi < 0 || foot(hi) <= limit) return 0;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (foot(mid) > limit) hi = mid; else lo = mid + 1; }
  // A word the line broke with a hyphen of its own making goes over whole: that hyphen is the line's, not the words'.
  const said = text.data, word = /\S/.test(said[lo]) && lo > 0 && /[^\s\-–—/]/.test(said[lo - 1]) ? said.slice(0, lo).search(/\s\S*$/) + 1 : 0;
  return word > 0 ? word : lo;
}
function cut(el, limit, full) {
  if (el.matches(WHOLE)) return null;
  const doc = el.ownerDocument, view = doc.defaultView, range = doc.createRange(), kids = [...el.childNodes];
  const box = node => { if (node.nodeType === 1) return node.getBoundingClientRect(); if (node.nodeType !== 3) return null; range.selectNodeContents(node); return range.getBoundingClientRect(); };
  const takes = node => !(node.nodeType === 1 && node.tagName === 'THEAD') && (box(node)?.height || 0) > 0;
  const inline = node => view.getComputedStyle(node).display === 'inline', whole = node => /avoid/.test(view.getComputedStyle(node).breakInside);
  const k = kids.findIndex(node => takes(node) && box(node).bottom > limit + NEAR);
  if (k < 0) return null;
  const over = kids[k], before = kids.slice(0, k).filter(takes), stays = before.length > 0, clean = before.some(node => !(node.nodeType === 1 && isHead(node)));
  let more = null, words = over.nodeType === 3;
  if (words) {
    range.selectNodeContents(over);
    const line = range.getClientRects()[0]?.height || 0, lead = Math.max(0, ((parseFloat(view.getComputedStyle(el).lineHeight) || line) - line) / 2);
    const at = lineAt(range, over, limit + NEAR, lead);
    if (at > 0) { more = over.splitText(at); cuts.set(over, more); }
  } else if (!over.matches(WHOLE) && (inline(over) || !whole(over) || (!clean && over.getBoundingClientRect().height > full))) { more = cut(over, limit, full); words = !!more && inline(over); }
  let from = k + 1;   // the first of the nodes that go over whole
  if (!more) {
    if (!stays) return null;
    from = k;   // it goes over whole, with any heading that would be left at the foot
    if (clean) for (let j = k - 1; j > 0; j--) { const node = kids[j]; if (node.nodeType !== 1 || !takes(node)) continue; if (isHead(node)) from = j; else break; }
  }
  const rest = el.cloneNode(false); rest.removeAttribute('data-cut'); rest.dataset.goesOn = '1';
  if (el.tagName === 'OL') rest.start = el.start + kids.slice(0, from).filter(node => node.nodeType === 1).length - (more ? 1 : 0);
  if (el.tagName === 'TABLE') { const head = el.querySelector(':scope > thead'); if (head) rest.appendChild(head.cloneNode(true)); }
  if (more) rest.appendChild(more);
  for (const node of kids.slice(from)) rest.appendChild(node);
  el.dataset.cut = words && !inline(el) && view.getComputedStyle(el).textAlign === 'justify' ? 'words' : 'open';
  // What stands last at the foot ends flush with it: the gap under it is the sheet's, as in print.
  if (!more) for (let last = lastOf(el); last; last = lastOf(last)) last.dataset.cut ||= '1';
  return rest;
}
function paginate(doc, look) {
  const source = doc.querySelector('.x-doc');
  if (!source) return 0;
  const size = G.paper.sizes(look);
  if (!doc.getElementById('sheet-style')) { const style = el(doc, 'style'); style.id = 'sheet-style'; style.textContent = CSS; doc.head.appendChild(style); }
  const all = pieces(source);
  cuts.clear();
  for (const old of doc.querySelectorAll('.sheet')) old.remove();
  source.remove();
  const sheets = [];
  let body, page, wrap = null, from = null, on = 0;
  const next = () => {
    const sheet = el(doc, 'div', 'sheet'); sheet.style.cssText = `width:${size.width}px;height:${size.height}px;padding:${size.top}px ${size.side}px ${size.bottom}px`;
    body = el(doc, 'div', 'sheet-body'); page = source.cloneNode(false); body.appendChild(page); sheet.appendChild(body); doc.body.appendChild(sheet); sheets.push(sheet);
    wrap = from = null; on = 0;
  };
  const place = piece => {
    if (!piece.wrap) { page.appendChild(piece.el); from = null; return; }
    if (from !== piece.wrap) {
      wrap = piece.wrap.cloneNode(false); wrap.removeAttribute('data-goes-on');
      if (piece.n > 0 || piece.more) { wrap.dataset.goesOn = '1'; if (wrap.tagName === 'OL') wrap.start = piece.n + 1; }
      if (wrap.tagName === 'TABLE') { if (piece.head) wrap.appendChild(piece.head.cloneNode(true)); wrap.appendChild(el(doc, 'tbody')); }
      page.appendChild(wrap); from = piece.wrap;
    }
    (wrap.tagName === 'TABLE' ? wrap.lastElementChild : wrap).appendChild(piece.el);
  };
  const takeBack = piece => {
    const parent = piece.el.parentElement; piece.el.remove();
    if (parent && parent !== page && !parent.children.length) { const whole = parent.tagName === 'TBODY' ? parent.parentElement : parent; whole.remove(); from = null; }
  };
  next();
  for (let i = 0; i < all.length;) {
    place(all[i]); on += 1;
    if (body.scrollHeight > body.clientHeight + 1) {
      let back = 1;   // this piece goes to the next sheet, with any heading that would be left at the foot of this one
      while (on - back > 0 && isHead(all[i - back].el)) back += 1;
      const lone = back === on, full = body.clientHeight;   // nothing but headings before it on this sheet
      /* Higher than a sheet, with nothing before it to break after: it begins here, and what goes over the foot is the next
         piece, first on the next sheet. After anything else it goes to the next sheet first, as it prints. */
      const rest = lone && (on === 1 || all[i].el.getBoundingClientRect().height > full) ? cut(all[i].el, body.getBoundingClientRect().bottom, full) : null;
      if (rest) { if (all[i].wrap) wrap.dataset.cut = '1'; all.splice(i + 1, 0, { ...all[i], el: rest, more: true }); i += 1; next(); continue; }
      if (on === 1) { i += 1; continue; }   // it cannot be broken: it stays, cut at the foot
      if (lone) back = 1;   // nothing but headings before it: moved too, the same sheet would come again and again
      for (let k = 0; k < back; k++) takeBack(all[i - k]);
      i = i - back + 1;
      next();
      continue;
    }
    i += 1;
  }
  if (look.footer || look.pageNumbers) sheets.forEach((sheet, k) => {
    const foot = el(doc, 'div', 'sheet-foot'); foot.contentEditable = 'false';
    foot.style.cssText = `left:${size.side}px;right:${size.side}px;bottom:${Math.max(6, size.bottom / 2 - 6)}px`;
    foot.append(Object.assign(el(doc, 'span'), { textContent: look.footer || '' }), Object.assign(el(doc, 'span'), { textContent: look.pageNumbers ? `${k + 1} / ${sheets.length}` : '' }));
    sheet.appendChild(foot);
  });
  return sheets.length;
}
const goesOn = (node, last) => node?.nodeType === 1 && !!node.dataset.goesOn && !!last && last.tagName === node.tagName;
const plain = node => { if (node.nodeType === 1) node.removeAttribute('data-goes-on'); return node; };
// A piece that goes on from the sheet before, put back into the one it continues: a list's items, a table's rows, a paragraph's words.
function join(to, part, take) {
  if (part.tagName === 'TABLE') { const rows = part.querySelector(':scope > tbody'), into = to.querySelector(':scope > tbody'); if (rows && into) { join(into, rows, take); return; } }
  const [first, ...others] = [...part.childNodes];
  if (goesOn(first, lastOf(to))) join(lastOf(to), first, take); else if (first) to.appendChild(plain(take(first)));
  for (const node of others) to.appendChild(take(node));
}
function gather(doc, move = false) {
  const pages = [...doc.querySelectorAll('.sheet .x-doc')];
  if (!pages.length) return doc.querySelector('.x-doc');
  const out = pages[0].cloneNode(false), take = node => move ? node : node.cloneNode(true);
  for (const page of pages) for (const child of [...page.childNodes]) {
    if (goesOn(child, lastOf(out))) join(lastOf(out), child, take); else out.appendChild(plain(take(child)));
  }
  for (const el of out.querySelectorAll('[data-cut], [data-goes-on]')) { el.removeAttribute('data-cut'); el.removeAttribute('data-goes-on'); }   // nothing of the sheets is left in the page
  return out;
}
function repaginate(doc, look) {
  const selection = doc.getSelection(), caret = selection?.rangeCount ? { node: selection.anchorNode, at: selection.anchorOffset } : null;
  const whole = gather(doc, true);
  for (const old of doc.querySelectorAll('.sheet')) old.remove();
  doc.body.appendChild(whole);
  const n = paginate(doc, look);
  // Words cut in two at a sheet's foot: the caret follows its letter into the part that went over.
  while (caret?.node?.nodeType === 3 && caret.at > caret.node.length && cuts.has(caret.node)) { caret.at -= caret.node.length; caret.node = cuts.get(caret.node); }
  if (caret?.node?.isConnected) { try { selection.collapse(caret.node, caret.at); } catch (error) { /* the caret is lost */ } }
  return n;
}
G.sheets = { paginate, gather, repaginate, PAPER };
})();
