/* The switches, each with a specimen the settings window draws. */
(function () {
const Find = window.Find;
const schema = [
  { key: 'findHeading', type: 'heading', default: null, title: 'Find', description: 'The search window as the first step of a walk: a name, then the kinds and the time, then the thread, without leaving.' },
  { key: 'takesSearchKey', type: 'boolean', default: true, title: 'Find opens on Logseq’s search key',
    description: 'Cmd+K (Ctrl+K elsewhere) opens Find, and Cmd+Shift+K opens Logseq’s own search. Off: Cmd+Shift+K opens Find and Logseq’s key is left alone.' },
  { key: 'windowPlace', type: 'enum', default: 'high', enumChoices: ['high', 'centred'], title: 'Where the window sits',
    description: 'High: near the top of the screen, with the page in view under it. Centred: in the middle, as Logseq’s own search.' },
  { key: 'rowsShown', type: 'number', default: 12, title: 'Rows shown before “show all”',
    description: 'How many matches are listed at first; “show all” lists the rest.' },
];
const setting = key => { const item = schema.find(s => s.key === key); const v = logseq.settings?.[key]; return item && typeof v === typeof item.default ? v : item?.default; };
const SPECIMENS = {
  takesSearchKey: on => on ? '<span class="sw-k">⌘K</span> Find &nbsp; <span class="sw-k">⌘⇧K</span> Logseq’s search' : '<span class="sw-k">⌘⇧K</span> Find &nbsp; <span class="sw-k">⌘K</span> Logseq’s search',
  windowPlace: v => v === 'centred' ? '<span class="sw-k">the window in the middle of the screen</span>' : '<span class="sw-k">the window near the top, the page in view under it</span>',
  rowsShown: v => `<span class="sw-k">${Number(v) || 12} rows, then “show all”</span>`,
};
const specimen = (item, value) => SPECIMENS[item.key] ? SPECIMENS[item.key](item.type === 'boolean' ? !!value : value) : '';
const openWindow = () => Find.settingsWindow.open({ doc: Find.kit.host(), name: 'Find', schema, read: setting, write: values => logseq.updateSettings(values), specimen });
Find.settings = { schema, setting, openWindow, specimen };
})();
