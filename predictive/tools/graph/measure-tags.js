/* node tools/graph/measure-tags.js [name ...]
   How well does tag suggestion do on lines it has not seen the twin of? Runs test/graph/held-out.json (59 hand-written lines, each
   with the tag a careful reader would give it, or none) through the plugin's own rules in the running Logseq, on the graph that is
   open, once for each setting below. Reads only: nothing is written to the graph. Also gives the leave-one-out score of each
   setting on the graph's own lines, which has twins in it and flatters everything, so it is there to catch a setting that loses
   precision, not to rank settings.
   Needs the debugging port and Playwright (tools/app/door.js). Any graph named in TEST_GRAPHS; the held-out lines are about the
   Illness Test Graph's patient, so on another graph they mean little. */
const fs = require('node:fs');
const path = require('node:path');
const { connect, reload } = require('../app/door.js');

const lines = JSON.parse(fs.readFileSync(path.join(__dirname, '../../test/graph/held-out.json'), 'utf8')).lines;
// The settings to compare. limits go to the engine and the rules (core/engine.js DEFAULT_LIMITS).
// The three settings (logseq/app.js TAG_EAGERNESS), each with the vote alone (gap 0) and with the profile; then the gap on its own.
const CONFIGS = [];
for (const [name, near, lead, gap] of [['careful', .6, .7, 4], ['balanced', .3, .7, 3], ['eager', .25, .6, 2]]) {
  CONFIGS.push({ name: `${name}, vote only`, limits: { tagNearLeast: near, tagLead: lead, tagGap: 0 } });
  CONFIGS.push({ name: `${name} (gap ${gap})`, limits: { tagNearLeast: near, tagLead: lead, tagGap: gap } });
}
for (const gap of [1, 1.5, 2, 2.5, 3, 4, 5]) CONFIGS.push({ name: `profile only, gap ${gap}`, limits: { tagNearLeast: .99, tagGap: gap } });
const only = process.argv.slice(2);

async function run([lines, configs]) {
  const F = window.Flow, out = [];
  for (const cfg of configs) {
    const ctx = await F.db.readContext({ limits: cfg.limits });
    const rows = lines.map(l => {
      const bullet = { id: -1, uuid: '', text: l.text, tags: [], values: new Map(), page: null, parent: null };
      const piece = F.propose.propose(ctx, bullet).pieces.find(p => p.kind === 'tag');
      return { truth: l.tag, got: piece ? piece.tag.title : null, text: l.text };
    });
    const s = F.score.score(ctx, { sample: 1500 });
    out.push({ name: cfg.name, limits: cfg.limits, rows, loo: { tags: s.tags, plain: s.plain, props: s.properties }, entries: ctx.index.entries.length });
  }
  return out;
}

(async () => {
  const c = await connect();
  try {
    await reload(c);   // the plugin in the app must be the code on disk, or the settings below mean nothing
    const configs = CONFIGS.filter(x => !only.length || only.includes(x.name));
    const results = await c.frame().evaluate(run, [lines, configs]);
    console.log(`graph "${c.graph}", ${lines.length} held-out lines (${lines.filter(l => l.tag).length} with a tag, ${lines.filter(l => !l.tag).length} plain)\n`);
    const pad = (s, n) => String(s).padEnd(n);
    console.log(pad('setting', 26), '| held-out: right wrong silent | plain tagged | leave-one-out: right wrong silent | plain tagged');
    for (const r of results) {
      const tagged = r.rows.filter(x => x.truth), plain = r.rows.filter(x => !x.truth);
      const right = tagged.filter(x => x.got === x.truth).length, wrong = tagged.filter(x => x.got && x.got !== x.truth).length, silent = tagged.filter(x => !x.got).length;
      const spoke = plain.filter(x => x.got).length;
      console.log(pad(r.name, 26), '|', pad(`${right} / ${tagged.length}`, 9), pad(wrong, 6), pad(silent, 8), '|', pad(`${spoke} / ${plain.length}`, 12), '|', pad(r.loo.tags.right, 6), pad(r.loo.tags.wrong, 6), pad(r.loo.tags.silent, 8), '|', `${r.loo.plain.spoke} / ${r.loo.plain.spoke + r.loo.plain.silent}`);
    }
    if (process.env.DETAIL) {
      const r = results[results.length - 1];
      console.log(`\n"${r.name}", line by line (truth -> suggested):`);
      for (const x of r.rows) console.log(`${x.got === x.truth ? '  ok ' : x.got ? ' WRONG' : '  --- '} ${pad(x.truth || 'plain', 12)} -> ${pad(x.got || '(nothing)', 12)} ${x.text.slice(0, 70)}`);
    }
  } finally { await c.close(); }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
