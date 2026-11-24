/* Reads well, and like Logseq (19 November 2026). The pictures say a screen changed; they cannot say the new screen is hard to
   read. The owner's complaints that no check saw, each measured here on every screen of the tour, on the page as it stands:
     past the edge     a piece of the plugin's runs past the window ("the sidebar ran past the window's edge", 17 Nov)
     cut off           words clipped by their own box with no … to say so
     too faint         words fainter than the library's faintest grey, --lk-off, 46% ("not even readable opacity", 31 Oct;
                       "the headers are translucent", 12 Nov)
     over each other   two pieces of words drawn on top of one another ("the + label covered tag and name", 12 Nov)
     out of line       rows of one list starting a few pixels apart ("you've made a mess of alignment", 9 Nov)
     empty row         a row with nothing in it ("why is there an empty line", 11 Nov)
     odd text size     a size neither the library's scale (12, 13, 14, 16) nor one Logseq uses on this screen ("text sizes still
                       differ", 6 Nov)
     unlike Logseq     the plugin's lines of words on a page at Logseq's own size but not its line height ("do what Logseq does
                       normally", 12 Nov)
   A finding is named by what it is, the piece and its first words, never by where it stands, so the same finding on the plugin as it
   was and as changed is one finding. The guard stops a change only for findings the change brought: what was there before is listed
   as known, to be fixed, and never fails an unchanged plugin. Measured twice, 600 ms apart; only what is found both times counts. */
const OWN = '[class*="lk-"],[class*="th-"],[class*="st-"],[class*="fd-"],[class*="td-"],[class*="xp-"],[class*="sw-"],[class*="sp-"]';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const once = page => page.evaluate(OWN => {
  const out = new Map(), W = innerWidth, H = innerHeight;
  const add = (kind, el, said) => { const key = kind + ' | ' + name(el) + ' | ' + words(el); if (!out.has(key) && out.size < 80) out.set(key, { kind, key, said: `${said}: ${name(el)}${words(el) ? ' “' + words(el) + '”' : ''}` }); };
  const name = el => el.tagName.toLowerCase() + '.' + String(el.className?.baseVal ?? el.className ?? '').trim().split(/\s+/).filter(c => !/^(is-|hover|active|selected|focus|on$|off$)/.test(c)).slice(0, 2).join('.');
  const words = el => (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 30);
  const ownText = el => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue).join('').replace(/\s+/g, ' ').trim();
  const shown = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W; };
  const alpha = color => { const m = String(color).match(/rgba\([^)]*,\s*([\d.]+)\s*\)$/) || String(color).match(/\/\s*([\d.]+%?)\s*\)$/); if (!m) return 1; return m[1].endsWith('%') ? parseFloat(m[1]) / 100 : parseFloat(m[1]); };
  const seen = el => { let a = alpha(getComputedStyle(el).color); for (let p = el; p && p.nodeType === 1; p = p.parentElement) a *= parseFloat(getComputedStyle(p).opacity || '1'); return a; };
  // Inside something that scrolls sideways on purpose (a table, a strip); Logseq's own page and sidebar are not such things.
  const scrollsSideways = el => { for (let p = el.parentElement; p; p = p.parentElement) { if (/^(main-content-container|app-container|root|right-sidebar|left-container|main-container)$/.test(p.id) || p === document.body || /cp__right-sidebar|sidebar-item-list|cp__sidebar-main/.test(String(p.className))) continue; const o = getComputedStyle(p).overflowX; if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth + 1) return true; } return false; };
  // Not under a window: what stands at the piece's middle is the piece, something in it, or something it is in (Find, the
  // settings window and the key sheet lie over the page, and the page's words under them are not on screen).
  const uncovered = el => { const r = el.getBoundingClientRect(), x = Math.min(W - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(H - 1, Math.max(0, r.top + Math.min(r.height / 2, 10))); const top = document.elementFromPoint(x, y); return !top || el.contains(top) || top.contains(el); };
  const own = [...document.querySelectorAll(OWN)].filter(el => shown(el) && uncovered(el));
  const isOwn = new Set(own);
  const worded = own.filter(el => words(el).length >= 3);
  // A piece that holds words itself: no other piece of the plugin's with words inside it.
  const holdsWords = el => words(el).length >= 3 && !worded.some(o => o !== el && el.contains(o));
  /* A line's box as far as it is drawn: what a scrolling list keeps out of sight is not on the screen, so it cannot lie over
     anything (24 November 2026: a row half under the foot of Find's window, scrolled out by the list, was read as "words drawn
     over" the foot's words). Each line is cut to every box above it that hides what runs past its edge. */
  const lines = el => {
    const clips = []; for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const c = getComputedStyle(p); if (/(hidden|clip|auto|scroll)/.test(c.overflowY + c.overflowX)) clips.push(p.getBoundingClientRect()); }
    return [...el.getClientRects()].map(r => { let left = r.left, top = r.top, right = r.right, bottom = r.bottom; for (const c of clips) { left = Math.max(left, c.left); top = Math.max(top, c.top); right = Math.min(right, c.right); bottom = Math.min(bottom, c.bottom); } return { left, top, right, bottom, width: right - left, height: bottom - top }; }).filter(r => r.width > 1 && r.height > 1);
  };
  const inOwn = el => { for (let p = el; p; p = p.parentElement) if (isOwn.has(p)) return true; return false; };

  // Logseq's own sizes for words on this screen, and its bullets' size and line height.
  const logseqSizes = new Set([12, 13, 14, 16]);
  // (Logseq's own pieces by their own names: Look puts marker classes on Logseq's containers, so 'not inside a piece of the plugin's' says nothing.)
  for (const el of document.querySelectorAll('.ls-block .block-content, .ls-page-title, .property-k, .property-value, .ls-table-cell, .ls-table-header-cell, .sidebar-item .sidebar-item-header, .nav-content-item, .cp__header a, .references .content, .ui__button, .ui__dropdown-menu-item')) { if (!shown(el)) continue; logseqSizes.add(Math.round(parseFloat(getComputedStyle(el).fontSize) * 10) / 10); }
  const bullet = [...document.querySelectorAll('.ls-page-blocks .ls-block .block-content')].find(el => shown(el) && words(el));
  const bulletSize = bullet && parseFloat(getComputedStyle(bullet).fontSize), bulletLine = bullet && parseFloat(getComputedStyle(bullet).lineHeight);

  const texts = [];
  for (const el of own) {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el), text = holdsWords(el) ? words(el) : '';
    if ((r.right > W + 2 || r.left < -2) && !scrollsSideways(el) && s.position !== 'fixed') add('past the edge', el, `runs past the window’s edge (to ${Math.round(r.right)} of ${W})`);
    if (words(el).length >= 3) {
      const clipsX = /hidden|clip/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 3 && s.textOverflow !== 'ellipsis';
      const clipsY = /hidden|clip/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 6 && !s.webkitLineClamp.match(/\d/);
      if (clipsX || clipsY) add('cut off', el, 'words cut off by their own box');
    }
    if (text.length >= 3) {
      texts.push([el, lines(el)]);
      const a = seen(el); if (a < 0.42) add('too faint', el, `words at ${Math.round(a * 100)}% (the faintest the library has is 46%)`);
      const size = Math.round(parseFloat(s.fontSize) * 10) / 10;
      if (!logseqSizes.has(size) && !/mono|code|kbd|pre/i.test(el.tagName + ' ' + s.fontFamily.slice(0, 40)) && !el.closest('h1,h2,h3')) add('odd text size', el, `words at ${size}px, a size neither the library nor Logseq has here`);
      if (bullet && el.closest('#main-content-container') && Math.abs(parseFloat(s.fontSize) - bulletSize) < 0.1 && isFinite(parseFloat(s.lineHeight)) && Math.abs(parseFloat(s.lineHeight) - bulletLine) > 2 && text.length > 12)
        add('unlike Logseq', el, `lines ${Math.round(parseFloat(s.lineHeight))}px apart where Logseq’s bullets are ${Math.round(bulletLine)}px`);
    }
    if (/(^|[\s-])(row|line|item)(\s|$)/.test(String(el.className?.baseVal ?? el.className)) && r.height >= 14 && r.width >= 60 && !words(el) && ![...el.querySelectorAll('*')].some(shown) && !/url\(/.test(s.backgroundImage))
      add('empty row', el, `a row ${Math.round(r.height)}px tall with nothing in it`);
  }
  // Two pieces of words on top of one another.
  const some = texts.slice(0, 350);
  for (let i = 0; i < some.length; i++) for (let j = i + 1; j < some.length; j++) {
    const [a, la] = some[i], [b, lb] = some[j];
    if (a.contains(b) || b.contains(a)) continue;
    // Line by line: a link that wraps onto two lines covers, as one box, whatever follows it on its last line.
    const over = la.some(ra => lb.some(rb => { const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top); return w >= 6 && h >= 6 && w * h > 0.3 * Math.min(ra.width * ra.height, rb.width * rb.height); }));
    if (over) add('over each other', a, `words drawn over “${words(b)}”`);
  }
  // Rows of one list a few pixels out of line: same parent, same name, one under another.
  const lists = new Map();
  for (const el of own) { if (!el.parentElement || !words(el)) continue; const k = name(el); let m = lists.get(el.parentElement); if (!m) lists.set(el.parentElement, m = new Map()); (m.get(k) || m.set(k, []).get(k)).push(el); }
  for (const m of lists.values()) for (const [, rows] of m) {
    if (rows.length < 3) continue;
    const rs = rows.map(el => el.getBoundingClientRect());
    if (new Set(rs.map(r => Math.round(r.top))).size < rows.length) continue;   // side by side, not a list
    const lefts = rs.map(r => r.left), gap = Math.max(...lefts) - Math.min(...lefts);
    if (gap >= 1 && gap <= 8) add('out of line', rows[0], `${rows.length} rows of one list start ${gap.toFixed(1)}px apart`);
  }
  return [...out.values()];
}, OWN);

async function measure(page) {
  const first = await once(page); await sleep(600);
  const keys = new Set((await once(page)).map(f => f.key));
  return first.filter(f => keys.has(f.key));
}

// What the change brought, screen by screen: findings on the plugin as changed that the plugin as it was does not have.
function brought(beforeRecords, afterRecords) {
  const news = [], known = [];
  for (const a of afterRecords) {
    const b = beforeRecords.find(x => x.name === a.name), had = new Set(((b && b.reads) || []).map(f => f.key));
    for (const f of a.reads || []) (b && b.reads && !had.has(f.key) ? news : known).push({ screen: a.name, ...f });
  }
  // One line for each kind of thing on a screen, not one for each row of a list: "words at 30%: a.td-words (7, first “Bloods tomorrow”)".
  const gather = list => { const by = new Map(); for (const f of list) { const piece = f.key.split(' | ')[1], k = f.screen + ' | ' + f.kind + ' | ' + piece; const g = by.get(k); if (g) g.n++; else by.set(k, { ...f, n: 1 }); } return [...by.values()].map(g => g.n > 1 ? { ...g, said: g.said + ` (and ${g.n - 1} more like it)` } : g); };
  return { news: gather(news), known: gather(known) };
}

module.exports = { once, measure, brought };
