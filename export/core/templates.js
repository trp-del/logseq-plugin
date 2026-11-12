/* Templates: a named set of the choices of the export window, so a kind of document is one pick. Three come with the plugin;
   the rest are the person's own, kept in the plugin's settings as { name: set }. A set holds only the keys of KEYS, and a
   pick changes only the keys its set holds, so a template of the plugin's leaves the footer or the properties left out as
   they were. One of the plugin's saved under its own name is the person's from then on; deleted, the plugin's comes back.
   Pure, runs in Node. */
(function () {
const E = (window.DbExport ||= {});

// What a template can hold, as the window's choice names them. Not the lines round one page's title, nor the preview's size.
const KEYS = ['target', 'layout', 'look', 'paper', 'margins', 'size', 'footer', 'pageNumbers', 'tags', 'tasks', 'titleDate', 'preparedBy', 'links', 'frontMatter',
  'dated', 'prose', 'customCss', 'hiddenHead', 'hiddenNodes'];
const BUILT_IN = {
  Report: { customCss: '', layout: 'prose', look: 'plain', margins: 'normal', size: 'normal', prose: { children: 'join', contents: true, numbered: true, titleSheet: false, sectionSheets: false, runIn: false, notesHead: 'Notes' } },
  Paper: { customCss: '', layout: 'prose', look: 'book', margins: 'wide', size: 'normal', prose: { children: 'join', contents: false, numbered: false, titleSheet: false, sectionSheets: false, runIn: false, notesHead: 'Notes' } },
  Brief: { customCss: '', layout: 'prose', look: 'compact', margins: 'narrow', size: 'small', prose: { children: 'join', contents: false, numbered: false, titleSheet: false, sectionSheets: false, runIn: true, notesHead: '' } },
};
const plain = value => value instanceof Set ? [...value].sort() : value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.keys(value).sort().map(k => [k, plain(value[k])])) : Array.isArray(value) ? [...value].sort() : value;
// The set a choice makes: every key of KEYS, a Set as a sorted list.
const held = choice => Object.fromEntries(KEYS.filter(key => choice[key] !== undefined).map(key => [key, plain(choice[key])]));
const own = store => store && typeof store === 'object' && !Array.isArray(store) ? store : {};
const names = store => [...Object.keys(BUILT_IN), ...Object.keys(own(store)).filter(name => !BUILT_IN[name]).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))];
const get = (store, name) => own(store)[name] || BUILT_IN[name] || null;
const isOwn = (store, name) => !!own(store)[name];
// Whether a choice still is the template: only the keys the template holds are compared.
const changed = (set, choice) => !!set && Object.keys(set).some(key => JSON.stringify(plain(set[key])) !== JSON.stringify(plain(choice[key])));
const clean = name => String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
// Each gives back a new store; rename and remove leave it as it was when there is nothing to do.
const save = (store, name, choice) => ({ ...own(store), [name]: held(choice) });
const remove = (store, name) => { const next = { ...own(store) }; delete next[name]; return next; };
const rename = (store, from, to) => { if (!own(store)[from] || from === to) return own(store); const next = remove(store, from); next[to] = own(store)[from]; return next; };

E.templates = { KEYS, BUILT_IN, held, names, get, isOwn, changed, clean, save, remove, rename };
})();
