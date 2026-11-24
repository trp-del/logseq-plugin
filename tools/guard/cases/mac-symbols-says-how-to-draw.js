/* The owner, 24 November 2026, after 0.5.5: "it says the symbols have not been drawn?". The symbols had been drawn on one Mac only;
   on the Mac the owner opened Logseq on there was no symbol file, the settings said so and stopped there, and the release carried
   no way to draw one. Where a Mac has not drawn its symbols, the settings' picture of "The Mac's symbols" says the one line to
   run in Terminal, and that line names a script that is really in the plugin's folder. */
const fs = require('node:fs'), path = require('node:path');
module.exports = {
  parts: ['shared', 'settings'],
  name: 'A Mac that has not drawn its symbols is told the one line that draws them, and the script it names is in the plugin',
  from: '24 Nov: “it says the symbols have not been drawn?”',
  graph: 'Illness Test Graph',
  async check(box, T) {
    const file = path.join(box.home, '.logseq', 'storages', 'logseq-plugin', 'mac-symbols.json');
    const had = fs.existsSync(file) ? fs.readFileSync(file) : null;
    try {
      fs.rmSync(file, { force: true });
      const seen = await box.frame().evaluate(async () => { await window.PluginDoor.symbols.read(); const d = window.PluginDoor.described.plugin, item = d.schema.find(i => i.key === 'macSymbols'); const el = document.createElement('div'); el.innerHTML = d.specimen(item, true); return { words: el.textContent, folder: String(logseq.baseInfo?.url || '') }; });
      const line = /sh (\S+tools\/mac-symbols\.sh)/.exec(seen.words);
      if (!/not drawn its symbols/.test(seen.words)) return { ok: false, said: 'with no symbol file, the settings do not say the symbols are not drawn' };
      if (!line) return { ok: false, said: 'the settings say the symbols are not drawn and do not say how to draw them' };
      const script = path.join(seen.folder, 'tools', 'mac-symbols.sh');
      if (!seen.folder.startsWith('/') || !fs.existsSync(script)) return { ok: false, said: 'the line names a script that is not in the plugin’s folder' };
      if (!/tools\/mac-symbols\.sh/.test(fs.readFileSync(path.join(seen.folder, 'tools', 'release.sh'), 'utf8'))) return { ok: false, said: 'the release’s zip does not carry the script the line names' };
      return { ok: true, said: `the settings say “${line[0]}”, and the script is in the plugin and in its release` };
    } finally { if (had) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, had); } await box.frame().evaluate(() => window.PluginDoor.symbols.read()).catch(() => {}); }
  },
};
