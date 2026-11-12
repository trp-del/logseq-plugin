/* node tools/logseq-contract-app.js   (Logseq with its debugging port on a test graph, Playwright on NODE_PATH)
   The app half of test/logseq-contract.js (9 November 2026), read-only: what the plugin relies on in Logseq, looked at in the
   running Logseq rather than in its bundle.
     - every plugin call on the list answers in Logseq (its handler is on logseq.api);
     - every database name on the list is in Logseq's own schema: an entity of the open graph (a property, a class), else a name
       in the running app's database worker (a built-in such as :block/link, there whether or not a bullet of this graph uses it);
     - every Logseq class name on the list is drawn somewhere on a round of Logseq's own screens: a person's page, a tag's page,
       a journal day, a bullet focused into, All pages, the right sidebar. A class drawn only inside a menu or a dialog cannot be seen without opening
       one; those are said as not seen, for a person to look at, and do not fail.
   It goes back to the page it found at the end and leaves the right sidebar as it was. Nothing is typed and nothing is written.
   After a Logseq update: run this, look at the plugin in Logseq, then node test/logseq-contract.js --accept. */
const path = require('node:path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TEST_GRAPHS = (process.env.TEST_GRAPHS || 'Seed Check,Illness Test Graph,Stress Check').split(',').map(s => s.trim());
// The accepted list, or a list not accepted yet: node test/logseq-contract.js --print <file>, then this with <file>.
const list = require(process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '../test/logseq-contract.json'));
const styled = list.styled || [], inside = list.inside || [];
// Classes Logseq draws only in a menu, a dialog or a notice: not reachable on the round without pressing things.
const ONLY_ON_DEMAND = new Set(['absolute-modal', 'cp__select', 'cp__select-main', 'select-item', 'menu-link', 'menu-link-wrap', 'ui__dialog-overlay',
  'ui__dropdown-menu-item', 'ui__dropdown-menu-sub-trigger', 'ui__popover-content', 'ui__toast-close', 'cp__plugins-item-card', 'cp__right-sidebar-settings',
  'extensions__pdf-viewer', 'pdfViewer', 'jtrigger', 'escape', 'embed-block', 'custom-query', 'ls-table', 'ls-table-header', 'ls-table-header-cell', 'ls-view-head',
  'ls-block-properties',     // a block's properties drawn as rows, not pills: only where a page shows them so
  'ls-sidebar-page-properties',
  'hl-page', 'prefix-link',   // a quote taken from a PDF: only on a page that holds one
  'selected']);   // a bullet selected: only after a press   // a page opened in the right sidebar; since the sidebar became tabs (0.3.60) it may hold none
let chromium; try { ({ chromium } = require('playwright')); } catch (error) { console.log('skipped: needs Playwright (set NODE_PATH)'); process.exit(2); }

(async () => {
  let browser;
  try { browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 5000 }); } catch (error) { console.log('skipped: Logseq is not reachable on its debugging port'); process.exit(2); }
  const page = browser.contexts().flatMap(c => c.pages()).find(p => /index\.html/.test(p.url()));
  const graph = String(await page.evaluate(async () => (await window.logseq.api.get_current_graph())?.name || '')).replace(/^logseq_db_/, '');
  if (!TEST_GRAPHS.includes(graph)) throw new Error(`the open graph is “${graph}”, not a test graph; nothing was touched`);
  if (await page.evaluate(() => !!window.logseq.api.check_editing())) throw new Error('a block is being edited in Logseq; nothing was touched');
  const problems = [], notSeen = [];
  const version = await page.evaluate(async () => (await window.logseq.api.get_app_info?.())?.version || '');
  console.log(`Logseq ${version || '(version not given)'}, graph “${graph}”; the list was accepted with ${list.checkedWith}`);

  const snake = s => s.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
  const HOOKS = new Set(['onCurrentGraphChanged', 'onRouteChanged', 'onChanged']);
  const SDK_ONLY = new Set(['registerCommand', 'registerCommandPalette', 'registerPageMenuItem', 'registerUIItem', 'registerBlockContextMenuItem', 'registerSlashCommand', 'registerSidebarRenderer', 'registerRouteRenderer']);
  const handlers = await page.evaluate(() => Object.keys(window.logseq.api || {}));
  for (const name of list.api) {
    const fn = name.split('.')[1];
    if (HOOKS.has(fn) || SDK_ONLY.has(fn)) continue;   // hooks and registrations live in the plugin door, checked by the plugin starting at all
    const handler = { getInfo: 'get_app_info' }[fn] || snake(fn);
    if (!handlers.includes(handler)) problems.push(`the plugin call ${name} has no handler in this Logseq (logseq.api.${handler})`);
  }
  const idents = await page.evaluate(async () => (await window.logseq.api.datascript_query('[:find ?i :where [_ :db/ident ?i]]')).flat().map(String));
  const plainAttrs = new Set(['db/id', 'db/ident', 'db/cardinality', 'block/uuid', 'block/name', 'block/title', 'block/page', 'block/parent', 'block/order', 'block/refs', 'block/tags', 'block/alias', 'block/created-at', 'block/updated-at', 'block/journal-day', 'block/closed-value-property']);
  // Logseq's built-in names live in its database worker's schema, not as entities of the graph (10 November 2026: :block/link failed
  // on a graph where no bullet showed a page). The worker read is the installed app's, the one running.
  let worker = ''; try { worker = require(path.join(__dirname, '../threads/tools/logseq-bundle.js')).open()?.read('js/db-worker.js').toString('utf8') || ''; } catch (error) { worker = ''; }
  const inWorker = a => { const [ns, n] = a.split('/'); return worker.includes(`"${ns}","${n}","${a}"`) || worker.includes(`"${ns}","${n}"`); };
  for (const a of list.attributes) if (!plainAttrs.has(a) && !idents.some(i => i.replace(/^:/, '') === a) && !inWorker(a)) problems.push(`the database name :${a} is not in Logseq's schema (not in this graph, not in its database worker)`);

  const start = page.url(), sidebarWas = await page.evaluate(() => !!document.querySelector('#right-sidebar.open, .cp__right-sidebar.open'));
  const seen = new Set();
  const look = async () => { const found = await page.evaluate(classes => classes.filter(c => document.querySelector('.' + CSS.escape(c))), [...list.classes, ...styled]); found.forEach(c => seen.add(c)); };
  const go = async (route, args) => { await page.evaluate(([r, a]) => window.logseq.api.push_state(r, a), [route, args]); await sleep(1800); await look(); };
  await look();
  const journal = await page.evaluate(async () => (await window.logseq.api.datascript_query('[:find ?n :where [?p :block/journal-day ?d] [?p :block/name ?n] [(> ?d 20261001)]]'))?.[0]?.[0]);
  const tag = await page.evaluate(async () => (await window.logseq.api.datascript_query('[:find ?n :where [?t :block/tags :logseq.class/Tag] [?t :db/ident ?i] [(namespace ?i) ?ns] [(= ?ns "user.class")] [?t :block/name ?n]]'))?.[0]?.[0]);
  if (tag) await go('page', { name: tag });
  if (journal) await go('page', { name: journal });
  // A bullet focused into: the line of steps above it (.breadcrumb--block-page), which Look's glide reads.
  const inner = await page.evaluate(async () => ((await window.logseq.api.datascript_query('[:find ?u :where [?b :block/parent ?p] [?p :block/parent ?g] [?g :block/page _] [?b :block/uuid ?u]]')) || []).slice(0, 8).map(row => String(row[0])));
  // Not every bullet can be opened (one on a page in the Recycle cannot): the first that shows its line of steps.
  for (const uuid of inner) { await page.evaluate(u => { window.location.hash = '#/page/' + u; }, uuid); await sleep(1500); await look(); if (seen.has('breadcrumb--block-page')) break; }
  await go('all-pages');
  await page.evaluate(() => window.logseq.api.set_right_sidebar_visible?.(true)); await sleep(800); await look();
  await page.evaluate(was => window.logseq.api.set_right_sidebar_visible?.(was), sidebarWas);
  await page.goto(start).catch(() => {}); await sleep(1500);

  for (const c of list.classes) if (!seen.has(c)) (ONLY_ON_DEMAND.has(c) ? notSeen : problems).push(c);
  // A class only a stylesheet names (Look's calm theme restyles menus, dialogs, notices, the search window): seen where the round
  // draws it, said as not seen otherwise, never a failure, since most stand only in what opens on a press.
  const styledUnseen = styled.filter(c => !seen.has(c));
  // What the plugin reaches for inside Logseq's own window: its api by name, the Electron bridge, the parts of its state and config.
  const reach = await page.evaluate(names => names.map(item => { const kind = item.slice(0, item.indexOf('.')), name = item.slice(item.indexOf('.') + 1);
    try {
      if (kind === 'api') return typeof window.logseq.api[name] === 'function';
      if (kind === 'apis') return typeof window.apis?.[name] === 'function';
      if (name === 'shortcuts') { const v = window.logseq.api.get_current_graph_configs(name); return v == null || typeof v === 'object'; }
      const v = window.logseq.api.get_state_from_store(name); return v != null;
    } catch (error) { return false; } }), inside);
  inside.forEach((item, i) => { if (!reach[i]) problems.push(`${item} does not answer inside this Logseq's own window`); });
  console.log(`${list.api.length} plugin calls, ${list.attributes.length} database names, ${list.classes.filter(c => seen.has(c)).length} of ${list.classes.length} class names seen drawn; ${styled.length - styledUnseen.length} of ${styled.length} that only a stylesheet names; ${reach.filter(Boolean).length} of ${inside.length} reaches inside Logseq's window answer`);
  if (styledUnseen.length) console.log('restyled but not drawn on the round (a menu, a dialog, a notice, the search window; look at them by hand): ' + styledUnseen.map(c => '.' + c).join(' '));
  if (notSeen.length) console.log('not seen on the round (drawn only in a menu or dialog; look at them by hand): ' + notSeen.map(c => '.' + c).join(' '));
  const missing = problems.filter(p => !p.includes(' '));
  for (const p of problems) console.log('PROBLEM: ' + (p.includes(' ') ? p : `Logseq's class .${p} was not drawn on any screen of the round`));
  await browser.close().catch(() => {});
  if (problems.length) { console.log('logseq-contract-app: FAILED'); process.exit(1); }
  console.log('logseq-contract-app: OK');
})().catch(error => { console.error('logseq-contract-app:', error.message); process.exit(1); });
