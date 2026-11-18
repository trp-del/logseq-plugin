#!/usr/bin/env node
/* node words.js <plugin folder>   Goalpost lines 3.2, 3.5, 3.6 and 2.5, read from the plugin's shipped code (no Logseq needed).
   - 3.2 one name a part: what the page calls Linked must not be called Threads in a command or on screen; a command must not
     say "blocks" where the plugin says bullets.
   - 3.5 no button named OK or Apply alone.
   - 3.6 dotted grey (lk-pencil) only where Predictive guesses.
   - 2.5 no notice shows an error's raw message.
   Prints one count a rule, then each place. */
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(process.argv[2] || '.');
global.window = { addEventListener() {} };
require(path.join(root, 'files.js'));
const files = global.window.PluginFiles.filter(f => !/vendor/.test(f));
const lines = [];
for (const f of files) { let block = false; fs.readFileSync(path.join(root, f), 'utf8').split('\n').forEach((text, i) => { const t = text.trim(); if (block) { if (t.includes('*/')) block = false; return; } if (t.startsWith('/*')) { if (!t.includes('*/')) block = true; return; } if (t.startsWith('//') || t.startsWith('*')) return; lines.push({ f, n: i + 1, text: text.replace(/\s\/\/ .*$/, '') }); }); }
const strings = l => [...l.text.matchAll(/(['`"])((?:(?!\1)[^\\]|\\.){2,200})\1/g)].map(m => m[2]);
const hits = { names: [], ok: [], pencil: [], raw: [] };
for (const l of lines) {
  for (const s of strings(l)) {
    // The part is Relations since 17 November 2026: “Threads” or “Linked” shown anywhere is the old name back.
    if (/^(Threads|Linked)\b|\b(Threads|Linked)(’|') |\bThreads (works|cannot|draws|could|has|is|was|runs)\b|\bPart of Threads\b|^Linked$/.test(s) && !/Linked references/.test(s) && /label|registerCommand|notify|showMsg|title|textContent|innerHTML|`|'/.test(l.text) && !/console\.|window\.Threads|Threads\.|prefix: 'Relations/.test(l.text)) hits.names.push(`${l.f}:${l.n}  “${s.slice(0, 70)}” (the part is Relations)`);
    if (/\b(this|the selected|some|\d+) blocks?\b|\bblocks? chosen\b|^\$\{[^}]+\} blocks$/.test(s) && !/^(plugin\.js|settings\/ways-in\.js)$/.test(l.f)) hits.names.push(`${l.f}:${l.n}  “${s.slice(0, 70)}” (the plugin says bullets)`);
    if (/^(OK|Ok|Apply)$/.test(s) && /\bgo:\s*['"`](OK|Ok|Apply)['"`]|>(OK|Ok|Apply)<|textContent = ['"`](OK|Ok|Apply)/.test(l.text)) hits.ok.push(`${l.f}:${l.n}  a button named “${s}”`);
  }
  if (/data-(stage|yes)[^>]*>\s*(OK|Ok|Apply)\s*</.test(l.text)) hits.ok.push(`${l.f}:${l.n}  a question's yes named “${l.text.match(/data-(?:stage|yes)[^>]*>\s*(OK|Ok|Apply)\s*</)[1]}”`);
  if (/lk-pencil/.test(l.text) && !/^predictive\//.test(l.f) && !/^(plugin\.js|look\/logseq\/style\.js)$/.test(l.f) && !/^threads\//.test(l.f)) hits.pencil.push(`${l.f}:${l.n}`);
  if (/(notify|showMsg)\(/.test(l.text) && /\b(error|err|e)\??\.message/.test(l.text) && !/reason\(/.test(l.text)) hits.raw.push(`${l.f}:${l.n}`);
}
console.log(`two names: ${hits.names.length}`);
console.log(`named OK or Apply: ${hits.ok.length}`);
console.log(`dotted grey outside Predictive: ${hits.pencil.length}`);
console.log(`raw errors in notices: ${hits.raw.length}`);
// A question asked without a button name of its own would fall back to “OK” (threads/parts/shared.js ask).
for (const l of lines) if (/\bask\(\{/.test(l.text) && /^threads\//.test(l.f) && !/\bgo:/.test(l.text) && !/function ask/.test(l.text)) hits.ok.push(`${l.f}:${l.n}  a question with no button name of its own`);
console.log(`after the fallback rule, named OK or Apply: ${hits.ok.length}`);
for (const [k, v] of Object.entries(hits)) for (const h of v) console.log(`  ${k}  ${h}`);
console.log('RESULT ' + JSON.stringify({
  '3.2': { ok: hits.names.length === 0, said: hits.names.length ? `two names for one thing in ${hits.names.length} place(s): ${hits.names[0].slice(0, 120)}` : 'read from the code: every command carries its part\'s one name, and nothing shown says block' },
  '3.5': { ok: hits.ok.length === 0, said: hits.ok.length ? `${hits.ok.length} button(s) named OK or Apply, or a question with no name for its yes: ${hits.ok[0].slice(0, 120)}` : 'read from the code: no question\'s button is named OK, and every question names its own yes' },
  '3.6': { ok: hits.pencil.length === 0, said: hits.pencil.length ? `dotted grey outside Predictive's guesses in ${hits.pencil.length} place(s): ${hits.pencil[0].slice(0, 120)}` : 'read from the code: the dotted pencil is used for guesses only' },
  '2.5': { ok: hits.raw.length === 0, said: hits.raw.length ? `${hits.raw.length} notice(s) show a raw error: ${hits.raw[0].slice(0, 120)}` : 'read from the code: no notice shows a raw error' },
}));
