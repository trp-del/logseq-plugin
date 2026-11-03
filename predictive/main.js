/* Predictive: fills in properties and predicts pages while you write, in any Logseq DB graph. Loaded by loader.js after the
   core and the Logseq parts (see README.md for how the pieces fit). */
(function () {
const Flow = window.Flow;
Flow.locales = { en: Flow.dates.en };   // another language: add its locale here (README, Other languages)

async function describe(result) {
  const p = result.properties, t = result.tags, n = result.plain;
  const spoken = p.guessRight + p.guessWrong;
  return [
    `${result.lines} earlier lines tried, each with one value hidden.`,
    `Values: ${p.sureRight} sure and right, ${p.sureWrong} sure and wrong; ${p.guessRight} guessed right, ${p.guessWrong} guessed wrong${spoken ? ` (${Math.round(100 * p.guessWrong / spoken)}% wrong)` : ''}; ${p.silent} left empty.`,
    `Tags: ${t.right} right, ${t.wrong} wrong, ${t.silent} left empty. Plain lines given a tag: ${n.spoke} of ${n.spoke + n.silent}.`,
  ].join('\n');
}

async function scoreCommand() {
  const ctx = await Flow.app.context();
  if (!ctx?.index?.entries.length) return Flow.app.notify('Nothing to score yet: this graph has no tagged lines.', 'warning');
  Flow.app.notify('Scoring proposals on this graph…');
  await new Promise(r => setTimeout(r, 50));
  const result = Flow.score.score(ctx, { sample: 600 });
  const text = await describe(result);
  console.log('Flow score\n' + text);
  Flow.app.notify(text, result.properties.sureWrong ? 'warning' : 'success');
}

async function tuneCommand() {
  const ctx = await Flow.app.context();
  if (!ctx?.index?.entries.length) return Flow.app.notify('Nothing to tune on yet: this graph has no tagged lines.', 'warning');
  Flow.app.notify('Tuning to this graph: a minute or less, you can keep working.');
  const pause = () => new Promise(r => setTimeout(r, 30));
  const result = await Flow.score.tune(ctx, { sample: 300, pause });
  const graph = ctx.graph || await Flow.app.graphName();
  const all = { ...(logseq.settings?.tuned || {}), [graph]: result.limits };
  Flow.app.remember('tuned', all);
  const { tagNearLeast, tagGap, ...forProperties } = result.limits;   // how readily a tag is suggested is the setting's (logseq/app.js)
  Object.assign(ctx.limits, forProperties);
  console.log('Flow tune', result);
  Flow.app.notify(`Tuned for “${graph}”: nearest line at least ${result.limits.nearLeast}, lead ${result.limits.lead} (for properties; tags follow the setting “How readily a tag is suggested”).\n${await describe(result.after)}`, 'success');
}

async function speedCommand() {
  const ctx = await Flow.app.context();
  if (!ctx) return Flow.app.notify('Still reading the graph; try again in a moment.');
  Flow.app.notify('Asking Apple’s model three times…');
  const r = await Flow.modelAsk.speed(ctx);
  if (!r.reached) return Flow.app.notify('Apple’s model is not connected: Plugin settings, Predictive, says why.', 'warning');
  if (!r.times.length) return Flow.app.notify('Apple’s model did not answer the sample question.', 'warning');
  const s = ms => (ms / 1000).toFixed(1) + ' s';
  Flow.app.notify(`Apple’s model answered one tag question in ${r.times.map(s).join(', then ')}. The first may start cold; after it the helper has the next one ready.\nAsked about: “${r.text.length > 80 ? r.text.slice(0, 79) + '…' : r.text}”`, 'success');
}

/* The settings window's specimens: each setting as the thing itself, as it looks while you write. The pencil, tag and
   name looks are Look's, through the shared names. */
const pen = w => `<span class="lk-pencil">${w}</span>`;
const SPECIMENS = {
  proposals: on => `<span class="sw-dot"></span>Saw <span class="lk-node">Dr. Mei Chen</span> about the fatigue, worse in the evenings<br><span style="padding-left:14px"><span class="sw-k">Provider:</span> ${on ? pen('Dr. Mei Chen') : '<span class="sw-faintw">empty</span>'} <span class="sw-sep">·</span> <span class="sw-k">Date:</span> ${on ? pen('Oct 23rd, 2026') : '<span class="sw-faintw">empty</span>'} <span class="sw-sep">·</span> <span class="sw-k">Symptom:</span> ${on ? pen('Fatigue') : '<span class="sw-faintw">empty</span>'}</span>`,
  proposalsHideEmpty: on => `<span class="sw-dot"></span>Lena Park came to take the pump off<br><span style="padding-left:14px"><span class="sw-k">Spoke with:</span> <span class="lk-node">Lena Park</span>${on ? '' : ' <span class="sw-sep">·</span> <span class="sw-faintw">Date: empty</span> <span class="sw-sep">·</span> <span class="sw-faintw">Topic: empty</span>'}</span>`,
  // Placement shows the choice: careful pencils neither line, balanced the fresh symptom line, eager the plain note too.
  tagEagerness: value => {
    const tag = on => on ? ' &nbsp; <span class="lk-pencil"><span class="lk-tag">Symptom Log</span></span>' : '';
    return `<span class="sw-dot"></span>Mouth feels like sandpaper, even water stings${tag(value !== 'careful')}<br><span class="sw-dot"></span>Bought bread and milk on the way home${tag(value === 'eager')}`;
  },
  linkSuggest: on => `<span class="sw-dot"></span>Saw Dr. Mei${on ? '<span class="sw-grey"> Chen</span>' : ''}`,
  linkSuggestLearn: on => `<span class="sw-dot"></span>Saw ${on ? 'Mei<span class="sw-grey"> Chen</span>' : 'Mei'} <span class="sw-faintw">&nbsp; ${on ? 'offered from three letters, a name the graph usually links' : 'offered only after the usual count of letters'}</span>`,
};
/* Under the model's setting, whether Apple's model answers on this Mac: asked as the window draws (at most every two
   seconds), and the line written in place when the answer comes, so nothing else in the window moves. The last answer is
   drawn meanwhile; before the first, an empty line holds the place. The line is in the row's label, so a click on it (to
   select the Terminal line) must not flip the setting. */
const REASONS = {
  appleIntelligenceNotEnabled: 'Apple Intelligence is off on this Mac: turn it on in System Settings.',
  modelNotReady: 'Apple’s model is not ready yet: it may still be downloading to this Mac.',
  deviceNotEligible: 'This Mac cannot run Apple’s model.',
};
// The plugin's own folder is Logseq's baseInfo.url (the frame itself is served from elsewhere).
const helperLine = () => {
  const url = String(logseq.baseInfo?.url || '');
  const folder = url.startsWith('/') ? url.replace(/\/?$/, '/') : `~/.logseq/plugins/${logseq.baseInfo?.id || 'logseq-plugin'}/`;
  return `sh ${folder.replace(/^\/Users\/[^/]+\//, '~/')}predictive/helper/install.sh`;
};
// The answer first, in the words a person asks with (connected or not), then why and what to do, faint.
const modelWords = s => !s ? '&nbsp;'
  : !s.reached ? `Not connected. <span class="sw-faintw">Predictive’s helper is not running on this Mac. In Terminal:</span><br><span class="pr-model-line">${helperLine()}</span>`
  : s.ready ? 'Connected to Apple’s model.'
  : `Not connected. <span class="sw-faintw">${REASONS[s.reason] || `Apple’s model is not ready: ${s.reason || 'no reason given'}.`}</span>`;
const model = { last: null, at: 0 };
function modelLine() {
  const doc = window.parent.document;
  if (!model.guarded) { model.guarded = true; doc.addEventListener('click', event => { if (event.target.closest?.('.pr-model')) event.preventDefault(); }, true); }
  if (Date.now() - model.at > 2000 && Flow.modelAsk?.status) {
    model.at = Date.now();
    Flow.modelAsk.status().then(s => {
      if (JSON.stringify(s) === JSON.stringify(model.last)) return;
      model.last = s;
      for (const el of doc.querySelectorAll('.pr-model')) el.innerHTML = modelWords(s);
    });
  }
  return `<div class="pr-model" style="user-select:text;cursor:text">${modelWords(model.last)}</div>`;
}
const specimen = (item, value) => item.key === 'proposalsModel' ? (value ? modelLine() : '') : SPECIMENS[item.key] ? SPECIMENS[item.key](value) : '';

async function main() {
  logseq.App.registerCommandPalette({ key: 'flow-score', label: 'Predictive: how well do proposals work on this graph?' }, scoreCommand);
  logseq.App.registerCommandPalette({ key: 'flow-tune', label: 'Predictive: tune proposals to this graph' }, tuneCommand);
  logseq.App.registerCommandPalette({ key: 'flow-model-speed', label: 'Predictive: how fast is Apple’s model?' }, speedCommand);
  logseq.App.registerCommandPalette({ key: 'flow-reread', label: 'Predictive: read the graph again' }, async () => { Flow.app.forget(); await Flow.app.context(); Flow.app.notify('Read the graph again.'); });
  logseq.DB.onChanged(({ blocks }) => Flow.app.learnSoon(blocks));
  logseq.onSettingsChanged?.((now, before) => { if (!window.PluginDoor.settingChanged(['tagEagerness'], now, before)) return; const ctx = Flow.app.state.ctx; if (ctx) Object.assign(ctx.limits, Flow.app.tagLimits()); });   // applies at once, no new reading
  logseq.App.onCurrentGraphChanged(() => Flow.app.forget());
  Flow.app.context().catch(() => {});   // the first reading starts at once and is never waited for while typing
  await Flow.linkUi.start();
  Flow.tagPick.start();   // before the proposals: its keys are looked at first
  Flow.cite.start();
  Flow.pageHere.start();
  Flow.proposeUi.start();
  Flow.steps.start();
}
const stop = () => { Flow.app.stopAll(); };
// The window's order: what is proposed, then the keys together, then the suggested links.
const row = (key, title) => ({ ...Flow.settingsSchema.find(item => item.key === key), ...(title ? { title } : {}) });
window.PluginDoor.describe('predictive', {
  schema: [
    row('proposalsHeading'), row('proposals'), row('proposalsHideEmpty'), row('tagEagerness'), row('proposalsModel'), row('proposalsSkipGraphs'),
    { type: 'heading', title: 'Keys' },
    row('proposalsStepKeys', 'Step through a bullet’s properties'), row('proposalsTagKeys', 'Choose a tag'), row('proposalsAcceptKeys', 'Accept everything shown, without a new bullet'), row('citeKeys', 'Cite a source'), row('pageKeys', 'Make the bullet a page'),
    row('linkHeading'), row('linkSuggest'), row('linkSuggestLearn'), row('linkSuggestRightArrow'), row('linkSuggestHyperTap', 'A tap of the Hyper key takes it'), row('linkSuggestKeys', 'A plain key that takes it too'), row('linkSuggestMinLetters'), row('linkSuggestPause', 'Pause before a suggestion shows, in milliseconds'),
  ],
  specimen,
});
window.PluginDoor.register({
  key: 'predictive', title: 'Predictive', about: 'Properties filled in and pages predicted while you write, ignorable by carrying on.',
  schema: Flow.settingsSchema.map(({ key, type, title, description, default: def, enumChoices, enumPicker }) =>
    ({ key, type, title, description, default: def, ...(enumChoices ? { enumChoices, enumPicker } : {}) })),
  start: main, stop,
});
})();
