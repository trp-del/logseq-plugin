/* Threads in the plugin's settings window: its rows, each with a specimen of the thing itself. The settings list Logseq
   shows comes from the parts' own schemas; this says how they read here. Tools of the window: a list offers the graph's
   properties as you type, and Open troubleshooting runs the command the diagnostics part registers. */
(function () {
const schemaOf = () => (window.Threads.parts || []).flatMap(part => part.schema || []);
const item = (key, more = {}) => ({ ...schemaOf().find(row => row.key === key), hidden: false, ...more });
const link = text => `<span class="lk-node">${text}</span>`;
const day = (when, text) => `<span class="sw-line"><span class="lk-day sw-faintw" style="min-width:48px;text-align:right">${when}</span><span>${text}</span></span>`;
const gone = '<span class="sw-faintw">gone from the page</span>';
const words = value => String(value || '').split(/[;\n]/).map(w => w.trim()).filter(Boolean);
const SPECIMENS = {
  twoWayRows: on => on ? day('Oct 29', link('Spoke with Dr. Mei Chen about fatigue')) + day('Oct 23', link('Appointment about the sore mouth')) : '<span class="sw-faintw">Only Logseq’s Linked references, at the foot of the page</span>',
  twoWayDays: on => on ? day('Oct 29', link('Spoke with Dr. Mei Chen about fatigue')) : link('Spoke with Dr. Mei Chen about fatigue'),
  twoWayMentions: on => on ? `<span class="sw-k">Mentioned in</span>${day('Oct 23', link('I had a good day with Dr. Mei Chen'))}` : '<span class="sw-faintw">Mentions stay in Linked references</span>',
  twoWayHideLinkedRefs: on => on ? gone : '<span class="sw-k">▸ 14 Linked references</span>',
  twoWayHideTagLists: on => on ? gone : '<span class="sw-k">▸ Nodes tagged Doctor</span>',
  // The lists: a row on the page the property points to, as the words now say it (the settings window, 12 November 2026).
  twoWayNames: value => { const pairs = words(value).map(w => w.split('=').map(x => x.trim())).filter(p => p[1]); const [prop, said] = pairs[0] || ['Provider', 'Provider']; return `<span class="sw-big">Dr. Mei Chen</span><br><span class="sw-k">${said} →</span> &nbsp; 9 Consultations<br><span class="sw-faintw" style="font-size:13px">${pairs.length ? `${prop} reads as “${said}”` : 'Each property reads as its own name'}</span>`; },
  twoWayOneEnd: value => { const off = words(value).map(w => w.toLowerCase()); return `<span class="sw-big">Boston</span><br>${['Lives in|214 People', 'Born in|38 People'].map(r => { const [p, n] = r.split('|'); return off.includes(p.toLowerCase()) ? `<span class="sw-faintw" style="text-decoration:line-through">${p} → &nbsp; ${n}</span>` : `<span class="sw-k">${p} →</span> &nbsp; ${n}`; }).join('<br>')}`; },
  twoWayMentionsHidden: value => { const pages = words(value); return pages.length ? pages.map(p => `<span class="sw-big">${p}</span><br><span class="sw-faintw" style="text-decoration:line-through">Mentioned in → &nbsp; every node that names it</span>`).join('<br>') : `<span class="sw-big">Dr. Mei Chen</span><br><span class="sw-k">Mentioned in →</span> &nbsp; 4 nodes`; },
  foundationOnly: on => on ? '<span class="sw-faintw">Only the plugin’s base runs, to see whether a part is at fault</span>' : '<span class="sw-k">All of Threads runs</span>',
};
const specimen = (row, value) => SPECIMENS[row.key] ? SPECIMENS[row.key](row.type === 'boolean' ? !!value : value) : '';
const properties = async () => (await window.Threads.core.provided.propSchema()).props.map(prop => prop.title);
// The parts' schemas are there once every part has loaded, so the rows are read when the window opens.
window.PluginDoor.describe('threads', {
  get schema() {
    return [
      { type: 'heading', title: 'Rows under a page', place: 'following' },
      item('twoWayRows', { title: 'Show Linked: everything that links to the page' }),
      item('twoWayDays', { title: 'A day beside each row', looks: ['No days', 'Days'] }),
      item('twoWayMentions', { title: 'Mentions as rows' }),
      { type: 'heading', title: 'Logseq’s own lists', place: 'following' },
      item('twoWayHideLinkedRefs', { title: 'Hide Linked references', looks: ['Shown', 'Hidden'] }),
      item('twoWayHideTagLists', { title: 'Hide Logseq’s lists of tagged nodes', looks: ['Shown', 'Hidden'] }),
      { type: 'heading', title: 'Names', place: 'following' },
      item('twoWayNames', { title: 'How a property reads on the other page', list: { hint: 'Provider = provider of', offer: properties } }),
      item('twoWayOneEnd', { title: 'Properties left out on the other page', list: { hint: 'add a property', offer: properties } }),
      item('twoWayMentionsHidden', { title: 'Pages that get no mentions row', list: { hint: 'add a page' } }),
      { type: 'heading', title: 'When something is wrong', place: 'parts' },
      item('foundationOnly', { title: 'Run only the base, to find a fault', looks: ['Everything runs', 'Only the base'] }),
      // Only while Threads runs: there is nothing to open otherwise.
      ...(window.Threads.core?.provided?.openTroubleshooting ? [{ type: 'action', key: 'troubleshoot', title: 'Open troubleshooting', run: () => window.Threads.core.provided.openTroubleshooting() }] : []),
    ];
  },
  specimen,
  picture: on => SPECIMENS.twoWayRows(on),
});
})();
