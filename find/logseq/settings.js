/* The switches, each with a specimen the settings window draws. */
(function () {
const Find = window.Find;
const schema = [
  { key: 'takesSearchKey', type: 'boolean', default: true, title: 'Open Find with Logseq’s search key',
    description: 'Cmd+K (Ctrl+K elsewhere) opens Find, and Cmd+Shift+K opens Logseq’s own search. Off: Cmd+Shift+K opens Find and Logseq’s key is left alone.' },
  { key: 'windowPlace', type: 'enum', default: 'high', enumChoices: ['high', 'centred'], title: 'Where the window opens',
    description: 'High: near the top of the screen, with the page in view under it. Centred: in the middle, as Logseq’s own search.' },
  { key: 'rowsShown', type: 'number', default: 12, title: 'Rows before “show all”',
    description: 'How many matches are listed at first; “show all” lists the rest.' },
];
const setting = key => { const item = schema.find(s => s.key === key); const v = logseq.settings?.[key]; return item && typeof v === typeof item.default ? v : item?.default; };
// One specimen, the keys: it is the thing itself. The other two settings are their own specimen (a word, a number).
const SPECIMENS = {
  windowPlace: v => `<span style="display:block;width:150px;height:62px;border:1px solid var(--lk-hair);border-radius:4px;position:relative"><span style="position:absolute;left:25%;width:50%;height:20px;border:1px solid var(--lk-line);border-radius:3px;top:${v === 'centred' ? 20 : 6}px;background:var(--lk-wash)"></span></span>`,
  rowsShown: v => `<span style="display:block;font-size:var(--lk-small);line-height:1.5">${Array.from({ length: Math.min(Number(v) || 12, 4) }, (_, i) => `<span style="display:block;color:var(--lk-quiet)">Match ${i + 1}</span>`).join('')}<span style="display:block;color:var(--lk-quiet)">… show all</span></span>`,
  takesSearchKey: on => on ? '<span class="sw-k">Cmd K</span> Find &nbsp; <span class="sw-k">Cmd Shift K</span> Logseq’s search' : '<span class="sw-k">Cmd Shift K</span> Find &nbsp; <span class="sw-k">Cmd K</span> Logseq’s search',
};
const specimen = (item, value) => SPECIMENS[item.key] ? SPECIMENS[item.key](item.type === 'boolean' ? !!value : value) : '';
Find.settings = { schema, setting, specimen };
})();
