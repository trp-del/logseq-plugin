/* The Ontology section of Logseq's right sidebar, beside a tag's page (8 and 12 November 2026; once called the inspector, and the
   names here keep that). It is a panel Logseq hosts (mount.js): it holds a tag's lines that do not stand above the page's title,
   Child tags, Beside and Relationships (main.js places the 'tag' view there while the panel is shown). On any other page, a
   property's included, it has nothing to show and stands aside (mount.js, sidebar-tabs.js).
   Until 24 November 2026 this file also drew the row view, the row pressed in a table shown as a section of the sidebar, and a
   property's lines stood here; the owner dropped both. A press on a table row is Logseq's alone. */
(function () {
const S = window.Structure;
const ROW = '#main-content-container .ls-table-row[blockid]';
const insp = { holder: null, top: null, node: null, stops: [], pageAt: 0 };

// Shown: the panel is in the page and drawn (Logseq's sidebar open and the panel not folded).
const shown = () => !!(insp.holder?.isConnected && insp.holder.getClientRects().length);
const top = () => (shown() ? insp.top : null);

// One faint line says what the panel is waiting for, or nothing when the lines above already fill it.
function idle() {
  const box = insp.node; if (!box) return;
  const doc = box.ownerDocument, lines = !!insp.top?.querySelector('.st-lines-t');
  /* Between two tags' pages Logseq has no table for a moment and gives the panel a new holder: said from what stood there in that
     moment, the line went and came back within a quarter of a second (seen frame by frame, 12 November 2026). For the first 700 ms
     of a page that has the lines, the table is taken as coming; then it is asked again and said as it is. */
  const settling = Date.now() - insp.pageAt < 700;
  const table = !!doc.querySelector(ROW) || (settling && lines);
  if (settling && !idle.again) idle.again = doc.defaultView.setTimeout(() => { idle.again = 0; idle(); }, 720);
  if (settling && !lines && !table && !insp.plain) return;   // nothing is known of the page yet: no line said, so none is pushed down when the tag's lines come (a 260 px jump, the motion check, 12 November 2026)
  const say = table || lines ? '' : 'Open a tag’s page to see it here.';
  if (box.textContent === say) return;
  box.innerHTML = say ? `<p class="st-insp-none lk-none">${say}</p>` : '';
}
function start() {
  const offRoute = S.base.onStop(logseq.App.onRouteChanged?.(() => { insp.pageAt = Date.now(); insp.plain = false; }));
  insp.stops = [offRoute];
}
function stop() { for (const s of insp.stops) { try { s?.(); } catch (error) { /* already gone */ } } insp.stops = []; if (insp.holder) insp.holder.innerHTML = ''; insp.watch?.disconnect(); }

// Logseq gives the panel a holder: the line that says what it waits for, and the place of the tag's lines.
function mounted(holder) {
  const doc = holder.ownerDocument;
  S.view.ensureStyle(doc);
  holder.innerHTML = '<div class="st st-tag st-insp-node"></div><div class="st-insp-top"></div>';
  insp.holder = holder; insp.node = holder.firstChild; insp.top = holder.lastChild; insp.pageAt = Date.now();
  // Logseq's sidebar hidden or the panel folded leaves the holder in the page with no size: the lines are taken out, and put back when it shows.
  let was = shown();
  insp.watch?.disconnect();
  insp.watch = doc.defaultView.ResizeObserver && new doc.defaultView.ResizeObserver(() => { if (shown() !== was) { was = shown(); S.inspector.changed?.(); } });
  insp.watch?.observe(holder);
  idle();
  S.inspector.changed?.();
}
function gone(holder) { if (insp.holder !== holder) return; insp.watch?.disconnect(); insp.holder = insp.top = insp.node = null; S.inspector.changed?.(); }

/* The page is read: no tag's (plain), so the section's line need not wait, and the Ontology section is not shown. Between two
   pages the last answer stands until the next is read, so walking from tag to tag never takes the section away for a moment. */
function pageKnown(plain) {
  const was = insp.plain; insp.plain = !!plain; if (plain && !was) idle();
  if (insp.applies !== !plain) { insp.applies = !plain; window.PluginDoor.sideTabs?.draw(); }
}
S.inspector = { start, stop, mounted, gone, top, shown, idle, pageKnown, applies: () => !!insp.applies, KEY: 'structure-inspector', model: null, changed: null };
})();
