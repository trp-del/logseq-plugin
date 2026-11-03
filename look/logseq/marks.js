/* The index of every page's sort (Entity, Occurrence, Phenomena, Information, from its tags), read once and again when a
   page or a tag changes, for the parts that group or name pages by kind (the title row's tag line, the right sidebar's list
   of links). No mark is drawn for a sort any more: the owner took the marks off on 3 November 2026. */
(function () {
const Look = window.Look;
const { host, onGraphChange } = Look.kit;
let reading = null, stopped = false;
async function load() {
  const asked = reading = Look.db.pageIndex();
  try { const found = await asked; if (asked !== reading || stopped) return; Look.index = found; Look.kit.run(host()); }
  catch (error) { console.error('Look: could not read the pages’ sorts', error); }
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
