/* The switches, each with a specimen the settings window draws. */
(function () {
const Find = window.Find;
const schema = [
  { key: 'takesSearchKey', type: 'boolean', looks: ['Cmd Shift K opens Find', 'Cmd K opens Find'], default: true, title: 'Open Find with Logseq’s search key',
    description: 'Cmd+K (Ctrl+K elsewhere) opens Find, and Cmd+Shift+K opens Logseq’s own search. Off: Cmd+Shift+K opens Find and Logseq’s key is left alone.' },
  { key: 'windowPlace', type: 'enum', default: 'high', enumChoices: ['high', 'centred'], title: 'Where the window opens',
    description: 'High: near the top of the screen, with the page in view under it. Centred: in the middle, as Logseq’s own search.' },
  { key: 'panel', type: 'boolean', default: true, title: 'A small Find under the line you are writing',
    description: 'A tap of the Hyper key (Caps Lock as Cmd+Ctrl+Opt+Shift) in a bullet opens a small Find under the line: type, and Enter links the lit row where the cursor is. Its first line offers tags for the bullet. Escape puts the cursor back. Off: the tap lists the tags, as before.' },
  { key: 'look', type: 'boolean', default: true, title: 'Open a linked page under the line',
    description: 'With the cursor on a link in the bullet you are writing, the key below opens that page under the line, where it can be read and changed. The key again, or Escape, closes it and the cursor is where it was.' },
  { key: 'lookKeys', type: 'string', keys: true, default: 'alt+l', title: 'The key that opens the link under the cursor',
    description: 'Option+L unless you set another on the key sheet (hold Option).' },
  { key: 'rowsShown', type: 'number', presets: [5, 12, 30], default: 12, title: 'Rows before “show all”',
    description: 'How many matches are listed at first; “show all” lists the rest.' },
];
const setting = Find.kit.setting;   // the saved value, or the schema's default (the base's reader, plugin.js)
// One specimen, the keys: it is the thing itself. The other two settings are their own specimen (a word, a number).
const SPECIMENS = {
  windowPlace: v => `<span style="display:block;width:150px;height:62px;border:1px solid var(--lk-hair);border-radius:4px;position:relative"><span style="position:absolute;left:25%;width:50%;height:20px;border:1px solid var(--lk-line);border-radius:3px;top:${v === 'centred' ? 20 : 6}px;background:var(--lk-wash)"></span></span>`,
  rowsShown: v => { const n = Math.max(1, Math.min(Number(v) || 12, 40)); return `<span style="display:grid;gap:3px;width:70%">${Array.from({ length: n }, () => '<span style="display:block;height:3px;border-radius:2px;background:var(--lk-hair)"></span>').join('')}<span style="color:var(--lk-quiet);font-size:var(--lk-small)">${n} rows, then show all</span></span>`; },
  takesSearchKey: on => on ? '<span class="sw-k">Cmd K</span> Find &nbsp; <span class="sw-k">Cmd Shift K</span> Logseq’s search' : '<span class="sw-k">Cmd Shift K</span> Find &nbsp; <span class="sw-k">Cmd K</span> Logseq’s search',
};
const specimen = (item, value) => SPECIMENS[item.key] ? SPECIMENS[item.key](item.type === 'boolean' ? !!value : value) : '';
Find.settings = { schema, setting, specimen };
})();
