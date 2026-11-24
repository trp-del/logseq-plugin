/* The switches, each with a specimen the settings window draws. */
(function () {
const Find = window.Find;
const schema = [
  { key: 'takesSearchKey', type: 'boolean', looks: ['Cmd Shift K opens Find', 'Cmd K opens Find'], default: true, title: 'Open Find with Logseq’s search key',
    description: 'Cmd+K (Ctrl+K elsewhere) opens Find, and Cmd+Shift+K opens Logseq’s own search. Off: Cmd+Shift+K opens Find and Logseq’s key is left alone.' },
  { key: 'windowPlace', type: 'enum', default: 'high', enumChoices: ['high', 'centred'], title: 'Where the window opens',
    description: 'High: near the top of the screen, with the page in view under it. Centred: in the middle, as Logseq’s own search.' },
  { key: 'panel', type: 'boolean', default: true, title: 'A small Find under the line you are writing',
    description: 'The key below, pressed in a bullet you are writing, opens a small Find under the line: type, and Enter links the lit row where the cursor is. Its first line offers tags for the bullet, and words no page is named by make a new page with its kind. The key again, or Escape, puts the cursor back. With bullets selected, a tap of the Hyper key (Caps Lock as Cmd+Ctrl+Opt+Shift) opens it to tag them all; a tap of Hyper in a bullet opens Logseq’s own list of pages instead.' },
  { key: 'panelKeys', type: 'string', keys: true, default: 'alt+k', title: 'The key that opens the small Find under the line',
    description: 'Option+K unless you set another on the key sheet (hold Option).' },
  { key: 'moveHeld', type: 'boolean', default: false, title: 'Move selected bullets under a page from the small Find',
    description: 'With bullets selected, a tap of Hyper opens the small Find; a tag lit and Enter tags them all. On: a page lit and Enter also moves the bullets under that page, with one Undo. Off until you turn it on, since it changes where your notes are.' },
  { key: 'look', type: 'boolean', default: true, title: 'Open a linked page under the line',
    description: 'With the cursor on a link in the bullet you are writing, the key below opens that page under the line, where it can be read and changed. The key again, or Escape, closes it and the cursor is where it was.' },
  { key: 'lookKeys', type: 'string', keys: true, default: 'alt+l', title: 'The key that opens the link under the cursor',
    description: 'Option+L unless you set another on the key sheet (hold Option).' },
  { key: 'within', type: 'boolean', default: true, title: 'A bar that filters the page you are on',
    description: 'The key below brings up a bar at the foot of the page. Words typed narrow the page to the bullets that hold them; a tag, a property value or a linked page picked from the short list above the bar narrows by that. The rest is hidden, or greyed. Escape, the ×, or the key again closes it and the page is as it was. Nothing is saved.' },
  { key: 'withinKeys', type: 'string', keys: true, default: 'alt+f', title: 'The key that filters the page',
    description: 'Option+F unless you set another on the key sheet (hold Option).' },
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
