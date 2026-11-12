/* The printed page previewed as sheets: the document's blocks dealt onto pages of the paper's size with the chosen margins,
   each sheet with its footer and page number, as Chromium will break them (a paragraph, a list item, a figure or a row
   stays whole; a heading never ends a page, unless what follows it needs a sheet of its own). Measured in the preview's own document, so this file needs a screen; it
   knows nothing of Logseq. The sheets stay editable: the blocks are moved, not copied, and gather() puts them back in
   order (lists and tables that were split joined again) for the export. */
(function () {
const E = (window.DbExport ||= {});
const MM = 96 / 25.4;
const PAPERS = { A4: [210, 297], Letter: [215.9, 279.4] };   // mm
const HEADS = 'H1, H2, H3, H4, .x-head, .x-month, .x-query';
const isHead = el => el.matches?.(HEADS) || el.matches?.('li') && el.querySelector(':scope > strong:first-child');

function sizes({ paper, margins }) {
  const [pw, ph] = PAPERS[paper] || PAPERS.A4;
  const m = String(margins || '20mm 20mm 22mm').split(/\s+/).map(s => parseFloat(s) * MM);
  return { width: Math.round(pw * MM), height: Math.round(ph * MM), top: m[0], side: m[1] ?? m[0], bottom: m[2] ?? m[0] };
}
const el = (doc, tag, cls) => window.PluginDoor.el(doc, tag, { class: cls || null });

/* The blocks of a document as units that can move between pages: a list's items and a table's rows on their own, with
   the element they belong to (recreated on the next page, numbering kept). */
function unitsOf(src) {
  const units = [];
  for (const c of [...src.children]) {
    if (/^(UL|OL)$/.test(c.tagName)) [...c.children].forEach((li, n) => units.push({ el: li, wrap: c, n }));
    else if (c.tagName === 'TABLE') { const head = c.querySelector(':scope > thead'); [...c.querySelectorAll(':scope > tbody > tr')].forEach((tr, n) => units.push({ el: tr, wrap: c, head, n })); }
    else units.push({ el: c });
  }
  return units;
}

/* Deals the document (its .x-doc) onto sheets. opts: paper, margins (the look's "top sides bottom"), footer, pageNumbers. */
function paginate(doc, opts) {
  const src = doc.querySelector('.x-doc');
  if (!src) return;
  const s = sizes(opts);
  if (!doc.getElementById('pv-style')) {
    const style = el(doc, 'style'); style.id = 'pv-style';
    style.textContent = `html, body { margin: 0; background: transparent; } body { padding: 0 20px 24px !important; }
      .pv-page { position: relative; box-sizing: border-box; margin: 0 auto 24px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.12), 0 10px 36px rgba(0,0,0,.22); overflow: hidden; }
      .pv-body { height: 100%; overflow: hidden; }
      .pv-foot { position: absolute; display: flex; justify-content: space-between; font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 8pt; color: #999; pointer-events: none; }`;
    doc.head.appendChild(style);
  }
  const units = unitsOf(src);
  for (const p of doc.querySelectorAll('.pv-page')) p.remove();
  src.remove();
  const pages = [];
  let page, body, docEl, lastWrap = null, lastWrapSrc = null, onPage = 0;
  const newPage = () => {
    page = el(doc, 'div', 'pv-page'); page.style.cssText = `width:${s.width}px;height:${s.height}px;padding:${s.top}px ${s.side}px ${s.bottom}px`;
    body = el(doc, 'div', 'pv-body'); docEl = src.cloneNode(false); body.appendChild(docEl); page.appendChild(body); doc.body.appendChild(page); pages.push(page);
    lastWrap = lastWrapSrc = null; onPage = 0;
  };
  const place = u => {
    if (!u.wrap) { docEl.appendChild(u.el); lastWrapSrc = null; return; }
    if (lastWrapSrc !== u.wrap) {
      lastWrap = u.wrap.cloneNode(false); lastWrap.removeAttribute('data-pv-cont');
      if (u.n > 0) { lastWrap.dataset.pvCont = '1'; if (u.wrap.tagName === 'OL') lastWrap.start = (Number(u.wrap.getAttribute('start')) || 1) + u.n; }
      if (u.wrap.tagName === 'TABLE') { if (u.head) lastWrap.appendChild(u.head.cloneNode(true)); lastWrap.appendChild(el(doc, 'tbody')); }
      docEl.appendChild(lastWrap); lastWrapSrc = u.wrap;
    }
    (u.wrap.tagName === 'TABLE' ? lastWrap.lastElementChild : lastWrap).appendChild(u.el);
  };
  const takeBack = u => { const parent = u.el.parentElement; u.el.remove(); if (parent && parent !== docEl && !parent.children.length) parent.remove(); else if (parent?.tagName === 'TBODY' && !parent.children.length) parent.parentElement.remove(); if (parent && parent !== docEl && !parent.isConnected) lastWrapSrc = null; };
  const overflows = () => body.scrollHeight > body.clientHeight + 1;
  newPage();
  let i = 0;
  while (i < units.length) {
    if (onPage > 0 && units[i].el.classList?.contains('x-newsheet')) newPage();   // a title sheet, or a section that starts its own
    place(units[i]); onPage += 1;
    if (overflows() && onPage > 1) {
      let back = 1;   // this unit goes to the next page, with any heading that would be left at the foot of this one
      while (onPage - back > 0 && isHead(units[i - back].el)) back += 1;
      if (back === onPage) back = 1;   // nothing but headings before it: moved too, the same sheet would come again, for ever. They stay, and it goes on alone.
      for (let k = 0; k < back; k++) takeBack(units[i - k]);
      i = i - back + 1;
      newPage();
      continue;
    }
    i += 1;
  }
  pages.forEach((p, k) => {
    if (!opts.footer && !opts.pageNumbers) return;
    const f = el(doc, 'div', 'pv-foot'); f.contentEditable = 'false';
    f.style.cssText = `left:${s.side}px;right:${s.side}px;bottom:${Math.max(6, s.bottom / 2 - 6)}px`;
    f.innerHTML = `<span>${E.inline.escapeHtml(opts.footer || '')}</span><span>${opts.pageNumbers ? `${k + 1} / ${pages.length}` : ''}</span>`;
    p.appendChild(f);
  });
  return pages.length;
}

/* The document back in one piece from the sheets: a fresh .x-doc holding the blocks in order, split lists and tables
   joined. move: the blocks themselves are moved (for dealing them again), else copied (for the export). */
function gather(doc, { move = false } = {}) {
  const pages = [...doc.querySelectorAll('.pv-page .x-doc')];
  if (!pages.length) return doc.querySelector('.x-doc');
  const out = pages[0].cloneNode(false);
  const take = n => move ? n : n.cloneNode(true);
  for (const d of pages) for (const c of [...d.children]) {
    const last = out.lastElementChild;
    if (c.dataset.pvCont && last && last.tagName === c.tagName) {
      const from = c.tagName === 'TABLE' ? c.querySelector(':scope > tbody') : c, to = c.tagName === 'TABLE' ? last.querySelector(':scope > tbody') : last;
      for (const item of [...from.children]) to.appendChild(take(item));
    } else { const n = take(c); n.removeAttribute('data-pv-cont'); if (n.tagName === 'OL' && n.dataset.pvStart == null) { /* its own start stays */ } out.appendChild(n); }
  }
  return out;
}
/* Deals the sheets again after an edit, keeping the caret where it was. */
function repaginate(doc, opts) {
  const sel = doc.getSelection();
  const caret = sel && sel.rangeCount ? { node: sel.anchorNode, offset: sel.anchorOffset } : null;
  const whole = gather(doc, { move: true });
  for (const p of doc.querySelectorAll('.pv-page')) p.remove();
  doc.body.appendChild(whole);
  const n = paginate(doc, opts);
  if (caret && caret.node?.isConnected) { try { sel.collapse(caret.node, caret.offset); } catch (error) { /* the caret is lost */ } }
  return n;
}
/* A part of the sheet lit, while its name is pointed at in the export window (part: its class without the x-, or nothing to put the light out). */
function light(doc, part) {
  if (!doc.getElementById('pv-lit')) { const style = el(doc, 'style'); style.id = 'pv-lit'; style.textContent = '.pv-lit { outline: 1.5px solid #c26a00 !important; outline-offset: 1px; background-color: #fff1d6 !important; }'; doc.head.appendChild(style); }
  for (const lit of doc.querySelectorAll('.pv-lit')) lit.classList.remove('pv-lit');
  const parts = part ? [...doc.querySelectorAll(`.x-${part}`)] : [];
  for (const one of parts) one.classList.add('pv-lit');
  parts[0]?.scrollIntoView?.({ block: 'nearest' });
}
E.preview = { light, paginate, gather, repaginate, sizes, PAPERS };
})();
