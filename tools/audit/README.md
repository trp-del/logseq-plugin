# tools/audit

The 0.4 audit's checks (16–17 November 2026), brought into the plugin's git on 18 November 2026 from
`logseq-value/reports/release-0.4/tools`, where they stood outside it. Each drives a Logseq of the checks' own, never the
owner's: its own home folder, profile and debugging port, a throwaway copy of a test graph, a copy of the plugin.

Read from the environment, nothing hard-coded:

| Setting | What | Default |
|---|---|---|
| `LOGSEQ_PORT` | the debugging port of the checks' own Logseq | 9555 |
| `NODE_PATH` | where Playwright and jsdom are | this plugin's `node_modules` |
| `TEST_GRAPHS_ROOT` | where the test graphs are made and copied from | `~/logseq-test-graphs` |
| `AUDIT_OUT` | where `faults.js` writes `faults.json` | the run's folder |

The ones everything starts from:

- `make-graphs.sh` builds the three test graphs (Illness Test Graph, Stress Check, Scale Check) from `threads/test/*.py` and `fixtures.edn`.
- `fresh.js <dir> [--plugin <folder>] [--graphs …]` makes a home under `<dir>`, copies the graph and the plugin, starts that
  Logseq (`own-logseq.js`), switches Apple's tools off, loads the plugin and guards the Mac (clipboard, Finder, print window).
- `own-logseq.js start <dir> | info | stop <dir>` starts it, says what runs, stops it. `stop` needs the folder and reads the port
  written there, so a stop can never close another run's Logseq.
- `kit.js` is what every check shares: `connect()` refuses any graph that is not such a copy; the RESULT line a runner reads.
- `prep.js`, `load-plugin.js`, `reload-plugin.js`, `resync.js` get the copy ready, (re)load the plugin.

`tools/release-app-check.js` is the release gate built on these; it runs `hands-on-verdict.js` from here. The other checks
(`look-only.js`, `screens.js`, `menus.js`, `split-try.js`, `settings-walk.js`, `parts-off.js`, `off-on.js`, `faults.js` and the
rest) each say at their top what they prove and how they are run.

Left in `reports/release-0.4`, because they read the 0.4 goalposts page there and mean nothing without it: `run.js` and
`checks.js` (the proof run of the 49 goalpost lines), `coverage.js`, `by-eye.js`, `my-copy.sh`.
