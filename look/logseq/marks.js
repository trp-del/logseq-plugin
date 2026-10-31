/* The marks of the four sorts: before a link in the words or in a property's value, and in a page's icon slot (left of its
   title, and in the left sidebar's lists) until an icon is set. A page's sort comes from its tags through one index of
   every page, read once and again when a page or a tag changes, never per link. The mark before a link is drawn by the
   link itself (an attribute, a picture in its own room at its start), so nothing is added to Logseq's markup and the mark
   can never be left at a line's end with its link on the next. */
(function () {
const Look = window.Look;
const { host, style, watchScreen, onGraphChange, markUrl, markSvg, el } = Look.kit, { setting } = Look.settings;
// A picture takes no currentColor, so the grey is set for each theme (Logseq's text colour at about half).
const GREY = { light: 'rgba(2,8,23,.46)', dark: 'rgba(229,231,235,.5)' };
const SORTS = ['entity', 'occurrence', 'phenomenon', 'information'];
const css = `
/* Before a link: a step smaller than the words, centred on them, in the link's own room at its start. */
:is(a.page-ref, .lk-node)[data-lk-sort] { padding-left: calc(8px + .3em); background-repeat: no-repeat; background-size: 8px 8px; background-position: 0 50%; -webkit-box-decoration-break: slice; box-decoration-break: slice; }
${['light', 'dark'].map(theme => SORTS.map(sort => `${theme === 'dark' ? 'html[data-theme="dark"]' : 'html:not([data-theme="dark"])'} :is(a.page-ref, .lk-node)[data-lk-sort="${sort}"] { background-image: ${markUrl(sort, GREY[theme])}; }`).join('\n')).join('\n')}
/* In a page's icon slot. Logseq 2.0.2 draws an icon you set as a box before the title and moves the title right; with none
   set, the 24 px slot at the title's left holds only the hidden fold arrow. The mark sits in that slot, so the title stays
   where it is on every page, set icon or not. */
.is-page-title-row > .block-control-wrap:has(> .lk-page-mark) { position: relative; }
.lk-page-mark { position: absolute; inset: 0; display: inline-flex; align-items: center; justify-content: center; color: var(--lk-quiet); pointer-events: none; }
.lk-page-mark svg { width: 15px; height: 15px; }
/* In the left sidebar's lists: Logseq's plain page icon gives way to the mark, and where a page has none, to an empty slot
   (a box in the column of marks would read as a fifth kind). A tag's # and an icon the person set are not touched. */
#left-sidebar a.link-item .page-icon[data-lk-sort] :is(.ls-icon-file, .ls-icon-page) { visibility: hidden; }
#left-sidebar a.link-item .page-icon[data-lk-sort] { background-repeat: no-repeat; background-size: 11px 11px; background-position: center; }
${['light', 'dark'].map(theme => SORTS.map(sort => `${theme === 'dark' ? 'html[data-theme="dark"]' : 'html:not([data-theme="dark"])'} #left-sidebar a.link-item .page-icon[data-lk-sort="${sort}"] { background-image: ${markUrl(sort, GREY[theme])}; }`).join('\n')).join('\n')}`;

let index = null, reading = null, stopped = false;
async function load() {
  const asked = reading = Look.db.pageIndex();
  try { const found = await asked; if (asked !== reading || stopped) return; index = found; Look.index = found; draw(host()); }
  catch (error) { console.error('Look: could not read the pages’ sorts', error); }
}
const AREA = ':is(#main-content-container, #right-sidebar)';
const LINKS = `${AREA} a.page-ref[data-uuid]:not(.tag), .lk-node[data-uuid]`;
function markLinks(doc) {
  const on = setting('linkMarks') && index;
  for (const a of doc.querySelectorAll(on ? LINKS : '[data-lk-sort]:is(a.page-ref, .lk-node)')) {
    // lk-bare: a name under a head that names its kind; the head has said it, so no mark.
    const want = on && !a.classList.contains('lk-bare') ? index.sortByUuid(a.getAttribute('data-uuid')) : null;
    if (want) { if (a.getAttribute('data-lk-sort') !== want) a.setAttribute('data-lk-sort', want); }
    else if (a.hasAttribute('data-lk-sort')) a.removeAttribute('data-lk-sort');
  }
}
/* The icon slot. Logseq 2.0.2 draws a set icon inside the title row, before the title's words; with none set there is
   nothing there but the hidden "Add icon" words above. The mark goes at the row's start when the page has no icon of its
   own (no icon element in the row). */
const TITLE_ROWS = '#main-content-container .ls-page-title .is-page-title-row, #right-sidebar .ls-page-title .is-page-title-row';
function markTitles(doc) {
  const on = setting('pageMark') && index;
  for (const row of doc.querySelectorAll(TITLE_ROWS)) {
    const block = row.closest('.ls-page-title')?.querySelector('.ls-block[blockid]') || row.querySelector('[blockid]');
    const uuid = block?.getAttribute('blockid') || '';
    const slot = row.querySelector(':scope > .block-control-wrap');
    const ownIcon = row.querySelector('.ls-page-icon');
    const want = on && uuid && slot && !ownIcon ? index.sortByUuid(uuid) : null;
    let mine = row.querySelector('.block-control-wrap > .lk-page-mark');
    if (!want) { mine?.remove(); continue; }
    if (mine?.dataset.sort === want) continue;
    mine?.remove();
    mine = el(doc, 'span', { class: 'lk-page-mark lk-own', 'data-sort': want, 'aria-hidden': 'true', html: markSvg(want) });
    slot.prepend(mine);
  }
}
function markLists(doc) {
  const on = setting('pageMark') && index;
  for (const item of doc.querySelectorAll(on ? '#left-sidebar a.link-item' : '#left-sidebar a.link-item .page-icon[data-lk-sort]')) {
    const icon = on ? item.querySelector('.page-icon:has(.ls-icon-file, .ls-icon-page)') : item;
    if (!icon) continue;
    const name = on ? (item.getAttribute('data-page-name') || (item.querySelector('.page-title') || item.querySelector('.title'))?.textContent || '').trim() : '';
    const want = on ? index.sortByName(name) || 'none' : null; // none: the slot kept empty
    if (want) { if (icon.getAttribute('data-lk-sort') !== want) icon.setAttribute('data-lk-sort', want); }
    else if (icon.hasAttribute('data-lk-sort')) icon.removeAttribute('data-lk-sort');
  }
}
function draw(doc) { if (stopped) return; markLinks(doc); markTitles(doc); markLists(doc); }

function start() {
  stopped = false;
  style('marks', css);
  watchScreen(draw);
  onGraphChange(pages => { if (pages && !stopped) load(); });
  load();
}
function stop() { stopped = true; reading = null; index = null; }
Look.marks = { start, stop, draw, load };
})();
