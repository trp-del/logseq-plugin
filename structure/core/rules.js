/* The ontologist's five rules, as issues on the model: each names the tag it sits on, says what is wrong in one line,
   offers one fix in words, and carries the change the fix stages (shown to the person, with the nodes it touches, before it is staged). The dots in the tree are
   these, placed; the Health list is these, gathered. Nothing here is enforced: an issue is a quiet mark. */
(function () {
const S = window.Structure;
const { KINDS, isKind, count, kids, parentOf, kindOf, filled, filledOwn, rangeGuess, titled, tag, prop } = S.model;
const RULES = ['One place', 'A child earns its place', 'A relation has a range', 'A property lives as high as it is filled', 'Names say what they are'];
const list = names => names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];

// The singular of a name written in the plural (Consultations, Results, Studies), or null when the name reads singular.
function singularOf(name) {
  const m = String(name).match(/^(.*?)(\S+)$/); if (!m) return null;
  const [, head, word] = m;
  if (/^[A-Z]{2,}$/.test(word) || word.length < 4) return null;
  if (/ies$/.test(word)) return head + word.slice(0, -3) + 'y';
  if (/(ss|us|is|ous|news|ics)$/i.test(word)) return null;
  if (/(x|z|ch|sh|s)es$/.test(word)) return head + word.slice(0, -2);
  if (/s$/.test(word)) return head + word.slice(0, -1);
  return null;
}

/* An issue's sentence is kept in parts, each with its role, so a screen can key them apart (Health, a card's Issues): the
   thing to settle (a tag, or a property on a tag; it opens its card), the words that tie it to the rest, the tags it concerns
   (drawn as tags, three then "and N more"), the count. `text` is the same sentence as plain words. */
const subject = (tag, prop) => ({ subject: prop != null ? { tag, prop } : { tag } });
const say = words => ({ words });
const tags = (ids, sep) => ({ tags: ids, sep });
const num = count => ({ count });
const MORE = 3;
function plain(M, parts) {
  const nm = id => M.tags.get(id)?.title ?? '';
  let s = '';
  for (const p of parts) {
    const w = p.subject ? (p.subject.prop != null ? M.props.get(p.subject.prop)?.title : nm(p.subject.tag))
      : p.tags ? (p.sep === 'and' || p.tags.length <= MORE ? list(p.tags.map(nm)) : p.tags.slice(0, MORE).map(nm).join(', ') + ` and ${p.tags.length - MORE} more`)
      : p.count ?? p.words;
    s += (s && p.count ? ', ' : s && !/^[,:;]/.test(w) ? ' ' : '') + w;
  }
  return s;
}

function issues(M) {
  const out = [];
  // `line`: the line on a card the issue belongs to, when it has one (the property on the tag; a tag beneath on the property's card).
  const add = (rule, on, parts, fix, change, line) => out.push({ rule, on, parts, text: plain(M, parts), fix, change, line });
  const user = [...M.tags.values()].filter(t => !t.missing && !t.kind);
  const kindName = id => M.tags.get(id)?.title;
  // 1. One place.
  for (const t of user) {
    if (t.parents.length > 1) {
      const keep = [...t.parents].sort((a, b) => (isKind(M, a) ? 1 : 0) - (isKind(M, b) ? 1 : 0) || S.model.depth(M, b) - S.model.depth(M, a))[0];
      add(RULES[0], t.id, [subject(t.id), say('sits under'), tags(t.parents, 'and')], `keep only under ${kindName(keep)}`, { kind: 'keepUnder', tag: t.id, parent: keep });
    }
    if (!kindOf(M, t.id) && t.parents.length < 2) add(RULES[0], t.id, [subject(t.id), say('sits under none of the four kinds')], 'put under a kind', { kind: 'prompt', what: 'tag', tag: t.id });
  }
  // 2. A child earns its place.
  for (const t of user) if (!count(M, t.id) && !t.kids.length) add(RULES[1], t.id, [subject(t.id), say('has no nodes and no tags under it')], 'remove', { kind: 'remove', tag: t.id });
  const seenPair = new Set();
  for (const t of user) {
    if (!t.props.length) continue;
    const p = parentOf(M, t.id); if (p == null) continue;
    // A sibling with nothing of its own: every property it declares the other declares too (two or more), and it adds none.
    if (t.props.length < 2 || !t.props.some(pid => prop(M, pid)?.type === 'node')) continue;
    const like = kids(M, p).filter(sid => sid !== t.id && !seenPair.has(`${Math.min(sid, t.id)}:${Math.max(sid, t.id)}`) && t.props.every(pid => tag(M, sid).props.includes(pid)) && count(M, sid) >= count(M, t.id))
      .sort((a, b) => count(M, b) - count(M, a))[0];
    if (like == null) continue;
    const s = tag(M, like);
    seenPair.add(`${Math.min(like, t.id)}:${Math.max(like, t.id)}`);
    add(RULES[1], t.id, [subject(t.id), say('reads like'), tags([like]), ...(t.props.length === s.props.length ? [say(': the same properties, both under')] : [say(': nothing'), tags([like]), say('lacks, both under')]), tags([p])], `merge into ${s.title}`, { kind: 'merge', from: t.id, into: like });
  }
  // 3. A relation has a range.
  for (const p of M.props.values()) {
    if (p.type !== 'node' || p.range.length || !p.on.length) continue;
    const guess = rangeGuess(M, p.id)[0];
    const on = p.on[0];
    const head = [subject(on, p.id), say('on'), tags([on])];
    if (guess) add(RULES[2], on, [...head, say(`links to nodes but no tag is set as what it points at; its values are mostly ${M.tags.get(guess[0]).title}s`)], `set ${M.tags.get(guess[0]).title}`, { kind: 'setRange', prop: p.id, to: [guess[0]] });
    else add(RULES[2], on, [...head, say('links to nodes but no tag is set as what it points at')], 'set the range', { kind: 'prompt', what: 'range', prop: p.id });
  }
  // 4. A property lives as high as it is filled.
  for (const t of M.tags.values()) {
    if (t.missing) continue;
    const children = t.kids.map(id => tag(M, id));
    if (children.length >= 3) {
      const byProp = new Map();
      for (const c of children) for (const pid of c.props) byProp.set(pid, [...(byProp.get(pid) || []), c.id]);
      for (const [pid, on] of byProp) {
        if (on.length < 3 || t.props.includes(pid)) continue;
        const n = on.reduce((s, id) => s + filled(M, id, pid), 0);
        add(RULES[3], t.id, [subject(on[0], pid), say('on'), tags(on), num(`${n} of ${on.reduce((s, id) => s + count(M, id), 0)} filled`)], `pull up to ${t.title}`, { kind: 'moveProp', prop: pid, from: on, to: t.id });
      }
    }
    for (const pid of t.props) {
      const all = filled(M, t.id, pid), of = count(M, t.id);
      if (children.length >= 2 && all && !filledOwn(M, t.id, pid)) {
        const where = children.filter(c => filled(M, c.id, pid) > 0);
        if (where.length === 1) { add(RULES[3], t.id, [subject(t.id, pid), say('on'), tags([t.id]), say('is filled only by'), tags([where[0].id]), num(`${all} of ${count(M, where[0].id)}`)], `push down to ${where[0].title}`, { kind: 'moveProp', prop: pid, from: [t.id], to: where[0].id }, { tag: t.id, prop: pid, kid: where[0].id }); continue; }
      }
      if (of >= 10 && all < of / 10) add(RULES[3], t.id, [subject(t.id, pid), say('on'), tags([t.id]), num(`${all} of ${of} filled`)], 'drop, or leave', { kind: 'dropProp', prop: pid, tag: t.id }, { tag: t.id, prop: pid });
    }
  }
  // 5. Names say what they are.
  const seenName = new Set();
  for (const t of user) {
    const key = t.title.trim().toLowerCase();
    const same = titled(M, t.title).filter(x => x.id !== t.id && !x.kind);
    if (same.length && !seenName.has(key)) { seenName.add(key); const [from, into] = count(M, t.id) <= count(M, same[0].id) ? [t, same[0]] : [same[0], t]; add(RULES[4], from.id, [subject(from.id), say('is named the same as another tag')], `merge into the other ${into.title}`, { kind: 'merge', from: from.id, into: into.id }); }
    const single = singularOf(t.title);
    if (!single) continue;
    const exists = titled(M, single).find(x => x.id !== t.id);
    if (exists) add(RULES[4], t.id, [subject(t.id), say('is plural, and'), tags([exists.id]), say('exists')], `merge into ${exists.title}`, { kind: 'merge', from: t.id, into: exists.id });
    else add(RULES[4], t.id, [subject(t.id), say('is plural')], `rename to ${single}`, { kind: 'rename', tag: t.id, name: single });
  }
  const order = new Map(RULES.map((r, i) => [r, i]));
  return out.sort((a, b) => order.get(a.rule) - order.get(b.rule));
}
const issuesOn = (all, id) => all.filter(i => i.on === id);
const issuesUnder = (M, all, id) => all.filter(i => i.on !== id && (id === S.model.LOOSE ? M.loose.includes(S.model.pathOf(M, i.on)[0]) : S.model.under(M, i.on, id)));
const issuesOfProp = (all, propId) => all.filter(i => i.change && i.change.prop === propId);
// The issue that belongs to a line on a card: the property's line on the tag's card; on the property's card, a tag beneath's line.
const issueOnLine = (all, tagId, propId, kidId) => all.find(i => i.line && i.line.tag === tagId && i.line.prop === propId && (kidId == null ? i.line.kid == null : i.line.kid === kidId));

S.rules = { RULES, issues, issuesOn, issuesUnder, issuesOfProp, issueOnLine, singularOf, list, MORE };
})();
