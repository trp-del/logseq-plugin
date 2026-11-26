/* BESIDE: the export's paper as sheets in the preview. The page's pieces dealt onto sheets of the paper's size with its
   margins, each with its footer and page number, as the print will break them: a paragraph, a list item, a picture or a
   table row stays whole, and a heading never ends a sheet unless what follows it needs a sheet of its own. Measured in the
   preview's own frame. The sheets can be written in: the pieces are moved onto them, not copied.
     sheets.paginate(doc, look)     deals the page (its .x-doc) onto sheets; look as core/paper.js takes it, with sizes
     sheets.gather(doc)             the page back in one piece, split lists and tables joined (a copy, for the export)
     sheets.repaginate(doc, look)   the sheets dealt again after writing, the caret kept */
(function () {
const G = window.PluginDoor;
const CSS = `:root { color-scheme: light; }
html, body { margin: 0; background: transparent; } body { padding: 0 20px 24px !important; } body:focus { outline: none; }
.sheet { position: relative; box-sizing: border-box; margin: 0 auto 24px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.12), 0 10px 36px rgba(0,0,0,.22); overflow: hidden; }
.sheet-body { height: 100%; overflow: hidden; display: flow-root; }
.sheet-foot { position: absolute; display: flex; justify-content: space-between; gap: 16px; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 8pt; color: #999; user-select: none; }`;
const HEADS = 'h1, h2, h3, h4, .x-head, .x-query';
const isHead = el => el.matches(HEADS) || (el.matches('li') && !!el.querySelector(':scope > strong:first-child'));
const el = (doc, tag, name) => { const made = doc.createElement(tag); if (name) made.className = name; return made; };

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
function paginate(doc, look) {
  const source = doc.querySelector('.x-doc');
  if (!source) return 0;
  const size = G.paper.sizes(look);
  if (!doc.getElementById('sheet-style')) { const style = el(doc, 'style'); style.id = 'sheet-style'; style.textContent = CSS; doc.head.appendChild(style); }
  const all = pieces(source);
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
      if (piece.n > 0) { wrap.dataset.goesOn = '1'; if (wrap.tagName === 'OL') wrap.start = piece.n + 1; }
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
    if (on > 1 && body.scrollHeight > body.clientHeight + 1) {
      let back = 1;   // this piece goes to the next sheet, with any heading that would be left at the foot of this one
      while (on - back > 0 && isHead(all[i - back].el)) back += 1;
      if (back === on) back = 1;   // nothing but headings before it: moved too, the same sheet would come again and again
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
function gather(doc, move = false) {
  const pages = [...doc.querySelectorAll('.sheet .x-doc')];
  if (!pages.length) return doc.querySelector('.x-doc');
  const out = pages[0].cloneNode(false), take = node => move ? node : node.cloneNode(true);
  for (const page of pages) for (const child of [...page.childNodes]) {
    if (child.nodeType !== 1) { out.appendChild(take(child)); continue; }
    const last = out.lastElementChild;
    if (child.dataset.goesOn && last && last.tagName === child.tagName) {
      const rows = child.tagName === 'TABLE' ? child.querySelector(':scope > tbody') : child, to = child.tagName === 'TABLE' ? last.querySelector(':scope > tbody') : last;
      for (const row of [...rows.children]) to.appendChild(take(row));
    } else { const node = take(child); node.removeAttribute('data-goes-on'); out.appendChild(node); }
  }
  return out;
}
function repaginate(doc, look) {
  const selection = doc.getSelection(), caret = selection?.rangeCount ? { node: selection.anchorNode, at: selection.anchorOffset } : null;
  const whole = gather(doc, true);
  for (const old of doc.querySelectorAll('.sheet')) old.remove();
  doc.body.appendChild(whole);
  const n = paginate(doc, look);
  if (caret?.node?.isConnected) { try { selection.collapse(caret.node, caret.at); } catch (error) { /* the caret is lost */ } }
  return n;
}
G.sheets = { paginate, gather, repaginate };
})();
