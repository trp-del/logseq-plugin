/* The switches, each with a specimen the settings window draws. */
(function () {
const Find = window.Find;
const schema = [
  { key: 'takesSearchKey', type: 'boolean', default: true, title: 'Find opens on Logseq’s search key',
    description: 'Cmd+K (Ctrl+K elsewhere) opens Find, and Cmd+Shift+K opens Logseq’s own search. Off: Cmd+Shift+K opens Find and Logseq’s key is left alone.' },
  { key: 'windowPlace', type: 'enum', default: 'high', enumChoices: ['high', 'centred'], title: 'Where the window sits',
    description: 'High: near the top of the screen, with the page in view under it. Centred: in the middle, as Logseq’s own search.' },
  { key: 'rowsShown', type: 'number', default: 12, title: 'Rows shown before “show all”',
    description: 'How many matches are listed at first; “show all” lists the rest.' },
];
const setting = key => { const item = schema.find(s => s.key === key); const v = logseq.settings?.[key]; return item && typeof v === typeof item.default ? v : item?.default; };
// One specimen, the keys: it is the thing itself. The other two settings are their own specimen (a word, a number).
const SPECIMENS = {
  takesSearchKey: on => on ? '<span class="sw-k">Cmd K</span> Find &nbsp; <span class="sw-k">Cmd Shift K</span> Logseq’s search' : '<span class="sw-k">Cmd Shift K</span> Find &nbsp; <span class="sw-k">Cmd K</span> Logseq’s search',
};
const specimen = (item, value) => SPECIMENS[item.key] ? SPECIMENS[item.key](item.type === 'boolean' ? !!value : value) : '';
Find.settings = { schema, setting, specimen };
})();
