/* Predictive: fills in properties and predicts pages while you write, in any Logseq DB graph. Loaded by loader.js after the
   core and the Logseq parts (see README.md for how the pieces fit). */
(function () {
const Flow = window.Flow;
Flow.locales = { en: Flow.dates.en };   // another language: add its locale here (README, Other languages)

/* The settings window's specimens: each setting as the thing itself, as it looks while you write. The pencil, tag and
   name looks are Look's, through the shared names. */
const pen = w => `<span class="lk-pencil">${w}</span>`;
// Keys pressed, between what was and what comes of them.
const then = k => `<span class="sw-then">${(window.PluginDoor.settings.keyWords(k) || '').split(' ').filter(Boolean).map(w => `<span class="sw-key">${w}</span>`).join('')}</span>`;
const SPECIMENS = {
  proposals: on => `<span class="sw-dot"></span>Saw <span class="lk-node">Dr. Mei Chen</span> about the fatigue, worse in the evenings<br><span style="padding-left:14px"><span class="sw-k">Provider:</span> ${on ? pen('Dr. Mei Chen') : '<span class="sw-faintw">empty</span>'} <span class="sw-sep">·</span> <span class="sw-k">Date:</span> ${on ? pen('Oct 23rd, 2026') : '<span class="sw-faintw">empty</span>'} <span class="sw-sep">·</span> <span class="sw-k">Symptom:</span> ${on ? pen('Fatigue') : '<span class="sw-faintw">empty</span>'}</span>`,
  proposalsHideEmpty: on => `<span class="sw-dot"></span>Lena Park came to take the pump off<br><span style="padding-left:14px"><span class="sw-k">Spoke with:</span> <span class="lk-node">Lena Park</span>${on ? '' : ' <span class="sw-sep">·</span> <span class="sw-faintw">Date: empty</span> <span class="sw-sep">·</span> <span class="sw-faintw">Topic: empty</span>'}</span>`,
  linkSuggest: on => `<span class="sw-dot"></span>Saw Dr. Mei${on ? '<span class="sw-grey"> Chen</span>' : ''}`,
  linkKeepCase: on => `<span class="sw-dot"></span>Saw <span class="lk-node">${on ? 'dr. mei chen' : 'Dr. Mei Chen'}</span> <span class="sw-faintw">&nbsp; typed as [[dr. mei chen]]</span>`,
  // The keys, the numbers and the graphs: what pressing, waiting or listing does in a bullet (the settings window, 12 November 2026).
  proposalsSkipGraphs: value => { const graphs = String(value || '').split(',').map(g => g.trim()).filter(Boolean); return graphs.length ? graphs.map(g => `${g} <span class="sw-faintw">&nbsp; left alone</span>`).join('<br>') : '<span class="sw-faintw">Every graph gets proposals</span>'; },
  linkSuggestMinLetters: n => { let seen = 0, cut = 0; const name = 'Dr. Mei Chen'; for (; cut < name.length && seen < Number(n); cut++) if (/[a-z0-9]/i.test(name[cut])) seen++; return `<span class="sw-dot"></span>Saw ${name.slice(0, cut)}<span class="sw-caret"></span><span class="sw-grey">${name.slice(cut)}</span>`; },
  linkSuggestPause: ms => `<span class="sw-dot"></span>Saw Dr. Mei<span class="sw-caret"></span><span class="sw-grey"> Chen</span><span class="sw-then">${Number(ms) ? `shows ${Number(ms) >= 1000 ? (Number(ms) / 1000).toFixed(1) + ' s' : ms + ' ms'} after your last key` : 'shows at once, as you type'}</span>`,
  proposalsStepKeys: k => `<span class="sw-dot"></span>Saw <span class="lk-node">Dr. Mei Chen</span>${then(k)}<span style="padding-left:14px"><span class="sw-k">Provider:</span> <span class="sw-caret"></span><span class="sw-faintw">choose</span> <span class="sw-sep">·</span> <span class="sw-k">Date:</span> <span class="sw-faintw">empty</span></span>`,
  proposalsTagKeys: k => `<span class="sw-dot"></span>Mouth feels like sandpaper<span class="sw-caret"></span>${then(k)}<span style="display:inline-grid;margin-left:14px;padding:4px;border:1px solid var(--lk-hair);border-radius:6px;font-size:14px"><span style="padding:0 8px;border-radius:4px;background:var(--lk-wash)"><span class="lk-tag">Symptom Log</span></span><span style="padding:0 8px"><span class="lk-tag">Observation</span></span></span>`,
  // The two ways: as you write the pencil follows the words; on the key the bullet stays bare until the key is pressed.
  proposalsWhen: value => value === 'when I press the key'
    ? `<span class="sw-dot"></span>Saw <span class="lk-node">Dr. Mei Chen</span> about the fatigue<span class="sw-caret"></span> <span class="sw-faintw">&nbsp; nothing until the key</span>`
    : `<span class="sw-dot"></span>Saw <span class="lk-node">Dr. Mei Chen</span> about the fatigue<span class="sw-caret"></span><br><span style="padding-left:14px"><span class="sw-k">Provider:</span> ${pen('Dr. Mei Chen')}</span>`,
  proposalsShowKeys: k => `<span class="sw-dot"></span>Saw <span class="lk-node">Dr. Mei Chen</span><span class="sw-caret"></span>${then(k)}<span class="sw-dot"></span>Saw <span class="lk-node">Dr. Mei Chen</span><br><span style="padding-left:14px"><span class="sw-k">Provider:</span> ${pen('Dr. Mei Chen')}</span>`,
  citeKeys: k => `<span class="sw-dot"></span>Iron was low in March${then(k)}<span style="padding-left:14px"><span class="sw-k">Source:</span> <span class="sw-caret"></span></span>`,
  pageKeys: k => `<span class="sw-dot"></span>Pump trial<span class="sw-caret"></span>${then(k)}<span class="sw-dot"></span><span class="lk-node">Pump trial</span>`,
  embedTrigger: t => t ? `<span class="sw-dot"></span>${String(t).replace(/</g, '&lt;')}<span class="sw-caret"></span>refill<span class="sw-then">Enter</span><span class="sw-dot" style="background:none;box-shadow:inset 0 0 0 1.5px currentColor"></span><span class="lk-node">Refill steps</span>` : '<span class="sw-faintw">Only /Node embed</span>',
  linkSuggestKeys: k => `<span class="sw-dot"></span>Saw Dr. Mei<span class="sw-caret"></span><span class="sw-grey"> Chen</span>${k ? then(k) + '<span class="sw-dot"></span>Saw <span class="lk-node">Dr. Mei Chen</span>' : '<span class="sw-then">no key of your own</span>'}`,
  linkSuggestRightArrow: on => `<span class="sw-dot"></span>Saw Dr. Mei<span class="sw-caret"></span><span class="sw-grey"> Chen</span>${then('right')}<span class="sw-dot"></span>${on ? 'Saw <span class="lk-node">Dr. Mei Chen</span>' : 'Saw Dr. Mei <span class="sw-caret"></span>'}`,
  linkSuggestHyperTap: on => `<span class="sw-dot"></span>Saw Dr. Mei<span class="sw-caret"></span><span class="sw-grey"> Chen</span><span class="sw-then"><span class="sw-key">Hyper</span> tapped alone</span><span class="sw-dot"></span>${on ? 'Saw <span class="lk-node">Dr. Mei Chen</span>' : 'Saw Dr. Mei<span class="sw-caret"></span><span class="sw-grey"> Chen</span>'}`,
  linkSuggestLearn: on => `<span class="sw-dot"></span>Saw ${on ? 'Mei<span class="sw-grey"> Chen</span>' : 'Mei'} <span class="sw-faintw">&nbsp; ${on ? 'offered from three letters, a name the graph usually links' : 'offered only after the usual count of letters'}</span>`,
};
const specimen = (item, value) => SPECIMENS[item.key] ? SPECIMENS[item.key](value) : '';

async function main() {
  const { onStop } = Flow.app;
  onStop(logseq.DB.onChanged(({ blocks, txMeta }) => Flow.app.learnSoon(blocks, txMeta)));
  onStop(logseq.App.onCurrentGraphChanged(() => Flow.app.forget()));
  Flow.app.context().catch(() => {});   // the first reading starts at once and is never waited for while typing
  await Flow.linkUi.start();
  Flow.tagPick.start();   // before the proposals: its keys are looked at first
  Flow.cite.start();
  Flow.pageHere.start();
  Flow.embedHere.start();
  Flow.oneDollar.start();
  Flow.proposeUi.start();
  Flow.steps.start();
  Flow.typedCaseUi.start();
}
const stop = () => Flow.app.stopAll();
// The window's order: what is proposed, the suggested links, then the keys together (the links' keys among them).
const row = (key, title, more = {}) => ({ ...Flow.settingsSchema.find(item => item.key === key), ...(title ? { title } : {}), ...more });
window.PluginDoor.describe('predictive', {
  schema: [
    { type: 'heading', title: 'Proposals', place: 'writing' },
    row('proposals', 'Propose values for a bullet’s properties'), row('proposalsWhen', 'When they show'), row('proposalsHideEmpty', 'Hide empty properties', { looks: ['Shown', 'Hidden'] }), row('proposalsSkipGraphs', 'Leave these graphs alone'),
    { type: 'heading', title: 'Suggested links', place: 'writing' },
    row('linkSuggest', 'Suggest a link as I type'), row('linkSuggestLearn', 'Learn which pages I link'), row('linkSuggestMinLetters', 'Letters before a suggestion shows', { presets: [3, 5, 8] }), row('linkSuggestPause', 'Pause before a suggestion shows', { presets: [0, 350, 800] }), row('linkKeepCase', 'Keep my capitals in a link', { looks: ['The page’s capitals', 'My capitals'] }),
    { type: 'heading', title: 'Keys', place: 'keys' },
    row('proposalsStepKeys', 'Step through a bullet’s properties'), row('proposalsShowKeys', 'Show the proposals now'), row('proposalsTagKeys', 'Choose a tag'), row('citeKeys', 'Cite a source'), row('pageKeys', 'Make the bullet a page'), row('embedTrigger', 'Typing that embeds a node'),
    row('linkSuggestRightArrow', 'Right arrow takes the suggested link'), row('linkSuggestHyperTap', 'A tap of Hyper takes it'), row('linkSuggestKeys', 'Another key takes it'),
  ],
  specimen,
  picture: on => SPECIMENS.proposals(on),
});
window.PluginDoor.register({
  key: 'predictive', title: 'Predictive', about: 'Properties filled in and pages predicted while you write, ignorable by carrying on.',
  schema: Flow.settingsSchema.map(({ key, type, title, description, default: def, enumChoices, enumPicker }) =>
    ({ key, type, title, description, default: def, ...(enumChoices ? { enumChoices, enumPicker } : {}) })),
  start: main, stop,
});
})();
