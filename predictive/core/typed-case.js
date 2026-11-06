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

const api = { plainLinks, carry, keepCase, sameButCase, tagIds, tagsByName };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') (window.Flow ||= {}).typedCase = api;
})();
