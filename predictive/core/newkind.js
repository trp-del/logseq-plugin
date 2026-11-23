/* The kind a new page is likely to be, from how the graph's own lines were written (0.5, the owner, 22 November 2026: "having to
   press [[ ]] twice then have to type # right after to add a tag to that page"). A new name has no page to ask, so the words
   before it are asked: in the earlier lines, which kinds of page were linked right after the same words ("lunch at [[Tartine]]",
   "at" was followed by Merchants). Pure: it is given the lines and the tags of the pages they link; it reads no graph.

   kindsAfter(before, lines, tagsOf, { skip })
     before   the words of the line up to where the new name goes
     lines    earlier lines as stored, a link written [[uuid]]
     tagsOf   uuid -> [{ uuid, title }] the linked page's tags
     skip     titles that say nothing about a kind (Logseq's own Page, Journal …)
   -> [{ uuid, title, count, lit }] the likeliest first, at most five; lit on the first only when it is clear: seen three times
      or more and at least twice as often as the next. With no clue nothing is lit (the owner is asked nothing; none is the
      plain choice). */
(function () {
const LINK = /\[\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]\]/gi;
const lastWords = (text, n) => String(text || '').toLowerCase().replace(/\[\[[^\]]*\]\]/g, ' ').split(/[^\p{L}\p{N}']+/u).filter(Boolean).slice(-n);
function kindsAfter(before, lines, tagsOf, { skip = [] } = {}) {
  const cue = lastWords(before, 2);
  if (!cue.length) return [];
  const no = new Set(skip.map(s => s.toLowerCase())), tally = new Map();
  const count = (uuid, weight) => { for (const t of tagsOf(uuid) || []) { if (!t?.title || no.has(t.title.toLowerCase())) continue; const k = tally.get(t.uuid) || { uuid: t.uuid, title: t.title, count: 0 }; k.count += weight; tally.set(t.uuid, k); } };
  for (const line of lines || []) {
    LINK.lastIndex = 0;
    let m;
    while ((m = LINK.exec(line))) {
      const lead = lastWords(line.slice(0, m.index), 2);
      if (!lead.length || lead[lead.length - 1] !== cue[cue.length - 1]) continue;
      // The last word the same counts once; the two last words the same, twice.
      count(m[1].toLowerCase(), cue.length > 1 && lead.length > 1 && lead[lead.length - 2] === cue[cue.length - 2] ? 2 : 1);
    }
  }
  const out = [...tally.values()].sort((a, b) => b.count - a.count || a.title.localeCompare(b.title)).slice(0, 5);
  if (out.length) out[0].lit = out[0].count >= 3 && out[0].count >= 2 * (out[1]?.count || 0);
  return out.map(k => ({ ...k, lit: !!k.lit }));
}
const api = { kindsAfter, lastWords };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') (window.Flow ||= {}).newkind = api;
})();
