#!/usr/bin/env node
/* node inventory.js <out.json>   Reads from the running plugin in the checks' own Logseq (port 9333) what exists to be checked:
   the parts, every setting, every command Logseq lists for the plugin, the keys, the kinds of change, the menu lines the plugin
   adds. The audit and the coverage check (goalpost line 7.5) read this list. Read-only. */
const fs = require('node:fs');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:' + (process.env.LOGSEQ_PORT || 9555), { timeout: 8000 });
  const page = browser.contexts().flatMap(c => c.pages()).find(p => /index\.html/.test(p.url()));
  const frame = page.frames().find(f => f.url().includes('logseq-plugin'));
  const inside = await frame.evaluate(() => {
    const D = window.PluginDoor;
    const settings = [];
    for (const [part, d] of Object.entries(D.described || {})) for (const r of (d && d.schema) || []) if (r && r.key && r.type !== 'heading') settings.push({ part, key: r.key, type: r.type, title: r.title, default: r.default, place: r.place || null, choices: r.enumChoices || r.looks || null, description: r.description || '' });
    return {
      version: logseq.baseInfo?.version, parts: D.modules.map(m => m.key),
      settings, schemaKeys: (logseq.baseInfo?.settingsSchema || logseq.settingsSchema || []).map(s => s.key),
      writes: Object.keys(D.write), menuItems: (D.menuItems || []).map(m => ({ key: m.key, label: m.label })),
      motion: Object.keys(D.MOTION || {}), icons: Object.keys(D.ICONS || {}),
      commands: (D.logseqCommands ? D.logseqCommands() : []).filter(c => /logseq-plugin|plugin\./.test(JSON.stringify(c))).map(c => ({ id: c.id, label: c.label || c.desc, keys: c.keys || c.binding })),
    };
  });
  const outside = await page.evaluate(() => {
    const pl = window.LSPluginCore.registeredPlugins.get('logseq-plugin');
    const cmds = [];
    try { const st = window.frontend?.state; } catch (e) {}
    return { simple: Object.keys(pl?.caller?._callUserModel ? {} : {}), palette: [...document.querySelectorAll('.lk-tool')].map(a => a.title) };
  });
  const out = { at: new Date().toISOString(), ...inside, toolbar: outside.palette };
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
  console.log(`parts ${out.parts.length}, settings ${out.settings.length} (schema ${out.schemaKeys.length}), commands ${out.commands.length}, kinds of change ${out.writes.length}, menu lines ${out.menuItems.length}, motions ${out.motion.length}, icons ${out.icons.length}`);
  await browser.close();
})().catch(e => { console.error(String(e)); process.exit(1); });
