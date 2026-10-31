/* In the list under a page's title, every property shows the icon of what it holds, before its name, where Logseq draws
   a grey dot in a button: the icon takes the dot's place, so nothing moves and a click does what Logseq's does. A property
   with an icon of its own keeps it; one the plugin does not know (Alias) keeps Logseq's. Under a node, a property is plain
   text (the owner, 2026-10-30): no icon in a node's rows of properties nor in the line of them under its words, only
   Logseq's dot and the name. */
(function () {
const Look = window.Look;
const { host, style, watchScreen, onGraphChange, kindIconHtml } = Look.kit, { setting } = Look.settings;
const css = `
.property-m[data-lk-kind] > :is(.bullet-container, .ls-icon-point-filled) { display: none; }
.property-m > .lk-kind { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; font-size: 15px; opacity: .5; }
.lk-icon.lk-web svg { width: 12px; height: 12px; }
/* Threads (and DB Refinements) draw the same icon in the same place; where Look has drawn its own, theirs steps aside, so
   running both never shows an icon twice. */
.property-m:has(> .lk-kind) > :is(.rf-kind, .rf-drawn) { display: none !important; }`;
const ROWS = '.ls-page-properties .property-pair.property-panel-row[data-property-title]';
let byTitle = null, loading = null, stopped = false;
async function load() {
  const asked = loading = Look.db.propIndex();
  try { const found = await asked; if (asked !== loading || stopped) return; byTitle = found; draw(host()); }
  catch (error) { console.error('Look: could not read the properties’ kinds', error); }
}
const make = (doc, prop) => { const span = doc.createElement('span'); span.className = 'lk-kind lk-own'; span.innerHTML = kindIconHtml(prop.kind); span.dataset.kind = prop.kind + (prop.many ? '+' : ''); return span; };
function draw(doc) {
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
function start() {
  stopped = false;
  style('props', css);
  watchScreen(draw);
  onGraphChange(() => { if (!stopped) load(); });
  load();
}
function stop() { stopped = true; loading = null; byTitle = null; }
Look.props = { start, stop, draw };
})();
