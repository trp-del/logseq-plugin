/* Suggested links, the rule (ported from logseq-db-refinements parts/link-suggest.js; the drawing is in logseq/link-ui.js).

   suggestFor(text, caret, pages, options) says what the last words typed could become: the rest of a page's name, shown
   grey after the cursor. Pure, so the tests can try it. The learning (which names the graph usually links, which the
   owner took or passed over) comes in as `rates` and `memory`; the pages that would fill an empty property of the bullet
   come in as `boost`. Nothing here knows a graph. */
(function () {
const WORD = /[\p{L}\p{N}]/u;
const letters = text => (text.match(/[\p{L}\p{N}]/gu) || []).length;
const bareWords = text => (String(text).toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);

// A page's own tag, for the ranking: one of yours, not Logseq's Page or Tag.
const tagged = page => page.isTag || (page.tags || []).some(t => t.title && !/^(page|tag)$/i.test(t.title));
const better = (a, b) => (tagged(b.page) - tagged(a.page)) || (a.page.title.length - b.page.title.length) || a.page.lower.localeCompare(b.page.lower);

/* From start back over the typed words that are earlier words of the name (before: the name's text before the word
   matched), in order: each typed word taken must be a word of the name before the last one taken. Returns [start, span]
   for head. "Ask Dr. Pat" links "Dr. Pat" as Dr. Raj Patel, with no "Dr." left in front. */
function takeNameWords(head, start, before) {
  const names = bareWords(before);
  let at = start, upTo = names.length;
  for (;;) {
    const m = /(\S+)(\s+)$/u.exec(head.slice(0, at));
    if (!m) break;
    if (/[\[\]#`]/.test(m[1])) break;                                     // a link, a tag or code is left as it is
    const typed = bareWords(m[1]);
    if (typed.length !== 1) break;
    let i = upTo - 1;
    while (i >= 0 && names[i] !== typed[0]) i--;
    if (i < 0) break;
    const lead = m[1].match(/^[^\p{L}\p{N}]*/u)[0];                        // "(Dr." -> "Dr.", the bracket left out
    at = at - m[0].length + lead.length; upTo = i;
    if (lead) break;
  }
  return [at, head.slice(at)];
}
function wordStarts(lower) {
  const at = [];
  for (let i = 1; i < lower.length; i++) if (WORD.test(lower[i]) && !WORD.test(lower[i - 1])) at.push(i);
  return at;
}

/* What the graph has taught: usual(lower) is a name the graph usually links (linked at least USUAL_LEAST times and
   USUAL_SHARE of its mentions), with what the owner took or passed over counted in (memory: [taken, ignored] by name,
   each worth MEMORY_WEIGHT mentions). Such a name is offered from three letters. rarelyLinked is the other way round. */
const USUAL_LEAST = 2, USUAL_SHARE = 0.6, PLAIN_LEAST = 3, PLAIN_SHARE = 0.2, MEMORY_WEIGHT = 2;
function tallyOf(lower, rates, memory) {
  const r = rates?.get(lower), m = memory?.[lower];
  return { linked: (r?.linked || 0) + (m?.[0] || 0) * MEMORY_WEIGHT, plain: (r?.plain || 0) + (m?.[1] || 0) * MEMORY_WEIGHT };
}
function usual(lower, rates, memory) {
  const { linked, plain } = tallyOf(lower, rates, memory);
  return linked >= USUAL_LEAST && linked / (linked + plain) >= USUAL_SHARE;
}
function rarelyLinked(lower, rates, memory) {
  const { linked, plain } = tallyOf(lower, rates, memory);
  return linked + plain >= PLAIN_LEAST && linked / (linked + plain) <= PLAIN_SHARE;
}

/* The pages that would fill an empty link property of the bullet: the link properties of its tags and of the tags they
   extend, each taken as empty while the bullet is written. A wide property (taking more than WIDE tags) is left out,
   since it would make nearly every page sure. Returns a Set of page ids, or null. */
const WIDE = 3;
function fitsTags(page, classIds, schema) {
  const seen = new Set(), queue = page.tags.map(t => t.id);
  while (queue.length) { const c = queue.shift(); if (seen.has(c)) continue; seen.add(c); if (classIds.has(c)) return true; queue.push(...(schema.parentsOf.get(c) || [])); }
  return false;
}
function boostFor(tagIds, schema, pages) {
  const classIds = new Set(), seen = new Set(), queue = [...tagIds];
  while (queue.length) {
    const t = queue.shift(); if (seen.has(t)) continue; seen.add(t);
    for (const pid of schema.classProps.get(t) || []) { const prop = schema.byId.get(pid); if (prop && prop.classes.length && prop.classes.length <= WIDE) for (const c of prop.classes) classIds.add(c.id); }
    queue.push(...(schema.parentsOf.get(t) || []));
  }
  if (!classIds.size) return null;
  return new Set(pages.filter(page => fitsTags(page, classIds, schema)).map(page => page.id));
}

// A long name needs more of itself typed before it is offered: a name of up to three words from its first letters, a
// longer one only once a third of its letters are typed, unless the page is sure.
const WORDS_FREE = 3, COVER = 1 / 3;
/* The suggestion for the words before the cursor, or null: { start, end, span, title, ghost, name, after }. start..end
   is the span the link replaces (span its words), ghost the rest of the name to show, name the whole name as the cue
   (shown when the words sit inside it or finish it), after true when the words are already finished by a space (nothing
   grey: a dotted line under them, until the next letter). Options: min, the setting's letters; rates and memory (usual,
   above); boost, the ids of pages that would fill one of the bullet's empty properties. */
function suggestFor(text, caret, pages, { min = 0, rates = null, memory = null, boost = null } = {}) {
  let head = text.slice(0, caret), next = text[caret] || '';
  if (text.slice(caret).trim()) return null;                                 // only while writing on, not editing inside the words
  const after = / $/.test(head) && !/ {2}$/.test(head);
  if (after) head = head.slice(0, -1); else if (!WORD.test(head.slice(-1)) || WORD.test(next)) return null; // not at the end of a word
  const lastOpen = head.lastIndexOf('[['); if (lastOpen >= 0 && head.indexOf(']]', lastOpen) < 0) return null; // inside [[ ]]
  const lastTick = head.lastIndexOf('`'); if (lastTick >= 0 && (head.match(/`/g) || []).length % 2) return null; // inside `code`
  const run = /(\S+(?:\s+\S+){0,3})$/.exec(head); if (!run) return null;
  const base = head.length - run[1].length, words = [];
  for (const m of run[1].matchAll(/\S+/g)) words.push({ at: base + m.index, word: m[0] });
  const current = words[words.length - 1].word;
  if (/^#|:\/\//.test(current)) return null;                                 // a tag, a web address
  const sure = (page, span) => (boost?.has(page.id) ? 3 : 0) + (usual(page.lower, rates, memory) ? 2 : 0) + (page.title === span ? 1 : 0);
  for (let k = Math.min(4, words.length); k >= 1; k--) {
    let start = words[words.length - k].at, span = head.slice(start);
    const lead = span.match(/^[^\p{L}\p{N}]*/u)[0]; span = span.slice(lead.length); start += lead.length; // "(Mei" -> "Mei"
    if (!span || /^#/.test(span)) continue;
    const q = span.toLowerCase().replace(/\s+/g, ' '), n = letters(q);
    if (n < 2) continue;
    const found = [];
    for (const page of pages) {
      if (page.lower.length < q.length) continue;
      if (after && page.lower !== q) continue;
      const at = page.lower.startsWith(q) ? 0 : wordStarts(page.lower).find(i => page.lower.startsWith(q, i));
      if (at === undefined) continue;
      const s = sure(page, span);
      if (!s && rarelyLinked(page.lower, rates, memory)) continue;
      if (!s && (page.lower.split(/\s+/).length > WORDS_FREE) && n < letters(page.lower) * COVER) continue;
      // A sure page from three letters (a name typed whole with its own capitals from two); any other page from the
      // setting's letters, never a short lower-case word ("the" never shows a page).
      const enough = s ? n >= (page.title === span ? 2 : 3) : n >= Math.max(3, min) && !(k === 1 && n < 4 && !/^\p{Lu}/u.test(span));
      if (enough) found.push({ page, at, s });
    }
    if (!found.length) continue;
    // Boosted first, then usual, then a name that starts with the words, then one of your tags, then the shortest.
    found.sort((a, b) => (b.s - a.s) || ((a.at > 0) - (b.at > 0)) || better(a, b));
    const hit = found[0], ghost = hit.page.title.slice(hit.at + q.length);
    if (hit.at > 0) [start, span] = takeNameWords(head, start, hit.page.lower.slice(0, hit.at));
    // A second name (an alias) always says whose it is: "Dr. Chen -> Dr. Mei Chen".
    const name = hit.page.aliasOf?.title ? `${hit.page.title} → ${hit.page.aliasOf.title}` : hit.at > 0 || !ghost ? hit.page.title : '';
    return { start, end: head.length, span, title: hit.page.title, ghost, name, after };
  }
  return null;
}

/* How often each page's name is linked, and how often written plain: each [[uuid]] or [[Name]] counted for its page, and
   each page's name counted where it stands as whole words outside a link. By the page's lower-case name: { linked, plain }.
   This is what "the graph usually links this name" rests on. rateCounter(pages).add(words) counts one line, add(words, -1)
   takes it back, so a changed line costs one line; each word of a line is looked up, so the cost does not grow with the
   pages. The names are found word by word; the few with no letter or number in them by a pattern of their own. */
const storedRef = /(\(\(|\[\[)([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})(\)\)|\]\])/gi;
const nameWord = /[\p{L}\p{N}]+/gu, wordLetter = /[\p{L}\p{N}]/u;
function rateCounter(pages) {
  const rates = new Map(), byUuid = new Map();
  for (const page of pages) { rates.set(page.lower, { linked: 0, plain: 0 }); if (page.uuid) byUuid.set(page.uuid.toLowerCase(), page.lower); }
  const names = [...rates.keys()].filter(n => n.length >= 2).sort((a, b) => b.length - a.length);   // longest first
  const escape = n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const words = new Map(), wordless = [];   // a tree of the names' words: { next, names } at each word
  for (const name of names) {
    const spelled = [...name.matchAll(nameWord)];
    if (!spelled.length) { wordless.push(name); continue; }
    let level = words, at;
    for (const [word] of spelled) { at = level.get(word) || { next: new Map(), names: [] }; level.set(word, at); level = at.next; }
    at.names.push({ name, lead: spelled[0].index });
  }
  const finder = wordless.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${wordless.map(escape).join('|')})(?![\\p{L}\\p{N}])`, 'giu') : null;
  const isName = (lower, name, at) => lower.startsWith(name, at) && !(at > 0 && wordLetter.test(lower[at - 1])) && !wordLetter.test(lower[at + name.length] || '');
  function add(title, by = 1) {
    const plain = title.replace(/\[\[([^\[\]]+)\]\]/g, (m, inner) => {
      const key = inner.trim().toLowerCase(), lower = byUuid.get(key) || (rates.has(key) ? key : null);
      if (lower) rates.get(lower).linked += by;
      return ' ';
    }).replace(storedRef, ' ').toLowerCase();
    const spelled = [...plain.matchAll(nameWord)];
    let past = 0;
    spelled.forEach((word, i) => {
      if (word.index < past) return;
      let hit = null, level = words;
      for (let j = i, at; (at = level.get(spelled[j]?.[0])); j++, level = at.next) hit = at.names.find(({ name, lead }) => word.index - lead >= past && isName(plain, name, word.index - lead)) || hit;
      if (hit) { rates.get(hit.name).plain += by; past = word.index - hit.lead + hit.name.length; }
    });
    if (finder) for (const m of plain.matchAll(finder)) rates.get(m[0]).plain += by;
  }
  return { rates, add };
}
function linkRatesOf(pages, titles) {
  const counter = rateCounter(pages);
  for (const title of titles) counter.add(title);
  return counter.rates;
}

const api = { suggestFor, takeNameWords, boostFor, fitsTags, usual, rarelyLinked, rateCounter, linkRatesOf, letters };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') (window.Flow ||= {}).link = api;
})();
