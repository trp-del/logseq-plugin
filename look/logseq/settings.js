/* One switch per thing Look draws, each on by default. The words say what is seen; every change applies at once. */
(function () {
const Look = window.Look;
const schema = [
  { key: 'linksHeading', type: 'heading', default: null, title: 'Links and marks', description: 'What a link looks like, and the small mark before it saying what sort of thing it opens.' },
  { key: 'quietLinks', type: 'boolean', default: true, title: 'A link in the text colour with a faint underline',
    description: 'A link to a page is the text colour with a faint line under it, firmer while you point at it, instead of blue: in a bullet’s words, in a property’s value, in Logseq’s tables and in the Linked references.' },
  { key: 'quietDays', type: 'boolean', default: true, title: 'A journal day as quiet grey words',
    description: 'A link to a journal day (“Oct 21st, 2026”) is grey words with no underline, the text colour while you point at it.' },
  { key: 'linkMarks', type: 'boolean', default: true, title: 'A small mark before a link, saying what sort of thing it opens',
    description: 'Just before a link to a page whose tag sits under Entity, Occurrence, Phenomena or Information, a small grey mark: ∃, the logical symbol, for Entity (a person, a hospital), a ring for Occurrence (a consultation), a wave for Phenomena (a symptom), three dots, ∴, for Information, which includes knowledge (a report, a finding). A link to an untagged page, a journal day, a tag or a page under two of these has none.' },
  { key: 'tagsHeading', type: 'heading', default: null, title: 'Tags and the title row', description: 'A tag as a class name, a page\u2019s place in the tree beside its title, and the mark where its icon would be.' },
  { key: 'tagsAsClasses', type: 'boolean', default: true, title: 'A tag as its name in mono',
    description: 'A tag reads as its name alone, as you wrote it, in a monospace face a step smaller, grey, without the #, where Logseq puts it: at the end of a bullet’s words and at the right end of a page’s title row. The × that removes it takes the #’s place under the pointer, so the name does not move.' },
  { key: 'tagChain', type: 'boolean', default: true, title: 'A page’s tag and the tags above it, beside its title',
    description: 'The right end of a page’s title row reads its tag and the tags that tag sits under, nearest first: “Doctor / Person / Entity” on Dr. Mei Chen; on a tag’s own page, only the tags above it. Each name opens its page; Shift-click opens it in the right sidebar. Under the pointer, an × before a tag the page holds takes it off.' },
  { key: 'tagChainSidebar', type: 'boolean', default: true, title: 'The same line under a page’s name in the right sidebar',
    description: 'A page opened in the right sidebar reads its tags and the tags above them under its name, with the same ×.' },
  { key: 'pageMark', type: 'boolean', default: true, title: 'The sort’s mark where a page’s icon would be',
    description: 'Left of a page’s title, where Logseq shows an icon you set, the mark of what sort of thing the page is, until you set an icon of your own. Also in the left sidebar’s lists, in place of the plain page icon.' },
  { key: 'hideTitleWords', type: 'boolean', default: true, title: 'Leave out “Add icon” and “Set property” by a title',
    description: 'Logseq shows “Add icon” and “Set property” by a page’s title while the pointer is over it. They are left out and their room kept, so nothing moves.' },
  { key: 'propsHeading', type: 'heading', default: null, title: 'Properties', description: 'How a property\u2019s name and value read in a page\u2019s list and under a node.' },
  { key: 'propertyIcons', type: 'boolean', default: true, title: 'In a page’s list, an icon of what each property holds',
    description: 'In the list under a page’s title, a property’s name starts with an icon of what it holds: three dots joined in a triangle for a link to nodes, a calendar for a date, letters for words, 123 for a number, a box for a choice. An icon you gave a property yourself stays. Under a node, a property is plain text, with Logseq’s dot and no icon, whatever this says.' },
  { key: 'propertyNameTips', type: 'boolean', default: true, title: 'A cut property name whole under the pointer',
    description: 'With the pointer on a property’s name that Logseq has cut short, its whole name shows as a tooltip.' },
  { key: 'quietNames', type: 'boolean', default: true, title: 'Property names lighter than their values',
    description: 'A property’s name is a shade lighter than its value, under a bullet and in a page’s list alike; the value keeps the text colour.' },
  { key: 'noCapsules', type: 'boolean', default: true, title: 'Properties without capsules',
    description: 'A bullet’s properties read as “Provider: Dr. Mei Chen · Date: Oct 21st”: no edge, no fill, a faint dot between one property and the next. When the keyboard is on one, a thin grey ring goes round it.' },
  { key: 'quietAddProperty', type: 'boolean', default: true, title: '“Add property” as a faint word',
    description: 'Logseq’s “+ Add property” is a filled button, the loudest thing under a page’s title. It becomes a faint word, the text colour under the pointer.' },
  { key: 'hideDatePencil', type: 'boolean', default: true, title: 'No pencil after a date',
    description: 'Logseq puts a small pencil after a date value; it is left out. A click on the date still opens the date picker.' },
  { key: 'quotesHeading', type: 'heading', default: null, title: 'PDF quotes', description: 'What a quote from a PDF looks like.' },
  { key: 'quoteBullets', type: 'boolean', default: true, title: 'A quote’s bullet is a quotation mark',
    description: 'A highlight from a PDF, and a bullet that is nothing but a highlight cited, has a quotation mark where the dot would be. A note with words of its own beside the citation keeps its dot.' },
  { key: 'foldedHeading', type: 'heading', default: null, title: 'Folded nodes', description: 'What a folded node says after its words.' },
  { key: 'foldedNote', type: 'boolean', default: true, title: 'A folded node says what is under it',
    description: 'After the words of a folded node, small and grey, led by ↳: a circle with the number of unfinished tasks under it, then its pictures, quotes, PDFs, files and links with how many of each (a link in the words, to a node or a web address, each counted once), then up to three of the tags inside (no number on them), then the nearest due day, or “was due” once it has passed. Shown only while the node is folded.' },
  { key: 'sidebarHeading', type: 'heading', default: null, title: 'The right sidebar', description: 'The bar on top of it and the items in it.' },
  { key: 'sidebarBar', type: 'boolean', default: true, title: 'The bar on top plain, its views quiet words',
    description: 'The bar on top of the right sidebar takes the page’s own ground with a fine line under it, where Logseq paints it blue grey; Contents, Page graph and Help read as quiet words in the text colour; the “(Dev)” views that developer mode adds are left out.' },
  { key: 'sidebarFlat', type: 'boolean', default: true, title: 'Items flat, a line between them',
    description: 'The pages and blocks in the right sidebar lie flat on it, with no card, shadow or rounded corner, and a line separates one from the next.' },
];
const setting = key => { const item = schema.find(s => s.key === key); const v = logseq.settings?.[key]; return item && typeof v === typeof item.default ? v : item?.default; };
/* The specimens the settings window shows: each setting as the thing itself, drawn with Look's own pieces as it will look
   with the setting on, and as Logseq leaves it with the setting off. */
const link = (name, sort, on = true) => `<span class="lk-node${on ? '' : ' sw-blue'}"${on && sort ? ` data-lk-sort="${sort}"` : ''}>${name}</span>`;
const SPECIMENS = {
  quietLinks: on => `Spoke with ${link('Dr. Mei Chen', null, on)} about the ${link('fatigue', null, on)}`,
  quietDays: on => `Seen on <span class="${on ? 'sw-k' : 'sw-blue'}">Oct 21st, 2026</span>`,
  linkMarks: on => `Video call with ${link('Dr. Mei Chen', on && 'entity')} about the ${link('fatigue', on && 'phenomenon')}; she wants the ${link('CT report', on && 'information')} before the next ${link('consultation', on && 'occurrence')}`,
  tagsAsClasses: on => `Spoke with Dr. Mei Chen about the fatigue &nbsp; ${on ? '<span class="lk-tag">Consultation</span>' : '<span class="sw-blue sw-chip">#Consultation</span>'}`,
  tagChain: on => `<span class="sw-line"><span class="sw-big">Dr. Mei Chen</span><span style="margin-left:auto">${on ? '<span class="lk-tag">Doctor</span><span class="sw-sep">/</span><span class="lk-tag">Person</span><span class="sw-sep">/</span><span class="lk-tag">Entity</span>' : '<span class="sw-faintw sw-chip">#Doctor</span>'}</span></span>`,
  tagChainSidebar: on => `<span class="sw-k">Dr. Mei Chen</span><br>${on ? '<span class="lk-tag">Doctor</span><span class="sw-sep">/</span><span class="lk-tag">Person</span><span class="sw-sep">/</span><span class="lk-tag">Entity</span>' : '<span class="sw-faintw">(nothing)</span>'}`,
  pageMark: on => `<span class="sw-big">${on ? `<span class="lk-page-mark">${Look.kit.markSvg('entity')}</span>` : ''}Dr. Mei Chen</span>`,
  hideTitleWords: on => `<span class="sw-faintw" style="font-size:12px;${on ? 'visibility:hidden' : ''}">Add icon &nbsp; Set property</span><br><span class="sw-big">Dr. Mei Chen</span>`,
  propertyIcons: on => `<span class="sw-big">Chest X-ray results</span><br><span class="sw-pill">${on ? `<span class="lk-kind">${Look.kit.kindIconHtml('node')}</span>` : '<span class="sw-dot"></span>'}<span class="sw-k">Provider</span> ${link('Dr. Mei Chen', 'entity')}</span><br><span class="sw-pill">${on ? `<span class="lk-kind">${Look.kit.kindIconHtml('text')}</span>` : '<span class="sw-dot"></span>'}<span class="sw-k">Findings</span> nodule in the right upper lobe</span>`,
  propertyNameTips: on => `<span class="sw-k">Referring consul…</span>${on ? ' &nbsp; <span class="sw-chip">Referring consultant at Northgate</span>' : ''}`,
  quietNames: on => `<span class="${on ? 'sw-k' : ''}">Provider:</span> ${link('Dr. Mei Chen', 'entity')} <span class="sw-sep">·</span> <span class="${on ? 'sw-k' : ''}">Date:</span> Sep 3`,
  noCapsules: on => on ? `<span class="sw-k">Provider:</span> ${link('Dr. Mei Chen', 'entity')} <span class="sw-sep">·</span> <span class="sw-k">Date:</span> Sep 3` : `<span class="sw-cap"><span class="sw-k">Provider:</span> ${link('Dr. Mei Chen', 'entity')}</span> &nbsp;<span class="sw-cap"><span class="sw-k">Date:</span> Sep 3</span>`,
  quietAddProperty: on => on ? `<span class="sw-faintw" style="font-size:13px">+ Add property</span>` : `<span class="sw-chip" style="font-weight:600;font-size:13px;padding:3px 10px">+ Add property</span>`,
  hideDatePencil: on => `<span class="sw-k">Date:</span> Sep 3${on ? '' : ' <span class="sw-faintw">✎</span>'}`,
  sidebarBar: on => on ? `<span class="sw-line" style="padding:4px 8px;box-shadow:0 1px 0 var(--sw-hair)"><span class="sw-k">Contents</span><span class="sw-k">Page graph</span><span class="sw-k">Help</span></span>` : `<span class="sw-line" style="padding:4px 8px;background:#d8e1e8;color:#222"><span>Contents</span><span>Page graph</span><span>Help</span><span>(Dev) RTC</span><span>(Dev) Profiler</span></span>`,
  sidebarFlat: on => on ? `<span style="display:block;padding:2px 0;border-top:1px solid var(--sw-line)">▸ Dr. Mei Chen</span><span style="display:block;padding:2px 0;border-top:1px solid var(--sw-line)">▸ Oct 19th, 2026 / This week</span>` : `<span class="sw-chip" style="display:block;box-shadow:0 2px 6px rgba(0,0,0,.15);margin-bottom:6px;padding:2px 8px">▸ Dr. Mei Chen</span><span class="sw-chip" style="display:block;box-shadow:0 2px 6px rgba(0,0,0,.15);padding:2px 8px">▸ Oct 19th, 2026 / This week</span>`,
  quoteBullets: on => `${on ? '<span class="sw-faintw" style="margin-right:.4em;font-family:Georgia,serif">“</span>' : '<span class="sw-dot"></span>'}In this study, 34% of patients fulfilled the criteria`,
  foldedNote: on => `<span class="sw-ring"><span class="sw-dot" style="margin:0"></span></span>This week${on ? ` <span class="lk-folded" style="margin-left:.5em"><span class="lk-lead">↳</span><span class="lk-pair">${Look.kit.iconHtml('circle')}<span>3</span></span><span class="lk-pair">${Look.kit.iconHtml('photo')}<span>2</span></span><span class="lk-pair">${Look.kit.iconHtml('link')}<span>4</span></span><span class="lk-sep">·</span><a class="lk-tag">Consultation</a><span class="lk-sep">·</span><span>due Oct 19</span></span>` : ''}`,
};
const specimen = (item, value) => SPECIMENS[item.key] ? SPECIMENS[item.key](!!value) : '';
Look.settings = { schema, setting, specimen };
})();
