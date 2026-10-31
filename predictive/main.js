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

async function main() {
  /* The settings window's specimens: each setting as the thing itself, as it looks while you write. The pencil, tag and
     name looks are Look's, through the shared names. */
  const pen = w => `<span class="lk-pencil">${w}</span>`;
  const SPECIMENS = {
    proposals: on => `<span class="sw-dot"></span>Saw <span class="lk-node" data-lk-sort="entity">Dr. Mei Chen</span> about the fatigue, worse in the evenings<br><span style="padding-left:14px"><span class="sw-k">Provider:</span> ${on ? pen('Dr. Mei Chen') : '<span class="sw-faintw">empty</span>'} <span class="sw-sep">·</span> <span class="sw-k">Date:</span> ${on ? pen('Oct 23rd, 2026') : '<span class="sw-faintw">empty</span>'} <span class="sw-sep">·</span> <span class="sw-k">Symptom:</span> ${on ? pen('Fatigue') : '<span class="sw-faintw">empty</span>'}</span>`,
    proposalsHideEmpty: on => `<span class="sw-dot"></span>Lena Park came to take the pump off<br><span style="padding-left:14px"><span class="sw-k">Spoke with:</span> <span class="lk-node" data-lk-sort="entity">Lena Park</span>${on ? '' : ' <span class="sw-sep">·</span> <span class="sw-faintw">Date: empty</span> <span class="sw-sep">·</span> <span class="sw-faintw">Topic: empty</span>'}</span>`,
    tagEagerness: () => `<span class="sw-dot"></span>Saw Dr. Mei Chen about the fatigue &nbsp; <span class="lk-tag lk-pencil">Consultation</span>`,
    linkSuggest: on => `<span class="sw-dot"></span>Saw Dr. Mei${on ? '<span class="sw-grey"> Chen</span>' : ''}`,
    linkSuggestLearn: on => `<span class="sw-dot"></span>Saw ${on ? 'Mei<span class="sw-grey"> Chen</span>' : 'Mei'} <span class="sw-faintw">&nbsp; ${on ? 'offered from three letters, a name the graph usually links' : 'offered only after the usual count of letters'}</span>`,
  };
  const specimen = (item, value) => SPECIMENS[item.key] ? SPECIMENS[item.key](!!value) : '';
  const settingsWindow = () => Flow.settingsWindow.open({ doc: window.parent.document, name: 'Predictive', schema: Flow.settingsSchema, read: key => { const item = Flow.settingsSchema.find(s => s.key === key); const v = logseq.settings?.[key]; return item && typeof v === typeof item.default ? v : item?.default; }, write: values => logseq.updateSettings(values), specimen });
  logseq.App.registerCommandPalette({ key: 'flow-settings', label: 'Predictive: settings' }, settingsWindow);
  logseq.App.registerCommandPalette({ key: 'flow-score', label: 'Predictive: how well do proposals work on this graph?' }, scoreCommand);
  logseq.App.registerCommandPalette({ key: 'flow-tune', label: 'Predictive: tune proposals to this graph' }, tuneCommand);
  logseq.App.registerCommandPalette({ key: 'flow-reread', label: 'Predictive: read the graph again' }, async () => { Flow.app.forget(); await Flow.app.context(); Flow.app.notify('Read the graph again.'); });
  logseq.DB.onChanged(({ blocks }) => Flow.app.learnSoon(blocks));
  logseq.onSettingsChanged?.(() => { const ctx = Flow.app.state.ctx; if (ctx) Object.assign(ctx.limits, Flow.app.tagLimits()); });   // applies at once, no new reading
  logseq.App.onCurrentGraphChanged(() => Flow.app.forget());
  Flow.app.context().catch(() => {});   // the first reading starts at once and is never waited for while typing
  await Flow.linkUi.start();
  Flow.tagPick.start();   // before the proposals: its keys are looked at first
  Flow.proposeUi.start();
  Flow.steps.start();
}
const stop = () => { Flow.settingsWindow?.close(); Flow.app.stopAll(); };
window.Plugin.register({
  key: 'predictive', title: 'Predictive', about: 'Properties filled in and pages predicted while you write, ignorable by carrying on.',
  schema: Flow.settingsSchema.map(({ key, type, title, description, default: def, enumChoices, enumPicker }) =>
    ({ key, type, title, description, default: def, ...(enumChoices ? { enumChoices, enumPicker } : {}) })),
  start: main, stop,
});
})();
