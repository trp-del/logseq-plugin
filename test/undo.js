/* node test/undo.js   (needs jsdom: NODE_PATH, see README)
   The arrow that waits at the bottom right (the audit's 12, 10 November 2026): it waits only on the page its change was made on,
   goes for good once the node it changed is gone from the graph, and stands left of the right sidebar, never on its words. */
const assert = require('node:assert');
let standIn; try { standIn = require('../look/test/stand-in.js'); } catch (error) { console.log('skipped: needs jsdom (set NODE_PATH)'); process.exit(2); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const r = await standIn.load(); await sleep(100);
  const { doc, door, logseq } = r, win = doc.defaultView, undo = door.undo;
  const docked = key => doc.querySelector(`.lk-undo-dock [data-lk-undo="${key}"]`);
  let alive = true;
  const B1 = standIn.U(901), P1 = standIn.U(902), fake = logseq.DB.datascriptQuery;
  let fails = false;
  logseq.DB.datascriptQuery = async q => !/deleted-at/.test(q) ? fake(q) : fails ? Promise.reject(new Error('not ready')) : alive && q.includes(B1) ? [[1]] : q.includes(P1) ? [[2]] : [];
  win.location.hash = '#/page/Dr.%20Mei%20Chen?graph-id=1';
  undo.offer({ owner: 'predictive', key: 'fill', at: () => null, node: B1, text: 'Provider: Dr. Mei Chen', run: async () => {} });
  assert.ok(docked('fill'), 'with nothing of the change on screen the arrow waits at the bottom right');
  // The right sidebar opens: the dock stands left of it.
  const side = doc.createElement('div'); side.id = 'right-sidebar'; side.className = 'cp__right-sidebar'; doc.body.appendChild(side);
  side.getBoundingClientRect = () => ({ width: 360, left: 0, right: 360, top: 0, bottom: 0, height: 0 });
  undo.draw();
  assert.strictEqual(doc.querySelector('.lk-undo-dock').style.right, '380px', 'the waiting arrow stands left of the open right sidebar');
  side.classList.add('closed'); undo.draw();
  assert.strictEqual(doc.querySelector('.lk-undo-dock').style.right, '20px', 'with the sidebar closed it is back at the corner');
  // Another page: the arrow no longer waits; back on the page, it is there again.
  win.location.hash = '#/page/Oct%2023rd%2C%202026?graph-id=1'; undo.draw();
  assert.ok(!docked('fill') && !doc.querySelector('.lk-undo-dock'), 'on another page the arrow from this one does not wait');
  assert.ok(undo.has('fill'), 'the change can still be taken back where it was made');
  win.location.hash = '#/page/dr.%20mei%20chen?graph-id=2'; undo.draw();
  assert.ok(docked('fill'), 'back on the page (in other capitals, the graph query aside) the arrow waits again');
  // The node it changed is deleted: the arrow goes for good.
  alive = false; await sleep(1200);
  assert.ok(!undo.has('fill') && !docked('fill'), 'once the bullet is gone from the graph its arrow goes');
  // A look-up that fails says nothing: the arrow stays.
  fails = true;
  undo.offer({ owner: 'look', key: 'tag', at: () => null, node: P1, text: 'Doctor taken off this page', run: async () => {} });
  await sleep(1200);
  assert.ok(undo.has('tag') && docked('tag'), 'a failed look-up keeps the arrow');
  undo.clear();
  console.log('undo: every check passed (waits on its own page, left of the sidebar, goes with its node)');
  process.exit(0);
})().catch(error => { console.error(error.message); process.exit(1); });
