/* One-off, run before the plugin's first start: the settings of the six plugins this one replaces, read from Logseq's
   settings folder and written as this plugin's own, so nothing has to be set again.
     node tools/merge-settings.js
   Later files win where two hold the same key (Predictive over the keys an old Threads left behind). Nothing is deleted;
   an existing logseq-plugin.json is kept as logseq-plugin.json.before. */
const fs = require('node:fs'), path = require('node:path');
const dir = path.join(process.env.HOME, '.logseq', 'settings');
const OLD = ['logseq-threads', 'logseq-db-export', 'logseq-structure', 'logseq-predictive', 'logseq-find', 'logseq-look'];
const merged = { disabled: false };
for (const id of OLD) {
  const file = path.join(dir, id + '.json');
  if (!fs.existsSync(file)) { console.log('no settings for', id); continue; }
  const { disabled, ...rest } = JSON.parse(fs.readFileSync(file, 'utf8'));
  Object.assign(merged, rest);
  console.log('took', Object.keys(rest).length, 'settings from', id);
}
const out = path.join(dir, 'logseq-plugin.json');
if (fs.existsSync(out)) fs.copyFileSync(out, out.replace(/\.json$/, '.json.before'));
fs.writeFileSync(out, JSON.stringify(merged, null, 2) + '\n');
console.log('wrote', out, 'with', Object.keys(merged).length - 1, 'settings');
