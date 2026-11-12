/* Loaded by main.js with the other parts. Kept in its own scope; main.js starts and stops it. */
(() => {
/* Two-way links part of Threads. A link made by a field reads the same from both ends.
   On the record that holds the field it is a property row, "report: Chest X-ray 2026-08-03". On the page it
   points to, Logseq lists the record under a tab named after the record's tag ("Appointment"), below the
   page's own blocks, so nothing there says how the two belong together. This part draws the far end as a
   row in the page's own property list, with grey names like any property's, read-only:
     report of →    Chest X-ray Aug 3 · Appointment
     doctor of →    9 Appointments · next Nov 12 ▾   (opens into the list of those records)
   One row per field that points here, named by the field read backwards ("doctor" → "doctor of", "prescribed
   by" → "prescribed", or a name from the twoWayNames setting). Up to three records show inline; more become
   a count with the nearest date, which opens into the list (open to begin with, as asked: "the details …
   should by default be unfolded"). Only your own Node properties count; tags, aliases and mentions in
   sentences stay in Linked references. Drawn for the page in the main view only. Reading the rows writes nothing; what
   writes is what you press: the + that adds a node, the picking bar's actions and writing into a node, each through
   the model with an Undo arrow. The tag tree
   changes how a field reads backwards, and turns its row off, through this part's settings.
   On the kit (the pages): the rows keep their own layout (one set of columns: the
   day where Logseq's values start, the name, its tag right after it, the tick box in the margin) and draw
   everything else with the kit: a tag as a class (mono, no #), the tick box, the picking bar as the library's lk-bar
   above the rows, filters as words, the fold chevron and the arrow after a name from Logseq's font, the +
   as the library's lk-plus, the draft line's field, the menus and the lists as the kit's pop-up
   placed by the browser, a question beside what it asked, the hover card; the graph is read and written only
   through the model's doors, the page and settings changes come from the core; no logseq.* call here. */
const shared = window.Threads.shared;
const { host, openEntity, openPageNamed, notify, esc, iconHtml } = shared;
const base = window.PluginDoor.base('threads', { prefix: 'Threads (two-way): ', leaves: { elements: '.th-two-way' } });
const { warnOnce, onStop: onUnload, listen } = base, runUnloadTasks = () => base.stop();

const settingsSchema = [
  { key: 'twoWayHeading', type: 'heading', group: 'reading', rank: 3, title: 'Threads', default: null,
    legend: 'Records that point at this page, as rows in its own properties',
    zone: '<div><span class="m">doctor of →</span> &nbsp;<u>9 Appointments</u> <span class="m">· next Nov 12</span></div>',
    description: 'Changes here apply right away.' },
  { key: 'twoWayRows', type: 'boolean', title: 'Links read the same from both ends', default: true,
    description: 'On a page that one of your properties points to (a doctor named as the “doctor” of visits, a report named as the “report” of a scan), each such property becomes a row in the page’s own property list, with an arrow after its name: “doctor of →   9 Appointments · next Nov 12”. Up to three nodes show by name; more show as a count that opens into the list. Click a node’s name to open it (Shift-click: in the sidebar); rest the pointer on it to see its properties and first lines. Click the property’s name to open the property; right-click it to change how it reads here. In a list with several kinds of nodes, click a kind to show only those. The + at the end of a row adds a new node with that property pointing here (Undo is the faded arrow after the row’s name). Tick the box before nodes (Shift-click a box: every one between) to act on them together: open in the sidebar, change this page to another one in their property, take the link off, add a tag, copy, set or clear a property, or delete them. A list of more than three can be grouped: the word “group” after its count (or right-click the name, “Group by…”) groups it by tag, month or any property its nodes hold, each group folding, and the + at the end of a group adds a node with that group’s tag or value already set. The chevron before a node’s name opens it under its name: its properties, what points at it and its first bullets, with a faint empty bullet to write a new one in; nodes open in place until one would break its lines, then the outline shifts by one level: the outermost goes into the way back above, the next reads like a page at the top. While you type a new node’s words in the + line, what it would get shows under the line in grey, as the proposals do in a bullet (a guess with a dotted line under it): Enter takes everything shown, a click on a guess keeps that one and lets the other guesses go, Escape clears them until you type again; a page’s name typed in the words completes in grey after the cursor, and the Right arrow links it. The same in the empty bullet of an opened node. The node’s properties show above its bullets there; click what one holds to change it (the likely values first), and the faded Undo arrow puts it back. After Enter the + line stays open, empty, for the next node; Escape closes it. Changing this page to another for the picked nodes lists first the pages their own words name.' },
  { key: 'twoWayDays', type: 'boolean', title: 'Show each node’s day in the margin', default: true,
    description: 'Each node in the rows shows its day (its own date, or the day it was written on) in a column at the left. Off, the column goes and the rows move left into its place; the day still shows in the card when you point at a node, and the find line still finds it.' },
  { key: 'twoWayNames', hidden: true, type: 'string', title: 'How properties read on the other page', default: '',
    list: { pairs: '=', split: ';', suggest: 'properties', left: 'Property', right: 'Reads back as', about: 'A row on the page a property points to is named by the property itself (“Provider”). Give other words here, or from the row’s right-click, or the Properties table’s Reads back as cell.' },
    description: 'Other words for a row on the page a property points to, as “property = words; property = words”. A property not listed is named by itself (“Provider”), nothing added.' },
  { key: 'twoWayOneEnd', hidden: true, type: 'string', title: 'Properties hidden on the other page', default: '',
    list: { split: ';', suggest: 'properties', about: 'Properties whose link is not shown as a row on the page they point to, for a property that points at a busy page (a status, a city with hundreds of people). The link stays in that page’s Linked references and in searches. Set from the tag tree as well.' },
    description: 'Properties whose link is not shown as a row on the page they point to, as “property; property”. Useful for a property that points at a busy page (a status, a city with hundreds of people). The link itself stays: it still shows in that page’s Linked references and in searches. Set from the tag tree as well.' },
  { key: 'twoWayMentions', type: 'boolean', title: 'Mentions come up to the rows', default: true,
    description: 'On a page, the nodes whose words link it (“Called [[Dr. Mei Chen]] about the scan”) show as one more row under the rows from properties, “Mentioned in”, with their day and tag, folding, grouping and tick boxes like the other rows. Logseq still lists them under Linked references too. A node that points here through a property shows in that property’s row only. Tick a mention that has no tag and the bar offers to make it a node: the tag its words look like first, with the property that would point at this page (“Make it a Conversation · Spoke with Dr. Mei Chen”). Its words stay as they are; the faded Undo arrow takes it back. A mention whose words look like a kind says so after its line, pencilled (“could be a Consultation · Provider”); its ×, under the pointer, says no: the suggestion goes and is not shown again, the faded arrow puts it back, and right-click “Mentioned in”, Show the suggestions taken off, brings the page’s back. Right-click “mentioned in” to hide the row on that page.' },
  { key: 'twoWayCouldBeOff', hidden: true, type: 'string', title: 'Mentions whose “could be” suggestion was taken off', default: '',
    description: 'The mentions (by id) whose pencilled “could be a …” was taken off with its ×, so it is not shown again. Right-click “Mentioned in”, Show the suggestions taken off, brings this page’s back.' },
  { key: 'twoWayMentionsHidden', type: 'string', title: 'Pages without the mentions row', default: '',
    list: { split: ';', about: 'Pages where the “Mentioned in” row is left out, for a page almost everything names. Set from the row itself: right-click “Mentioned in”, Hide mentions on this page. The mentions stay in the page’s Linked references.' },
    description: 'Pages where the “Mentioned in” row is left out, as “page; page”, for a page almost everything names. Set from the row itself: right-click “Mentioned in”, then Hide mentions on this page. The mentions stay in the page’s Linked references.' },
  { key: 'twoWayHideLinkedRefs', type: 'boolean', title: 'Leave out Logseq’s Linked references the rows replace', default: true,
    description: 'Logseq’s Linked references at the foot of a page list every node that links the page, under the page and bullets it sits in. The rows above show the same nodes: through a property, read backwards, and in “mentioned in” with the bullets they sit in, each opened in place. So on a page with rows, Linked references is left out. Not on a tag’s page (its nodes are Logseq’s own table there), nor on a journal day (where it also lists the tasks scheduled or due that day), nor where “mentioned in” is hidden. Off: Linked references shows as well. Unlinked references always stays.' },
  { key: 'twoWayHideTagLists', type: 'boolean', title: 'Leave out Logseq’s tag lists the rows repeat', default: true,
    description: 'Below a page’s own text, Logseq lists the nodes that link to the page under a heading named after their tag (“Appointment”, “Project”), for tags with two-way links turned on. The rows above already show those nodes, with the property that links them, so on a page that has the rows the list is left out. In the right sidebar it is left out always: the same nodes are in the page’s Linked references there. Off: Logseq’s list shows as well.' },
];
const setting = shared.settingReader(settingsSchema);
let UUID, isEntityId, watchDomEarly, addsElements, sendStyle, provided, uuidsIn, saveSettings, onPageChange, onDatabaseChange, onSettingsChange, model;
// Where the part and its pieces (parts/two-way/*.js, loaded after this file) meet: each gives what the others use, and they
// reach it through twoWay when they run, so the order they load in does not matter.
const twoWay = {};
const take = (core, names) => shared.take(core, names, warnOnce);

// What is known about the page on screen: its uuid and one group per field that points at it.
// byPage: each page's rows as last read this session, drawn at once when you come back to it.
// indexed: every page's rows were read in one look-up, so a page not in byPage has none, and a page
// opened for the first time gets its rows in the same frame as its title instead of half a second later.
// open, all and only: per row, whether its list is open, shows every record, or only one kind ("Infusion").
const state = { kindsAll: new Set(), listed: [], findDug: new Map(), findAsked: new Set(), version: 0, pageUuid: '', groups: [], byPage: new Map(), indexed: false, open: new Map(), all: new Set(), only: new Map(), box: null, html: '', picked: new Set(), lastPick: '', group: new Map(), values: new Map(), nodeDraft: null, mentionsOf: new Map(), raise: new Map(), kids: new Set(), selecting: new Set(), dig: new Map(), focus: '', fresh: '', node: new Map(), nall: new Set(), ball: new Set(), steps: [], pageTitle: '', kept: new Map(), find: '', drawingTop: false, pagesRead: null, linksShut: new Set(), emptyOpen: new Set(), keepEmpty: new Set() };
// Where the pieces join the part's load and start (7 November 2026): loadHooks(page, groups) may give the groups back changed, settledHooks() run once the page's state stands, starters() when the part starts.
const loadHooks = [], settledHooks = [], starters = [], clickHooks = [];
/* Where the pieces join a list's drawing (7 November 2026, the forty): listHooks(group, key, items) may give the nodes back
   narrowed or reordered; headHooks(group, key, items) add words to a head; underHeadHooks(group, key, items) a line under it
   while open; leadHooks(group, item) a mark before a node's name; betweenHooks(group, item, prev) a line before a node;
   lineMenuHooks(group, item) and rowMenuHooks(group) items for the right-click menus. */
const tailHooks = [], viewMenuHooks = [], listHooks = [], headHooks = [], underHeadHooks = [], leadHooks = [], betweenHooks = [], lineMenuHooks = [], rowMenuHooks = [];
// Today's number and a day in words are the door's (plugin.js, Door.dates): one rule in every module.
const todayNumber = () => window.PluginDoor.dates.today();
const dayText = day => window.PluginDoor.dates.words(day);
// A tag's name is a singular noun, or an illness that ends in s whatever the number: Diagnosis, Diagnoses; Measles, Measles.
// The kind of a node as a word: a node with no tag has none.
const tagWord = tag => tag === 'note' ? 'node' : tag;
const plural = (word, n) => n === 1 ? word : /[^aeiou]y$/i.test(word) ? word.slice(0, -1) + 'ies' : /sis$/i.test(word) ? word.slice(0, -2) + 'es' : /(ss|us|x|z|ch|sh)$/i.test(word) ? word + 'es' : /s$/i.test(word) ? word : word + 's';
/* How a row is named (the owner, 2026-10-26: "we should get rid by default of adding these prepositions like of",
   "but still keep features of changing name"; "why are you adding an arrow?"): by the property's own name, as it is
   written, nothing added ("Provider", not "provider of"; the older readings are gone). Other words are
   given in the twoWayNames setting, from the row's right-click or the Properties table's Reads back as cell. The pairs
   this setting held by default until now ("works at = works here" and the like) were never chosen, so they are passed
   over; a pair giving a property its own name again is no renaming. */
const OLD_DEFAULTS = new Set(['symptoms|logged in', 'ask|asked', 'works at|works here', 'insurer|insurer of', 'related|related to']);
/* Names from the other end (11 November 2026, the owner: "I want it to happen automatically", and "I preferred more connector
   type names with preposition or relational, but not always"; then their pick of the cloud model with grammar behind it). A row
   with no name of the owner's reads by the name Apple's larger model in Private Cloud Compute gives for it ("Located in" →
   "Location of"), asked once for each property in the background (nameByCloud) and kept in twoWayCloudNames, in the same
   "Located in = Location of" pairs; until it has answered, or where it cannot be reached, by grammar (byGrammar). The model is sent
   only the property's and tags' names (the owner, 3 November 2026: the cloud for the ontology alone). A name the owner gives,
   the property's own name too, always wins. twoWayAppleNames, the on-device model's names of 0.3.70 (2 good of 16), is passed over. */
const pairsOf = text => String(text || '').split(/[;\n]/).map(pair => pair.split('=').map(part => part?.trim())).filter(([field, words]) => field && words);
const appleOn = () => setting('proposalsModel') !== false;
/* The property read from the other end by English grammar (11 November 2026, the owner: "a more sophisticated way ... by having a
   set of words or libraries rather than simple heuristics"): compromise (vendor/compromise.js) gives the verb forms, plurals and
   parts of speech, and word lists below give what grammar alone cannot know: the noun a verb makes ("Located in" → "Location
   of"), what an active verb with its preposition reads as ("Works at" → "Employer of"), which links run both ways ("Spoke with"),
   the roles ("Provider" → "Provider of") and the verbs a property is named by ("Treats" → "Treated by", where "Notes" stays a
   plural). Any other noun ("Topic", "Hospital") keeps its name. Without the library (a test's stand-in), every name as it is. */
function makeReadsBack(nlp) {
  // A link that reads the same from both ends.
  const BOTH = new Set(['spoke with', 'talked to', 'talked with', 'met', 'met with', 'married to', 'related to', 'linked to', 'connected to', 'sibling', 'friend', 'partner', 'colleague', 'spouse', 'neighbour', 'neighbor', 'see also', 'related', 'same as', 'similar to']);
  // The noun a verb makes, for "<verb>ed in/with/at" ("Located in" → "Location of").
  const NOUN = { locate: 'location', diagnose: 'diagnosis', specialize: 'specialty', specialise: 'specialty', specialized: 'specialty', specialised: 'specialty', born: 'birthplace', prescribe: 'prescription', treat: 'treatment', admit: 'admission', publish: 'publication', base: 'base', bear: 'birthplace', bury: 'burial place', hold: 'venue', host: 'host', store: 'storage', record: 'record', mention: 'mention', file: 'file', list: 'list', train: 'training', educate: 'school', employ: 'employer', register: 'register', enrol: 'school', enroll: 'school', insure: 'insurer', house: 'home', set: 'setting', found: 'founding', stage: 'venue', infect: 'infection', vaccinate: 'vaccine', expose: 'exposure', involve: 'involvement', interest: 'interest', qualify: 'qualification' };
  // What an active verb with its preposition reads as from the other end ("Works at" → "Employer of").
  const ACTIVE = { 'work at': 'Employer of', 'work for': 'Employer of', 'work in': 'Workplace of', 'live in': 'Home of', 'live at': 'Home of', 'belong to': 'Owner of', 'report to': 'Manager of', 'come from': 'Origin of', 'refer to': 'Referred to in', 'study at': 'School of', 'stay at': 'Stay of', 'take place in': 'Place of', 'take place at': 'Place of', 'happen at': 'Place of', 'happen in': 'Place of', 'occur in': 'Place of', 'lead to': 'Led to by', 'result in': 'Resulting from', 'depend on': 'Needed by', 'rely on': 'Relied on by', 'respond to': 'Response from', 'point to': 'Pointed to by', 'apply to': 'Applies to', 'go to': 'Visited by', 'attend at': 'Attended by' };
  // A verb whose passive takes "in" ("Mentioned in"), not "by".
  const IN = new Set(['mention', 'include', 'cite', 'list', 'feature', 'contain', 'show', 'name', 'describe', 'record', 'note', 'quote', 'reference']);
  // A role whose other end is another role ("Parent" → its other end lists the children: "Parent of").
  const ROLE = /^(parent|child|mother|father|son|daughter|owner|author|guardian|carer|caregiver|nurse|doctor|physician|surgeon|therapist|manager|editor|host|teacher|student|patient|client|employer|employee|tenant|landlord|mentor|supervisor|sponsor|insurer|provider|prescriber|referrer|member|founder|leader|head|chair|lead)$/i;
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const like = (src, out) => /^[A-Z]/.test(src) ? cap(out) : out;   // the property's own capitals
  const conj = verb => { try { return nlp(verb).verbs().conjugate()[0] || {}; } catch (e) { return {}; } };
  const participle = verb => { const c = conj(verb); return c.Participle || c.PastTense || verb; };
  const infinitive = word => { const c = conj(word); return c.Infinitive || word; };
  const plural = noun => { try { return nlp(`the ${noun}`).nouns().toPlural().text().replace(/^the /, '') || noun; } catch (e) { return noun; } };
  // The verbs a property is named by in the present ("Treats"); any other word ending in s is read as a plural ("Notes").
  const RELATION_VERBS = new Set(['treat', 'mention', 'include', 'cause', 'cite', 'contain', 'use', 'own', 'cover', 'visit', 'prescribe', 'require', 'support', 'follow', 'affect', 'replace', 'manage', 'employ', 'attend', 'describe', 'reference', 'precede', 'block', 'fund', 'host', 'teach', 'monitor', 'measure', 'track', 'answer', 'refute', 'contradict', 'confirm', 'explain', 'diagnose', 'administer', 'order', 'perform', 'produce', 'create', 'influence', 'trigger', 'prevent', 'relieve', 'worsen', 'improve', 'feature', 'list', 'quote', 'summarize', 'summarise', 'review', 'supervise', 'insure', 'serve', 'see', 'refer', 'cure', 'target', 'inhibit', 'interact']);
  const isParticiple = word => { const t = nlp(`It was ${word} by them.`).terms().json()[2]?.terms[0].tags || []; return t.includes('Verb') && (t.includes('PastTense') || t.includes('Participle') || t.includes('Passive')); };

  return function readsBack(name) {
    const said = String(name || '').trim(), low = said.toLowerCase().replace(/\s+/g, ' ');
    if (!said) return said;
    if (BOTH.has(low)) return said;
    const words = low.split(' '), last = words[words.length - 1], head = words.slice(0, -1).join(' ');
    const PREP = new Set(['by', 'in', 'at', 'with', 'on', 'from', 'to', 'for', 'of', 'into', 'about', 'under', 'through']);
    if (words.length >= 2 && PREP.has(last)) {
      if (last === 'of') return like(said, plural(head));                                                    // Symptom of → Symptoms
      const first = words[0];
      if (last === 'by' && isParticiple(first)) return like(said, head);                                    // Prescribed by → Prescribed
      const noun = words.length === 2 && last !== 'by' && (NOUN[first] || (isParticiple(first) && NOUN[infinitive(first)]));
      if (noun) return like(said, `${noun} of`);                                                            // Located in → Location of
      if (words.length === 2 && isParticiple(first)) return said;
      const verb = infinitive(first), key = [verb, ...words.slice(1)].join(' ');
      if (ACTIVE[key]) return like(said, ACTIVE[key]);                                                      // Works at → Employer of
      return said;
    }
    if (words.length === 1 && /s$/.test(low)) {                                                              // Treats → Treated by
      const verb = [infinitive(low), low.slice(0, -1), low.slice(0, -2)].find(v => v !== low && RELATION_VERBS.has(v));
      if (verb) return like(said, `${participle(verb)} ${IN.has(verb) ? 'in' : 'by'}`);
    }
    if (words.length === 1 && ROLE.test(low)) return `${said} of`;                                           // Provider → Provider of
    return said;                                                                                              // Topic, Hospital: as it is
  };
}
const byGrammar = (() => {
  const read = typeof window.nlp === 'function' ? makeReadsBack(window.nlp) : null, kept = new Map();
  return name => {
    if (!read) return name;
    if (!kept.has(name)) { let out = name; try { out = read(name) || name; } catch (error) { out = name; } kept.set(name, out); }
    return kept.get(name);
  };
})();
function backwardsNames() {
  const names = new Map();
  if (appleOn()) for (const [field, words] of pairsOf(setting('twoWayCloudNames'))) names.set(field.toLowerCase(), words);
  // The owner's own, over the model's; their property's own name typed in keeps the row on it.
  for (const [field, words] of pairsOf(setting('twoWayNames'))) {
    if (OLD_DEFAULTS.has(`${field.toLowerCase()}|${words.toLowerCase()}`)) continue;
    names.set(field.toLowerCase(), words);
  }
  return names;
}
const ownedName = name => pairsOf(setting('twoWayNames')).some(([field, words]) => field.toLowerCase() === name.toLowerCase() && !OLD_DEFAULTS.has(`${field.toLowerCase()}|${words.toLowerCase()}`));
const cloudHas = name => pairsOf(setting('twoWayCloudNames')).some(([field]) => field.toLowerCase() === name.toLowerCase());
const readBackwards = (name, names) => names.get(name.toLowerCase()) || byGrammar(name);

// Fields shown from one end only: "status; city" -> Set of lower-case names.
const oneEndNames = () => new Set(String(setting('twoWayOneEnd') || '').split(/[;\n]/).map(name => name.trim().toLowerCase()).filter(Boolean));
// For the tag tree (parts/tags.js): how a field reads from the other end, and whether it shows there. Both
// are written to the settings above, so a change in the tree shows in the settings window too.
const backwardsLabel = name => readBackwards(name, backwardsNames());
function setBackwards(name, words) {
  words = String(words || '').replace(/[;=\n]/g, ' ').replace(/\s+/g, ' ').trim();
  const pairs = String(setting('twoWayNames') || '').split(/[;\n]/).map(pair => pair.split('=').map(part => part?.trim())).filter(([field, said]) => field && said && field.toLowerCase() !== name.toLowerCase());
  // Empty: no pair, so the row reads as it does by itself (the model's name, else by grammar). The property's own name typed in
  // is kept as a pair, so neither comes back over it.
  if (words) pairs.push([name, words]);
  saveSettings({ twoWayNames: pairs.map(([field, said]) => `${field} = ${said}`).join('; ') });
}
function setShownAtOtherEnd(name, shown) {
  const names = String(setting('twoWayOneEnd') || '').split(/[;\n]/).map(n => n.trim()).filter(n => n && n.toLowerCase() !== name.toLowerCase());
  if (!shown) names.push(name);
  saveSettings({ twoWayOneEnd: names.join('; ') });
}

async function load() {
  const version = ++state.version;
  let pageUuid = '', groups = [];
  try {
    if (setting('twoWayRows')) {
      const page = await model.currentPage();
      // A zoomed-in block comes back with a page of its own; only a page gets the rows.
      // A journal day too (Linked references shows on a day, so the rows do); the Journals list, with many days
      // on screen, gets none (see draw).
      if (page && !page.page && isEntityId(page.id)) {
        state.pageJournal = !!(page['journal?'] || page.journalDay);
        state.pageDay = Number(page.journalDay) || 0;
        state.replaces = false;
        pageUuid = String(page.uuid || '');
        state.pageId = page.id;
        state.pageTitle = String(page.title || page.originalName || page.name || '');
        // The page's own names, plain in its lines (C1, 7 November 2026): its title, then its aliases once read.
        state.ownNames = new Set([state.pageTitle.toLowerCase()]);
        ownNamesOf(page.id).catch(() => {});
        await readStatuses();
        groups = await groupsFor(page.id);
        const title = String(page.title || page.originalName || page.name || '').toLowerCase();
        if (!hiddenMentions().has(title)) {
          let read = !!(setting('twoWayMentions') && provided.mentionsInto);
          const mentions = await mentionsGroup(page.id, groups).catch(error => { read = false; warnOnce('could not read the nodes that name this page', error); return null; });
          if (mentions) groups = [...groups, mentions];
          // The rows replace Linked references on a page that is not a tag, once its mentions were really read: with
          // them off, or a read that failed, Linked references is the only place they are.
          // Not on a journal day: its Linked references also lists the tasks scheduled or due that day, through Logseq's own
          // properties, which the rows do not read.
          state.replaces = read && !state.pageJournal && !(await provided.kindOfPage?.(page.id).catch(() => null))?.isTag;
        }
        for (const hook of loadHooks) groups = (await hook(page, groups).catch(error => { warnOnce('a piece could not read for this page', error); return null; })) || groups;
        await twoWay.readValues(twoWay.groupedUuids(groups)).catch(error => warnOnce('could not read the values the rows are grouped by', error));
        // Which nodes have bullets under them, read before the rows are drawn, so no ring comes or goes after.
        await readKids(groups.flatMap(g => [...g.items, ...(g.since || [])].map(item => item.uuid)));
      }
    }
  } catch (error) { warnOnce('could not find the fields that point at this page', error); }
  if (version !== state.version) return;
  if (pageUuid !== state.pageUuid) { state.raise.clear(); state.raisePairs = null; }
  putBackOpen(pageUuid);
  state.pageUuid = pageUuid;
  state.groups = groups;
  state.readAt = performance.now();
  twoWay.peek.cache.clear();
  if (pageUuid) { state.byPage.set(pageUuid, groups); state.mentionsOf.set(pageUuid, groups.find(isMentions) || null); }
  for (const hook of settledHooks) { try { hook(); } catch (error) { warnOnce('a piece could not settle on this page', error); } }
  // What the open nodes hold, read again (each once), drawn when read.
  readOpen2();
  draw(host());
  // Asked the moment the page changed, Logseq can still have named the page being left: ask once more for the one on screen.
  const shown = shownPage(host());
  if (shown && shown !== pageUuid && state.retried !== shown) { state.retried = shown; later(0); }
}
// Which of these nodes have a bullet under them (model.withKids), kept for every draw: only those get the folded ring.
async function readKids(uuids) {
  const ask = uuids.filter(u => UUID.test(String(u)));
  if (!ask.length || !model.withKids) return;
  const held = await model.withKids(ask).catch(error => { warnOnce('could not read which nodes hold bullets', error); return null; });
  if (!held) return;
  for (const u of ask) { if (held.has(String(u).toLowerCase())) state.kids.add(String(u).toLowerCase()); else state.kids.delete(String(u).toLowerCase()); }
}
const hasKids = uuid => state.kids.has(String(uuid).toLowerCase());
const shownPage = doc => {
  const shown = doc ? [...doc.querySelectorAll('#main-content-container :is(.ls-page-title, .page-title) .ls-block[blockid]')].map(el => el.getAttribute('blockid')) : [];
  return shown.length === 1 ? shown[0] : '';
};
// A page's rows, with what points at its other names: a node holding an alias points at the page.
async function groupsFor(id) {
  const groups = (await groupsByPage(id)).get(id)?.groups || [];
  for (const other of await provided.aliasesOf?.(id) || []) {
    for (const group of (await groupsByPage(other)).get(other)?.groups || []) {
      const same = groups.find(g => g.name === group.name);
      if (!same) groups.push(group);
      else same.items = [...same.items, ...group.items.filter(item => !same.items.some(x => x.uuid === item.uuid))];
    }
  }
  return groups;
}
// A node's stored words as they read: links as the words they show, "saw [[Dr. Joe]]" as "saw Dr. Joe",
// "[the scan]([[CT]])" as "the scan", tags written in the words left out.
async function wordsOf(stored) { return plainWords(await linkedWordsOf(stored)); }
// The same words with their links kept ([[Page]], [words]([[Page]])), for a name that underlines them (7 November 2026, the
// owner: "lines in threads should contain under for the wikilinks"); tags written in the words are left out.
async function linkedWordsOf(stored) {
  let title = stored;
  try { title = await provided.readableTitle(title); } catch { /* the stored words, then */ }
  return String(title).replace(/\s+#(?:\[\[[^\]]*\]\]|[^\s#\[\]]+)/g, '').trim();
}
const plainWords = words => String(words).replace(/\[([^\[\]]+)\]\((?:\[\[[^\]]*\]\]|https?:\/\/[^\s)]+)\)/g, '$1').replace(/\[\[([^\]]+)\]\]/g, '$1').trim() || 'Untitled';
// Coming up first (nearest first), then the past (latest first), then nodes with no date.
const byWhen = today => (a, b) => (a.day >= today ? 0 : a.day ? 1 : 2) - (b.day >= today ? 0 : b.day ? 1 : 2) ||
  (a.day >= today ? a.day - b.day : b.day - a.day) || a.title.localeCompare(b.title);
/* Mentions come up to the rows (the owner's pick A, "do A
   and B"): the nodes whose own words link this page, which Logseq shows only in Linked references at the foot, as one
   more row after the rows from properties, "Mentioned in", drawn and worked like them (folding, grouping, tick boxes,
   the arrow into a node). A mention stays a mention: nothing is written by showing it. A node that points here through
   a property is in that property's row only. The row's name is MENTIONS, which no property can be called (Logseq
   trims a property's name), so the row's open state, order and grouping are kept like any row's. Hidden per page by the
   twoWayMentionsHidden setting (the right-click on its name). Read for the page on screen only, never for every page. */
const MENTIONS = ' mentioned in';
const isMentions = group => group?.name === MENTIONS;
const hiddenMentions = () => new Set(String(setting('twoWayMentionsHidden') || '').split(/[;\n]/).map(name => name.trim().toLowerCase()).filter(Boolean));
async function mentionsGroup(id, groups) {
  if (!setting('twoWayMentions') || !provided.mentionsInto) return null;
  const filed = new Set(groups.flatMap(g => g.items.map(item => item.uuid)));
  const found = (await provided.mentionsInto(id)).filter(m => UUID.test(m.uuid) && !filed.has(m.uuid));
  if (!found.length) return null;
  // What an untagged mention looks like, asked once each, a few at a time: at once when the earlier lines are
  // read, else after a quiet moment, since asking reads them, and a look at a page reads no whole graph.
  askQuietly.uuids = found.filter(m => !m.tag).slice(0, 30).map(m => m.uuid);
  clearTimeout(state.quiet);
  if (askQuietly.uuids.length) state.quiet = setTimeout(askQuietly, provided.earlierLinesRead?.() ? 0 : QUIET);
  // Each with the page and bullets it sits in, as Linked references shows it.
  const crumbs = provided.crumbsInto ? await provided.crumbsInto(id).catch(() => new Map()) : new Map();
  const items = await Promise.all(found.map(async m => { const words = await linkedWordsOf(m.title); return { uuid: m.uuid, title: plainWords(words), words, tag: m.tag || 'note', day: m.day, dayFrom: m.dayFrom || '', status: m.status || 0,
    crumbs: await Promise.all((crumbs.get(m.uuid) || []).map(async c => ({ uuid: c.uuid, name: await wordsOf(c.title) }))) }; }));
  items.sort(byWhen(todayNumber()));
  return { name: MENTIONS, label: 'Mentioned in', items, fieldUuid: '', ident: '', mentions: true };
}
const QUIET = 5000;
function askQuietly() { for (const uuid of askQuietly.uuids.splice(0)) twoWay.prepareRaise(uuid).catch(() => {}); }
askQuietly.uuids = [];
// Whether words being written reach this page's rows: a row's node or a node opened from it, a bullet under one of those, or
// a line that links this page. Writing elsewhere, or on this page itself, changes nothing the rows show.
function touchesRows({ blocks = [] } = {}) {
  const shown = new Set([...state.groups.flatMap(g => g.items.map(item => item.uuid)), ...state.node.keys()]);
  return blocks.some(b => shown.has(b.uuid) || shown.has(b.parent?.uuid) || (state.pageUuid && String(b.rawTitle || b.title || '').includes(state.pageUuid)) || b.refs?.some(ref => (ref?.id ?? ref) === state.pageId));
}
// The rows of one page (id), or of every page that is not a journal (no id), as a Map of page id to { uuid, groups }.
// The nodes that point at the pages come from the model (linksInto); this shapes them into rows.
async function groupsByPage(id) {
  const { pages, fields, records: found } = await provided.linksInto(id);
  if (!found.size) return new Map();
  const records = new Map();
  // The titles are made readable together: each one with a link in it asks the database for that link's name.
  await Promise.all([...found].map(async ([b, record]) => { const words = await linkedWordsOf(record.title); records.set(b, { uuid: record.uuid, title: plainWords(words), words, tag: record.tag || 'note', day: record.day, dayFrom: record.dayFrom || '', status: record.status || 0 }); }));
  const names = backwardsNames(), today = todayNumber(), oneEnd = oneEndNames();
  // What each property holds, for the icon before its name: a Date row on a journal day is a calendar, not the
  // triangle of a link to a node.
  const schema = !provided.propSchema ? null : await provided.propSchema().catch(error => { warnOnce('the properties’ kinds could not be read', error); return null; });
  const propOf = new Map((schema?.props || []).map(p => [p.title, p]));
  const kindOf = name => { const p = propOf.get(name); return p ? { kind: p.choices?.length ? 'choice' : p.type, many: !!p.many } : { kind: 'node', many: false }; };
  const result = new Map();
  for (const [page, { uuid, byField }] of pages) {
    const groups = [];
    for (const [name, set] of byField) {
      if (oneEnd.has(name.toLowerCase())) continue;
      const items = [...set].map(b => records.get(b)).filter(item => item && UUID.test(item.uuid));
      if (!items.length) continue;
      items.sort(byWhen(today));
      groups.push({ name, label: readBackwards(name, names), items, fieldUuid: fields.get(name)?.uuid || '', ident: fields.get(name)?.ident || '', ...kindOf(name) });
    }
    groups.sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label));
    result.set(page, { uuid, groups });
  }
  nameByCloud([...result.values()].flatMap(page => page.groups));
  return result;
}
/* Asks the cloud model for the rows that have no name yet, one property at a time, in the background, once a session each; the
   names are saved together when the round is over and the rows drawn again with them. */
const cloudAsked = new Set();
let cloudRound = null;
function nameByCloud(groups) {
  if (!appleOn() || cloudRound) return;
  const wanting = [...new Map(groups.filter(g => !isMentions(g) && !cloudAsked.has(g.name.toLowerCase()) && !ownedName(g.name) && !cloudHas(g.name)).map(g => [g.name.toLowerCase(), g])).values()];
  if (!wanting.length) return;
  cloudRound = (async () => {
    const got = [];
    // No helper, or no cloud model for this Mac: nothing is asked, and these rows not again this session; grammar names them.
    if (!await cloudReady()) { for (const group of wanting) cloudAsked.add(group.name.toLowerCase()); return; }
    for (const group of wanting) {
      if (stopped) return;
      cloudAsked.add(group.name.toLowerCase());
      const [best] = await readsBackOffers(group).catch(() => []);
      if (best) got.push([group.name, String(best).replace(/[;=\n]/g, ' ').trim()]);
    }
    if (!got.length || stopped) return;
    const kept = pairsOf(setting('twoWayCloudNames')).filter(([field]) => !got.some(([name]) => name.toLowerCase() === field.toLowerCase()));
    saveSettings({ twoWayCloudNames: [...kept, ...got].map(([field, words]) => `${field} = ${words}`).join('; ') });
    later(0); indexLater(0);
  })().catch(error => warnOnce('could not ask for the rows’ names', error)).finally(() => { cloudRound = null; });
}

// Every page's rows in one look-up, at the start and again when the graph has been still for a while. The
// page on screen still asks for its own rows, which are newer; this only lets a page show its rows from its first
// frame. In a graph with very many links it is read once, at the start, so typing never waits behind it.
const BIG_INDEX = 5000;
let indexVersion = 0, indexSize = 0;
async function loadIndex() {
  const version = ++indexVersion;
  if (!setting('twoWayRows')) { state.indexed = false; return; }
  await readStatuses();   // so a page shown from the index draws its circles from its first frame
  const all = await groupsByPage(null);
  if (version !== indexVersion) return;
  indexSize = 0;
  for (const { groups } of all.values()) for (const group of groups) indexSize += group.items.length;
  const fresh = new Map();
  for (const { uuid, groups } of all.values()) if (UUID.test(uuid) && groups.length) fresh.set(uuid, groups);
  // The mentions rows read this session stay with their pages (the index reads none: they are read page by page).
  for (const [uuid, mentions] of state.mentionsOf) if (mentions) fresh.set(uuid, [...(fresh.get(uuid) || []), mentions]);
  // The page on screen keeps what its own look-up found.
  if (state.pageUuid && state.byPage.has(state.pageUuid)) fresh.set(state.pageUuid, state.byPage.get(state.pageUuid));
  state.byPage = fresh;
  state.indexed = true;
  const want = [...fresh.values()].flatMap(twoWay.groupedUuids);
  if (want.length) await twoWay.readValues(want.slice(0, 2000)).catch(error => warnOnce('could not read the values the rows are grouped by', error));
}

// "9 Appointments · next on Nov 12", "4 Lab panels, 3 Imaging studies · from Aug 2 to Oct 9"; whenOnly: the day part alone.
// The days said in words (the owner: "unclear from the visuals what the date mean"): from the first to the last,
// or the next one still to come; the tip says where a node's day comes from (WHEN_TIP).
// dayOf: a node's day as the list goes by it (twoWay.dayIn, a date property chosen in View), else its own.
function summary(items, whenOnly = false, dayOf = item => item.day) {
  const counts = new Map();
  for (const item of items) counts.set(item.tag, (counts.get(item.tag) || 0) + 1);
  const kinds = [...counts].sort((a, b) => b[1] - a[1]).map(([tag, n]) => `${n} ${plural(tag, n)}`).join(', ');
  const today = todayNumber(), days = items.map(dayOf).filter(Boolean);
  const next = days.filter(day => day >= today).sort((a, b) => a - b)[0];
  let when = '';
  if (next) when = `next on ${dayText(next)}`;
  else if (days.length) { const first = Math.min(...days), last = Math.max(...days); when = first === last ? `on ${dayText(first)}` : `from ${dayText(first)} to ${dayText(last)}`; }
  return whenOnly ? when : [kinds, when].filter(Boolean).join(' · ');
}
// What the head's days are of (8 November 2026, the owner: "make it clear what the date is of"): the property most of them come
// from, or Journal for the day a node is written on; said in the tip under the pointer since 10 November (the audit's 26).
const whenTip = from => from === 'Journal' ? 'The journal day each node is written on' : `Each node’s ${from}`;
function headWhen(group, items) {
  const by = twoWay.dayChoice?.(group) || '';
  const when = summary(items, true, by === 'none' || !twoWay.dayIn ? undefined : item => twoWay.dayIn(group, item));
  if (!when) return { when: '', from: '' };
  // The days alone, "Aug 20 to Oct 29" (10 November 2026, the audit's 26: "Date from Aug 20 to Oct 29" glued the property's name to
  // the days; the grammar never shows a property's name with a day). What they are the days of is said under the pointer.
  const days = when.replace(/^from /, '');
  if (by === 'none' || !twoWay.listFrom) return { when: days, from: '' };
  return { when: days, from: twoWay.listFrom(group) };
}
const INLINE = 3, LISTED = 5;
/* Moving around the rows (the + and the hovers, the owner asked for the rows to be more interactive). A record's name
   opens it; Shift-click opens it in the sidebar (the icon at its
   end that did the same went on 31 October 2026). Resting on a record shows a card with its fields and first lines (peek, below). The field's
   name opens the field's own page. In an open list, a row of kinds ("All 13 · Infusion 8 · Scan 1") shows only
   that kind, as does a kind at the end of a line; a line marked "earlier" parts what is coming up from what is
   past; "show all 13" folds back with "show fewer". Whether a list is open is kept across restarts. */
/* A node's name: its own words, cut at a width, never at a sentence ("Clinic.", three times, could not be told apart; the
   review, 31 October). On a row the width is the row's (one line, with an ellipsis: the name in the stylesheet, its tag kept
   whole); opened, or while finding, it wraps; cut, the card shows the whole of it. This is for where words go in a sentence or a
   small place (a notice, a crumb, the trail). */
const NAME_ROOM = 60;
function shortName(title) {
  const text = String(title || '').trim();
  return text.length > NAME_ROOM ? text.slice(0, NAME_ROOM).replace(/\s+\S*$/, '') + '…' : text;
}
/* The + (at the owner's word: "return that code before we moved around the plus"): at the
   end of the last node of a short row, after the summary of a list. A click opens
   the line to type the new node in. A short row's nodes span the row so their tags line up, so the + sits
   just after the last node's date (or name). The library's lk-plus. */
const addLink = group => group.ident && state.draft?.field !== group.name ? `<button type="button" class="lk-plus lk-i-plus th-tw-add" aria-label="Add a${/^[aeiou]/i.test(twoWay.kindsOf(group)[0] || '') ? 'n' : ''} ${esc(twoWay.kindsOf(group)[0] || 'node')}" data-field="${esc(group.name)}" data-what="Add a${/^[aeiou]/i.test(twoWay.kindsOf(group)[0] || '') ? 'n' : ''} ${esc(twoWay.kindsOf(group)[0] || 'node')}"></button>` : '';
// The kit's tick box, in the margin left of the record (the kit's), drawn only on a list where picking was
// turned on from its View menu (the owner, 7 November 2026: "the select boxes now should only be shown when activated by a menu
// combined with the other ones"). Picking ends with the picks: Escape, the bar's box, or an action done.
const pickBox = (group, item) => state.drawingTop || !state.selecting.has(group.name) ? '' : pickOn(group, item);
const stopPicking = () => { state.picked.clear(); state.selecting.clear(); };
const pickOn = (group, item) => { const key = `${item.uuid}|${group.name}`, on = state.picked.has(key); state.listed.push(key); return `<input type="checkbox" class="lk-tick th-tw-pick" data-pick="${esc(key)}"${on ? ' checked' : ''} aria-label="Pick" title="Pick (Shift-click: every one from the last picked)">`; };
// A record's tag at the right opens the tag's page, Shift-click in the sidebar (the owner: "should be able to
// click on tag in two-way area on right side"); a tag reads as a class, mono with no # (the kit's tag).
const tagLink = item => item.tag && item.tag !== 'note' ? `<a class="th-tag lk-tag th-tw-tag" data-tag-page="${esc(item.tag)}" href="#">${esc(item.tag)}</a>` : `<span class="th-tag lk-tag th-tw-tag">${esc(item.tag)}</span>`;
// No sidebar icon at the end of a line (the review, 31 October: a control per row, and a long name left a blank line
// under itself where the icon wrapped); Shift-click on the name opens it in the sidebar, as everywhere in Logseq.
/* The rows on the kit's outline (the owner's drawings of 2026-10-26): every node on a line of its
   own, the tick box in the margin, its day in a column of one width, the one chevron right before its name, its tag
   after it. A row of more than three folds by the chevron before its count; its list opens under it. */
const O = shared.outline;
// On a journal day, a node of that day shows no day: the page's title says it.
const dayCell = item => item.day && item.day !== state.pageDay ? dayText(item.day) : '';
/* A list with a day on any of its nodes gives every line the day's column, right of the dot, so the words of each line
   start at one place; a list with none has no column and its words follow the dot (the owner, 7 November 2026). A day of
   another year widens the column for the whole list. */
const daysOf = group => [...group.items, ...(group.since || [])].map(item => twoWay.dayOf(group, item)).filter(Boolean);
const isDated = group => daysOf(group).length > 0;
// A list of one has no head, so its line says what its day is of; so does any line dated otherwise than its list's head says.
const aloneIn = group => group.items.length === 1 && !(group.found && group.total > 1) && !(group.since || []).length;
// The day column widens by the longest such name, for the whole list, so the words of its lines still start at one place.
const fromWidth = () => 0;   // what a day is of stands after the words now, so no list's day column widens for it (the audit's 30)
const datedAttrs = group => { if (!daysOf(group).length) return ''; const w = fromWidth(group); return ` data-dated=""${w ? ` style="--th-tw-from: ${w}"` : ''}`; };
const dayIn = (group, item) => twoWay.dayIn ? twoWay.dayIn(group, item) : item.day;
// A line's day, short, with what it is of where its list does not say it.
const dayCellOf = (group, item) => { const d = twoWay.lineDayOf ? twoWay.lineDayOf(group, item, !aloneIn(group)) : twoWay.dayOf(group, item); return d && typeof d === 'object' ? { text: shortDay(d.text), from: d.from } : shortDay(d); };
// A day of another year: the line shows the day alone, and a faint line with the year stands where the years change (C10).
const shortDay = text => String(text || '').replace(/, \d{4}$/, '');
const yearOf = text => (String(text || '').match(/, (\d{4})$/) || [])[1] || '';
const yearLine = (group, item, prev) => { const y = yearOf(twoWay.dayOf(group, item)), was = prev ? yearOf(twoWay.dayOf(group, prev)) : ''; return y && y !== was ? `<div class="th-tw-earlier lk-note th-tw-year">${y}</div>` : ''; };
/* The day a node's line shows, by its place (the row's or the node's key), so what it opens leaves out a Date saying it
   again (the owner's pick 3 of the two-way fixes: "each line drops what its heading already says"). */
const lineDay = new Map();
async function ownNamesOf(id) {
  const ids = await provided.aliasesOf?.(id) || [];
  let added = false;
  for (const other of ids) {
    const uuid = await provided.uuidById?.(other).catch(() => ''), title = uuid && await provided.titleNow(uuid).catch(() => '');
    if (title && state.pageId === id && !state.ownNames.has(title.toLowerCase())) { state.ownNames.add(title.toLowerCase()); added = true; }
  }
  if (added) { state.html = null; draw(host()); }
}
// A name's words: a wikilink in them is underlined and opens its page, a web address the browser, as in a bullet's words; the name itself, its own click.
const nameWords = item => item.words && /\[\[|https?:\/\//.test(item.words) ? twoWay.lineHtml(item.words, Infinity) : esc(item.title);
/* A task's circle (8 November 2026, the owner: "threads should be able to show tasks status circles"): Logseq's own, before
   the words as Logseq draws it after a task's bullet. Its name and icon are the ones Logseq keeps on the status value, read with
   the rows (statusChoices), so a status renamed, added or given another icon in Logseq shows so here (9 November 2026, the owner:
   "have it just stay in sync with whatever icons are chosen or changed"); Logseq's own class gives it Logseq's colour (ls-icon-…).
   A press on it (or Enter, Space) opens Logseq's Set Status list, as a press on Logseq's circle does (9 November 2026, "can you
   make the status circle interactive"): every status in Logseq's order, the one in force ticked, and Clear; what is picked is
   written with the faded Undo arrow (setStatus). */
state.statuses = new Map();
const readStatuses = async () => { if (!provided.statusChoices) return; const list = await provided.statusChoices().catch(error => { warnOnce('could not read the statuses', error); return null; }); if (list) state.statuses = new Map(list.map(s => [s.id, s])); };
// An icon as Logseq draws it from what it keeps ({ type, id, color }): one of Logseq's own drawn ones (its tablerIcons, such as
// Todo or Done), else Tabler's font Logseq loads (ti-star), or an emoji. Nothing of the icon is copied into Threads.
const pascal = id => String(id).replace(/(^|[-_ ])(\w)/g, (m, s, c) => c.toUpperCase());
const KEBAB = /^(viewBox|xmlns)$/;
function elementHtml(node) {
  if (node == null || node === false) return '';
  if (Array.isArray(node)) return node.map(elementHtml).join('');
  if (typeof node !== 'object') return esc(String(node));
  if (typeof node.type === 'function') return elementHtml(node.type(node.props || {}));
  const { children, ...props } = node.props || {};
  const attrs = Object.entries(props).filter(([, v]) => v != null && v !== false && typeof v !== 'function' && typeof v !== 'object')
    .map(([k, v]) => ` ${k === 'className' ? 'class' : KEBAB.test(k) ? k : k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}="${esc(String(v))}"`).join('');
  return `<${node.type}${attrs}>${elementHtml(children)}</${node.type}>`;
}
function statusIconHtml(icon) {
  if (!icon?.id) return '';
  if (icon.type === 'emoji') return `<em-emoji id="${esc(icon.id)}" size="1em"></em-emoji>`;
  const drawn = host().defaultView?.tablerIcons?.['Icon' + pascal(icon.id)];
  if (drawn) { try { return elementHtml(drawn({ size: 18 })); } catch { /* the font below */ } }
  return `<i class="ti ti-${esc(String(icon.id).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase())}" aria-hidden="true"></i>`;
}
const taskHtml = item => { const s = state.statuses.get(item.status); if (!s) return ''; const color = s.icon?.color ? ` style="color: ${esc(s.icon.color)}"` : ''; return `<button type="button" class="th-task ls-icon-${esc(s.icon?.id || '')}"${color} data-task="${esc(item.uuid)}" data-status="${s.id}" title="${esc(s.title)}: click to set the status" aria-label="Status: ${esc(s.title)}">${statusIconHtml(s.icon) || esc(s.title)}</button>`; };
// Every line of this node, in the rows and in opened nodes, takes the new status at once; the read that the write brings confirms it.
function statusEverywhere(uuid, status) {
  for (const g of state.groups) for (const item of g.items) if (item.uuid === uuid) item.status = status;
  for (const data of state.node.values()) for (const g of data.rows || []) for (const item of g.items) if (item.uuid === uuid) item.status = status;
  state.html = null; draw(host());
}
async function setStatus(button) {
  const uuid = button.dataset.task, had = Number(button.dataset.status) || 0;
  twoWay.hidePeek?.();
  await readStatuses();
  const picked = await shared.pickValue({ at: button, placeholder: 'Set Status', clearLabel: 'Clear', keepOrder: true,
    options: [...state.statuses.values()].map(s => ({ label: s.title, id: s.id, iconHtml: statusIconHtml(s.icon), held: s.id === had })) });
  if (!picked || (!picked.clear && picked.id === had)) return;
  const name = shortName(state.groups.flatMap(g => g.items).find(item => item.uuid === uuid)?.title || '');
  const before = state.statuses.get(had)?.title || '';
  try {
    if (picked.clear) await model.unsetValue(uuid, model.STATUS_IDENT); else await model.setValue(uuid, model.STATUS_IDENT, picked.label);
  } catch (error) { warnOnce('could not set the status', error); return notify('The status could not be set', 'warning'); }
  statusEverywhere(uuid, picked.clear ? 0 : picked.id);
  const field = state.groups.find(g => g.items.some(item => item.uuid === uuid))?.name;
  await offerKept([[uuid, model.STATUS_IDENT]], picked.clear ? `Cleared the status of “${name}”` : `Set “${name}” to ${picked.label}`, async () => {
    if (before) await model.setValue(uuid, model.STATUS_IDENT, before); else await model.unsetValue(uuid, model.STATUS_IDENT);
    statusEverywhere(uuid, had); later(300);
  }, field, inBox(`[data-task="${CSS.escape(uuid)}"]`));
  later(300);
}
const nameHtml = (item, open = false, bare = false) => `${taskHtml(item)}<a class="th-tw-record th-ol-name lk-node${bare ? ' lk-bare' : ''}${open ? ' th-ol-open' : ''}" data-uuid="${esc(item.uuid)}" href="#">${nameWords(item)}</a>${item.tag && item.tag !== 'note' ? '<wbr>' + tagLink(item) : ''}`;
/* top: the node at the top of a shifted section: its rows are drawn as the page's are, keyed under it; nothing
   in them acts on the page (no tick boxes, no +, no Group). */
function rowHtml(group, top = null) {
  const key = `${top ? top.uuid : state.pageUuid}|${group.name}`;
  const tip = isMentions(group) ? 'These nodes name this page in their words. Right-click to hide this row here.' : `“${esc(group.name)}” on the nodes listed here points to this page. Change it on the node.`;
  const label = group.found && group.whole ? `<span class="th-tw-matchname">${esc(group.label)}</span>` : esc(group.label);
  const name = group.fieldUuid
    ? `<div class="th-tw-name lk-prop" draggable="true"><span class="th-kind">${shared.kindIconHtml(group.kind || 'node')}</span><a class="th-tw-field" data-uuid="${esc(group.fieldUuid)}" href="#" title="${tip} Click to open the property “${esc(group.name)}”.">${label}</a></div>`
    : `<div class="th-tw-name lk-prop" draggable="true" title="${tip}">${label}</div>`;
  const base = top ? top.key : `r:${group.name}`;
  // Each row's list is a list of its own for the tick boxes (Look's lk-list): the pointer on it raises its boxes and no
  // other's; while anything is ticked every list shows its boxes, as before.
  const listCls = `th-tw-value th-ol lk-list`, picking = state.selecting.has(group.name) && !state.drawingTop ? ' data-picking=""' : '';
  // A row of one is the node itself, in place (its name, then its tag), not a header (1.0.2, the owner: "it is fine
  // that not everyone looked the same, especially since it is header v node"); every list of two or more has the one header.
  if (group.items.length === 1 && !(group.found && group.total > 1)) {
    const lines = group.items.map(item => itemHtml(group, item, base, addLink(group))).join('');
    return `<div class="th-tw-row" data-field="${esc(group.name)}">${name}<div class="${listCls}"${picking}${datedAttrs(group)}>${lines}${twoWay.addLineHtml(group)}</div></div>`;
  }
  // While finding, a list opens in full only once something of it is left out (the reviewer: one letter made the list
  // longer, 323 → 535 px, a folded list unfolding though nothing was filtered).
  const narrowed = !!group.found && group.items.length < group.total;
  // In full only once the found are few: one node dropping out no longer makes the list three times longer.
  const open = narrowed || twoWay.isOpen(key), all = state.all.has(key) || (narrowed && group.items.length <= LISTED);
  // While finding, the head keeps the whole list's words and order and only the nodes narrow (the review, 31 October:
  // "Consultation · Infusion · Scan" became "Infusion · Consultation" and "Admissions · from Aug 13 to Sep 12" became
  // "Admission · on Aug 13" as letters were typed), so the eye keeps its place.
  const whole = (group.found && state.groups.find(g => g.name === group.name)) || group;
  // On a day (7 November 2026, "on Oct 7" in the find line): the head counts the nodes up to that day, says how many
  // there are today, and the later nodes stand faint under a "since" line; the list is turned back, not narrowed.
  const headItems = group.since ? group.items : whole.items;
  const counts = new Map();
  for (const item of headItems) counts.set(item.tag, (counts.get(item.tag) || 0) + 1);
  const only = counts.has(state.only.get(key)) ? state.only.get(key) : '';
  const items = listHooks.reduce((xs, hook) => hook(group, key, xs) || xs, only ? group.items.filter(item => item.tag === only) : group.items);
  const shown = all ? items : items.slice(0, LISTED);
  /* The kinds as the kit's filter words, the one in force in the text colour. With several kinds they are the line by the
     chevron itself, the days at the end (the owner: the header "3 Therapeutic sessions, 3 Cancer Drugs" said what
     the words under it said again): folded it reads as the summary, and a click on a kind opens the list with only those. */
  const chip = (tag, text, cls = '', raw = false) => `<button type="button" class="th-chip th-tw-chip lk-view${tag === only ? ' on' : ''}${cls}" data-key="${esc(key)}" data-tag="${esc(tag)}" aria-pressed="${tag === only}">${raw ? text : esc(text)}</button>`;
  const kinds = counts.size > 1;
  /* One style for every list (1.0.2): the count and what they are first, in one weight ("11 Symptom Logs", or "4 nodes"
     when they are of several kinds); after it, quiet and parted by a dot, the kinds as filter words and the days. With several kinds the count is the old "All": it folds and unfolds the
     list, and shows every node again when one kind is picked. */
  const total = headItems.length;
  const { when, from } = headWhen(group, headItems);
  const was = group.since ? `<span class="th-tw-was lk-note" title="On this page today, with every day">${whole.items.length} today</span>` : '';
  /* The mentions row's head says its count like every row ("5 nodes"), Logseq's word for an untagged node, never the plugin's
     old "notes" (the review, 31 October). Its days alone stood there once; once the days moved to the head's right (10 November)
     the head's left stood empty, an empty line under "Mentioned in" (11 November 2026, the owner: "why is there an empty line"). */
  /* With several kinds, each kind is a tab with its count beside it, All's too (9 November 2026, the owner: "there should be
     numbers next to each tab"), the number a step lighter than its word, so the words still lead. */
  const tabCount = n => `<span class="th-tw-n">${n}</span>`;
  const leadText = kinds ? `All ${tabCount(total)}` : `${total} ${esc(plural(tagWord((headItems[0] || group.since?.[0])?.tag || 'note'), total))}`;   // the number shows on a closed head (the owner, 1 November, the research's rule that a head says what it holds)
  const lead = kinds ? chip('', leadText, ' th-tw-lead', true)
    : `<a class="th-tw-toggle th-tw-lead" data-key="${esc(key)}" href="#" title="Click to ${open ? 'fold' : 'open'} the list.">${leadText}</a>`;
  const whenHtml = when ? `<a class="th-tw-toggle th-tw-when" data-key="${esc(key)}" href="#" title="${esc(from ? whenTip(from) : 'The days of these nodes')}. Click to ${open ? 'fold' : 'open'} the list.">${esc(when).replace(/ (?=\d)/g, '&nbsp;')}</a>` : '';
  const sep = '<span class="th-tw-sep" aria-hidden="true">·</span>';
  // Three kinds, then "and 12 more" (the grammar; a click shows them all), the one in force always among them. The days stay.
  const byCount = [...counts].sort((a, b) => b[1] - a[1]);
  const named = state.kindsAll.has(key) || byCount.length <= 3 ? byCount : byCount.findIndex(([tag]) => tag === only) > 2 ? [...byCount.slice(0, 2), byCount.find(([tag]) => tag === only)] : byCount.slice(0, 3);
  const rest = byCount.length - named.length;
  // What the list is set to, the View menu's words, stands before the days at the head's right (10 November 2026, the owner: B).
  const view = twoWay.viewSaid(group), right = view || whenHtml ? `<span class="th-tw-right">${view}${whenHtml}</span>` : '';
  const tail = [...(kinds ? named.map(([tag, n]) => chip(tag, `${esc(tag === 'note' ? 'No tag' : tag)} ${tabCount(n)}`, '', true)) : []), ...(kinds && rest ? [`<button type="button" class="lk-more th-tw-kinds" data-kinds="${esc(key)}">and ${rest} more</button>`] : []), right, was].filter(Boolean);
  // Each piece keeps its dot in the gap before it, and the head clips what stands before its left edge: a line that wraps starts on
  // its words, never on a dot (the stylesheet).
  const extra = headHooks.map(hook => hook(group, key, items) || '').join('');
  const head = `<span class="th-tw-chips">${lead}${tail.map((piece, i) => `<span class="th-tw-piece">${lead || i ? sep : ''}${piece}</span>`).join('')}${extra}</span>`;
  let list = '', since = '';
  const bare = !!only || counts.size === 1, tell = bare ? twoWay.tellingProp(group, items) : '';
  if (open) {
    const today = todayNumber();
    // The nodes after the day, faint under a line that says so; "show all" is the list's.
    const later = only ? (group.since || []).filter(item => item.tag === only) : group.since || [];
    if (later.length) since = `<div class="th-tw-since"><div class="th-tw-earlier lk-note">since ${esc(dayText(twoWay.readFind().asOf))}</div>${(all ? later : later.slice(0, LISTED)).map(item => itemHtml(group, item, base, '', bare, tell)).join('')}${later.length > LISTED && !all && items.length <= LISTED ? O.more({ text: `show ${later.length - LISTED} more`, attrs: { class: null, 'data-more': key }, under: isDated(group) ? 'dotday' : 'dot' }) : ''}</div>`;
    // Grouped: the nodes in groups by a tag, a month or a property's value, each group folding.
    const grouping = twoWay.groupingOf(group, items);
    if (grouping) list = underHeadHooks.map(hook => hook(group, key, items) || '').join('') + grouping.parts.map(part => twoWay.groupHtml(group, part, grouping.by)).join('');
    else {
      list = underHeadHooks.map(hook => hook(group, key, items) || '').join('') + shown.map((item, i) => (i > 0 && dayIn(group, item) && dayIn(group, item) < today && dayIn(group, shown[i - 1]) >= today ? '<div class="th-tw-earlier lk-note">earlier</div>' : '') + yearLine(group, item, shown[i - 1]) + betweenHooks.map(hook => hook(group, item, shown[i - 1], key) || '').join('') + itemHtml(group, item, base, '', bare, tell)).join('')
        + (items.length > LISTED ? O.more({ text: all ? 'show fewer' : `show ${items.length - LISTED} more`, attrs: { class: null, 'data-more': key }, under: isDated(group) ? 'dotday' : 'dot' }) : '');
    }
  }
  const fold = O.chev({ open, label: group.label, attrs: { 'data-fold': key } });
  // The list's own line is the parent of its nodes (the owner, 2026-10-27: "header chevron is over the other chevrons of
  // its children"): its chevron starts where the days do, its words right after; the nodes, their days too, one step in.
  // The mentions' sure proposals, all at once (C19): a quiet word at the head once two or more are pencilled in.
  const proposed = isMentions(group) ? group.items.filter(item => couldBeHtml(item)).length : 0;
  const takeAll = proposed > 1 ? `<button type="button" class="lk-btn lk-low th-tw-takeall" data-takeall-could="" title="Make each what its words look like, with one Undo">Take the ${proposed} proposed</button>` : '';
  const headLine = O.line({ day: null, chev: fold, body: `${head}${addLink(group)}${takeAll}${twoWay.groupBtn(group)}`, cls: 'th-tw-head' });
  const listHtml = open ? O.kids({ html: list + since, cls: 'th-ol-bare th-tw-list', fresh: state.fresh === key }) : '';
  return `<div class="th-tw-row" data-field="${esc(group.name)}"${open ? ' data-open=""' : ''}>${name}<div class="${listCls}"${picking}${datedAttrs(group)}>${headLine}${listHtml}${twoWay.addLineHtml(group)}</div></div>`;
}
// One node of a row: its line, where it sits (a mention's page and bullets), what it could be, and what it holds when open.
// bare: the heading above names the one tag, so the lines leave it out (for a list of one kind); tell:
// the property whose value tells these nodes apart, said in the tag's place.
function itemHtml(group, item, base, end = '', bare = false, tell = '') {
  const key = `${base}>${item.uuid}`, open = state.dig.has(key);
  const shown = bare ? { ...item, tag: '' } : item;
  // [day] [chevron] [node] (the owner, 2026-10-27: "have [date] [chevron] [bullet]"), on every line: the day always in
  // the margin, so the left edge means time ("Name first", the day after the tag, is gone). What a node opens
  // hangs from its chevron.
  // Opened by the find field, its name keeps its weight, so the tag and day after it do not slide right as letters
  // are typed (the reviewer: 4 to 9 px).
  lineDay.set(key, dayCell(item));
  const day = dayCellOf(group, item);
  // Opened, the node's properties show the telling value: the line lets go of it.
  const body = `${leadHooks.map(hook => hook(group, item) || '').join('')}${nameHtml(shown, open && state.findDug.get(key) !== true, bare)}${couldBeHtml(item)}${tailHooks.map(hook => hook(group, item) || '').join('')}${O.from(day)}${tell && !open ? twoWay.tellHtml(item, tell) : ''}${end}`;
  const line = O.line({ tick: pickBox(group, item), dot: { uuid: item.uuid, closed: !open && hasKids(item.uuid), title: shortName(item.title) }, day: day || (isDated(group) ? '' : null), chev: twoWay.digChev(key, item.uuid, 0, shortName(item.title), open), body, cls: 'th-tw-line', attrs: { 'data-uuid': item.uuid } });
  const under = `${crumbHtml(item)}${twoWay.raiseHtml(group, item)}`;
  return open ? O.unit({ html: line + under + twoWay.digKids(key, item.uuid, 'in'), focus: state.focus === key, attrs: { 'data-key': key } }) : line + under;
}
/* Where a mention sits: its page and the bullets above it, small, under its line. A mention with no tag whose
   words look like a known kind says so, pencilled in where its tag would stand, on its own line, so that coming late
   moves nothing (the review, 31 October: it came after the rows and pushed them down): a click opens Make it… for that one mention. */
// Its × (the library's Take off, under the pointer) says no: the suggestion goes, is remembered as refused (twoWayCouldBeOff)
// and is not shown again; the faded arrow puts it back, and the row's right-click brings the page's refused ones back.
const couldBeOff = () => new Set(String(setting('twoWayCouldBeOff') || '').split(/[;\n]/).map(s => s.trim()).filter(Boolean));
const couldBeHtml = item => {
  const best = (!item.tag || item.tag === 'note') && !couldBeOff().has(item.uuid) ? state.raise.get(item.uuid)?.best : null;
  if (!best) return '';
  const pencil = O.pencil(`could be a ${best.tag.title} · ${best.prop.title}`, { 'data-could': item.uuid, title: `Its words look like a ${best.tag.title}: click to make it one, with “${best.prop.title}” set to this page` });
  return `<span class="th-tw-could lk-reveals">${pencil}<button type="button" class="lk-x lk-reveal" data-could-off="${esc(item.uuid)}" title="Not this: the suggestion goes and is not shown again" aria-label="Take off the suggestion">×</button></span>`;
};
function refuseCouldBe(uuid, nameEl) {
  const before = String(setting('twoWayCouldBeOff') || '');
  saveSettings({ twoWayCouldBeOff: [...couldBeOff(), uuid].join('; ') });
  state.html = null; draw(host());
  offerUndo('The suggestion is off this mention', () => { saveSettings({ twoWayCouldBeOff: before }); state.html = null; draw(host()); }, MENTIONS, () => nameEl);
}
// The refused suggestions of this page's mentions, shown again.
function showCouldBeAgain() {
  const group = state.groups.find(isMentions), here = new Set((group?.items || []).map(item => item.uuid));
  const before = String(setting('twoWayCouldBeOff') || '');
  saveSettings({ twoWayCouldBeOff: [...couldBeOff()].filter(uuid => !here.has(uuid)).join('; ') });
  state.html = null; draw(host());
  offerUndo('The suggestions taken off on this page are back', () => { saveSettings({ twoWayCouldBeOff: before }); state.html = null; draw(host()); }, MENTIONS);
}
const refusedHere = () => { const off = couldBeOff(); return (state.groups.find(isMentions)?.items || []).filter(item => off.has(item.uuid)).length; };
// A crumb that is only the journal day the node is written on says the day again: left out. Each place is a step (lk-step,
// the faint underline of the trail): a press opens its page or bullet, Shift in the right sidebar.
const crumbsOf = item => (item.crumbs || []).filter((c, i) => !(i === 0 && item.day && /^[A-Z][a-z]{2} \d{1,2}(st|nd|rd|th), \d{4}$/.test(c.name)));
const crumbHtml = item => crumbsOf(item).length ? `<div class="th-tw-crumb">${crumbsOf(item).map(c => `<a class="lk-step" href="#" data-open-uuid="${esc(c.uuid)}">${esc(c.name)}</a>`).join('<span class="th-ol-sep"> › </span>')}</div>` : '';

// The page's own property list in the main view (not one inside a record, a reference or the sidebar), else its title:
// the rows stand under the title and the properties, above the page's own words (the owner, 1 November 2026).
function anchorFor(doc) {
  const main = doc.querySelector('#main-content-container');
  if (!main) return null;
  const outside = el => !el.closest('.references, .ls-bidirectional-properties, .ls-block .ls-block, .custom-query');
  const props = [...main.querySelectorAll('.ls-page-properties')].find(outside);
  if (props) return props;
  const titles = [...(provided.pageTitles?.(doc) || [])].filter(el => main.contains(el) && !el.parentElement?.closest('.ls-page-title, .page-title, h1.title'));
  const title = titles.length === 1 ? titles[0] : null;
  return title ? (title.querySelector('.is-page-title-row') || provided.titleAnchor?.(doc, title) || title) : null;
}
/* A page opening in steps. Logseq draws a page's title and its blocks first and its property list in two
   or three steps over the next half second, so the page's own words were pushed down each time, and once more when
   the rows came. Seen in the owner's Logseq: Oxaliplatin's blocks at 223px, then 303, 495 and 820. Now the rows are
   known before the page opens (loadIndex), and for the first two seconds after a page change the box keeps, above
   the rows, the room that lay between the title and the rows when the page was last seen settled, less what is
   there so far: the rows and the blocks start where they end. The room is kept in Logseq's window storage, so this
   works from the second visit on, across restarts. */
/* The keys end in 2: the rooms remembered before were measured while proposals still brought hidden
   property rows up and down, and a room remembered too large is let go at settle as a slide up (measured on Marcus
   Bell: 168 px, two seconds after the page). The old ones are dropped. */
const SETTLE_MS = 2000, HEIGHTS_KEY = 'refinementTwoWayRoom4', OLD_KEYS = ['refinementTwoWayRoom', 'refinementTwoWayLeast', 'refinementTwoWayRoom2', 'refinementTwoWayRoom3'];
/* A first visit (measured with the tour): the rows came under the title some 50 ms before Logseq's own property
   list, which then pushed them down (Dr. Raj Patel: 109 px). Now, on a page with no room remembered, they wait unseen in
   their place until that list is there, at most WAIT_MS, and no room is held for them: the least room of any page seen,
   held, could be more than this page takes, and was let go at settle as a slide up (Marcus Bell: 56 px). */
const WAIT_MS = 900, STILL_MS = 200;
const settle = { since: 0, page: '', leaving: '', saved: false, timer: 0, ease: 0, wait: 0, frame: 0, stood: false };
/* The wait ends once Logseq's property list is there and the rows' place has stood still a moment, or at once for a page that will
   have no list (the review, 31 October: on a first visit they came 600 ms late, the list having long been drawn). Stillness alone is
   not enough: the list can come 200 ms after a still page (seen on Fatigue). WAIT_MS stays the most it can be.
   The rows stand above the page's words, so a page not yet read this session waits for its reading as well, words and all:
   its mentions and the find line come with that reading, and pushed the words down (Dr. Mei Chen: 266 px at half a second). */
function endWaitWhenStill(box, page) {
  if (settle.frame) cancelAnimationFrame(settle.frame);
  let top = null, since = performance.now(), noList = false;
  Promise.resolve(model?.pageHasList?.(page)).then(has => { noList = has === false; }).catch(() => {});
  const look = () => {
    if (!box.hasAttribute('data-th-waiting')) return;
    const now = box.getBoundingClientRect().top;
    if (now !== top) { top = now; since = performance.now(); }
    const main = box.ownerDocument.querySelector('#main-content-container');
    const listThere = noList || !!main?.querySelector('.ls-page-properties');
    if (!listThere || !state.mentionsOf.has(page) || (!noList && performance.now() - since < STILL_MS)) { settle.frame = requestAnimationFrame(look); return; }
    settle.stood = true; box.removeAttribute('data-th-waiting');
  };
  settle.frame = requestAnimationFrame(look);
}
let heights = new Map();
const readHeights = () => { try { const storage = host().defaultView.localStorage; for (const key of OLD_KEYS) storage.removeItem(key); heights = new Map(Object.entries(JSON.parse(storage.getItem(HEIGHTS_KEY) || '{}'))); } catch { heights = new Map(); } };
function remember(page, height) {
  height = Math.round(height);
  if (heights.get(page) === height) return;
  heights.delete(page);
  heights.set(page, height);
  if (heights.size > 500) heights.delete(heights.keys().next().value);
  try { host().defaultView.localStorage.setItem(HEIGHTS_KEY, JSON.stringify(Object.fromEntries(heights))); } catch { /* storage full or off: kept for this session */ }
}
// 'hold' while the page on screen settles, 'save' once when it has, else nothing.
function settling(page) {
  if (!page || page === settle.leaving) return '';
  const age = performance.now() - settle.since;
  if (!settle.page && age < SETTLE_MS) { settle.page = page; settle.saved = false; }
  if (settle.page !== page) return '';
  return age < SETTLE_MS ? 'hold' : settle.saved ? '' : 'save';
}
function holdRoom(doc, box, mode, page) {
  // The title's own row: the box and the property list sit inside the title's block, below that row.
  const title = doc.querySelector('#main-content-container :is(.ls-page-title, .page-title) .is-page-title-row');
  if (!mode || !title) { setHold(box, 0); return; }
  const held = parseFloat(box.style.getPropertyValue('--th-tw-hold')) || 0;
  const room = box.getBoundingClientRect().top - title.getBoundingClientRect().bottom - held;
  // Settled: the room still held, if any, eases away over a moment instead of snapping; then the room
  // is kept for next time, so the next visit holds the right amount from the start.
  if (mode === 'save') { settle.saved = true; if (room >= 0) remember(page, room); if (held) easeHold(box); else setHold(box, 0); return; }
  setHold(box, heights.has(page) ? Math.max(0, Math.round(heights.get(page) - room)) : 0);
}
const setHold = (box, px) => { if (px) box.style.setProperty('--th-tw-hold', px + 'px'); else box.style.removeProperty('--th-tw-hold'); };
function easeHold(box) {
  box.setAttribute('data-th-settling', '');
  box.style.setProperty('--th-tw-hold', '0px');
  clearTimeout(settle.ease);
  settle.ease = setTimeout(() => { box.removeAttribute('data-th-settling'); if (box.style.getPropertyValue('--th-tw-hold') === '0px') setHold(box, 0); }, 300);
}
/* What is open is kept per page (the second break: "leaving closes everything"): the nodes opened in the
   rows, the chain under them, the steps and the lists shown whole, put back when the page is shown again, for the
   session. */
const KEPT_PAGES = 50;
function keepOpen() {
  const page = state.openFor;
  if (!page) return;
  const empty = !state.dig.size && !state.steps.length;
  state.kept.delete(page);
  if (!empty) state.kept.set(page, { dig: new Map(state.dig), focus: state.focus, steps: state.steps.slice(), nall: new Set(state.nall), ball: new Set(state.ball) });
  while (state.kept.size > KEPT_PAGES) state.kept.delete(state.kept.keys().next().value);
}
// Put back what was open on a page, once, when its rows are first shown again (by the stored rows or by a fresh reading).
function putBackOpen(pageUuid) {
  if (!pageUuid || state.openFor === pageUuid) return;
  state.openFor = pageUuid;
  const kept = state.kept.get(pageUuid);
  state.dig = new Map(kept?.dig || []); state.focus = kept?.focus || ''; state.steps = kept?.steps.slice() || [];
  state.nall = new Set(kept?.nall || []); state.ball = new Set(kept?.ball || []);
  readOpen2();
}
// Every node open here (and the one stepped into), read again once each, then drawn.
function readOpen2() {
  const nodes = new Map([...state.dig.values(), ...state.steps.slice(-1)].map(n => [n.uuid, n]));
  if (!nodes.size) return;
  Promise.all([...nodes.values()].map(n => twoWay.readNode(n.uuid, n.id).catch(error => warnOnce('could not read a node', error)))).then(() => draw(host()));
}
function onRoute() {
  for (const [k, mine] of state.findDug) if (mine) twoWay.closeQuietly(k);
  state.findDug.clear(); state.findAsked.clear(); state.findKeep = 0; state.findHold = 0;
  if (state.box) state.box.style.minHeight = '';
  keepOpen();
  state.find = ''; state.findRead = ''; state.findShown = false;
  twoWay.hidePeek(); twoWay.closeAdd(); state.draft = null; state.kindsAll.clear(); stopPicking(); state.lastPick = ''; state.dig.clear(); state.focus = ''; state.steps = []; state.openFor = ''; state.nodeDraft = null;
  // The page being left, which may still be on screen for a moment and must not take the new page's place.
  // Only a page still on screen is being left: the same page opened again after it went is a new visit, held as one.
  settle.leaving = shownPage(host());
  Object.assign(settle, { since: performance.now(), page: '', saved: false, stood: false });
  clearTimeout(settle.timer); clearTimeout(settle.ease); clearTimeout(settle.wait); if (settle.frame) cancelAnimationFrame(settle.frame);
  // Left while the held room eased away: left on, the easing slid the rows on every page opened after.
  state.box?.removeAttribute('data-th-settling');
  // Once settled: no more room held, and the room is kept for next time.
  settle.timer = setTimeout(() => draw(host()), SETTLE_MS + 50);
  settle.wait = setTimeout(() => draw(host()), WAIT_MS + 20);
}
const shownPages = doc => [...doc.querySelectorAll('#main-content-container :is(.ls-page-title, .page-title) .ls-block[blockid]')].map(el => el.getAttribute('blockid'));
function draw(doc) {
  if (!doc) return;
  const on = setting('twoWayRows');
  // The rows belong to the page they were read for; a page drawn before its look-up finishes gets the rows it had
  // when last seen, or none if every page's rows were read and it had none, until the look-up has checked them.
  const shown = shownPages(doc);
  if (shown.length && !shown.includes(state.pageUuid)) {
    const id = shown.find(uuid => state.byPage.has(uuid)) || (shown.length === 1 && state.indexed ? shown[0] : '');
    if (id) { state.pageUuid = id; state.groups = state.byPage.get(id) || []; state.html = null; putBackOpen(id); }
  }
  const anchor = on ? anchorFor(doc) : null;
  // A view with no page title the rows know (the Journals list), reached after the rows were read, has none of them.
  const stale = !shown.length && settle.since > (state.readAt || 0);
  // The Journals list shows many days at once: no rows there (a day of its own gets them). Days by their uuid: a
  // page's alias is a second block in the title area too, and on the way from a journal day it read as that list.
  const rows = state.groups.length > 0 && !stale && !(shown.length && !shown.includes(state.pageUuid)) && shown.filter(uuid => uuid.startsWith('00000001-')).length < 2;
  // A page with an alias has more than one block in its title area; the page is the one the rows were read for.
  const page = shown.includes(state.pageUuid) ? state.pageUuid : shown.length === 1 ? shown[0] : '';
  const mode = anchor ? settling(page) : '';
  if (!anchor || (!rows && !mode)) { state.box?.remove(); twoWay.highlightFind(state.box); return; }   // the gutter stays: let go, a short page widened by 16 px a moment after it opened (motion-check, 6 November 2026)
  let box = state.box;
  if (!box || box.ownerDocument !== doc) {
    box = state.box = doc.createElement('div');
    box.className = 'th-two-way';
    box.setAttribute('contenteditable', 'false');
    box.addEventListener('mousedown', event => { event.stopPropagation(); if (state.find && event.target.closest?.('.th-chev, [data-findall]')) event.preventDefault(); });
    box.addEventListener('click', onClick);
    // Enter or Space on a task's circle opens its list: Logseq takes Enter on the page before a button can make it a click.
    box.addEventListener('keydown', event => { const task = (event.key === 'Enter' || event.key === ' ') && !event.isComposing && event.target.closest?.('[data-task]'); if (!task) return; event.preventDefault(); event.stopPropagation(); setStatus(task).catch(error => warnOnce('could not set the status', error)); });
    box.addEventListener('mouseover', twoWay.onOver);
    box.addEventListener('mouseout', twoWay.onOut);
    box.addEventListener('contextmenu', onRename);
    // A node is read while the pointer comes to its chevron, so it opens at once.
    // Read and found to hold nothing more, its arrow goes where it stands (a room keeps a line's place), as Logseq draws none.
    const bare = c => { if (!c.isConnected || c.getAttribute('aria-expanded') === 'true' || twoWay.holdsMore(c.dataset.uuid, c.dataset.dig)) return; if (c.parentElement?.classList.contains('th-ol-line')) c.replaceWith(Object.assign(c.ownerDocument.createElement('span'), { className: 'th-chev-room', ariaHidden: 'true' })); else c.remove(); };
    box.addEventListener('pointerover', event => { const c = event.target.closest?.('.th-chev[data-dig]'); if (!c) return; if (state.node.has(c.dataset.uuid)) bare(c); else twoWay.readNode(c.dataset.uuid, c.dataset.id, { look: true }).then(() => bare(c), () => {}); });
    state.html = '';
  }
  if (!rows) state.picked.clear();
  const stepped = rows && state.steps.length ? twoWay.steppedHtml() : null;
  state.listed = [];   // filled as the rows are drawn, so the rows come before the bar that reads it
  // A piece may draw in the rows' place (two pages side by side).
  const rowsHtml = rows && stepped == null ? (twoWay.rowsInstead?.() ?? twoWay.openHits(twoWay.foundGroups()).map(g => rowHtml(g)).join('')) : '';
  /* The whole section folds to one line under its name (the owner, 8 November 2026: "allow it to be folded in, the whole
     thing"), kept per page as a list's fold is; while letters are in the find line it stays open. */
  const wholeKey = `${state.pageUuid}|*`, wholeOpen = !!state.find.trim() || twoWay.isOpen(wholeKey);
  const wholeHtml = `<div class="th-tw-whole">${O.line({ day: null, chev: O.chev({ open: wholeOpen, label: 'Linked', attrs: { 'data-whole': wholeKey } }), body: `<a class="th-tw-whole-name" data-whole="${esc(wholeKey)}" href="#" title="Click to ${wholeOpen ? 'fold' : 'open'} Linked.">Linked</a>`, cls: 'th-tw-whole-line' })}</div>`;
  const html = rows ? '<div class="th-tw-pin" aria-hidden="true"></div>' + (stepped ?? (wholeHtml + (wholeOpen ? twoWay.barHtml() + twoWay.findHtml() + rowsHtml : ''))) : '';
  // What unrolls does so once: the drawing kept is the one without it, so the next drawing does not replace it.
  const bare = html.replace(/ th-ol-unroll/g, '');
  box.toggleAttribute('data-finding', !!state.find.trim());
  box.toggleAttribute('data-no-days', !state.groups.some(group => group.items.some(dayCell)));   // on a day's own page, usually: nothing fills the margin
  // Held before the rows are drawn again, so the page never sees the section shorter for an instant (it pulled the page's
  // scroll up 26 px at a first letter).
  if (state.find.trim()) { if (state.findHold) box.style.minHeight = `${Math.round(state.findHold)}px`; }
  else if (state.findHold) {
    // Emptied: let go only of the room below what is on screen, so the page stays where it was read (the reviewer: the
    // page dropped 97 px on Esc after scrolling down); the rest goes with the page.
    const pane = doc.querySelector('#main-content-container');
    const spare = pane ? pane.scrollHeight - pane.clientHeight - pane.scrollTop : Infinity;
    state.findKeep = Math.max(0, Math.round(state.findHold - spare)); state.findHold = 0;
    box.style.minHeight = state.findKeep ? `${state.findKeep}px` : '';
  } else if (!state.findKeep) box.style.minHeight = '';
  box.style.alignContent = box.style.minHeight ? 'start' : ''; // the held room stays below the rows, not spread between them
  if (state.html !== bare) {
    const active = box.contains(box.ownerDocument.activeElement) ? box.ownerDocument.activeElement : null;
    const typing = active?.matches('.th-tw-draft-name'), typingNode = active?.matches('.th-tw-node-field') ? active.dataset.key : '';
    const finding = active?.matches('.th-tw-find') ? active.selectionStart : null;
    const redraw = () => { state.html = bare; box.innerHTML = html; shared.outline.unrolled(box); twoWay.keepDraft(box); twoWay.keepNodeField(box); twoWay.keepFind(box, finding); };
    const inPlace = box.querySelector('.th-in-place');
    if (inPlace) inPlace.across(redraw); else redraw();
    if (typing) twoWay.focusDraft();
    if (typingNode) twoWay.focusNodeField(typingNode);
  }
  twoWay.highlightFind(box);
  twoWay.steadyWidth(box.ownerDocument, true);
  // The room held grows with the tallest the section has been while finding, so a page scrolled down to read the found
  // nodes keeps its place when the next letter makes them fewer (the reviewer: 214 px).
  if (state.find.trim() && state.findHold) state.findHold = Math.max(state.findHold, box.getBoundingClientRect().height);
  twoWay.placeBar(box);
  box.toggleAttribute('data-th-replaces', rows && !!state.replaces);
  // The section stands for the page, stepped into a node or not: Logseq's lists it repeats stay hidden.
  box.toggleAttribute('data-th-rows', !!rows);
  twoWay.pinNow();
  if (anchor.nextElementSibling !== box) anchor.after(box);
  holdRoom(doc, box, mode, page);
  const waited = box.hasAttribute('data-th-waiting');
  box.toggleAttribute('data-th-waiting', mode === 'hold' && !settle.stood && (!state.mentionsOf.has(page) || (!heights.has(page) && !anchor.matches('.ls-page-properties'))) && performance.now() - settle.since < WAIT_MS);
  if (!waited && box.hasAttribute('data-th-waiting')) endWaitWhenStill(box, page);
  if (!rows && mode === 'save') box.remove();
}
// Before the screen is drawn, so the rows come in the same frame as the property list they sit under. Only
// when elements came or went, or while a page settles.
const drawEarly = (doc, records) => { if (performance.now() - settle.since < SETTLE_MS || addsElements(records)) draw(doc); };
function onClick(event) {
  const pickEl = event.target.closest?.('.th-tw-bar [data-act]') || event.target.closest?.('.th-tw-row .th-tw-pick');
  if (pickEl) { event.preventDefault(); event.stopPropagation(); twoWay.hidePeek(); return pickEl.dataset.act ? twoWay.act(pickEl.dataset.act, pickEl) : twoWay.togglePick(pickEl, event.shiftKey); }
  const couldOff = event.target.closest?.('[data-could-off]');
  if (couldOff) { event.preventDefault(); event.stopPropagation(); twoWay.hidePeek(); return refuseCouldBe(couldOff.dataset.couldOff, couldOff.closest('.th-tw-line') || couldOff); }
  const could = event.target.closest?.('[data-could]');
  if (could) {
    event.preventDefault(); event.stopPropagation(); twoWay.hidePeek();
    const group = state.groups.find(isMentions);
    // The menu opens where the words were: the drawing that ticks the mention replaces them.
    const r = could.getBoundingClientRect(), at = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    if (group) { state.picked.clear(); state.picked.add(`${could.dataset.could}|${group.name}`); draw(host()); twoWay.raiseMenu(at).catch(error => warnOnce('could not open Make it…', error)); }
    return;
  }
  const back = event.target.closest?.('[data-step]');
  if (back) { event.preventDefault(); event.stopPropagation(); twoWay.hidePeek(); return twoWay.stepBack(Number(back.dataset.step)); }
  const whole = event.target.closest?.('[data-whole]');
  if (whole) {
    event.preventDefault(); event.stopPropagation(); twoWay.hidePeek();
    const key = whole.dataset.whole, folding = twoWay.isOpen(key);
    /* Folded while the page is scrolled down, the page would have to scroll up as far as the section shrinks, and the
       line under the pointer would leap away from it (the owner, 11 November 2026: the jump when Linked folds). So the
       room below what is on screen goes, and the rest is kept, as an emptied find line keeps it, until the page
       changes. Opened again, the room stays under the rows: let go then, the page was short for a moment and leapt
       to its top. */
    const box = whole.closest('.th-two-way'), pane = box?.ownerDocument.querySelector('#main-content-container');
    if (folding && box && pane) {
      const spare = pane.scrollHeight - pane.clientHeight - pane.scrollTop;
      state.findKeep = Math.max(0, Math.round(box.getBoundingClientRect().height - spare));
      box.style.minHeight = state.findKeep ? `${state.findKeep}px` : '';
    }
    twoWay.setOpen(key, !folding); state.html = null; draw(host()); return;
  }
  if (twoWay.onOutlineClick(event)) return;
  const fold = event.target.closest?.('.th-chev[data-fold]');
  if (fold) { event.preventDefault(); event.stopPropagation(); twoWay.hidePeek(); const key = fold.dataset.fold; if (twoWay.isOpen(key)) { const list = fold.closest('.th-tw-row')?.querySelector('.th-tw-list'); shared.outline.close(list, () => { twoWay.setOpen(key, false); draw(host()); }); } else { twoWay.setOpen(key, true); state.fresh = key; state.html = null; draw(host()); state.fresh = ''; } return; }
  const gfold = event.target.closest?.('.th-chev[data-gkey]');
  if (gfold) { event.preventDefault(); event.stopPropagation(); twoWay.setOpen(gfold.dataset.gkey, !twoWay.isOpen(gfold.dataset.gkey)); draw(host()); return; }
  const moreKinds = event.target.closest?.('[data-kinds]');
  if (moreKinds) { event.preventDefault(); event.stopPropagation(); state.kindsAll.add(moreKinds.dataset.kinds); draw(host()); return; }
  const more = event.target.closest?.('[data-more]');
  if (more) { event.preventDefault(); event.stopPropagation(); const key = more.dataset.more; if (state.all.has(key)) state.all.delete(key); else state.all.add(key); draw(host()); return; }
  const groupBy = event.target.closest?.('.th-tw-groupby');
  if (groupBy) {
    event.preventDefault(); event.stopPropagation();
    const group = state.groups.find(g => g.name === groupBy.dataset.field);
    if (group) twoWay.groupMenu(group, groupBy).catch(error => warnOnce('could not open the group menu', error));
    return;
  }
  const groupAdd = event.target.closest?.('.th-tw-gadd');
  if (groupAdd) { event.preventDefault(); event.stopPropagation(); twoWay.hidePeek(); const group = state.groups.find(g => g.name === groupAdd.dataset.field); if (group) twoWay.startGroupDraft(group, groupAdd.dataset.gkey); return; }
  // A click that just misses the box, anywhere in the room left of the record, ticks it too (the owner: "make
  // checkbox tap area bigger"): before, it opened the record and took you off the page.
  const rowEl = !event.target.closest?.('a, button') && event.target.closest?.('.th-tw-line');
  const first = rowEl && rowEl.querySelector(':scope > :not(.th-tw-pick)');
  const box = rowEl && rowEl.querySelector(':scope > .th-tw-pick');
  if (box && first && event.clientX < first.getBoundingClientRect().left) { event.preventDefault(); event.stopPropagation(); twoWay.hidePeek(); return twoWay.togglePick(box, event.shiftKey); }
  const plus = event.target.closest?.('.th-tw-add');
  if (plus) { event.preventDefault(); event.stopPropagation(); twoWay.hidePeek(); const group = state.groups.find(g => g.name === plus.dataset.field); if (group) { twoWay.closeAdd(); twoWay.draftFor(group); draw(host()); twoWay.focusDraft(); } return; }
  const dpick = event.target.closest?.('.th-tw-dpick');
  if (dpick) { event.preventDefault(); event.stopPropagation(); return twoWay.keepPiece(dpick.dataset.pkey); }
  const lineEl = event.target.closest?.('.th-tw-draft');
  if (lineEl && !event.target.closest('a, input, button')) { lineEl.querySelector('.th-tw-draft-field')?.focus(); return; }
  if (twoWay.pieceClick?.(event)) return;
  const task = event.target.closest?.('[data-task]');
  if (task) { event.preventDefault(); event.stopPropagation(); setStatus(task).catch(error => warnOnce('could not set the status', error)); return; }
  for (const hook of clickHooks) if (hook(event)) return;
  if (event.target.closest?.('[data-takeall-could]')) { event.preventDefault(); event.stopPropagation(); twoWay.raiseAll().catch(error => { warnOnce('could not take the proposals', error); notify('The proposals could not all be taken', 'warning'); }); return; }
  // The name opens, the arrow unfolds: the blank part of a row does nothing, and the page stays.
  const target = event.target.closest?.('a, button');
  if (!target) return;
  event.preventDefault(); event.stopPropagation();
  twoWay.hidePeek();
  if (target.matches('.th-tw-record, .th-tw-field')) return openEntity(target.dataset.uuid, event.shiftKey);
  if (target.matches('.th-tw-tag[data-tag-page]')) return twoWay.openPage(target.dataset.tagPage, event.shiftKey);
  if (target.matches('[data-draft="tag"]')) return twoWay.tagList(target);
  const key = target.dataset.key;
  // The head folds its list as the fold arrow does: rolled up before it goes, unrolled as it comes.
  const turn = () => { if (twoWay.isOpen(key)) shared.outline.close(target.closest('.th-tw-row')?.querySelector('.th-tw-list'), () => { twoWay.setOpen(key, false); draw(host()); }); else { twoWay.setOpen(key, true); state.fresh = key; state.html = null; draw(host()); state.fresh = ''; } };
  if (target.matches('.th-tw-toggle')) return turn();
  else if (target.matches('.th-tw-chip')) {
    // All folds and unfolds the list (the owner: "clicking All # should fold/unfold"); with one tag picked
    // it first shows every node again. A tag's word opens the list with only its nodes, a second click shows all.
    const tag = target.dataset.tag || '';
    if (!tag) { if (state.only.has(key)) { state.only.delete(key); twoWay.setOpen(key, true); } else return turn(); }
    else { if (state.only.get(key) === tag) state.only.delete(key); else state.only.set(key, tag); if (!twoWay.isOpen(key)) twoWay.setOpen(key, true); }
  }
  draw(host());
}

// Where an Undo sits (shared.undo): at the end of a row's name on the page in the main view; the first row's
// when the change was to several rows at once; at the bottom right when no row is left to sit beside.
const rowNames = field => [...host().querySelectorAll('#main-content-container .th-two-way .th-tw-row')]
  .filter(row => field == null || row.dataset.field === field).map(row => row.querySelector('.th-tw-name')).filter(Boolean);
let undoCount = 0;
// near: where the change sits in an opened node, found again by its key after each drawing; the row's name
// when it is not on screen.
// many: a change of several nodes at once (the pick bar), which keeps its own Undo beside the arrow of a change of one thing.
const offerUndo = (text, run, field, near, many = false) => { if (!many) made.key = ''; shared.undo.offer({ key: `two-way:${++undoCount}`, at: () => near?.() || (field == null ? rowNames().slice(0, 1) : rowNames(field)), text, run, many }); };
// The arrow on something just made takes the thing away, so it lasts only while the thing is as it was made: written in,
// renamed or given a bullet, it goes (asked after a change, and again when pressed). What was written is never taken with it.
// A page made is kept too once anything has come to point at it (a link, a property's value), as Predictive and Structure keep
// theirs (10 November 2026, the door's one rule): its Undo would leave that link pointing at nothing.
const made = { key: '', uuid: '', was: '', page: false, timer: 0 };
const asMade = async m => await model.madeState(m.uuid) === m.was && (!m.page || await model.pageUnlinked(m.uuid));
async function offerMade(uuid, text, run, field, near, page = false) {
  const mine = { uuid, was: await model.madeState(uuid), page };
  offerUndo(text, async () => { if (!await asMade(mine)) return notify(page ? 'It has changed or been linked to since it was made, so it stays' : 'It has changed since it was made, so it stays', 'warning'); await run(); }, field, near);
  Object.assign(made, { key: `two-way:${undoCount}`, ...mine });
}
/* The arrow on a value changed puts it back only while the value is as the change left it (8 November 2026): what was written
   after, by hand or by another plugin, is never written over. spots are [node, property] pairs; guard gives the undo to keep,
   which answers 'kept' when something changed since and leaves it. */
const stampOf = spots => Promise.all(spots.map(([uuid, ident]) => model.valueStamp(uuid, ident))).then(JSON.stringify);
async function guard(spots, undo) {
  const was = await stampOf(spots);
  return async () => { if (await stampOf(spots) !== was) return 'kept'; await undo(); };
}
async function offerKept(spots, text, run, field, near) {
  const undo = await guard(spots, run);
  offerUndo(text, async () => { if (await undo() === 'kept') notify('It has changed since, so it stays', 'warning'); }, field, near);
}
function checkMade() {
  if (made.key && !shared.undo.has(made.key)) made.key = '';   // used, replaced or left behind with the page
  if (!made.key) return;
  clearTimeout(made.timer);
  made.timer = setTimeout(async () => {
    const key = made.key;
    if (key && !await asMade(made).catch(() => true) && key === made.key) { shared.undo.forget(key); made.key = ''; }
  }, 300);
}
const inBox = selector => () => state.box?.isConnected ? state.box.querySelector(selector) : null;
const valueBox = (uuid, prop) => inBox(`.th-ol-pname[data-edit="${CSS.escape(prop.ident)}"][data-uuid="${CSS.escape(uuid)}"] + .th-ol-pv`);

/* Right-click a row's name to change how it reads here (the owner: "I should be able to right click
   “report of of” and edit display name"). Saved in "Fields read backwards", as the tag map's box does; empty goes
   back to how the name reads by itself. Undo is the arrow after the row's name. */
/* The right-click on a row's name opens a short menu under it, the kit's pop-up: Group by…, Open in the map,
   Reads back as…, Hide where it points. One “…” for every item that asks before it acts; every item has its icon (the audit's 25). */
function onRename(event) {
  // A node's line: its own menu, from the pieces (pin, compare, …); nothing when none has an item for it.
  const lineEl = !event.target.closest?.('.th-tw-name') && event.target.closest?.('.th-tw-line[data-uuid]');
  if (lineEl) {
    const row = lineEl.closest('.th-tw-row'), group = state.groups.find(g => g.name === row?.dataset.field), item = group?.items.find(i => i.uuid === lineEl.dataset.uuid);
    const items = item ? lineMenuHooks.flatMap(hook => hook(group, item) || []) : [];
    if (!items.length) return;
    event.preventDefault(); event.stopPropagation(); twoWay.hidePeek(); twoWay.closeAdd();
    twoWay.adding.pop = shared.popup({ at: lineEl.querySelector('.th-tw-record') || lineEl, head: shortName(item.title), onClose: () => { twoWay.adding.pop = null; }, items });
    return;
  }
  const nameEl = event.target.closest?.('.th-tw-name') || event.target.closest?.('.th-tw-head')?.closest('.th-tw-row')?.querySelector('.th-tw-name');
  const group = nameEl && state.groups.find(g => g.name === nameEl.closest('.th-tw-row')?.dataset.field);
  if (!group) return;
  event.preventDefault(); event.stopPropagation(); twoWay.hidePeek(); twoWay.closeAdd();
  // As wide as its longest words (the review, 31 October: a set width cut the widest action short).
  twoWay.adding.pop = shared.popup({ at: nameEl.querySelector('.th-tw-field') || nameEl, head: group.label, onClose: () => { twoWay.adding.pop = null; }, items: [
    ...(!state.drawingTop ? [{ icon: 'order', label: 'View', sub: async () => twoWay.shortView(await twoWay.viewItems(group)), subWidth: 260 }] : []),
    { sep: true },
    isMentions(group)
      ? { icon: 'remove', label: 'Hide mentions on this page', run: () => { hideMentionsHere().catch(error => warnOnce('could not hide the mentions row', error)); } }
      : provided.tagTree?.showProp ? { icon: 'map', label: 'Open in the map', run: () => provided.tagTree.showProp(group.name) } : null,
    ...(isMentions(group) && refusedHere() ? [{ icon: 'show', label: `Show the ${refusedHere()} suggestion${refusedHere() === 1 ? '' : 's'} taken off`, run: showCouldBeAgain }] : []),
    ...rowMenuHooks.flatMap(hook => hook(group) || []),
    ...(isMentions(group) ? [] : [{ icon: 'rename', label: 'Reads back as…', run: () => { renameRow(group, nameEl).catch(error => warnOnce('could not rename the row', error)); } }]),
    // The same two words as the tag map's (one word for each idea); the head above already names the row.
    ...(isMentions(group) ? [] : [{ icon: 'hide', label: 'Hide where it points', run: () => {
      setShownAtOtherEnd(group.name, false);
      offerUndo(`“${group.label}” is hidden on every page it points to; the links stay`, () => { setShownAtOtherEnd(group.name, true); later(0); });
      later(0);
    } }]),
  ].filter(Boolean) });
}
// The mentions row left out on this page: its name added to "Pages without the mentions row"; Undo takes it out.
async function hideMentionsHere() {
  const uuid = state.pageUuid, stored = await provided.titleNow(uuid).catch(() => '');
  const title = String(await provided.readableTitle(stored).catch(() => stored) || '').trim();
  if (!title) return;
  const before = String(setting('twoWayMentionsHidden') || '');
  const names = before.split(/[;\n]/).map(name => name.trim()).filter(name => name && name.toLowerCase() !== title.toLowerCase());
  saveSettings({ twoWayMentionsHidden: [...names, title].join('; ') });
  offerUndo(`The mentions row is hidden on “${title}”`, () => { saveSettings({ twoWayMentionsHidden: before }); later(0); });
}
/* The cloud model's name for a row (Predictive's helper, /reads-back, version 6): the property seen from the page it points to.
   Only the property's name and tags' names are sent. [] when the helper or the cloud model is not there, or "Read my words with
   Apple's tools" is off; kept for each property until the plugin reloads, asked again after a miss. */
const { HELPER } = window.PluginDoor || {};
const readsBackKept = new Map();
// No fetch (a test's stand-in window) or the setting off: never asked.
const canAsk = () => appleOn() && typeof fetch === 'function' && typeof AbortSignal?.timeout === 'function';
// Whether the helper answers, knows /reads-back from the cloud (version 6) and the cloud model is there for this Mac.
const cloudReady = async () => canAsk() && !!await fetch(HELPER + '/status', { signal: AbortSignal.timeout(800) }).then(r => r.json()).then(status => status?.cloud && (status.version || 0) >= 6, () => false);
function readsBackOffers(group) {
  if (!canAsk()) return Promise.resolve([]);
  const key = group.name.toLowerCase();
  if (!readsBackKept.has(key)) {
    const asking = (async () => {
      if (!await cloudReady()) return [];
      const schema = provided.propSchema ? await provided.propSchema().catch(() => null) : null;
      const prop = schema?.props.find(p => p.title.toLowerCase() === key);
      const from = [...new Set(group.items.map(item => item.tag).filter(tag => tag && tag !== 'note'))].slice(0, 6);
      const to = (prop?.classes || []).map(c => c.title).filter(Boolean).slice(0, 6);
      const reply = await fetch(HELPER + '/reads-back', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ property: group.name, from, to }), signal: AbortSignal.timeout(20000) }).then(r => r.json()).catch(() => null);
      return Array.isArray(reply?.names) ? reply.names.filter(name => typeof name === 'string' && name.trim()).slice(0, 3) : [];
    })().catch(() => []);
    readsBackKept.set(key, asking);
    asking.then(names => { if (!names.length && readsBackKept.get(key) === asking) readsBackKept.delete(key); });
  }
  return readsBackKept.get(key);
}
async function renameRow(group, nameEl) {
  const before = backwardsLabel(group.name);
  // Typed on the row's own name, as a page is renamed in Logseq (1.0.4); empty goes back to how it reads by itself. Under the
  // box: the cloud model's name, grammar's and the property's own, each once, leaving out what the row reads now.
  const offers = () => readsBackOffers(group).catch(() => []).then(names => [...new Set([...names, byGrammar(group.name), group.name])].filter(name => name !== before));
  const typed = await shared.editInPlace({ at: nameEl, value: before, placeholder: group.name, offers });
  if (typed == null || typed.trim() === before) return;
  setBackwards(group.name, typed.trim());
  offerUndo(typed.trim() ? `${group.name} reads “${typed.trim()}” on every page it points to` : `${group.name} reads as it does by itself again on every page it points to`, () => setBackwards(group.name, before), group.name);
}

function applyStyles() {
  sendStyle('th-two-way', setting('twoWayRows') ? twoWay.twoWayCss : '');
  sendStyle('th-two-way-hide-linked-refs', setting('twoWayRows') && setting('twoWayHideLinkedRefs') ? twoWay.hideLinkedRefsCss : '');
  sendStyle('th-two-way-no-days', setting('twoWayRows') && !setting('twoWayDays') ? twoWay.noDaysCss : '');
  sendStyle('th-two-way-hide-tag-lists', setting('twoWayRows') && setting('twoWayHideTagLists') ? twoWay.hideTagListsCss : '');
}

let timer = 0, indexTimer = 0;
const later = (ms = 600) => { clearTimeout(timer); timer = setTimeout(() => load().catch(error => warnOnce('could not refresh the two-way rows', error)), ms); };
// Right after Logseq starts its database is not ready for a while (the audit: the read 1.5 s after a cold
// start failed, and nothing read again until the graph changed): a few quiet tries before saying so.
let indexTries = 0;
const indexLater = ms => { clearTimeout(indexTimer); indexTimer = setTimeout(() => loadIndex().then(() => { indexTries = 0; }, error => {
  if (++indexTries < 5) indexLater(2000 * indexTries); else { indexTries = 0; warnOnce('could not read the rows of every page', error); }
}), ms); };
let stopped = false;
// The core's things, taken when the part starts; the pieces reach the ones they use through twoWay.
function useCore(core) {
  ({ UUID, isEntityId, watchDomEarly, addsElements, sendStyle, provided, uuidsIn, saveSettings, onPageChange, onDatabaseChange, onSettingsChange } = take(core, ['UUID', 'isEntityId', 'watchDomEarly', 'addsElements', 'sendStyle', 'provided', 'uuidsIn', 'saveSettings', 'onPageChange', 'onDatabaseChange', 'onSettingsChange', 'currentPage', 'getPage', 'createPage', 'deletePage', 'appendBlock', 'removeBlock', 'addTag', 'removeTag', 'setValue', 'unsetValue', 'STATUS_IDENT', 'editBlock']));
  model = core.provided; // the graph is read and written through the model's doors
  Object.assign(twoWay, { UUID, isEntityId, provided, model, uuidsIn });
}
function start() {
  useCore(window.Threads.core);
  stopped = false;
  applyStyles();
  readHeights();
  twoWay.forgetOrder();
  twoWay.readOpen();
  twoWay.readGroup();
  for (const starter of starters) { try { starter(); } catch (error) { warnOnce('a piece could not start', error); } }
  watchDomEarly(drawEarly);
  draw(host());
  // At once: the look-up waits in line behind Logseq loading the page anyway. The box stays until the next
  // page is drawn: draw() moves it, or takes it away, in the same frame. The hooks are the core's.
  onPageChange(() => { if (stopped) return; onRoute(); later(0); });
  onDatabaseChange(change => {
    if (stopped) return;
    clearTimeout(state.quiet);
    if (askQuietly.uuids.length) state.quiet = setTimeout(askQuietly, QUIET);
    checkMade();
    const writing = window.PluginDoor?.writing(change);
    if (!writing || touchesRows(change)) later(900);
    if (!writing && indexSize < BIG_INDEX) indexLater(10000);
  });
  // Another graph: nothing read of this one holds there.
  window.Threads.core.onGraphChange(() => { if (stopped) return; state.byPage = new Map(); state.mentionsOf = new Map(); state.indexed = false; state.node.clear(); twoWay.reading.clear(); state.pagesRead = null; indexSize = 0; made.key = ''; later(0); indexLater(0); });
  onSettingsChange((now, before) => {
    if (stopped) return;
    if (settingsSchema.some(item => now?.[item.key] !== before?.[item.key])) { applyStyles(); later(0); indexLater(0); }
  });
  // A click away from an empty draft line drops it; one with words keeps them.
  const away = event => { if (state.draft && !state.draft.name.trim() && !event.target.closest?.('.th-tw-draft, .th-two-way-add, .th-tw-add, .th-tw-gadd')) { state.draft = null; twoWay.closeAdd(); draw(host()); } };
  listen(host(), 'mousedown', away, true);
  const escape = event => {
    if (event.key !== 'Escape' || event.target.closest?.('input, textarea, [contenteditable="true"]')) return;
    if (state.picked.size || state.selecting.size) { stopPicking(); draw(host()); }
    // The focus closes and hands the grey to its parent.
    else if (state.focus && state.dig.has(state.focus) && state.focus !== twoWay.topStep()?.key) { event.preventDefault(); const key = state.focus; shared.outline.close(state.box?.querySelector(`.th-ol-kids[data-key="${CSS.escape(key)}"]`), () => twoWay.closeDig(key)); }
    // Nothing open under the top: one step back along the trail (Esc does one thing at a time).
    else if (state.steps.length) { event.preventDefault(); twoWay.stepBack(state.steps.length - 2); }
    // Then the find line's words (a day, a page beside, letters): back to today's whole page (7 November 2026).
    else if (state.find) { event.preventDefault(); state.find = ''; draw(host()); }
  };
  listen(host(), 'keydown', escape);
  let pinFrame = 0;
  const onScroll = () => { cancelAnimationFrame(pinFrame); pinFrame = requestAnimationFrame(twoWay.pinNow); };
  listen(host(), 'scroll', onScroll, { capture: true, passive: true });
  twoWay.steadyWidth(host(), true);
  onUnload(() => { twoWay.steadyWidth(host(), false); stopped = true; clearTimeout(timer); clearTimeout(indexTimer); clearTimeout(settle.timer); clearTimeout(settle.ease); clearTimeout(settle.wait); if (settle.frame) cancelAnimationFrame(settle.frame); twoWay.hidePeek(); twoWay.closeAdd(); state.box?.remove(); state.box = null; });
  later(0);
  indexLater(1500);
}
((window.Threads ||= {}).parts ||= []).push({ name: 'two-way', says: 'the rows on a page', schema: settingsSchema, start, stop: runUnloadTasks, inner: twoWay });
// What the pieces reach of the part, and of the core once it starts (useCore).
Object.assign(twoWay, { taskHtml, dayCellOf, headWhen, whenTip, INLINE, LISTED, UUID, stopPicking, clickHooks, tailHooks, viewMenuHooks, listHooks, headHooks, underHeadHooks, leadHooks, betweenHooks, lineMenuHooks, rowMenuHooks, saveSettings: changes => saveSettings(changes), dayCell, isDated, readKids, hasKids, loadHooks, settledHooks, starters, summary, plural, tagWord, dayText, draw, groupsFor, inBox, isMentions, couldBeOff, itemHtml, later, lineDay, model, nameHtml, offerKept, offerMade, offerUndo, guard, onUnload, listen, provided, rowHtml, setting, shortName, state, tagLink, todayNumber, uuidsIn, valueBox, warnOnce, useCore });
})();
