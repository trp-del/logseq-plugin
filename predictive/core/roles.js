/* Roles: the part each page named in a bullet plays, read from the grammar of the sentence (22 November 2026, the owner: "I want
   the property filling to be very sophisticated and have very nuanced way of distinguishing language"). Until now a page linked
   in the words went to the first property that takes its kind, so "Deposited $250 into [[Chase Checking]]" filled From account,
   "Referred by [[Dr. Patel]]" filled Provider, and "Did not see [[Dr. Chen]]" filled Provider all the same.

   Three readings, in this order:
   1. Set aside. A page the words name without it taking part fills nothing: denied ("did not see", "not Starbucks"), replaced
      ("instead of", "rather than"), left out ("without"), compared with ("cheaper than"), spoken about ("about Dr. Patel's
      report", a possessive), in a clause about someone else ("who trained under"), or absent ("was away").
   2. The part it plays. The words around a page say how it takes part: the small word before it (from, to, into, by, with, for),
      the verb it is the subject or the object of ("Sam lent Ana", "ordered by", "Ben to send"), an arrow ("A → B"). A property's
      own name says which part it wants: "From account" the source, "Referred by" who referred, "Bought for" the one it was for,
      "Lender" who lent, "Assignee" who it was assigned to. Verbs that tell one event from two sides are joined (lend and borrow,
      pay and charge, send and receive), so "Borrowed $40 from Sam" makes Sam the Lender.
   3. Against. A property named for one part does not take a page the words give another part ("Lunch with Sam" is not Bought for).

   Pure: no Logseq, no screen. read(ctx, text) -> { mentions: [{ page, linked, aside, keys }] };
   specOf(ctx, prop) -> { keys, prep, side, named }; standing(mention, spec) -> 'strong' | 'weak' | 'against' | 'none'.
   The words are the locale's (core/dates.js, roles), so another language adds its own. */
(function () {
const need = n => (typeof require === 'function' && typeof module !== 'undefined') ? require('./' + n + '.js') : window.Flow[n];
const { UUID } = need('text');
const engine = need('engine');
const names = need('names');

const SENT = '\u0001';
const rolesOf = ctx => ctx.reader?.locale?.roles || null;

// The words of a bullet as tokens: a word, a page (a link, or a whole name in plain words), a break (, ; : and a full stop), an arrow.
function tokensOf(ctx, text) {
  const R = rolesOf(ctx), pages = [];
  let words = String(text || '').replace(/#\[\[[^\[\]]*\]\]|(?:^|\s)#[^\s#\[\]]+/g, ' ');
  words = words.replace(/\[\[([^\[\]]+)\]\]/g, (m, key) => {
    const named = ctx.byKey.get(key.trim().toLowerCase()), page = (named?.aliasOf && ctx.byId.get(named.aliasOf.id)) || named;
    if (!page) return UUID.test(key) ? ' ' : ` ${key} `;
    pages.push(page); return ` ${SENT}${pages.length - 1}${SENT}`;
  });
  const out = [];
  const re = new RegExp(`${SENT}(\\d+)${SENT}(['’]s(?![\\p{L}]))?|(→|->|=>|⇒)|([,;:]|\\.(?=\\s|$)|\\s[–—-]\\s)|([\\p{L}\\p{N}]+)((?:n['’]t)|['’]s(?![\\p{L}]))?`, 'gu');
  for (const m of words.matchAll(re)) {
    if (m[1] != null) out.push({ kind: 'page', page: pages[Number(m[1])], linked: true, poss: !!m[2] });
    else if (m[3]) out.push({ kind: 'arrow' });
    else if (m[4]) {
      // A full stop after a short word ("Dr.", "Nov.", "St.") ends nothing.
      const prev = out[out.length - 1];
      if (m[4] === '.' && prev?.kind === 'word' && prev.w.length <= 3 && !/^\d+$/.test(prev.w)) continue;
      out.push({ kind: 'break', hard: m[4] !== ',' });
    } else if (m[5]) {
      const w = m[5].toLowerCase(), tail = (m[6] || '').toLowerCase();
      if (/^n['’]t$/.test(tail)) { out.push({ kind: 'word', w, raw: m[5] }); out.push({ kind: 'word', w: 'not', raw: 'not' }); }
      else if (/['’]t$/.test(words.slice(m.index + m[5].length, m.index + m[5].length + 2)) && w.endsWith('n')) { out.push({ kind: 'word', w: w.slice(0, -1) || w, raw: m[5] }); out.push({ kind: 'word', w: 'not', raw: 'not' }); }
      else out.push({ kind: 'word', w, raw: m[5], poss: /s$/.test(tail) && tail.length === 2 });
    }
  }
  // "didn't" is read by the pattern above as "didn" + "'t": the stray t is dropped.
  for (let i = out.length - 1; i > 0; i--) if (out[i].kind === 'word' && out[i].w === 't' && out[i - 1].kind === 'word' && out[i - 1].w === 'not') out.splice(i, 1);
  // Whole names in plain words ("Dr. Raj Patel", "Chase Checking"): the longest at each place, as allNamedIn reads them.
  const { whole } = names.namesFor(ctx);
  for (let i = 0; i < out.length; i++) {
    if (out[i].kind !== 'word') continue;
    let best = null;
    for (const { page, words: name } of whole.get(out[i].w) || []) {
      if (name.length < (best?.words.length || 0) + 1) continue;
      if (name.every((w, k) => out[i + k]?.kind === 'word' && out[i + k].w === w)) best = { page, words: name };
    }
    if (best && !best.page.isTag) { const last = out[i + best.words.length - 1]; out.splice(i, best.words.length, { kind: 'page', page: best.page, linked: false, poss: !!last.poss }); }
  }
  if (!R) return out;
  return out;
}

// The grammar library's reading of the words (each word's kind), the pages standing as a name; null where it is not loaded or
// counts the words another way.
const tagged = new Map();
function tagsOf(tokens) {
  const nlp = engine.nlpOf();
  if (!nlp) return null;
  // A break is a comma on the word before it, so the library counts the words as they are counted here.
  const line = tokens.map(t => t.kind === 'page' ? ' Alex' : t.kind === 'word' ? ' ' + t.w : t.kind === 'break' ? ',' : ' then').join('').replace(/^[\s,]+/, '');
  if (tagged.has(line)) return tagged.get(line);
  let out = null;
  try {
    const doc = nlp(line); doc.compute('root');
    const terms = doc.json().flatMap(s => s.terms);
    const real = tokens.filter(t => t.kind !== 'break');
    if (terms.length === real.length) { out = []; let k = 0; for (const t of tokens) out.push(t.kind === 'break' ? null : terms[k++]); }
  } catch (error) { out = null; }
  if (tagged.size > 200) tagged.clear();
  tagged.set(line, out);
  return out;
}
const isVerb = term => !!term && term.tags.includes('Verb') && !term.tags.includes('Auxiliary') && !term.tags.includes('Modal') && !term.tags.includes('Copula') && !term.tags.includes('Particle');
const rootOf = (term, w) => String(term?.root || '').toLowerCase() || verbRoot(w) || engine.lemma(w) || w;

// A word's base form as a verb ("referred" refer, "bought" buy, "requested" request), for a property's name.
const verbRoots = new Map();
function verbRoot(word) {
  if (verbRoots.has(word)) return verbRoots.get(word);
  const nlp = engine.nlpOf();
  let root = '';
  if (nlp) try { const doc = nlp(`they have ${word} it`); doc.compute('root'); const t = doc.json()[0].terms[2]; if (t && t.tags.includes('Verb')) root = String(t.root || t.normal || '').toLowerCase(); } catch (error) { root = ''; }
  if (!root && /ed$/.test(word)) root = engine.lemma(word) || word.replace(/ed$/, '');
  verbRoots.set(word, root);
  return root;
}
const knownVerb = word => { const nlp = engine.nlpOf(); if (!nlp) return false; try { return nlp(word).has('#Verb') || nlp(`to ${word}`).has('#Infinitive'); } catch (error) { return false; } };

// Every way the same part is said: a key with the keys that mean it (lend:agent, borrow:from …), and a verb with the verbs it
// stands for (ask: request).
function closure(R, keys) {
  const out = new Set(keys);
  for (const group of R.same || []) if (group.some(k => out.has(k))) for (const k of group) out.add(k);
  return out;
}
const canon = (R, g) => { const out = new Set([g]); if (R.nouns?.[g]) out.add(R.nouns[g]); for (const [verb, list] of Object.entries(R.synonyms || {})) if (list.includes(g)) out.add(verb); for (const v of [...out]) if (R.nouns?.[v]) out.add(R.nouns[v]); return [...out]; };

// The longest of these words that ends at token k: its class and where it begins.
function cueAt(R, tokens, k, from) {
  const lists = [['aside', R.aside], ['from', R.from], ['to', R.to], ['by', R.by], ['with', R.with], ['for', R.for], ['at', R.at]];
  let best = null;
  for (const [kind, list] of lists) for (const phrase of list || []) {
    const ws = phrase.split(' '), start = k - ws.length + 1;
    if (start < from || (best && ws.length <= best.n)) continue;
    if (ws.every((w, n) => tokens[start + n]?.kind === 'word' && tokens[start + n].w === w)) best = { kind, n: ws.length, start, phrase };
  }
  return best;
}

function read(ctx, text) {
  const R = rolesOf(ctx);
  const tokens = tokensOf(ctx, text), mentions = [];
  if (!R || !tokens.some(t => t.kind === 'page')) return { tokens, mentions };
  const tags = tagsOf(tokens);
  const word = i => tokens[i]?.kind === 'word' ? tokens[i].w : null;
  const verbAt = i => tokens[i]?.kind === 'word' && (tags ? isVerb(tags[i]) : false);
  const root = i => rootOf(tags?.[i], tokens[i].w);
  const skip = new Set(R.skip || []), pronouns = new Set(R.pronouns || []), particles = new Set(R.verbParticles || []);
  const cueOfMention = new Map();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind !== 'page') continue;
    const m = { page: t.page, linked: t.linked, aside: false, keys: new Set(), at: i };
    mentions.push(m);
    // The clause: back to the last break.
    let cs = i; while (cs > 0 && tokens[cs - 1].kind !== 'break') cs--;
    const next = i + 1;
    const subjectOf = verbAt(next) ? next : (tags && tokens[next]?.kind === 'word' && (tags[next].tags.includes('Auxiliary') || tags[next].tags.includes('Modal')) && verbAt(next + 1)) ? next + 1 : -1;
    // One of a list ("Ben and Chloe", "Ben, Chloe and Ana"): it plays the part the one before it plays.
    const joined = (() => {
      let j = i - 1;
      if (word(j) && (R.joiners || []).includes(word(j))) j--;
      else if (tokens[j]?.kind === 'break' && !tokens[j].hard && (tokens[next]?.kind === 'break' || (R.joiners || []).includes(word(next)))) j--;
      else return null;
      if (tokens[j]?.kind === 'break' && !tokens[j].hard) j--;
      return tokens[j]?.kind === 'page' && subjectOf < 0 ? j : null;
    })();
    if (joined != null && cueOfMention.has(joined)) { const first = cueOfMention.get(joined); m.aside = first.aside; for (const k of first.keys) m.keys.add(k); cueOfMention.set(i, m); continue; }
    cueOfMention.set(i, m);
    // An arrow: the page before it is the source, the page after it where it goes.
    if (tokens[i + 1]?.kind === 'arrow') m.keys.add('side:from');
    if (tokens[i - 1]?.kind === 'arrow') m.keys.add('side:to');
    // Its own thing ("Dr. Patel's report"): the report is spoken of, not the doctor.
    if (t.poss && tokens[next]?.kind === 'word') m.aside = true;
    // Absent: "was away", "is on leave".
    { let n = next; if (tags && tokens[n]?.kind === 'word' && tags[n].tags.includes('Copula')) n++; const one = word(n), two = one && word(n + 1) ? `${one} ${word(n + 1)}` : null; if (n > next || !verbAt(next)) { if ((R.absent || []).includes(two) || (n > next && (R.absent || []).includes(one))) m.aside = true; } }
    // Denied, or in a clause about another ("who trained under"): anywhere earlier in its clause.
    for (let j = cs; j < i; j++) {
      const w = word(j); if (!w) continue;
      if ((R.negators || []).includes(w) || (w === 'no' && word(j + 1) === 'longer') || (R.relative || []).includes(w)) m.aside = true;
    }
    // The small word before it, small words like "the" passed over.
    let k = i - 1; while (k >= cs && word(k) && skip.has(word(k))) k--;
    const cue = k >= cs && tokens[k].kind === 'word' ? cueAt(R, tokens, k, cs) : null;
    if (cue?.kind === 'aside') { m.aside = true; continue; }
    // "than at Target", "than the Amex": compared with.
    if (cue && (R.than || []).includes(word(cue.start - 1))) { m.aside = true; continue; }
    if (cue) {
      m.prep = cue.kind;
      if (cue.kind === 'from' || cue.kind === 'to') m.keys.add('side:' + cue.kind);
      m.keys.add('prep:' + cue.kind);
      // What the small word hangs on: the word before it (pronouns, numbers and "the" passed over), and the clause's verb.
      let g = cue.start - 1;
      while (g >= cs && tokens[g].kind === 'word' && (skip.has(tokens[g].w) || pronouns.has(tokens[g].w) || /^\d/.test(tokens[g].w) || particles.has(tokens[g].w) && verbAt(g - 1))) g--;
      const heads = new Set();
      if (g >= cs && tokens[g].kind === 'word') for (const c of canon(R, root(g))) heads.add(c);
      for (let j = cue.start - 1; j >= cs; j--) if (verbAt(j)) { for (const c of canon(R, root(j))) heads.add(c); break; }
      for (const h of heads) m.keys.add(cue.kind === 'by' ? `${h}:agent` : `${h}:${cue.kind}`);
    } else if (k >= cs && tokens[k].kind === 'word') {
      // No small word: the object of the verb right before it ("Lent Sam", "Topped up Ally Savings", "Paid off the Amex").
      let v = k, particle = '';
      if (particles.has(tokens[v].w) && v - 1 >= cs && tokens[v - 1].kind === 'word') { particle = tokens[v].w; v--; }
      if (verbAt(v) || particle || (R.objectVerbs || []).includes(root(v))) {
        for (const c of canon(R, root(v))) {
          m.keys.add(`${c}:object`);
          const phrase = particle ? `${c} ${particle}` : c;
          if ((R.toVerbs || []).includes(phrase) || (R.toVerbs || []).includes(c)) m.keys.add('side:to');
          if ((R.fromVerbs || []).includes(phrase) || (R.fromVerbs || []).includes(c)) m.keys.add('side:from');
        }
        m.object = true;
      }
    }
    // The subject of the verb after it ("Sam lent Ana", "Dr. Patel ordered an MRI"); "Ben to send" is the one to do it.
    if (subjectOf >= 0 && !cue) {
      for (const c of canon(R, root(subjectOf))) { m.keys.add(`${c}:agent`); if ((R.toAgents || []).includes(c)) m.keys.add('side:to'); if ((R.fromAgents || []).includes(c)) m.keys.add('side:from'); }
      m.agent = true;
    }
    if (!cue && word(next) === 'to' && verbAt(next + 1)) { m.keys.add('assign:to'); m.todo = true; }
    else if (!cue && (R.willWords || []).includes(word(next)) && verbAt(next + 1)) { m.keys.add('assign:to'); m.todo = true; }
  }
  // The first of a list takes the part the last one is given: "Ana and Chloe joined".
  for (let n = mentions.length - 2; n >= 0; n--) {
    const m = mentions[n], after = mentions[n + 1];
    if (m.keys.size || m.aside || m.prep) continue;
    let j = m.at + 1; if (tokens[j]?.kind === 'break' && !tokens[j].hard) j++;
    if (word(j) && (R.joiners || []).includes(word(j))) j++; else if (j === m.at + 1) continue;
    if (j === after.at && !after.prep && after.agent) { for (const k of after.keys) m.keys.add(k); m.agent = true; }
  }
  for (const m of mentions) m.keys = closure(R, m.keys);
  return { tokens, mentions };
}

/* What a property's own name says of the part it takes. "From account" / "To account": a side. "Referred by", "Performed by": who
   did it. "Bought for", "Paid with": the page after that small word. "Lender", "Organizer": who does it; "Assignee", "Payee":
   who it is done to. Keys as the mentions carry them; prep the small word in the name; named true when the name says anything. */
function specOf(ctx, prop) {
  const kept = (ctx.roleSpecs ||= new Map());
  if (kept.has(prop.ident)) return kept.get(prop.ident);
  const R = rolesOf(ctx), spec = { keys: new Set(), prep: '', side: '', named: false, weak: new Set() };
  kept.set(prop.ident, spec);
  if (!R) return spec;
  const words = String(prop.title || '').toLowerCase().match(/[\p{L}]+/gu) || [];
  if (!words.length) return spec;
  const preps = { from: 'from', to: 'to', by: 'by', with: 'with', for: 'for', at: 'at' };
  const first = preps[words[0]], last = preps[words[words.length - 1]];
  if (words.length > 1 && (first === 'from' || first === 'to')) { spec.side = first; spec.prep = first; spec.keys.add('side:' + first); }
  else if (words.length > 1 && last) spec.prep = last;
  else if (words.length > 1 && first) spec.prep = first;
  const rest = words.filter(w => !preps[w]);
  if (spec.prep && !spec.side) {
    for (const w of rest) { const v = /(?:ed|en|t)$/.test(w) || rest.length === 1 ? verbRoot(w) : ''; if (v) spec.keys.add(spec.prep === 'by' ? `${v}:agent` : `${v}:${spec.prep}`); }
    if (spec.prep === 'for' || spec.prep === 'with') { spec.keys.add('prep:' + spec.prep); if (spec.prep === 'with') spec.weak.add('prep:with'); }
    if (spec.prep === 'at') spec.keys.add('prep:at'), spec.weak.add('prep:at');
  }
  if (!spec.prep) for (const w of rest) {
    const one = engine.lemma(w) || w;
    if (R.nounRoles?.[one]) { for (const k of [].concat(R.nounRoles[one])) spec.keys.add(k); continue; }
    if (R.nounRoles?.[w]) { for (const k of [].concat(R.nounRoles[w])) spec.keys.add(k); continue; }
    // A doer ("Lender", "Organizer") or the one done to ("Assignee", "Payee"), from a verb the grammar library knows.
    const ee = one.match(/^(.{3,})ee$/), er = one.match(/^(.{3,}?)(?:e?r|or)$/);
    if (ee) { const v = [ee[1], ee[1] + 'e'].find(knownVerb); if (v) spec.keys.add((R.agentiveEe || []).includes(one) ? `${v}:agent` : `${v}:to`); }
    else if (er) { const v = [er[1], er[1] + 'e', er[1].replace(/(.)\1$/, '$1')].find(c => c.length >= 3 && knownVerb(c)); if (v && !(R.notDoers || []).includes(one)) spec.keys.add(`${v}:agent`); }
  }
  // A property of company ("Accompanied by", "Attendees", "Spoke with"): "with Ruth" speaks for it, more quietly than a verb.
  if ([...spec.keys].some(k => (R.company || []).includes(k.split(':')[0]))) { spec.keys.add('prep:with'); spec.weak.add('prep:with'); }
  spec.keys = closure(R, spec.keys);
  for (const k of ['prep:with', 'prep:at']) if (spec.weak.has(k)) spec.weak.add(k);
  spec.named = spec.keys.size > 0;
  spec.doer = !spec.prep && [...spec.keys].some(k => k.endsWith(':agent'));
  return spec;
}

/* How a mention stands to a property: 'strong' (the words give it this part), 'weak' (company: "with Ruth"), 'against' (the words
   give it another part than the property's name asks), 'none' (the words say nothing either way). */
function standing(m, spec) {
  if (!spec.named) return 'none';
  let strong = false, weak = false;
  for (const k of m.keys) if (spec.keys.has(k)) { if (spec.weak.has(k)) weak = true; else strong = true; }
  if (strong) return 'strong';
  if (weak) return 'weak';
  if (spec.side && m.keys.has('side:' + (spec.side === 'from' ? 'to' : 'from'))) return 'against';
  // "for Ana" is the one it is for: only a property that asks for that takes her.
  if (m.prep === 'for') return 'against';
  if (!spec.side && (spec.prep === 'for' || spec.prep === 'to' || spec.prep === 'from' || spec.prep === 'with')) { if ((m.prep && m.prep !== spec.prep && m.prep !== 'at' && !(spec.prep === 'with' && m.prep === 'by')) || m.agent || m.todo) return 'against'; }
  // "Referred by" is who referred: not who did another thing, nor who another thing was done to ("Tell Ben", "Saw Dr. Chen").
  if (spec.prep === 'by' && (m.agent || m.todo || m.object)) return 'against';
  // A property for the one a thing is done to ("Assignee") leaves who does another thing, and who another thing is done to
  // ("Email Ana the minutes": Ana is written to, not given the task).
  if (!spec.doer && !spec.prep && (m.agent || m.object) && [...spec.keys].every(k => k.endsWith(':to') || k.endsWith(':object'))) return 'against';
  return 'none';
}

/* The part each sum of money in the words plays. A sum named as a part of the bill ("$15 tip", "tipped $8", "fee of $3", "a $5
   coupon") is the number property's named for that part, where the tag has one, and never the price. A sum compared with ("$7
   less than"), replaced ("was $200, paid $150", "from $80 to $95", "not $40") or the whole a part was paid of ("$50 of the $95
   bill") is set aside. What is left is the price: one sum, or of several the one said to be the total.
   sums(ctx, text, numberProps) -> { any, main, byProp: Map(ident -> n), isPart(prop) }. */
function sums(ctx, text, numberProps = []) {
  const reader = ctx.reader, S = reader?.locale?.sums, out = { any: false, main: null, byProp: new Map(), isPart: () => false };
  if (!S || !reader.sumsInWords) return out;
  const partOfWord = new Map();
  for (const [part, list] of Object.entries(S.parts || {})) for (const w of list) partOfWord.set(w, part);
  const partOfProp = prop => { for (const w of String(prop.title || '').toLowerCase().match(/[\p{L}]+/gu) || []) { const part = partOfWord.get(w) || partOfWord.get(engine.lemma(w) || w); if (part) return part; } return null; };
  out.isPart = prop => !!partOfProp(prop);
  const found = reader.sumsInWords(text);
  if (!found.length) return out;
  out.any = true;
  const filler = new Set(S.filler || []), notBetween = new Set(S.notBetween || []), afterOnly = new Set(S.afterOnly || []);
  // Right after the sum ("$15 tip", "$10 late fee", "$15 wire fee", "$20 off"), or right before it ("tip $10", "fee of $3", "saved
  // $12"). A word that names the sum before it ("$30 voucher off a $110 coat") does not name the next one too.
  const named = new Set();
  const partOf = (f, prev) => {
    const one = f.after[0], two = one && !partOfWord.has(one) && !notBetween.has(one) ? f.after[1] : null;
    const after = partOfWord.get(one) || (two && partOfWord.get(two)) || null;
    if (after) { named.add(f.after.indexOf(partOfWord.has(one) ? one : two) + ':' + found.indexOf(f)); return after; }
    let k = 0; while (k < f.before.length && filler.has(f.before[k])) k++;
    const w = f.before[k];
    if (!w || afterOnly.has(w)) return null;
    // The words between two sums are the same words: one that named the earlier sum is spoken for.
    if (prev?.namedBy === w && prev.after.length - (prev.namedAt + 1) === k) return null;
    return partOfWord.get(w) || null;
  };
  found.forEach((f, i) => {
    f.part = partOf(f, found[i - 1]);
    { const one = f.after[0], two = one && !partOfWord.has(one) && !notBetween.has(one) ? f.after[1] : null; if (partOfWord.has(one)) { f.namedBy = one; f.namedAt = 0; } else if (two && partOfWord.has(two)) { f.namedBy = two; f.namedAt = 1; } }
    const b0 = f.before[0], b01 = f.before.length > 1 ? `${f.before[1]} ${b0}` : '';
    // Compared with: "$7 less than at Target", "$10 more than last month".
    if (f.after.slice(0, 3).some(w => (S.compare || []).includes(w))) f.aside = 'compared';
    // Denied: "not $40".
    else if ((S.not || []).includes(b0)) f.aside = 'denied';
    // Replaced: "from $80 to $95", "was $200, paid $150": the later sum stands.
    else if ((S.from || []).includes(b0) && found[i + 1] && (S.to || []).includes(found[i + 1].before[0])) f.aside = 'replaced';
    else if ((S.was || []).includes(b0) && found.length > i + 1) f.aside = 'replaced';
    // The whole a part was paid of: "Paid $50 of the $95 bill".
    else if (i > 0 && ((S.whole || []).includes(b0) || (S.whole || []).includes(b01)) && !f.total && !f.part) f.aside = 'whole';
    // What was multiplied: "2 x $35 = $70".
    else if (f.after[0] === '=' && found[i + 1]) f.aside = 'factor';
  });
  // A part with its own property is that property's: one sum for each, or none.
  for (const prop of numberProps) {
    const part = partOfProp(prop);
    if (!part) continue;
    const mine = [...new Set(found.filter(f => !f.aside && f.part === part).map(f => f.n))];
    if (mine.length === 1) out.byProp.set(prop.ident, mine[0]);
  }
  // The price: what is no part and not set aside. One sum; or of several the one said to be the total. A lone sum is the price
  // whatever it is called, unless the tag has a property for that part ("Tip $10" with a Tip).
  const hasPropFor = part => numberProps.some(p => partOfProp(p) === part);
  let left = found.filter(f => !f.aside && !f.part);
  if (!left.length && found.length === 1 && found[0].part && !found[0].aside && !hasPropFor(found[0].part)) left = found;
  const distinct = [...new Set(left.map(f => f.n))];
  if (distinct.length === 1) out.main = distinct[0];
  else if (distinct.length > 1) { const totals = [...new Set(left.filter(f => f.total).map(f => f.n))]; if (totals.length === 1) out.main = totals[0]; }
  return out;
}

/* The words with the days that were set aside taken out, so the day that stands is read as the day: "moved from Dec 5 to Dec 12"
   reads as Dec 12, "was due Nov 20, pushed to Nov 27" as due Nov 27, "by Dec 4, not Dec 1" as by Dec 4, "originally due Dec 1, now
   due Dec 8" as now due Dec 8, and "no longer due Dec 5" as no day at all. Words with nothing set aside come back as they were. */
function standingDays(reader, text, base) {
  const V = reader?.locale?.moved;
  if (!V || !reader.daySpans) return text;
  const lower = String(text || '').toLowerCase();
  const any = [...V.words, ...V.not.map(w => w.split(' ')[0]), ...V.once, 'from'];
  if (!any.some(w => new RegExp(`(?:^|[^\\p{L}])${w}(?![\\p{L}])`, 'u').test(lower)) && !/n['’]t/.test(lower)) return text;
  let { toks, spans } = reader.daySpans(text, base);
  if (!spans.length) return text;
  const low = i => (toks[i] || '').toLowerCase().replace(/[,.;:!?()]+$/, '').replace(/^[(]+/, '');
  const ends = i => /[,;]$|\.$/.test(toks[i] || '');   // the end of a part of the sentence
  const cut = new Set(), put = new Map();   // token places taken out; a place where other words are put
  const partStart = i => { let s = i; while (s > 0 && !ends(s - 1)) s--; return s; };
  const partEnd = i => { let e = i; while (e < toks.length - 1 && !ends(e)) e++; return e; };
  spans.forEach((sp, n) => {
    if (sp.gone) return;
    const start = partStart(sp.from);
    // Denied or replaced: "not Dec 1", "instead of Dec 11", "no longer due Dec 5".
    for (let j = Math.max(start, sp.from - 4); j < sp.from; j++) {
      const one = low(j), two = `${one} ${low(j + 1)}`;
      if (V.not.includes(two) || V.not.includes(one) || /n['’]t$/.test(one)) { for (let k = j; k < sp.to; k++) cut.add(k); sp.gone = true; return; }
    }
    const next = spans[n + 1];
    if (!next || next.gone) return;
    // "moved from Dec 5 to Dec 12": the first day goes, the second stands where it is.
    if (low(sp.from - 1) === 'from' && next.from === sp.to + 1 && V.to.includes(low(sp.to))) {
      let moved = false; for (let j = Math.max(0, sp.from - 5); j < sp.from - 1; j++) if (V.words.includes(low(j))) moved = true;
      if (moved) { for (let k = sp.from - 1; k <= sp.to; k++) cut.add(k); sp.gone = true; return; }
    }
    // "was due Nov 20, pushed to Nov 27": the later day takes the first one's place, and the words that moved it go.
    if (V.to.includes(low(next.from - 1))) {
      let at = -1; for (let j = sp.to; j < next.from - 1; j++) if (V.words.includes(low(j))) { at = j; break; }
      if (at >= 0 && next.from - sp.to <= 6) {
        while (at > sp.to && V.lead.includes(low(at - 1))) at--;
        for (let k = at; k < next.to; k++) cut.add(k);
        const tail = (toks[sp.to - 1].match(/[,.;:!?)]+$/) || [''])[0];
        put.set(sp.from, toks.slice(next.from, next.to).join(' ').replace(/[,.;:!?)]+$/, '') + (toks[next.to - 1].match(/[,.;:!?)]+$/) || [tail])[0]);
        for (let k = sp.from; k < sp.to; k++) cut.add(k);
        sp.gone = true; next.gone = true; return;
      }
    }
    // "Originally due Dec 1, now due Dec 8": the part that says how it was goes.
    const end = partEnd(sp.to - 1), mine = []; for (let j = start; j <= end; j++) mine.push(low(j));
    const was = mine.some(w => V.once.includes(w)) || mine.some((w, j) => V.wasCue.includes(w) && reader.anyCue(mine[j + 1] || ''));
    if (was && next.from > end) {
      const ne = partEnd(next.to - 1); let now = false; for (let j = partStart(next.from); j <= ne; j++) if (V.now.includes(low(j))) now = true;
      if (now) { for (let k = start; k <= end; k++) cut.add(k); sp.gone = true; }
    }
  });
  if (!cut.size) return text;
  const kept = [];
  toks.forEach((t, i) => { if (put.has(i)) kept.push(put.get(i)); else if (!cut.has(i)) kept.push(t); });
  return kept.join(' ').replace(/\s+([,.;])/g, '$1').replace(/^[\s,;.]+/, '').replace(/[,;]\s*(?=[,;.])/g, '').replace(/[,;\s]+$/, '').trim();
}

const api = { read, specOf, standing, tokensOf, sums, standingDays };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') (window.Flow ||= {}).roles = api;
})();
