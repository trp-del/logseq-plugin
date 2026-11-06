/* Your capitals in a link. Logseq saves a [[link]] as the page's id and always shows the page's own name, so [[dr. mei chen]]
   comes back as Dr. Mei Chen. A link with its own words, [dr. mei chen]([[Dr. Mei Chen]]), is Logseq's own and keeps them. These
   are the pure parts: which links in the words are plain ones, what was typed for each while the bullet was open, and the saved
   words with the links whose capitals differ given your words. No Logseq, no screen: runs in Node for the tests and in the
   plugin alike (logseq/typed-case.js watches the bullet). */
(function () {
const LINK = /\[\[([^\[\]]+)\]\]/g;
// A plain link: not a tag (#[[Two Words]]) and not already a link with its own words ([words]([[Page]])).
function plainLinks(text) {
  const out = [];
  for (const m of String(text || '').matchAll(LINK)) {
    const before = text.slice(Math.max(0, m.index - 2), m.index);
    if (before.endsWith('#') || before === '](') continue;
    out.push({ name: m[1], at: m.index, length: m[0].length });
  }
  return out;
}
const lower = s => String(s).toLowerCase();
const sameButCase = (a, b) => a !== b && lower(a) === lower(b);

/* What was typed for each plain link, carried from the last look at the words to this one. A link unchanged keeps what was
   typed. A link whose name changed only in its capitals keeps what was typed too: that is Logseq's list putting in the page's
   name for the name you typed whole. Any other change is typing, and the words now there are what was typed. When links come
   or go, those before and after the change are matched from each end. */
function carry(before, typed, now) {
  const out = now.slice();
  const keeps = (i, j) => before[i] === now[j] || sameButCase(before[i], now[j]);
  let head = 0;
  while (head < before.length && head < now.length && keeps(head, head)) { out[head] = typed[head]; head++; }
  let tail = 0;
  while (tail < before.length - head && tail < now.length - head && keeps(before.length - 1 - tail, now.length - 1 - tail)) {
    out[now.length - 1 - tail] = typed[before.length - 1 - tail]; tail++;
  }
  return out;
}

/* The saved words with each plain link whose typed name differs from the page's only in its capitals written with your words.
   saved: the words as Logseq holds them ([[uuid]]); typed: what was typed for each plain link, in order; titleOf(uuid): the
   page's name. Null when nothing changes, or when the saved links do not line up with the typed ones (then nothing is guessed). */
function keepCase(saved, typed, titleOf) {
  const links = plainLinks(saved);
  if (!links.length || links.length !== typed.length) return null;
  let out = '', from = 0, changed = false;
  links.forEach((link, i) => {
    const title = titleOf(link.name), mine = typed[i];
    if (!title || !mine || !sameButCase(mine, title) || /[\[\]]/.test(mine)) return;
    out += saved.slice(from, link.at) + `[${mine}]([[${link.name}]])`;
    from = link.at + link.length; changed = true;
  });
  return changed ? out + saved.slice(from) : null;
}

/* The words made ready to hand to Logseq: a tag saved as #[[id]] is written by its name, as the bullet's text box shows it
   (#Consultation, #[[Symptom Log]]). Logseq's updateBlock reads #[[id]] as a new tag named by the id, while a name it turns
   back into the tag's id, as when you type it; a plain [[id]] it reads right. Null when a tag's name is not known. */
const TAG_ID = /#\[\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]\]/gi;
const tagIds = words => [...String(words).matchAll(TAG_ID)].map(m => m[1]);
function tagsByName(words, titleOf) {
  let missing = false;
  const out = String(words).replace(TAG_ID, (m, id) => {
    const name = titleOf(id);
    if (!name || /[\[\]]/.test(name)) { missing = true; return m; }
    return /^[^\s#,.!?;:"'()]+$/.test(name) ? `#${name}` : `#[[${name}]]`;
  });
  return missing ? null : out;
}

/* A suggested link taken (Right arrow, a tap of the Hyper key) is written in the capitals you were typing in: the letters you
   typed stay as typed, and the rest of the name follows them, all small after small letters ("dr. mei" gives dr. mei chen), all
   capitals after capitals ("MR" gives MRI), the page's own after anything else ("dr. Mei" gives dr. Mei Chen). When the words
   typed are inside the name ("mei" for Dr. Mei Chen), the whole name follows them the same way. rest(span, words) is the grey
   words as they will be written; written(span, title) the whole name. */
function styleOf(span) {
  const all = String(span).match(/\p{L}/gu) || [];
  if (!all.length) return 'own';
  if (all.every(c => c === c.toLowerCase() && c !== c.toUpperCase())) return 'lower';
  if (all.length > 1 && all.every(c => c === c.toUpperCase() && c !== c.toLowerCase())) return 'upper';
  return 'own';
}
const styled = (style, words) => style === 'lower' ? words.toLowerCase() : style === 'upper' ? words.toUpperCase() : words;
const rest = (span, words) => styled(styleOf(span), String(words));
function written(span, title) {
  span = String(span); title = String(title);
  if (lower(title).startsWith(lower(span))) return span + rest(span, title.slice(span.length));
  return rest(span, title);
}

/* Back in the bullet, Logseq's text box would show such a link as it is kept, [dr. mei chen]([[Dr. Mei Chen]]). It is shown as
   you typed it, [[dr. mei chen]], and written back with your words when you leave. Only a link whose words are the page's name
   in other capitals; any other link with its own words is left as it is. Returns { text, at } (at moves a place in the old words
   to the same place in the new) or null when nothing changes. */
const LABELLED = /\[([^\[\]]+)\]\(\[\[([^\[\]]+)\]\]\)/g;
function asTyped(text) {
  text = String(text ?? '');
  const cuts = [];   // each link changed: where it was, and how many letters fewer before it
  let out = '', from = 0, fewer = 0;
  for (const m of text.matchAll(LABELLED)) {
    const [whole, words, name] = m;
    if (!sameButCase(words, name)) continue;
    const now = `[[${words}]]`;
    out += text.slice(from, m.index) + now; from = m.index + whole.length;
    cuts.push({ start: m.index, end: m.index + whole.length, before: fewer, words: words.length }); fewer += whole.length - now.length;
  }
  if (!cuts.length) return null;
  out += text.slice(from);
  // A place in the words before a link stays; one inside its words keeps its letter; one after moves back by what went.
  const at = place => {
    for (const cut of cuts) {
      if (place <= cut.start) return place - cut.before;
      if (place < cut.end) return cut.start - cut.before + 2 + Math.max(0, Math.min(place - cut.start - 1, cut.words));
    }
    return place - fewer;
  };
  return { text: out, at };
}

const api = { plainLinks, carry, keepCase, sameButCase, tagIds, tagsByName, rest, written, asTyped };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') (window.Flow ||= {}).typedCase = api;
})();
