/* Threads in the plugin's settings window: its rows, each with a specimen of the thing itself. The settings list Logseq
   shows comes from the parts' own schemas; this says how they read here. Tools of the window: a list offers the graph's
   properties as you type, and Open troubleshooting runs the command the diagnostics part registers. */
(function () {
const schemaOf = () => (window.Threads.parts || []).flatMap(part => part.schema || []);
const item = (key, more = {}) => ({ ...schemaOf().find(row => row.key === key), hidden: false, ...more });
const link = text => `<span class="lk-node">${text}</span>`;
const day = (when, text) => `<span class="sw-line"><span class="lk-day sw-faintw" style="min-width:48px;text-align:right">${when}</span><span>${text}</span></span>`;
const gone = '<span class="sw-faintw">gone from the page</span>';
const SPECIMENS = {
  twoWayRows: on => on ? day('Oct 29', link('Spoke with Dr. Mei Chen about fatigue')) + day('Oct 23', link('Appointment about the sore mouth')) : '<span class="sw-faintw">Only Logseq’s Linked references, at the foot of the page</span>',
  twoWayDays: on => on ? day('Oct 29', link('Spoke with Dr. Mei Chen about fatigue')) : link('Spoke with Dr. Mei Chen about fatigue'),
  twoWayMentions: on => on ? `<span class="sw-k">Mentioned in</span>${day('Oct 23', link('I had a good day with Dr. Mei Chen'))}` : '<span class="sw-faintw">Mentions stay in Linked references</span>',
  twoWayHideLinkedRefs: on => on ? gone : '<span class="sw-k">▸ 14 Linked references</span>',
  twoWayHideTagLists: on => on ? gone : '<span class="sw-k">▸ Nodes tagged Doctor</span>',
  foundationOnly: on => on ? '<span class="sw-faintw">Only the plugin’s base runs, to see whether a part is at fault</span>' : '<span class="sw-k">All of Threads runs</span>',
};
const specimen = (row, value) => SPECIMENS[row.key] ? SPECIMENS[row.key](!!value) : '';
const properties = async () => (await window.Threads.core.provided.propSchema()).props.map(prop => prop.title);
// The parts' schemas are there once every part has loaded, so the rows are read when the window opens.
window.PluginDoor.describe('threads', {
  get schema() {
    return [
      { type: 'heading', title: 'Rows under a page', place: 'following' },
      item('twoWayRows', { title: 'Show everything that points here' }),
      item('twoWayDays', { title: 'A day beside each row' }),
      item('twoWayMentions', { title: 'Mentions as rows' }),
      { type: 'heading', title: 'Logseq’s own lists', place: 'following' },
      item('twoWayHideLinkedRefs', { title: 'Hide Linked references' }),
      item('twoWayHideTagLists', { title: 'Hide Logseq’s lists of tagged nodes' }),
      { type: 'heading', title: 'Names', place: 'following' },
      item('twoWayNames', { title: 'How a property reads on the other page', list: { hint: 'Provider = provider of', offer: properties } }),
      item('twoWayOneEnd', { title: 'Properties left out on the other page', list: { hint: 'add a property', offer: properties } }),
      item('twoWayMentionsHidden', { title: 'Pages that get no mentions row', list: { hint: 'add a page' } }),
      { type: 'heading', title: 'When something is wrong', place: 'parts' },
      item('foundationOnly', { title: 'Run only the base, to find a fault' }),
      // Only while Threads runs: there is nothing to open otherwise.
      ...(window.Threads.core?.provided?.openTroubleshooting ? [{ type: 'action', key: 'troubleshoot', title: 'Open troubleshooting', run: () => window.Threads.core.provided.openTroubleshooting() }] : []),
    ];
  },
  specimen,
});
})();
