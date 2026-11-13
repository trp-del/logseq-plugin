/* In the list under a page's title, every property shows the icon of what it holds, before its name, where Logseq draws
   a grey dot in a button: the icon takes the dot's place, so nothing moves and a click does what Logseq's does. A property
   with an icon of its own keeps it; one the plugin does not know (Alias) keeps Logseq's. Under a node, a property is plain
   text (the owner, 2026-10-30): no icon in a node's rows of properties nor in the line of them under its words, only
   Logseq's dot and the name. A name Logseq has cut short shows whole as a tooltip under the pointer. */
(function () {
const Look = window.Look;
const { host, style, watchScreen, onGraphChange, kindIconHtml } = Look.kit, { setting } = Look.settings;
const css = `
.property-m[data-lk-kind] > :is(.bullet-container, .ls-icon-point-filled) { display: none; }
.property-m > .lk-kind { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; font-size: 15px; opacity: .5; }
`;
const ROWS = '.ls-page-properties .property-pair.property-panel-row[data-property-title]';
let byTitle = null, loading = null, stopped = false;
async function load() {
  const asked = loading = Look.db.propIndex();
  try { const found = await asked; if (asked !== loading || stopped) return; byTitle = found; draw(host()); }
  catch (error) { console.error('Look: could not read the properties’ kinds', error); }
}
const make = (doc, prop) => { const span = doc.createElement('span'); span.className = 'lk-kind lk-own'; span.innerHTML = kindIconHtml(prop.kind); span.dataset.kind = prop.kind + (prop.many ? '+' : ''); return span; };
// A long line of properties wraps: the first on each new line is marked, for the stylesheet to take its dot off.
function markLines(doc) {
  for (const strip of doc.querySelectorAll('.bottom-properties-pills-strip')) {
    let top = null;
    for (const pill of strip.children) {
      if (pill.offsetParent === null) { pill.removeAttribute('data-lk-line'); continue; }   // a hidden property sits on no line
      pill.toggleAttribute('data-lk-line', top !== null && pill.offsetTop > top + 4);
      top = pill.offsetTop;
    }
  }
}
function drawIcons(doc) {
  if (stopped || !byTitle) return;
  const on = setting('propertyIcons');
  for (const row of doc.querySelectorAll(ROWS)) {
    const button = row.querySelector(':scope > .property-key-panel .property-icon > .property-m');
    if (!button) continue;
    const prop = on ? byTitle.get(row.getAttribute('data-property-title')) : null;
    const dot = button.querySelector(':scope > :is(.bullet-container, .ls-icon-point-filled)');
    const want = prop && dot && !prop.icon ? prop.kind + (prop.many ? '+' : '') : '';
    let mine = button.querySelector(':scope > .lk-kind');
    if (!want) { if (mine) { mine.remove(); button.removeAttribute('data-lk-kind'); } continue; }
    if (mine?.dataset.kind === want) continue;
    mine?.remove();
    button.append(make(doc, prop));
    button.setAttribute('data-lk-kind', '');
  }
}
function draw(doc) { markLines(doc); drawIcons(doc); }
// The pointer on a property's name: if Logseq has cut it, the whole name as the tooltip (only names it cut; one it no
// longer cuts loses the tooltip again). Nothing is measured until the pointer is there.
function onOver(event) {
  if (!setting('propertyNameTips')) return;
  const name = event.target?.closest?.('.property-key-inner');
  if (!name) return;
  const cut = [name, ...name.querySelectorAll('*')].some(el => el.scrollWidth > el.clientWidth + 1);
  if (cut && !name.hasAttribute('title')) { name.setAttribute('title', name.textContent.trim()); name.setAttribute('data-lk-title', ''); }
  else if (!cut && name.hasAttribute('data-lk-title')) { name.removeAttribute('title'); name.removeAttribute('data-lk-title'); }
}
function start() {
  stopped = false;
  style('props', css);
  watchScreen(draw, drawIcons);
  Look.kit.listen(host().defaultView, 'mouseover', onOver);
  onGraphChange(pages => { if (pages && !stopped) load(); });
  load();
}
function stop() { stopped = true; loading = null; byTitle = null; }
// What the index knows of a property by its title ({ kind, many, icon }), or null while it is being read.
const prop = title => byTitle?.get(title) || null;
Look.props = { start, stop, draw, load, prop };
})();
