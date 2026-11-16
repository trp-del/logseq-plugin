/* The record of every Apply, kept on this Mac so its Undo outlives Logseq (16 November 2026, step 1 of the tag upkeep plan:
   "Undo a merge days later"). Until then an Apply's way back was a list of functions in memory, gone when Logseq closed.

   A record is what Apply wrote and the way back, as data: the tags and properties it named (handles), the inverses in order,
   and the guards that keep an Undo from writing over what came after. It is written to the plugin's own storage folder
   (logseq.FileStorage, ~/.logseq/storages/logseq-plugin/) before the first write it covers, and again as the run goes, so a
   Logseq that quits halfway leaves a record that says how far it got. Kept for 30 days, then dropped.

   Files, per graph (its name made safe for a file name):
     st-rec-<graph>            the list: one short head per record, newest first
     st-rec-<graph>-<id>       the record's handles and guards
     st-rec-<graph>-<id>-<n>   its inverses, CHUNK at a time, so a long merge rewrites only the last few on each write
   A record's state: 'writing' (Apply running), 'done', 'undoing', 'undone'. One found 'writing' or 'undoing' when the plugin
   starts was cut off; it is marked 'cut' and its Undo waits in the Log. Nothing is written by the plugin on its own at start. */
(function () {
const S = window.Structure;
const KEEP_DAYS = 30, CHUNK = 25;
const DAY = 24 * 60 * 60 * 1000;
// The storage: Logseq's FileStorage in the app, a stand-in in the tests (S.recordStore).
const store = () => S.recordStore || logseq.FileStorage;
const safe = graph => String(graph).replace(/^logseq_db_/, '').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 80) || 'graph';
const listKey = graph => `st-rec-${safe(graph)}`;
const bodyKey = (graph, id) => `${listKey(graph)}-${id}`;
const chunkKey = (graph, id, n) => `${bodyKey(graph, id)}-${n}`;
const readJson = async (key, fallback) => { try { const text = await store().getItem(key); return text ? JSON.parse(text) : fallback; } catch (error) { return fallback; } };
const writeJson = (key, value) => store().setItem(key, JSON.stringify(value));
const drop = key => Promise.resolve(store().removeItem(key)).catch(() => {});

// The heads of a graph's records, newest first. Only one list per graph is read and written; writes wait for each other.
let queue = Promise.resolve();
const serial = fn => (queue = queue.then(fn, fn));
const heads = graph => readJson(listKey(graph), []);
const putHead = (graph, head) => serial(async () => {
  const list = (await heads(graph)).filter(h => h.id !== head.id);
  list.unshift({ id: head.id, at: head.at, text: head.text, state: head.state, steps: head.steps, of: head.of, left: head.left, chunks: head.chunks, touches: head.touches });
  list.sort((a, b) => b.at - a.at);
  await writeJson(listKey(graph), list);
});

/* A record being written or undone. For the tests and for a run with no graph name it lives in memory only (memory: true). */
function make({ graph, text, memory = false, id = Date.now() + Math.random().toString(36).slice(2, 6) }) {
  const rec = {
    id, graph, text, at: Date.now(), state: 'writing', steps: 0, of: 0,
    handles: {}, guards: {}, inverses: [], dirty: new Set(), next: 0, memory,
    // A handle's key, given the first time an inverse names it; the handle itself stays the one the steps change in place.
    key(h) { if (!h.$k) { h.$k = 'h' + (rec.next++); } rec.handles[h.$k] = h; return h.$k; },
    h(k) { return rec.handles[k]; },
    guard(spots) { const g = 'g' + (rec.next++); rec.guards[g] = { spots, stamp: null, verdict: null, said: false }; return g; },
    add(inv) { rec.inverses.push(inv); rec.dirty.add(Math.floor((rec.inverses.length - 1) / CHUNK)); },
    touched(i) { rec.dirty.add(Math.floor(i / CHUNK)); },
    left() { return rec.inverses.filter(x => !x.done).length; },
    // Everything changed since the last flush, on disk before the next write to the graph.
    // A disk that will not take it (the storage missing, full, refused) does not stop the change: the Undo then lives in memory
    // only, as before 16 November, and `lost` says so once, for the notice.
    async flush() {
      if (rec.memory) { rec.dirty.clear(); return; }
      const chunks = [...rec.dirty]; rec.dirty.clear();
      try {
        for (const n of chunks) await writeJson(chunkKey(graph, id, n), rec.inverses.slice(n * CHUNK, (n + 1) * CHUNK));
        await writeJson(bodyKey(graph, id), { handles: rec.handles, guards: rec.guards });
        await putHead(graph, rec.head());
      } catch (error) { console.error('Structure: the record could not be kept on this Mac', error); rec.memory = true; rec.lost = true; }
    },
    head() {
      const touches = [...new Set(Object.values(rec.handles).map(h => h.uuid).filter(Boolean))];
      return { id, at: rec.at, text: rec.text, state: rec.state, steps: rec.steps, of: rec.of, left: rec.left(), chunks: Math.ceil(rec.inverses.length / CHUNK), touches };
    },
  };
  return rec;
}

// A record read back from disk, to be undone. null when its files are gone.
async function load(graph, head) {
  const body = await readJson(bodyKey(graph, head.id), null);
  if (!body) return null;
  const rec = make({ graph, text: head.text, id: head.id });
  Object.assign(rec, { at: head.at, state: head.state, steps: head.steps, of: head.of, handles: body.handles || {}, guards: body.guards || {} });
  for (let n = 0; n < (head.chunks || 0); n++) {
    const part = await readJson(chunkKey(graph, head.id, n), null);
    if (!part) return null;   // a lost part: Undo would run out of order, so it does not run at all
    rec.inverses.push(...part);
  }
  rec.next = Object.keys(rec.handles).length + Object.keys(rec.guards).length + 1;
  return rec;
}

// The graph's records as the Log shows them: older than 30 days dropped with their files; one left 'writing' or 'undoing'
// by a Logseq that closed is marked 'cut' (running: the ids this session is running now, which are not cut).
async function list(graph, running = new Set()) {
  if (!graph) return [];
  let all = await heads(graph);
  const old = all.filter(h => Date.now() - h.at > KEEP_DAYS * DAY);
  if (old.length) {
    await serial(async () => writeJson(listKey(graph), (await heads(graph)).filter(h => !old.some(o => o.id === h.id))));
    for (const h of old) { await drop(bodyKey(graph, h.id)); for (let n = 0; n < (h.chunks || 0); n++) await drop(chunkKey(graph, h.id, n)); }
    all = all.filter(h => !old.includes(h));
  }
  const cut = all.filter(h => (h.state === 'writing' || h.state === 'undoing') && !running.has(h.id));
  for (const h of cut) { h.state = 'cut'; await putHead(graph, h); }
  return all;
}

// A later record that changed the same tags or properties, still not undone: it is undone first, or Undo would put back
// a tag under what came after it.
function laterOver(all, head) {
  const mine = new Set(head.touches || []);
  return all.filter(h => h.at > head.at && h.state !== 'undone' && h.left > 0 && (h.touches || []).some(u => mine.has(u))).sort((a, b) => a.at - b.at)[0] || null;
}

S.records = { make, load, list, laterOver, KEEP_DAYS };
})();
