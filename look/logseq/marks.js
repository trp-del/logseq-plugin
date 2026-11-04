/* The index of every page's tags and the chains above them, read once and again when a page or a tag changes, for the
   parts that name pages by their tags (the title row's tag line, the right sidebar's list of links, grouped by the top-level
   tag). No tag is a kind of its own: since 4 November 2026 the top is whatever tags stand at the top of the graph. */
(function () {
const Look = window.Look;
const { host, onGraphChange } = Look.kit;
let reading = null, stopped = false;
async function load() {
  const asked = reading = Look.db.pageIndex();
  try { const found = await asked; if (asked !== reading || stopped) return; Look.index = found; Look.kit.run(host()); }
  catch (error) { console.error('Look: could not read the pages’ tags', error); }
}
function draw() {}
function start() {
  stopped = false;
  onGraphChange(pages => { if (pages && !stopped) load(); });
  load();
}
function stop() { stopped = true; reading = null; }
Look.marks = { start, stop, draw, load };
})();
