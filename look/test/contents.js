// The Contents tab's reading of a page's headings (links.js readHeads): order, one step in from the heading above, a link read as its name.
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const noop = () => {};
const window = { PluginDoor: {}, Look: { kit: { el: noop, style: noop, host: noop, watchScreen: noop, onGraphChange: noop, openPage: noop },
  settings: { setting: noop }, db: { query: async () => [['1a000000-0000-4000-8000-000000000013', 'Dr. Mei Chen', '']], UUID: /^[0-9a-f-]{36}$/ } } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../logseq/links.js'), 'utf8'), { window, logseq: {}, console, setTimeout });
const H = ':logseq.property/heading';
const tree = [
  { uuid: 'A', [H]: 1, title: 'Background' },
  { uuid: 'B', [H]: 1, title: 'Findings', children: [
    { uuid: 'x', title: 'not a heading' },
    { uuid: 'C', [H]: 3, title: 'Liver **bold**' },
    { uuid: 'D', [H]: 3, title: 'Lymph nodes', children: [{ uuid: 'E', [H]: 4, title: 'Compared with July\nsecond line' }] } ] },
  { uuid: 'F', [H]: 2, fullTitle: 'Questions for [[1a000000-0000-4000-8000-000000000013]]' },
  { uuid: 'G', [H]: true, title: 'Next steps' },
];
window.Look.links.readHeads(tree).then(heads => {
  assert.strictEqual(JSON.stringify(heads.map(h => [h.uuid, h.depth, h.number, h.title])), JSON.stringify([
    ['a', 0, '1', 'Background'], ['b', 0, '2', 'Findings'], ['c', 1, '2.1', 'Liver bold'], ['d', 1, '2.2', 'Lymph nodes'], ['e', 2, '2.2.1', 'Compared with July'],
    ['f', 1, '2.3', 'Questions for Dr. Mei Chen'], ['g', 0, '3', 'Next steps']]));
  console.log('ok: headings read in order, one step in from the heading above, links as names');
}).catch(error => { console.error(error); process.exit(1); });
