/* What a bullet's own words already say for certain about its properties. No Logseq here, and no guessing: a value is
   answered only where exactly one thing can be meant.
   sure(facts) answers [{ ident, value, why }]; value is the id of the node to put under the property.
     facts.tags      the ids of the bullet's own tags
     facts.tagIndex  id -> { id, parents: [id] }: every tag of the person's
     facts.props     the properties the bullet's tags give it, inherited ones included: [{ ident, type, range: [tag id], many }]
     facts.held      the idents the bullet already holds a value under: those are never touched
     facts.linked    the nodes its words link, [{ id, tags: [tag id] }]
     facts.page      the page it is written on, { id, tags, day } (day: its journal day, else 0)
     facts.dated     for a date property, how earlier nodes of these tags were dated: ident -> { same, other }, the number written
                     on a journal day with that very day under the property, and the number with another day
   The rules:
     1. A linked node fits a property when one of its tags, or a tag above one, is in the property's range. A property that only
        one linked node fits, and a node that fits only one empty property, are a sure pair.
     2. A property no linked node fits takes the page the bullet is on, when the page fits it and fits no other empty property.
     3. A date property takes the journal day the bullet is written on, when every earlier node dated that way did (three at least). */
(function (root) {
const T = typeof module !== 'undefined' && module.exports ? require('./tags.js') : root.PluginDoor.tags;
function sure(facts) {
  const { tags = [], tagIndex = new Map(), props = [], held = new Set(), linked = [], page = null, dated = new Map() } = facts || {};
  const open = props.filter(prop => !held.has(prop.ident));
  const fits = (node, prop) => (prop.range || []).length > 0 && (node.tags || []).some(tag => { const up = T.above(tag, tagIndex); return prop.range.some(id => up.has(id)); });
  const nodeProps = open.filter(prop => prop.type === 'node');
  const out = [];
  const taken = new Set();
  const fitsOf = new Map(nodeProps.map(prop => [prop.ident, linked.filter(node => fits(node, prop))]));
  for (const prop of nodeProps) {
    const fit = fitsOf.get(prop.ident);
    if (fit.length !== 1) continue;
    const others = nodeProps.filter(other => other.ident !== prop.ident && fitsOf.get(other.ident).some(node => node.id === fit[0].id));
    if (others.length) continue;   // the node could be meant for another property as well: not sure
    out.push({ ident: prop.ident, value: fit[0].id, why: 'linked' }); taken.add(prop.ident);
  }
  if (page && !page.day && (page.tags || []).length) {
    const free = nodeProps.filter(prop => !taken.has(prop.ident) && !fitsOf.get(prop.ident).length && fits(page, prop));
    if (free.length === 1 && !linked.some(node => node.id === page.id)) out.push({ ident: free[0].ident, value: page.id, why: 'page' });
  }
  if (page && page.day) {
    for (const prop of open.filter(prop => prop.type === 'date')) {
      const seen = dated.get(prop.ident);
      if (seen && seen.same >= 3 && !seen.other) out.push({ ident: prop.ident, value: page.id, why: 'day' });
    }
  }
  void tags;
  return out;
}
/* A web address typed without http:// in front. Logseq makes a link only of an address with one, so the words are written as
   [as typed](https://as typed). addresses(words) answers the new words, or null where there is nothing to link.
   An address starts with www., or ends in a common ending (.com, .org, .gov …); an ending that is also an English word or a
   file's (.in, .me, .app) counts only with www. before it or a / after it. Left alone: a mail address, a file's name, code,
   a link already made, and anything in [[ ]]. */
const ENDINGS = new Set('com org net edu gov mil int io co ai dev info biz health xyz online site tech store blog news tv us uk ca de fr nl es se dk fi ch au nz jp cn br mx ie pt pl kr za eu'.split(' '));
const NEEDS_MORE = new Set('app me in it is at be no so to am ly gg gl'.split(' '));
const KEPT = /```[\s\S]*?(?:```|$)|`[^`\n]*`|\[[^\[\]\n]*\]\((?:[^()\n]|\([^()\n]*\))*\)|\[\[[^\n]*?\]\]|\(\([^\n]*?\)\)|\{\{[^\n]*?\}\}|<[^<>\n]*>|(?<![\w])[a-z][a-z0-9+.-]*:\/\/\S+|(?<![\w])(?:mailto|file|assets):\S+/gi;
const ADDRESS = /(?<![\w@.\/\\:#$=&?%~+-])((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+)([a-z]{2,})(?![\w@-]|\.\w)((?::\d+)?(?:[\/?#][^\s<>\[\]`"]*)?)/gi;
function linkOne(whole, host, ending, rest) {
  let tail = rest;
  for (;;) {   // the sentence's own marks are not the address's; nor is a bracket that closes one opened before it
    const last = tail.slice(-1);
    if (/[.,;:!'*_~^|]/.test(last) || (last === '?') || (last === ')' && tail.split('(').length < tail.split(')').length)) tail = tail.slice(0, -1);
    else break;
  }
  const www = /^www\./i.test(host), known = ending === ending.toLowerCase();
  if (!www && !(known && (ENDINGS.has(ending) || (NEEDS_MORE.has(ending) && tail.startsWith('/'))))) return whole;
  const typed = host + ending + tail;
  return `[${typed}](https://${typed.replace(/\(/g, '%28').replace(/\)/g, '%29')})${rest.slice(tail.length)}`;
}
function addresses(words) {
  const text = String(words == null ? '' : words);
  let out = '', at = 0;
  for (const kept of text.matchAll(KEPT)) { out += text.slice(at, kept.index).replace(ADDRESS, linkOne) + kept[0]; at = kept.index + kept[0].length; }
  out += text.slice(at).replace(ADDRESS, linkOne);
  return out === text ? null : out;
}
/* The pages a bullet's words link by name, as they stand in its box while it is written: [[A name]]. links(words) answers the
   names in their order, each once; a link still empty or not yet closed is none. */
const links = words => [...new Set([...String(words == null ? '' : words).matchAll(/\[\[([^\[\]\n]+)\]\]/g)].map(found => found[1].trim()).filter(Boolean))];
const api = { sure, addresses, links };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).sure = api;
})(typeof window !== 'undefined' ? window : globalThis);
