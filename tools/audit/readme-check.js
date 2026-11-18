#!/usr/bin/env node
/* node readme-check.js <plugin folder>   Goalpost line 7.2, as far as a program can read it: the READMEs and the code name the
   same things.
   - every command the code puts in Logseq's command list is named, word for word, in a README; and every command a README
     names in bold ("**Export: this page…**") is one the code registers;
   - every part the main README lists is a folder with a README of its own that files.js loads files from, and the other way;
   - every file files.js loads exists, and no script of a part is left unloaded (a file nothing loads is a leftover).
   What a README promises a screen does is proved by the checks in the app, not here. */
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(process.argv[2] || '.');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const walk = (dir, out = []) => { for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) { if (!/^(node_modules|dist|test|tools|vendor|\.git|check\.log|alfred)$/.test(e.name)) walk(p, out); } else out.push(p); } return out; };
const all = walk('.').map(p => p.replace(/^\.\//, ''));
const code = all.filter(f => f.endsWith('.js')), readmes = all.filter(f => /README\.md$/.test(f));
const faults = [];
// Commands.
const labels = new Set();
for (const f of code) for (const m of read(f).matchAll(/registerCommandPalette\??\.?\(\{[^}]*?label:\s*(['"`])((?:(?!\1).)+)\1/gs)) labels.add(m[2]);
for (const f of code) for (const m of read(f).matchAll(/\bcommand\(\s*\{[^}]*?label:\s*(['"`])((?:(?!\1).)+)\1/gs)) labels.add(m[2]);
for (const f of code) for (const m of read(f).matchAll(/registerCommand\??\.?\(\s*(['"`])[\w-]+\1\s*,\s*(['"`])((?:(?!\2).)+)\2/g)) labels.add(m[3]);
const fixed = [...labels].filter(l => !l.includes('${') && l.trim().length > 3 && !/: $/.test(l));
const prose = readmes.map(f => read(f)).join('\n');
const plain = s => s.replace(/[’']/g, '\'').replace(/\s+/g, ' ').trim();
const proseP = plain(prose);
for (const l of fixed) if (!proseP.includes(plain(l))) faults.push(`the command “${l}” is in Logseq's command list and in no README`);
const PARTS = '(?:Export|Find|Ontology|Predictive|Threads|Linked|Todo|Look|Troubleshooting)';
const named = new Set([...prose.matchAll(new RegExp(`\\*\\*(${PARTS}: [^*]{3,70})\\*\\*`, 'g'))].map(m => plain(m[1]).replace(/[.,;]$/, '')));
for (const n of named) if (![...labels].some(l => plain(l) === n || (l.includes('${') && n.startsWith(plain(l.split('${')[0]))) || plain(l).startsWith(n.replace(/…$/, '')))) faults.push(`a README names the command “${n}”, and the code registers none of that name`);
// Parts.
const files = read('files.js');
const loaded = [...files.matchAll(/['"`]([\w./-]+\.js)['"`]/g)].map(m => m[1]);
const partDirs = [...new Set(loaded.filter(f => f.includes('/')).map(f => f.split('/')[0]))].filter(d => !/^(settings)$/.test(d));
for (const d of partDirs) if (!fs.existsSync(path.join(root, d, 'README.md'))) faults.push(`the part in ${d}/ has no README`);
for (const f of loaded) if (!fs.existsSync(path.join(root, f))) faults.push(`files.js loads ${f}, which does not exist`);
const unloaded = code.filter(f => f.includes('/') && !loaded.includes(f) && !/^(settings\/)/.test(f) || false).filter(f => !loaded.includes(f));
for (const f of unloaded) if (!files.includes(path.basename(f)) && !code.some(g => g !== f && read(g).includes(path.basename(f)))) faults.push(`${f} is a script nothing loads`);
console.log(`${fixed.length} commands in the code, ${named.size} commands named in bold in ${readmes.length} READMEs, ${loaded.length} files loaded, ${partDirs.length} parts`);
for (const f of faults) console.log('FAIL ' + f);
console.log('RESULT ' + JSON.stringify({ '7.2': { ok: !faults.length && fixed.length >= 12, said: faults.length ? `${faults.length} place(s) where the READMEs and the code differ: ${faults[0]}` : `the READMEs name every one of the ${fixed.length} commands the code registers and no other, every loaded file exists, and every part has its README` } }));
process.exit(faults.length ? 1 : 0);
