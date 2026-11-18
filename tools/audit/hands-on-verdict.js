#!/usr/bin/env node
/* node hands-on-verdict.js <plugin folder> [--dark]   Goalpost lines 2.1, 2.2 and 2.6 (and part of 4.4 and 7.8).
   Runs the plugin's own hands-on walk (tools/hands-on.js: real clicks and keys, the page itself measuring) in the checks' own
   Logseq and judges what it measured:
   2.1  typing: words typed into a bullet reach the screen in 50 ms a letter on average, each letter of a tag in 120 ms;
   2.2  nothing moves that was not moved: no layout shift without an input just before it, in any step; nothing left open;
   2.6  the plugin's own screens (Find, Todo, Ontology, two pages side by side, settings) answer in a tenth of a second (120 ms
        with one frame of slack) and no frame over 50 ms has the plugin's code in it;
   and that no step said anything in the console, crashed, showed a strong stray colour or stood past the window's edge. */
const fs = require('node:fs'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const { result } = require('./kit');
const plugin = path.resolve(process.argv[2] || ''), dark = process.argv.includes('--dark'), big = process.argv.includes('--big');
const r = spawnSync('node', ['tools/hands-on.js', ...(dark ? [] : ['--no-dark'])], { cwd: plugin, env: process.env, encoding: 'utf8', timeout: 900000, maxBuffer: 1 << 26 });
const out = (r.stdout || '') + (r.stderr || '');
console.log(out.trim().split('\n').slice(-30).join('\n'));
const base = path.join(plugin, 'dist', 'hands-on'), runs = fs.existsSync(base) ? fs.readdirSync(base).filter(n => fs.existsSync(path.join(base, n, 'results.json'))).sort() : [];
if (r.status !== 0 || !runs.length) { const said = 'the hands-on walk did not finish: ' + (out.trim().split('\n').pop() || 'no output').slice(0, 160); result({ '2.1': { ok: false, said }, '2.2': { ok: false, said }, '2.6': { ok: false, said } }); process.exit(1); }
const run = JSON.parse(fs.readFileSync(path.join(base, runs.pop(), 'results.json'), 'utf8')), steps = run.steps || [];
const OWN = /^(Find|Todo|Ontology|Split|Settings)/;
const typing = steps.filter(s => s.detail && (s.detail.wordsMeanMs != null || s.detail.tagLetters));
const slowWords = typing.filter(s => s.detail.wordsMeanMs > 50).map(s => `${s.name} ${s.detail.wordsMeanMs} ms a letter`);
const slowTag = typing.flatMap(s => (s.detail.tagLetters || []).filter(l => l.ms > 120).map(l => `“${l.ch}” ${l.ms} ms`));
const picked = typing.filter(s => s.detail.tag && !s.detail.picked).map(s => s.name + ': the tag was not taken');
const moved = steps.filter(s => (s.shifts?.unexpected || 0) > 0).map(s => `${s.name} (${s.theme}): ${(s.shifts.worst.find(w => !w.input)?.src || [''])[0]}`);
const open = steps.filter(s => (s.leftOpen || []).length).map(s => `${s.name}: ${s.leftOpen.join(', ')} left open`);
const slow = steps.filter(s => OWN.test(s.name) && s.responseMs > 120).map(s => `${s.name} (${s.theme}) ${s.responseMs} ms`);
const frames = steps.filter(s => (s.longFrames?.plugin || 0) > 0).map(s => `${s.name}: ${s.longFrames.plugin} long frame(s) with the plugin's code, worst ${s.longFrames.worst} ms`);
const errors = steps.filter(s => s.error || s.crashed || (s.errors || []).filter(e => !/net::ERR_/.test(JSON.stringify(e))).length).map(s => `${s.name}: ${s.error || (s.crashed ? 'Logseq said something went wrong' : JSON.stringify(s.errors[0]).slice(0, 120))}`);
// A colour that is all but black (rgb(2, 8, 23), Logseq's own text) is no stray colour: only one bright enough to be seen as a hue counts.
const hue = c => { const m = String(c).match(/\d+/g)?.map(Number) || []; return Math.max(...m.slice(0, 3)) > 60; };
const looks = steps.filter(s => s.looks && (s.looks.overflowX || Object.keys(s.looks.strong || {}).some(hue) || (s.looks.offRight || []).length)).map(s => `${s.name}: ${s.looks.overflowX ? 'wider than the window' : Object.keys(s.looks.strong || {}).some(hue) ? 'strong colour ' + Object.keys(s.looks.strong).find(hue) : 'past the right edge: ' + s.looks.offRight[0]}`);
const words = typing.map(s => s.detail.wordsMeanMs).filter(n => n != null);
for (const [k, v] of Object.entries({ slowWords, slowTag, picked, moved, open, slow, frames, errors, looks })) for (const line of v) console.log(`FAIL ${k}: ${line}`);
const also = [...errors, ...looks];
const verdicts = {
  '2.1': { ok: steps.length >= 9 && typing.length >= 1 && !slowWords.length && !slowTag.length && !picked.length && !errors.length, said: slowWords.length || slowTag.length || picked.length ? `typing was held up: ${[...slowWords, ...slowTag, ...picked].slice(0, 3).join('; ')}` : `words typed into a bullet reach the screen in ${Math.max(...words)} ms a letter at most, a tag's letters in ${Math.max(...typing.flatMap(s => (s.detail.tagLetters || []).map(l => l.ms)))} ms at most` },
  '2.2': { ok: steps.length >= 9 && !moved.length && !open.length && !also.length, said: moved.length || open.length || also.length ? `something moved by itself or was left open in ${moved.length + open.length + also.length} step(s): ${[...moved, ...open, ...also][0]}` : `${steps.length} steps by real clicks and keys: nothing moved without an input, nothing was left open` },
  '2.6': { ok: steps.length >= 9 && !slow.length && !frames.length, said: slow.length || frames.length ? `too slow to answer: ${[...slow, ...frames].slice(0, 3).join('; ')}` : `Find, Todo, Ontology, two pages side by side and settings answer in ${Math.max(...steps.filter(s => OWN.test(s.name)).map(s => s.responseMs))} ms at most; no long frame has the plugin's code in it` },
};
// On a very large graph the same walk is the proof that size brings nothing down and nothing waits.
if (big) verdicts['6.1'] = { ok: steps.length >= 9 && !errors.length && !slow.length && !frames.length && !slowWords.length, said: errors.length || slow.length || frames.length || slowWords.length ? `on ${run.graph} something gave way: ${[...errors, ...slow, ...frames, ...slowWords][0]}` : `on ${run.graph} the whole walk ran: every screen of the plugin answered in ${Math.max(...steps.filter(s => OWN.test(s.name)).map(s => s.responseMs))} ms at most, typing held at ${Math.max(...words)} ms a letter, memory ${run.memoryMB?.start ?? '?'} to ${run.memoryMB?.end ?? '?'} MB` };
result(verdicts);
// A verdict that does not hold ends the program with 1, so a runner reading only the exit code sees it too (18 November 2026).
process.exitCode = Object.values(verdicts).every(v => v.ok) ? 0 : 1;
