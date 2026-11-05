// Captures the tag map as the plugin draws it now (0.4.456, the outline), for the views page: the real parts/tags.js and its helpers
// run in Playwright's Chromium, their queries answered by Logseq's command line from the Illness Test Graph, and the
// drawn markup of the Tags view and of the Properties view (Provider opened) is written to <dir>/tagmap-tags.html and
// <dir>/tagmap-props.html, which build-views.js puts on its sheets. Nothing is written to the graph.
// Run from the repo root after prepare.js: node tools/pages/capture-tagmap.js <scratch dir>
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const dir = process.argv[2];
if (!dir) { console.error('usage: node tools/pages/capture-tagmap.js <scratch dir>'); process.exit(1); }
const CLI = process.env.HOME + '/.local/bin/logseq', GRAPH = process.env.GRAPH || 'Illness Test Graph';
const cache = new Map();
const ask = q => {
  if (!cache.has(q)) cache.set(q, JSON.parse(execFileSync(CLI, ['query', '-g', GRAPH, '-o', 'json', '--timeout-ms', '120000', '--query', q], { maxBuffer: 1 << 28 }).toString()).data?.result ?? []);
  return cache.get(q);
};
const src = f => fs.readFileSync(f, 'utf8');
// How a property reads on the other page: its own name, the two-way part's default since 0.4.444.
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  page.on('pageerror', e => console.log('page error', e.message));
  await page.exposeFunction('cliQuery', q => ask(q));
  await page.route('http://map.test/', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div id="at"></div></body></html>' }));
  await page.goto('http://map.test/');
  await page.addScriptTag({ content: `const settings = { tagTreeRoots: '', twoWayNames: '', twoWayOneEnd: '', propertyGroups: '' };
    window.parent = window;
    window.logseq = { settings, updateSettings: o => Object.assign(settings, o), DB: { datascriptQuery: q => window.cliQuery(q), onChanged: () => () => {} }, UI: { showMsg() {} }, App: { pushState() {} }, Editor: {} };
    window.Threads.core = { provided: { backwardsLabel: name => name, setBackwards() {}, shownAtOtherEnd: () => true, setShownAtOtherEnd() {} } };` });
  for (const f of ['parts/shared.js', 'parts/model.js']) await page.addScriptTag({ content: src(f) });
  await page.addScriptTag({ content: require(path.resolve('tools/pretend-model')) });
  for (const f of ['parts/tags-graph.js', 'parts/tags-props.js']) await page.addScriptTag({ content: src(f) });
  await page.addScriptTag({ content: src('parts/tags.js').replace(/\}\)\(\);\s*$/, 'window.__createView = createView; window.__css = css; })();') });
  const out = await page.evaluate(async () => {
    const style = document.createElement('style'); style.textContent = window.Threads.shared.kitCss + window.__css; document.head.append(style);
    const view = window.__createView(document, 'page'); document.getElementById('at').append(view.node);
    await view.refresh();
    const wait = ms => new Promise(r => setTimeout(r, ms));
    // The outline (0.4.456): Occurrence and Consultation opened, Provider walked on to Doctor; then Provider's own lines.
    const line = name => [...document.querySelectorAll('.rtg-outline .rtg-tagline')].find(l => l.querySelector('.rtg-name')?.textContent === name);
    for (const name of ['Occurrence', 'Consultation']) { line(name)?.querySelector('[data-fold]')?.click(); await wait(600); }
    const provider = () => [...document.querySelectorAll('.rtg-outline .rf-ol-leads')].find(l => /Provider/.test(l.textContent));
    provider()?.querySelector('[data-walk]')?.click(); await wait(1200);
    const out = {};
    out.tags = view.node.outerHTML;
    provider()?.querySelector('[data-walk]')?.click(); await wait(600);
    provider()?.querySelector('[data-pchev]')?.click(); await wait(1500);
    out.props = view.node.outerHTML;
    return out;
  });
  await browser.close();
  fs.writeFileSync(path.join(dir, 'tagmap-tags.html'), out.tags);
  fs.writeFileSync(path.join(dir, 'tagmap-props.html'), out.props);
  console.log('captured the tag map from', GRAPH, Math.round(out.tags.length / 1024), '+', Math.round(out.props.length / 1024), 'KB');
})().catch(e => { console.error(e); process.exit(1); });
