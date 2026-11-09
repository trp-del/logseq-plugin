/* Lessons: what Predictive learns from how you answer its suggestions, kept per graph on a page of that graph ("Predictive
   lessons", logseq/lessons.js). Pure: no Logseq, no screen.

   A lesson is one source and one target: "Apple's matcher · tag Conversation", "your words · Deadline". It counts how often a
   suggestion of it was taken (Enter, a click), said no to (its ×, the faded arrow, or another value or tag set by hand instead),
   and moved (the same value set by hand in another property of the same kind: a sum put in Amount instead of Payment). A
   suggestion passed over, neither taken nor answered, teaches nothing: you may simply not have cared.

   What the lessons change, and only for guesses (a sure value, such as a page you linked, is never held back):
   - said no to at least 3 times and more than twice as often as taken: that source no longer suggests that target;
   - moved to the same other property at least twice, and more often than taken: the value is suggested there instead.

   The page holds one line per lesson, in plain words, so you can read it and delete a line to make Predictive forget it:
     Apple's matcher · tag Conversation: taken 1, said no 5
     your words · Deadline: taken 2, moved to Scheduled 3 */
(function () {

const SOURCE = {
  'alike-tag': 'earlier lines', alike: 'earlier lines', 'alike-money': 'earlier lines', parent: 'the bullet above',
  meaning: 'Apple’s matcher', model: 'Apple’s model', names: 'Apple’s name finder',
  words: 'your words', 'words-day': 'your words', 'words-number': 'your words', 'words-money': 'your words', 'words-deadline': 'your words', 'words-scheduled': 'your words',
  day: 'the day written', 'guess-day': 'the day written', untagged: 'a linked page', linked: 'a linked page', 'linked-wide': 'a linked page', page: 'the page', 'page-wide': 'the page',
};
const APPLE = ['model', 'meaning', 'names'];
const NO_LEAST = 3, MOVED_LEAST = 2;

// Where a suggestion came from, in plain words: Apple's tool when one took part, else the first reason.
function sourceOf(piece) {
  const parts = String(piece?.how || '').split('+').filter(h => h !== 'lesson');
  const apple = parts.find(h => APPLE.includes(h));
  return SOURCE[apple || parts[0]] || 'Predictive';
}
const targetOf = piece => piece.kind === 'tag' ? `tag ${piece.tag?.title || String(piece.shown || '').replace(/^#/, '')}` : piece.prop?.title || piece.ident;
const keyOf = piece => `${sourceOf(piece)} · ${targetOf(piece)}`;

const blank = (source, target) => ({ source, target, taken: 0, no: 0, moved: new Map() });
// One outcome: 'taken', 'no', or 'moved' with the title of the property it went to.
function note(lessons, piece, outcome, to = '') {
  if (!piece?.guess) return null;
  const key = keyOf(piece);
  const lesson = lessons.get(key) || blank(sourceOf(piece), targetOf(piece));
  if (outcome === 'taken') lesson.taken++;
  else if (outcome === 'no') lesson.no++;
  else if (outcome === 'moved' && to) lesson.moved.set(to, (lesson.moved.get(to) || 0) + 1);
  else return null;
  lessons.set(key, lesson);
  return key;
}

// The line on the page, and back.
function lineOf(lesson) {
  const parts = [];
  if (lesson.taken) parts.push(`taken ${lesson.taken}`);
  if (lesson.no) parts.push(`said no ${lesson.no}`);
  for (const [to, n] of [...lesson.moved].sort((a, b) => b[1] - a[1])) parts.push(`moved to ${to} ${n}`);
  return `${lesson.source} · ${lesson.target}: ${parts.join(', ') || 'nothing yet'}`;
}
function parseLine(text) {
  const m = String(text || '').trim().match(/^(.+?) · (.+): (.*)$/);
  if (!m) return null;
  const lesson = blank(m[1].trim(), m[2].trim());
  for (const part of m[3].split(/,\s*/)) {
    let x;
    if ((x = part.match(/^taken (\d+)$/))) lesson.taken = Number(x[1]);
    else if ((x = part.match(/^said no (\d+)$/))) lesson.no = Number(x[1]);
    else if ((x = part.match(/^moved to (.+) (\d+)$/))) lesson.moved.set(x[1], Number(x[2]));
  }
  return lesson;
}

const saysNo = lesson => !!lesson && lesson.no >= NO_LEAST && lesson.no > 2 * lesson.taken;
function movesTo(lesson) {
  if (!lesson) return '';
  const [to, n] = [...lesson.moved].sort((a, b) => b[1] - a[1])[0] || [];
  return to && n >= MOVED_LEAST && n > lesson.taken ? to : '';
}

/* The pieces as the lessons leave them. fields: the properties the record can take; open(prop): whether it is still empty. A
   tag held back takes the guesses that rested on it. A moved guess keeps its value and its reasons, plus 'lesson'. */
function apply(pieces, lessons, { fields = [], open = () => true } = {}) {
  if (!lessons?.size) return pieces;
  const out = [];
  let tagHeld = false;
  for (const piece of pieces) {
    if (!piece.guess) { out.push(piece); continue; }
    const lesson = lessons.get(keyOf(piece));
    if (saysNo(lesson)) { if (piece.kind === 'tag') tagHeld = true; continue; }
    const to = piece.kind === 'number' || piece.kind === 'day' ? movesTo(lesson) : '';
    const there = to && fields.find(f => f.title === to && f.ident !== piece.ident && sameKind(f, piece.prop) && open(f));
    if (there && !pieces.some(p => p.ident === there.ident) && !out.some(p => p.ident === there.ident)) out.push({ ...piece, ident: there.ident, prop: there, how: `${piece.how}+lesson`, key: undefined });
    else out.push(piece);
  }
  return tagHeld ? out.filter(p => !p.needsTag) : out;
}
const dateLike = t => t === 'date' || t === 'datetime';
const sameKind = (a, b) => !!a && !!b && (a.type === b.type || (dateLike(a.type) && dateLike(b.type)));

const api = { sourceOf, targetOf, keyOf, note, lineOf, parseLine, saysNo, movesTo, apply, sameKind, NO_LEAST, MOVED_LEAST };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') (window.Flow ||= {}).lessons = api;
})();
