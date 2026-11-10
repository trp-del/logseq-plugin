/* node test/logseq-contract.js [--accept]
   What the plugin relies on in Logseq, checked against the Logseq installed on this Mac, without starting it (9 November 2026).
   The plugin's code is read for three kinds of reliance:
     - the plugin calls it uses (logseq.Editor.upsertBlockProperty and the like);
     - the class names of Logseq's own page it looks for (.ls-block, .page-title, .cp__sidebar-main-content ...);
     - the database names its queries ask for (:block/title, :logseq.property/deleted-at, :logseq.class/Tag ...).
   Each is looked for in Logseq's own bundle (/Applications/Logseq.app, its app.asar). It fails when:
     1. Logseq has changed version since the list was last checked in the app (test/logseq-contract.json, "checkedWith"):
        run the app round (tools/logseq-contract-app.js) on the new Logseq, then accept;
     2. something the plugin relies on is no longer in Logseq's bundle: a Logseq update renamed or dropped it;
     3. the code relies on something new that is not on the list yet: look at it in the app, then accept;
     4. a selector looks for a class that neither Logseq nor the plugin draws any more (a leftover that finds nothing).
   --accept writes today's list and the installed version into test/logseq-contract.json. Do that only after the app round. */
const fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const LIST = path.join(__dirname, 'logseq-contract.json');
const APP = '/Applications/Logseq.app';

// Selectors kept on purpose though nothing draws their class today, each with its reason. A leftover found here is removed
// from the code, not added to this list.
const KNOWN_LEFTOVERS = {
};

// The plugin's running code: every file Logseq loads (files.js), and the root files.
const listed = fs.readFileSync(path.join(ROOT, 'files.js'), 'utf8').match(/'[a-z/-]+\.js'/g).map(s => s.slice(1, -1));
const files = [...new Set(['plugin.js', 'main.js', 'loader.js', 'outside.js', 'sidebar-tabs.js', ...listed])].filter(f => fs.existsSync(path.join(ROOT, f)));
// Comments left out, so a call named only in a comment is no reliance.
const src = files.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[\s;{}])\/\/[^\n]*/g, '$1')).join('\n');

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const word = s => new RegExp('(?<![\\w-])' + esc(s) + '(?![\\w-])', 'g');
const api = [...new Set([...src.matchAll(/\blogseq\.([A-Z][A-Za-z]*)\.([A-Za-z]+)\b/g)].map(m => `${m[1]}.${m[2]}`))].sort();
const selectorTexts = [...src.matchAll(/(?:querySelector(?:All)?|closest|matches)\(\s*(['`"])((?:(?!\1).)*)\1/g)].map(m => m[2]);
// Inside a selector, what is in ${...} is code (block.uuid), not a class.
const selected = [...new Set(selectorTexts.flatMap(t => [...t.replace(/\$\{[^}]*\}/g, '').matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(m => m[1])))].sort();
const attributes = [...new Set([...src.matchAll(/:((?:block|db|logseq\.(?:property|class))\/[A-Za-z][\w-]*\??)/g)].map(m => m[1]))].sort();
const selectorsJoined = selectorTexts.join('\n');
const drawnByPlugin = c => (src.match(word(c)) || []).length > (selectorsJoined.match(word(c)) || []).length;

// Logseq's bundle: its version, its plugin door, its page code and styles, its database worker.
let bundle = null, version = null;
try {
  version = require('node:child_process').execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Print CFBundleShortVersionString', path.join(APP, 'Contents/Info.plist')], { encoding: 'utf8' }).trim();
  const B = require('../threads/tools/logseq-bundle.js').open();
  if (B) {
    const read = f => B.read(f).toString('utf8');
    bundle = { user: read('js/lsplugin.user.js'), main: read('js/main.js'), worker: read('js/db-worker.js'),
      css: ['css/style.css', 'css/ui.css', 'css/shui.css', 'css/tabler-icons.min.css'].map(read).join('\n') };
  }
} catch (error) { bundle = null; }
if (!bundle) { console.log('skipped: Logseq is not installed in /Applications on this Mac'); process.exit(0); }

const snake = s => s.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
const kebab = s => s.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
// A plugin call is in Logseq when its door (lsplugin.user.js) or its handler (main.js, in snake case) names it; a hook
// such as App.onRouteChanged is named in kebab case (route-changed).
const hasApi = name => { const fn = name.split('.')[1]; const hook = fn.startsWith('on') ? kebab(fn.slice(2)).slice(1) : null;
  return bundle.user.includes(fn) || bundle.main.includes(snake(fn)) || (hook && (bundle.main.includes(hook) || bundle.user.includes(hook))); };
// A class is Logseq's when its styles or its page code (hiccup "div.ls-block.flex", or "ls-block" in a class string) name it.
// Icon classes are made from the icon's name ("ls-icon-" + name), so ls-icon-x is Logseq's when the icon x is.
const hasClass = c => {
  if (c.startsWith('ls-icon-')) return new RegExp('\\.ti-' + esc(c.slice(8)) + '(?![\\w-])').test(bundle.css);
  return new RegExp('\\.' + esc(c) + '(?![\\w-])').test(bundle.css) || new RegExp('[."\' ]' + esc(c) + '(?=[."\' \\]])').test(bundle.main);
};
// A database name is in Logseq when its code names it whole (":block/title") or as a compiled keyword ("block","title").
const hasAttribute = a => { const [ns, n] = a.split('/'); return [bundle.main, bundle.worker].some(t => t.includes(a) || t.includes(`"${ns}","${n}"`)); };

// A short plain word the plugin puts on its own pieces too (.on, .k, .nm, .open) matches Logseq's bundle by chance; such a
// class is the plugin's, not a reliance on Logseq.
const createdByPlugin = c => { const w = '(?<![\\w-])' + esc(c) + '(?![\\w-])';
  return new RegExp(`class(Name)?\\s*[=:]\\s*[\`'"][^\`'"]*${w}|classList\\.\\w+\\([^)]*[\`'"]${esc(c)}[\`'"]|\\b(el|h|make|node)\\(\\s*[\`'"][\\w-]+[\`'"]\\s*,\\s*[\`'"][^\`'"]*${w}`).test(src); };
const logseqClasses = selected.filter(c => hasClass(c) && !(createdByPlugin(c) && !/[-_]/.test(c)));
const now = { api, classes: logseqClasses, attributes };
if (process.argv.includes('--accept')) {
  fs.writeFileSync(LIST, JSON.stringify({ checkedWith: version, acceptedOn: new Date().toISOString().slice(0, 10), ...now }, null, 1) + '\n');
  console.log(`accepted: ${api.length} plugin calls, ${logseqClasses.length} of Logseq's class names, ${attributes.length} database names, Logseq ${version}`);
  process.exit(0);
}
const was = fs.existsSync(LIST) ? JSON.parse(fs.readFileSync(LIST, 'utf8')) : null;
const problems = [];
if (!was) problems.push('no list yet: run the app round, then node test/logseq-contract.js --accept');
else if (was.checkedWith !== version) problems.push(`Logseq is now ${version}; the plugin was last checked in the app with ${was.checkedWith}. Run tools/logseq-contract-app.js, look at the plugin in Logseq, then accept`);

const gone = [...api.filter(a => !hasApi(a)).map(a => `the plugin call ${a}`),
  ...attributes.filter(a => !hasAttribute(a)).map(a => `the database name :${a}`)];
if (was) gone.push(...was.classes.filter(c => selected.includes(c) && !hasClass(c)).map(c => `Logseq's class .${c}`));
for (const g of gone) problems.push(`Logseq ${version} no longer has ${g}, which the plugin relies on`);

if (was) for (const [kind, list] of Object.entries(now)) for (const item of list) if (!was[kind].includes(item) && !(kind === 'classes' && !hasClass(item)))
  problems.push(`new reliance on Logseq, not checked in the app yet: ${kind === 'api' ? 'the plugin call ' + item : kind === 'classes' ? 'the class .' + item : 'the database name :' + item}`);

const nowhere = selected.filter(c => !hasClass(c) && !drawnByPlugin(c));
for (const c of nowhere) if (!KNOWN_LEFTOVERS[c]) problems.push(`a selector looks for .${c}, which neither Logseq nor the plugin draws`);
for (const c of Object.keys(KNOWN_LEFTOVERS)) if (!nowhere.includes(c)) problems.push(`.${c} is no longer a leftover: take it off KNOWN_LEFTOVERS`);

console.log(`Logseq ${version}: ${api.length} plugin calls, ${logseqClasses.length} of Logseq's class names, ${attributes.length} database names; ${Object.keys(KNOWN_LEFTOVERS).length} known leftover selectors`);
if (problems.length) { for (const p of problems) console.log('PROBLEM: ' + p); process.exit(1); }
console.log('logseq-contract: OK');
