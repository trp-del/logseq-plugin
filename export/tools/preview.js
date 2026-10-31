/* Draws the sample document in every look and layout with Playwright's Chromium: a picture and a PDF of each, so the looks
   can be judged without Logseq. Playwright is not a dependency of the plugin: point NODE_PATH at a node_modules that has it.
     NODE_PATH=/Users/admin/logseq-value/logseq-plugin-old/node_modules node tools/preview.js <out dir> [look] [layout] */
const fs = require('node:fs'), path = require('node:path');
const E = require('../test/run-core.js');
const out = process.argv[2] || path.join(__dirname, '..', 'dist', 'preview');
fs.mkdirSync(out, { recursive: true });
const looks = process.argv[3] ? [process.argv[3]] : E.themes.looks.map(l => l.key);
const layouts = process.argv[4] ? [process.argv[4]] : E.doc.layouts.map(l => l.key);
const doc = E.sample();
const images = f => 'data:image/png;base64,' + fs.readFileSync(path.join('/Users/admin/logseq/graphs/Illness Test Graph', f)).toString('base64');
(async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  for (const look of looks) for (const layout of layouts) {
    const body = E.html.toHtml(doc, { layout, locale: 'en-GB', titleBlock: { date: 20261029, preparedBy: 'Ruth Okoro', kicker: 'Daniel Okoro · care notes' }, images: f => f.endsWith('.png') ? images(f) : f, under: 'user.property/hospital' });
    const css = E.themes.stylesheet(look, { footer: 'Confidential', pageNumbers: true, paper: 'A4' });
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${doc.title}</title><style>${css}</style></head><body><div class="x-doc">${body}</div></body></html>`;
    const name = `${look}-${layout}`;
    fs.writeFileSync(path.join(out, name + '.html'), html);
    await page.setContent(html);
    await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true });
    await page.pdf({ path: path.join(out, name + '.pdf'), preferCSSPageSize: true, printBackground: true });
    console.log('drew', name);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
