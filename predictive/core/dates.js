/* The plain-language reader: dates and numbers that are literally in the words ("on Friday", "in two weeks", "cycle 5").
   Ported from logseq-db-refinements (parts/shadow-rules.js stage E, parts/model.js parseDay) with the language lifted
   out into a locale object, so a graph written in another language gets its own words by adding a locale; nothing else
   changes. English ships; set `locale` in the plugin's settings once another exists (README, "Other languages").

   Everything is pure and counted from a `base` day (the journal day the bullet is written on, else today). */
(function () {
const { cleanWords } = (typeof require === 'function' && typeof module !== 'undefined') ? require('./text.js') : window.Flow.text;

const en = {
  name: 'en',
  weekdays: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],   // index = Date.getDay()
  months: ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'],
  relative: { today: 0, tonight: 0, tomorrow: 1, tmr: 1, yesterday: -1 },
  next: 'next',
  // A short weekday ("fri") counts only after one of these ("on fri"); a whole name ("friday") counts anywhere.
  before: ['on', 'this', 'by', 'until', 'till'],
  weekdayPattern: '(?:mon|tues?|wed(?:nes)?|thu(?:rs)?|fri|sat(?:ur)?|sun)(?:day)?',
  wholeWeekdaySuffix: 'day',
  // Whole month names only: "5 marathons" is not March 5. The lookahead keeps a month a word.
  monthPattern: '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?=\\s)',
  ambiguousMonth: 'may',                  // a month only where a date can end: "Dose 4 may need lowering" is the verb
  the: 'the',
  ordinalSuffix: '(?:st|nd|rd|th)',
  dayPrepositions: ['on', 'by', 'until', 'till', 'from', 'before', 'after', 'for'],   // "on the 4th"
  of: 'of',
  // After a bare "the 4th": the end of the words, a time, or a small joining word. "on the 2nd floor" is a floor.
  afterDay: ['at', 'in', 'and', 'then', 'for', 'so', 'but', 'or', 'to', 'when', 'with', 'please', 'until', 'till'],
  inWord: 'in',
  units: { day: 1, week: 7, fortnight: 14 },       // "in 3 days", matched by the word's start
  unitPattern: 'days?|weeks?|fortnights?',
  small: { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 },
  // Words that point ahead without naming a day: today's date would be wrong for them.
  ahead: /\b(?:next|tomorrow|later|soon|upcoming|coming up|in (?:a|an|\d+|a few|two|three|four|five|six|seven|eight|nine|ten|twelve) (?:days?|weeks?|months?|years?|fortnights?)|(?:a|\w+) weeks? from|end of (?:the|this|next) month)\b/i,
  // Words that tell of what has been: a weekday among them may be the one gone or the one coming ("was moved to Friday").
  past: /\b(?:was|were|had|did|went|saw|came|got|felt|showed|told|last)\b/i,
  /* Days told in a phrase (8 November 2026, the owner: "it should understand most of the dates using natural language"). Each is
     read before the single words, and the words it used are not read again: "the day after tomorrow" is not also tomorrow. */
  phrases: {
    dayAfterTomorrow: 'the day after tomorrow|day after tomorrow',
    dayBeforeYesterday: 'the day before yesterday|day before yesterday',
    partOfToday: 'this (?:morning|afternoon|evening)',
    nextUnit: 'next (week|month|year)',
    lastUnit: 'last (week|month|year)',
    lastWeekday: 'last',   // "last Thursday": the one before today
    from: 'from',                                // "a week from Monday", "two weeks from Friday"
    ago: 'ago',                                  // "three weeks ago"
    endOf: '(?:the )?end of (?:the |this )?(month|next month|the year|this year|next year)',
    startOf: '(?:the )?(?:start|beginning) of (next month|the month|this month|next year)',
    partOfMonth: '(early|mid|late)[ -]',         // "early December", "mid-January"
    partDay: { early: 1, mid: 15, late: 25 },
    nth: { first: 1, '1st': 1, second: 2, '2nd': 2, third: 3, '3rd': 3, fourth: 4, '4th': 4, last: -1 },   // "the first Monday of December"
    // Days with a fixed date that a person names by name; the next one, or the one that just went (JUST_WENT).
    named: { 'christmas eve': [11, 24], 'christmas day': [11, 25], christmas: [11, 25], "new year's eve": [11, 31], "new years eve": [11, 31],
      "new year's day": [0, 1], "new years day": [0, 1], halloween: [9, 31], "valentine's day": [1, 14], "valentines day": [1, 14] },
  },
  monthUnit: 'months?',                          // "in six months", "two months ago": calendar months
  yearUnit: 'years?',
  // 20/11, 11/20/2026, 20.11.2026: only where the numbers can be read one way (a number over 12 is the day); else nothing.
  numericDate: true,
  numberJoiners: ['and', 'or', 'to', '&', '-'],     // "cycles 3 and 4" names two numbers
  numberMarks: ['no\\.?\\s*', '#'],                 // "cycle no. 5", "cycle #5"
  /* Basic meanings: what a value in the words is, and which property's name says it takes such a value. A property is matched by a
     word of its own name, so "Amount", "Cost", "Total paid" and "Due date" each find theirs, in any graph.
     money: a sum with its currency ("$84", "€12.50", "40 dollars"), for a number property named for money.
     deadline: a day right after a word that says by when ("due Friday", "due by the 4th", "deadline in two weeks"), for a date named
     for a deadline (Logseq's own Deadline too). scheduled: a day right after a word that says it is set for then ("scheduled for
     Friday"), for Logseq's Scheduled or a date named so. */
  money: {
    before: '[$€£¥₹]|(?:us|usd|eur|gbp|chf|cad|aud)\\s?\\$?',
    after: '[$€£¥₹]|dollars?|bucks|euros?|pounds?|quid|usd|eur|gbp|chf|cad|aud|yen|francs?|rupees?',
    names: ['amount', 'cost', 'costs', 'price', 'fee', 'fees', 'paid', 'payment', 'pay', 'total', 'spent', 'spend', 'charge', 'charged', 'bill', 'billed',
      'budget', 'expense', 'expenses', 'balance', 'refund', 'refunded', 'owed', 'owe', 'debt', 'fare', 'rent', 'copay', 'co-pay', 'deposit', 'sum', 'invoice', 'salary', 'income'],
    total: { before: 'total(?:\\s+of)?|totalling|totaling|came\\s+to|comes\\s+to|in\\s+all|altogether|all\\s+in|=', after: 'total|in\\s+total|in\\s+all|altogether|all\\s+in' },   // which of several sums is the total
  },
  plainSum: {   // a plain number read as the sum: the words before or after that make it something else
    notAfter: ['for', 'with', 'cycle', 'round', 'dose', 'day', 'week', 'no', 'number', 'of', 'the', 'on', 'by', 'at', 'every', 'each', 'in', 'from', 'to', 'until', 'till', 'since', 'after', 'before', 'page', 'p', 'step', 'floor', 'room', 'level', 'grade', 'size', 'age', 'aged', 'year', 'route', 'gate', 'seat', 'flight', 'apt', 'unit', 'suite'],
    notBefore: ['am', 'pm', '%', 'x', 'times', 'people', 'km', 'mi', 'kg', 'lb', 'h', 'hr', 'min', 'of', 'percent', 'minutes', 'hours', 'days', 'weeks', 'months', 'years', 'nights', 'st', 'nd', 'rd', 'th'],
    notCount: ['dollars', 'bucks', 'euros', 'pounds', 'francs', 'rupees'],
  },
  deadline: { words: ['due', 'deadline', 'by', 'before', 'b4', 'no later than', 'latest'], not: ['to'], loose: ['due', 'deadline'], notLoose: ['due to'], after: ['deadline'], notAfter: ['day', 'week', 'month', 'night'], notAfterOther: ['start', 'end'], names: ['deadline', 'due'], nameEnds: ['by', 'before'] },   // "due to the pain" is a cause; a date named "Repay by", "Renew before" is a deadline
  scheduled: { words: ['scheduled for', 'scheduled on', 'scheduled', 'planned for', 'booked for', 'booked', 'set for', 'coming', 'comes', 'arriving', 'arrives', 'visiting', 'appointment', 'appt'], loose: ['scheduled', 'booked', 'appointment', 'appt'], names: ['scheduled', 'schedule', 'planned', 'appointment'] },
  /* start, end, completed (17 November 2026, the owner: "recognize using words as cues for deadline vs scheduled vs start and end
     date vs completed"). start: a day right after a word that says something begins ("starts Dec 1", "starting Monday", "since
     the 4th"). end: right after a word that says it stops ("until Dec 12", "ends Friday", "expires Mar 1"). completed: a day in a
     part of the sentence that says it was done ("paid Nov 20", "fixed the leak on Nov 12", "window replaced Nov 9"): a word of
     these, or any verb in the past (by the grammar library) for a day not after the day written. */
  start: { words: ['starts', 'starting', 'start', 'started', 'begins', 'beginning', 'begin', 'began', 'since', 'effective', 'opens', 'opening', 'kicks off', 'kicking off', 'from'], aheadOnly: ['from'], loose: ['starts', 'begins'], names: ['start', 'starts', 'begin', 'beginning', 'since', 'effective', 'opened', 'opening', 'onset'] },
  end: { words: ['until', 'till', 'til', 'through', 'thru', 'ends', 'ending', 'ended', 'end', 'expires', 'expiring', 'expired', 'closes', 'closing', 'wraps up', 'wrapping up', 'finishes', 'finishing'], loose: ['ends', 'expires'], names: ['end', 'ends', 'until', 'expires', 'expiry', 'expiration', 'through', 'closing', 'stop'] },
  completed: { words: ['done', 'finished', 'completed', 'paid', 'filed', 'submitted', 'sent', 'received', 'closed', 'settled', 'delivered', 'returned', 'resolved', 'fixed', 'signed', 'approved', 'repaid', 'happened'], past: true,
    names: ['completed', 'complete', 'done', 'finished', 'paid', 'closed', 'resolved', 'filed', 'submitted', 'received', 'delivered', 'settled'] },
  // Two days joined as one span: "from Jan 5 to Jun 30", "Jan 5–Jun 30", "between Dec 1 and Dec 12": the first is the start, the second the end.
  particles: ['up', 'off', 'out', 'over', 'down', 'back', 'away', 'through', 'around', 'along', 'by', 'from', 'with', 'about', 'than', 'then', 'and', 'or', 'but', 'so', 'as', 'if', 'when', 'me', 'you', 'we', 'they', 'he', 'she', 'him', 'her', 'us', 'them', 'i', 'my', 'our', 'your', 'their'],   // never a date word alone, when learning (core/date-words.js)
  cueFiller: ['on', 'for', 'the', 'is', 'was', 'are', 'were', 'be', 'been', 'will', 'at', 'a', 'an', 'of', 'it', 'its', 'to', 'this', 'that', 'in'],   // small words passed over when learning the words before a day (core/date-words.js)
  dayLeads: ['end', 'start', 'beginning', 'early', 'mid', 'late', 'last'],   // words a day can begin with: "end of the month", "early December"
  range: { openers: ['from', 'between'], joiners: ['to', 'until', 'till', 'til', 'through', 'thru', 'and'], needsOpener: ['and'] },
  /* The part a sum plays (core/roles.js sums): a sum named as a part of the bill (a tip, a discount, a fee) is that part's and not
     the price; a sum only compared with ("$7 less than"), replaced ("was $200", "from $80 to $95") or the whole a part was paid of
     ("$50 of the $95") is set aside. parts: the kind of part and the words that name it, before or after the sum. */
  sums: {
    parts: {
      tip: ['tip', 'tipped', 'tips', 'gratuity'],
      discount: ['discount', 'discounted', 'coupon', 'off', 'saved', 'saving', 'savings', 'rebate', 'markdown', 'voucher', 'promo', 'credit'],
      fee: ['fee', 'fees', 'surcharge', 'commission', 'penalty'],
      tax: ['tax', 'taxes', 'vat', 'gst'],
      refund: ['refund', 'refunded', 'back', 'returned', 'repaid', 'reimbursed', 'cashback'],
      deposit: ['deposit'], interest: ['interest'], shipping: ['shipping', 'delivery', 'postage'], change: ['change'],
    },
    filler: ['of', 'a', 'an', 'the', 'was', 'is', 'in', 'as', 'about', 'around', 'roughly', 'only', 'just', 'another', 'extra'],
    notBetween: ['on', 'for', 'to', 'and', 'plus', 'with', 'at', 'in', 'of', 'a', 'an', 'the', 'from', 'or', 'but', 'was', 'is', 'per', 'each', 'total'],   // "$15 wire fee": one word may stand between, not these
    afterOnly: ['off'],   // "$20 off" names the discount; "off a $110 coat" does not
    was: ['was', 'were', 'originally', 'normally', 'usually', 'listed', 'instead'],
    compare: ['than'],
    whole: ['of', 'of the', 'of a', 'of my', 'of our', 'toward the', 'towards the', 'against the', 'on the'],
    notWhole: ['total', 'tip', 'fee'],
    from: ['from'], to: ['to'],
    not: ['not', 'no'],
  },
  /* A day set aside for another (core/roles.js days): "moved from Dec 5 to Dec 12", "was due Nov 20, pushed to Nov 27", "by Dec 4,
     not Dec 1", "originally due Dec 1, now due Dec 8". */
  moved: {
    words: ['moved', 'pushed', 'postponed', 'rescheduled', 'changed', 'shifted', 'bumped', 'delayed', 'brought', 'put', 'extended', 'switched', 'slipped', 'deferred', 'rebooked', 'moving', 'pushing', 'now'],
    to: ['to', 'until', 'till', 'for'],
    not: ['not', 'never', 'instead of', 'rather than', 'no longer', 'not on', 'not by', 'not until'],
    once: ['originally', 'initially', 'previously', 'formerly', 'first', 'meant', 'supposed'],
    wasCue: ['was', 'were'],
    now: ['now', 'instead', 'new', 'changed', 'moved', 'updated', 'currently', 'pushed', 'rescheduled'],
    lead: ['was', 'got', 'been', 'is', 'now', 'then', 'but', 'and', 'it', 'since', 'later', 'back', 'out', 'forward', 'again'],
  },
  /* The part a page plays in a sentence (core/roles.js, 22 November 2026). The small words before a name and what they make of
     it; words that set a name aside; verbs that say one event from two sides (same: every key in a group is the same part); a
     verb's other words (synonyms) and its nouns ("a loan to Ana" is lending); what a property named with a plain noun asks for
     (nounRoles). Keys are verb:part, the part one of agent (who does it), object, to, from, for, with. */
  roles: {
    from: ['from', 'out of', 'off of', 'using', 'via', 'courtesy of'],
    to: ['to', 'into', 'onto', 'toward', 'towards', 'over to'],
    by: ['by'],
    with: ['with', 'along with', 'together with', 'alongside'],
    for: ['for', 'on behalf of'],
    at: ['at', 'in', 'on', 'near', 'inside', 'outside'],
    aside: ['not', 'instead of', 'in place of', 'in lieu of', 'rather than', 'without', 'than', 'about', 'regarding', 're', 'concerning', 'unlike', 'except', 'except for', 'excluding', 'versus', 'vs', 'minus', 'besides', 'no', 'over', 'not at', 'not with', 'not from', 'not to', 'not by', 'not for'],
    than: ['than'],
    negators: ['not', 'never', 'cannot'],
    relative: ['who', 'whom', 'whose', 'which', 'what', 'how', 'why', 'whether'],   // a clause about another, or what someone said or meant
    absent: ['away', 'out', 'off', 'unavailable', 'absent', 'sick', 'ill', 'busy', 'closed', 'gone', 'on leave', 'on vacation', 'on holiday', 'on holidays', 'booked up', 'fully booked', 'not there', 'not in'],
    skip: ['the', 'a', 'an', 'my', 'our', 'his', 'her', 'their', 'your', 'this', 'that', 'new', 'old', 'same', 'usual', 'dear'],
    pronouns: ['me', 'us', 'him', 'her', 'them', 'it', 'you', 'myself', 'ourselves', 'everything', 'something', 'this', 'that', 'money', 'cash'],
    verbParticles: ['up', 'off', 'out', 'down', 'back', 'over', 'along'],
    joiners: ['and', 'or', 'plus', 'nor'],
    willWords: ['will', 'should', 'must', 'shall'],
    objectVerbs: ['lend', 'pay', 'owe', 'refill', 'fund', 'repay', 'reimburse', 'tip', 'email', 'text', 'ring', 'ask', 'tell', 'see', 'meet', 'visit'],
    toVerbs: ['top up', 'refill', 'fund', 'replenish', 'load', 'pay off', 'pay down', 'deposit', 'pad', 'feed'],
    fromVerbs: ['drain', 'empty', 'withdraw', 'debit', 'raid', 'tap'],
    toAgents: ['receive', 'get', 'gain', 'collect'],   // "Ally Savings received $400": the subject is where it went
    fromAgents: ['fund', 'cover', 'send', 'feed'],
    synonyms: {
      request: ['ask', 'want', 'need', 'require', 'demand', 'commission'],
      perform: ['do', 'conduct', 'run', 'carry', 'execute', 'administer', 'handle'],
      organize: ['organise', 'call', 'host', 'arrange', 'convene', 'chair', 'lead', 'schedule', 'plan', 'book'],
      accompany: ['come', 'join', 'drive', 'bring', 'escort', 'tag'],
      attend: ['join', 'come', 'attend', 'show'],
      lend: ['loan', 'front', 'spot', 'advance'],
      refer: ['recommend me', 'send'],
      order: ['prescribe'],
      assign: ['delegate', 'give', 'hand', 'task'],
      pay: ['reimburse', 'repay', 'settle'],
      charge: ['bill', 'invoice'],
      buy: ['purchase', 'get', 'order'],
    },
    nouns: { loan: 'lend', referral: 'refer', payment: 'pay', gift: 'give', present: 'give', assignment: 'assign', order: 'order', request: 'request', transfer: 'transfer', invoice: 'charge', bill: 'charge', appointment: 'meet', meeting: 'meet', call: 'speak', chat: 'speak', lunch: 'meet', dinner: 'meet', coffee: 'meet', visit: 'meet' },
    same: [
      ['lend:agent', 'borrow:from', 'owe:object', 'owe:to'],
      ['lend:object', 'lend:to', 'borrow:agent', 'owe:agent'],
      ['pay:agent', 'charge:object', 'charge:to', 'owe:agent'],
      ['pay:object', 'pay:to', 'charge:agent'],
      ['refer:agent', 'refer:from'],
      ['send:agent', 'receive:from'], ['send:to', 'send:object', 'receive:agent'],
      ['give:agent', 'receive:from'], ['give:to', 'give:object', 'give:for'],
      ['buy:from', 'buy:at', 'sell:agent'], ['buy:agent', 'sell:to'],
      ['assign:to', 'assign:object'],
      ['order:agent', 'request:agent'],
    ],
    company: ['accompany', 'attend', 'join', 'meet', 'speak', 'talk', 'chat', 'dine', 'share', 'split'],
    nounRoles: { recipient: ['give:to', 'send:to', 'prep:for'], payee: 'pay:to', payer: 'pay:agent', creditor: 'lend:agent', debtor: 'lend:to', vendor: 'sell:agent', seller: 'sell:agent', buyer: 'buy:agent',
      sender: 'send:agent', receiver: 'send:to', host: 'organize:agent', guest: 'attend:agent', participant: 'attend:agent', companion: 'accompany:agent', beneficiary: 'prep:for', referrer: 'refer:agent', source: 'side:from', destination: 'side:to', origin: 'side:from' },
    agentiveEe: ['attendee', 'absentee', 'retiree', 'escapee', 'standee', 'returnee'],
    notDoers: ['number', 'order', 'paper', 'letter', 'matter', 'quarter', 'color', 'colour', 'factor', 'floor', 'doctor', 'offer', 'cover', 'year', 'other', 'folder', 'reminder', 'calendar', 'chapter', 'tier', 'summer', 'winter', 'weather', 'water', 'paper', 'power', 'answer', 'error', 'sector', 'meter', 'trigger', 'filter', 'counter', 'center', 'corner', 'dinner', 'partner', 'member', 'customer', 'manager', 'officer', 'gender', 'trailer', 'timer', 'layer', 'server', 'user'],
  },
};

const dayAfter = (date, n) => { const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()); d.setDate(d.getDate() + n); return d; };
// The same day so many months on (or back), held to the month's last day: a month after 31 January is 28 or 29 February.
const monthsAfter = (date, n) => { const first = new Date(date.getFullYear(), date.getMonth() + n, 1), last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(); return new Date(first.getFullYear(), first.getMonth(), Math.min(date.getDate(), last)); };
// A date only when the day exists: 30 February is no day (it must not roll over into March).
const exactDay = (year, month, day) => { const d = new Date(year, month, day); return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day ? d : null; };
const dayNumber = d => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const asDate = day => new Date(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100);
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A day and month with no year that went by at most this long ago is that day: a note written after the fact. Further
// back, the words can only be about next year's.
const JUST_WENT = 56;

function makeReader(locale = en) {
  const L = locale;
  const weekdayIndex = word => L.weekdays.findIndex(d => d.startsWith(word) && word.length >= 2);
  const alt = list => `(?:${list.map(escape).join('|')})`;
  const AFTER_DAY = `(?=\\s*$|\\s+(?:${L.afterDay.join('|')}|\\d))`;
  const smallWords = Object.keys(L.small).join('|');

  // A day typed for a Date: today, tomorrow, yesterday, a weekday (the next one after today), "next" and a weekday (a
  // week later), +3 or -2 (days from today), 2026-10-23, 23 oct, oct 23 (this year, or next year when that day passed).
  function parseDay(text, today) {
    const t = String(text).trim().toLowerCase();
    if (!t) return null;
    if (t in L.relative) return dayAfter(today, L.relative[t]);
    let m = t.match(/^([+-])(\d{1,3})$/);
    if (m) return dayAfter(today, (m[1] === '-' ? -1 : 1) * Number(m[2]));
    m = t.match(new RegExp(`^(${escape(L.next)}\\s+)?(\\p{L}{2,12})$`, 'u'));
    if (m) {
      const wd = weekdayIndex(m[2]);
      if (wd >= 0) { let n = (wd - today.getDay() + 7) % 7 || 7; if (m[1]) n += 7; return dayAfter(today, n); }
    }
    m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return exactDay(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    m = t.match(/^(\d{1,2})\s+(\p{L}{3,12})\.?(?:\s+(\d{4}))?$/u) || t.match(/^(\p{L}{3,12})\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/u);
    if (m) {
      const [a, b] = /^\d/.test(m[1]) ? [m[1], m[2]] : [m[2], m[1]];
      const month = L.months.findIndex(name => name.startsWith(b));
      if (month < 0) return null;
      let date = exactDay(m[3] ? Number(m[3]) : today.getFullYear(), month, Number(a));
      if (!m[3] && date && date < today) date = exactDay(today.getFullYear() + 1, month, Number(a));
      return date;
    }
    return null;
  }

  // The days the words name, as day numbers, each once, counted from `base`: a weekday is the coming one, and today's own
  // weekday, with no word that points ahead, is none (today, a week ago or a week on: the words cannot say), and so is any
  // weekday in words that tell of what has been; "the 4th" the
  // next 4th; a day and a month the next such day, or the one that just went (JUST_WENT); "in two weeks".
  function daysInWords(text, base) {
    let words = ' ' + cleanWords(text).toLowerCase().replace(/(\d)[./](?=\d)/g, '$1/').replace(/[.,;:!?()]/g, ' ') + ' ';
    const today = asDate(base), found = new Set();
    const add = date => { if (date && !Number.isNaN(date.getTime())) found.add(dayNumber(date)); };
    const pointsAhead = L.ahead.test(text), tellsPast = !pointsAhead && (L.past.test(text) || pastAction(text));
    words = phrasesRead(words, today, add, pointsAhead);
    for (const [, word] of words.matchAll(new RegExp(`\\s(${Object.keys(L.relative).join('|')})\\s`, 'g'))) add(parseDay(word, today));
    for (const [, next, on, day] of words.matchAll(new RegExp(`\\s(?:(${escape(L.next)})\\s+|(${L.before.map(escape).join('|')})\\s+)?(${L.weekdayPattern})(?=\\s)`, 'g'))) {
      if (!next && !on && !day.endsWith(L.wholeWeekdaySuffix)) continue;
      const date = parseDay(`${next ? L.next + ' ' : ''}${day}`, today);
      if (next || (!tellsPast && (pointsAhead || !date || !sameDay(date, dayAfter(today, 7))))) add(date);
    }
    for (const [, n] of words.matchAll(new RegExp(`\\s(?:${L.dayPrepositions.map(escape).join('|')}|${L.weekdayPattern})\\s+${escape(L.the)}\\s+(\\d{1,2})${L.ordinalSuffix}${AFTER_DAY}`, 'g'))) {
      const d = Number(n);
      if (d < 1 || d > 31) continue;
      let date = new Date(today.getFullYear(), today.getMonth(), d);
      if (date.getDate() !== d || date < today) date = new Date(today.getFullYear(), today.getMonth() + 1, d);
      if (date.getDate() === d) add(date);
    }
    const dayMonth = (d, month, rest) => {
      if (month === L.ambiguousMonth && !new RegExp(`^${AFTER_DAY}`).test(rest)) return;
      const date = parseDay(`${d} ${month.slice(0, 3)}`, today);
      if (!date || date.getDate() !== Number(d)) return;
      const yearBefore = exactDay(date.getFullYear() - 1, date.getMonth(), date.getDate());
      add(yearBefore && !pointsAhead && dayAfter(yearBefore, JUST_WENT) >= today ? yearBefore : date);
    };
    for (const m of words.matchAll(new RegExp(`\\s(\\d{1,2})${L.ordinalSuffix}?\\s+(?:${escape(L.of)}\\s+)?(${L.monthPattern})`, 'g'))) dayMonth(m[1], m[2], words.slice(m.index + m[0].length));
    for (const m of words.matchAll(new RegExp(`\\s(${L.monthPattern})\\s+(\\d{1,2})${L.ordinalSuffix}?(?=\\s)`, 'g'))) dayMonth(m[2], m[1], words.slice(m.index + m[0].length));
    for (const [, n, unit] of words.matchAll(new RegExp(`\\s${escape(L.inWord)}\\s+(\\d{1,2}|${smallWords})\\s+(${L.unitPattern})(?=\\s)`, 'g'))) {
      const per = Object.entries(L.units).find(([name]) => unit.startsWith(name))?.[1] || 1;
      add(dayAfter(today, (L.small[n] ?? Number(n)) * per));
    }
    for (const [, iso] of words.matchAll(/\s(\d{4}-\d{1,2}-\d{1,2})\s/g)) add(parseDay(iso, today));
    return [...found];
  }

  /* The phrases (L.phrases), read first: each day found is added, and the words it used are blanked, so the single words after
     do not read them again. Returns the words left. */
  function phrasesRead(words, today, add, pointsAhead) {
    const P = L.phrases;
    if (!P) return words;
    const nums = `\\d{1,3}|${smallWords}`, num = n => L.small[n] ?? Number(n);
    const unitDays = unit => Object.entries(L.units).find(([name]) => unit.startsWith(name))?.[1];
    const isMonth = unit => new RegExp(`^(?:${L.monthUnit})$`).test(unit), isYear = unit => new RegExp(`^(?:${L.yearUnit})$`).test(unit);
    const span = (date, unit, n) => isMonth(unit) ? monthsAfter(date, n) : isYear(unit) ? monthsAfter(date, 12 * n) : dayAfter(date, n * (unitDays(unit) || 1));
    const monthOf = word => L.months.findIndex(m => m.startsWith(word.slice(0, 3)) && word.length >= 3);
    const units = `${L.unitPattern}|${L.monthUnit}|${L.yearUnit}`;
    const weekday = `(${L.weekdayPattern})`, month = `(${L.monthPattern.replace(/\(\?=\\s\)$/, '')})`;
    const blank = m => ' '.repeat(m.length);
    const read = (pattern, day) => { words = words.replace(new RegExp(`(?<=\\s)(?:${pattern})(?=\\s)`, 'g'), (...m) => { const d = day(...m.slice(1)); if (d === undefined) return m[0]; add(d); return blank(m[0]); }); };
    // The next such day, or the one that just went where the words do not point ahead.
    const nearest = (mo, d) => { let date = exactDay(today.getFullYear(), mo, d); if (!date) return null; if (date < today) { const back = date; date = exactDay(today.getFullYear() + 1, mo, d); if (!pointsAhead && dayAfter(back, JUST_WENT) >= today) return back; } return date; };
    read(P.dayAfterTomorrow, () => dayAfter(today, 2));
    read(P.dayBeforeYesterday, () => dayAfter(today, -2));
    read(P.partOfToday, () => today);
    // "a week from today", "two days from tomorrow": the span from that day (17 November 2026: it was read as today).
    if (L.relative.today != null) read(`(${nums}|a|an)\\s+(${units})\\s+${escape(L.from || 'from')}\\s+(${Object.keys(L.relative).map(escape).join('|')}|now)`, (n, unit, rel) => span(rel === 'now' ? today : dayAfter(today, L.relative[rel]), unit, num(n) || 1));
    // "a week from Monday": the weekday coming, then the span.
    read(`(${nums})\\s+(${units})\\s+${escape(P.from)}\\s+${weekday}`, (n, unit, wd) => { const d = parseDay(wd, today); return d ? span(d, unit, num(n)) : null; });
    read(`(${nums})\\s+(${units})\\s+${escape(P.ago)}`, (n, unit) => span(today, unit, -num(n)));
    read(`${escape(L.inWord)}\\s+(${nums})\\s+(${L.monthUnit}|${L.yearUnit})`, (n, unit) => span(today, unit, num(n)));
    // "the first Monday of December", "the last Friday of the month".
    read(`(?:${escape(L.the)}\\s+)?(${Object.keys(P.nth).join('|')})\\s+${weekday}\\s+(?:${escape(L.of)}|in)\\s+(?:${month}|(?:the|this|(next)) month)`, (nth, wd, mo, next) => {
      const which = P.nth[nth], w = weekdayIndex(wd); if (w < 0) return null;
      const pick = (y, m) => { if (which > 0) { const first = new Date(y, m, 1); return exactDay(y, m, 1 + (w - first.getDay() + 7) % 7 + 7 * (which - 1)); } const last = new Date(y, m + 1, 0); return exactDay(y, m, last.getDate() - (last.getDay() - w + 7) % 7); };
      const said = mo ? monthOf(mo) : -1;
      if (said < 0) { const from = next ? monthsAfter(today, 1) : today; return pick(from.getFullYear(), from.getMonth()); }
      let date = pick(today.getFullYear(), said); if (date && date < today) date = pick(today.getFullYear() + 1, said); return date;
    });
    read(P.endOf, which => which.includes('year') ? new Date(today.getFullYear() + (which.includes('next') ? 1 : 0), 11, 31) : which.includes('next') ? new Date(today.getFullYear(), today.getMonth() + 2, 0) : new Date(today.getFullYear(), today.getMonth() + 1, 0));
    read(P.startOf, which => which.includes('year') ? new Date(today.getFullYear() + 1, 0, 1) : which.includes('next') ? new Date(today.getFullYear(), today.getMonth() + 1, 1) : new Date(today.getFullYear(), today.getMonth(), 1));
    read(`${P.partOfMonth}${month}`, (part, mo) => { const m = monthOf(mo); return m < 0 ? null : nearest(m, P.partDay[part]); });
    // "next week" alone: a week on; with a weekday too ("Monday next week") the weekday says the day.
    const weekdayToo = new RegExp(`\\s${L.weekdayPattern}\\s`).test(words);
    read(P.nextUnit, unit => unit === 'week' ? (weekdayToo ? undefined : dayAfter(today, 7)) : unit === 'month' ? monthsAfter(today, 1) : monthsAfter(today, 12));
    if (P.lastWeekday) read(`${escape(P.lastWeekday)}\\s+(${L.weekdayPattern})`, wd => { const w = weekdayIndex(wd); if (w < 0) return null; const back = (today.getDay() - w + 7) % 7 || 7; return dayAfter(today, -back); });
    read(P.lastUnit, unit => unit === 'week' ? (weekdayToo ? undefined : dayAfter(today, -7)) : unit === 'month' ? monthsAfter(today, -1) : monthsAfter(today, -12));
    for (const [name, [mo, d]] of Object.entries(P.named).sort((a, b) => b[0].length - a[0].length)) read(escape(name), () => nearest(mo, d));
    if (L.numericDate) read('(\\d{1,2})/(\\d{1,2})(?:/(\\d{4}|\\d{2}))?', (a, b, y) => {
      a = Number(a); b = Number(b);
      const [d, m] = a > 12 && b <= 12 ? [a, b] : b > 12 && a <= 12 ? [b, a] : a === b && a <= 12 ? [a, b] : [0, 0];
      if (!d) return null;
      if (y) return exactDay(y.length === 2 ? 2000 + Number(y) : Number(y), m - 1, d);
      return nearest(m - 1, d);
    });
    return words;
  }

  // The number written beside a number property's name ("cycle 5", "5 cycles", "deductible $1,000", "a $1,000 deductible"), or
  // null; two different ones, null. A sum is read whole, commas and all. Pass the names of the bullet's other number properties
  // (others): a number right after another one's name is that one's, so in "coverage $350,000 deductible $1,000" the 350,000 is
  // never read as a number before Deductible.
  // A sum written with separators, as one plain number: "4,000.98" and the European "4.000,98" are 4000.98, "350,000" is 350000.
  const wholeNumbers = t => t.replace(/(\d{1,3}(?:\.\d{3})+),(\d{1,2})(?!\d)/g, (m, w, c) => w.replace(/\./g, '') + '.' + c).replace(/\d{1,3}(?:,\d{3})+(?!\d)/g, m => m.replace(/,/g, ''));
  function numberInWords(text, propTitle, others = []) {
    const words = ' ' + wholeNumbers(cleanWords(text).toLowerCase()).replace(/[,;:!?()]/g, ' ').replace(/\.(?=\s|$)/g, ' ') + ' ', found = new Set();
    const nameOf = t => String(t).toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').trim();
    const name = nameOf(propTitle);
    if (!name) return null;
    const pattern = n => escape(n).replace(/\s+/g, '\\s+');
    const cash = L.money ? `(?:(?:${L.money.before})\\s?)?` : '';
    const marks = `(?:${L.numberMarks.join('|')})?`, joiners = L.numberJoiners.map(escape).join('|');
    const after = n => new RegExp(`\\s${pattern(n)}s?\\s+${marks}${cash}(\\d+(?:\\.\\d+)?)(?=\\s)(?!\\s+(?:${joiners})\\s+\\d)`, 'gd');
    const claimed = new Set();
    for (const t of others) { const o = nameOf(t); if (o && o !== name) for (const m of words.matchAll(after(o))) claimed.add(m.indices[1][0]); }
    for (const m of words.matchAll(after(name))) found.add(Number(m[1]));
    for (const m of words.matchAll(new RegExp(`\\s${cash}(\\d+(?:\\.\\d+)?)\\s+${pattern(name)}s?\\s`, 'gd'))) if (!claimed.has(m.indices[1][0])) found.add(Number(m[1]));
    return found.size === 1 ? [...found][0] : null;
  }

  // A sum of money in the words ("$84", "€12.50", "84 dollars", "1,200 EUR", "€1.240,50", "$3.9k"), as a number, or null. Two
  // different sums: the one a word of totalling stands before ("$84 and $22, $106 total", "came to $106"), else null.
  function moneyInWords(text) {
    const M = L.money;
    if (!M) return null;
    const words = ' ' + wholeNumbers(cleanWords(text).toLowerCase()) + ' ', found = new Map(), num = '(\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.(\\d{1,2}))?(k)?';
    const add = (m, whole, cents, k) => { let n = Number(String(whole).replace(/,/g, '') + (cents ? '.' + cents : '')); if (k) n = Math.round(n * 1000 * 100) / 100; if (Number.isFinite(n)) found.set(m.index, n); };
    for (const m of words.matchAll(new RegExp(`(?:^|[\\s(])(?:${M.before})\\s?${num}(?![\\d.,]?\\d)`, 'g'))) add(m, m[1], m[2], m[3]);
    for (const m of words.matchAll(new RegExp(`(?:^|[\\s(])${num}\\s?(?:${M.after})(?=[\\s.,;:!?)]|$)`, 'g'))) add(m, m[1], m[2], m[3]);
    const sums = new Set(found.values());
    if (sums.size === 1) return [...sums][0];
    if (sums.size < 2 || !M.total) return null;
    // The sum said to be the total: right after a word of totalling, or right before "total".
    const totals = new Set();
    for (const [at, n] of found) {
      const before = words.slice(0, at + 1), after = words.slice(at + 1).replace(/^\S+/, '');
      if (new RegExp(`(?:^|\\s)(?:${M.total.before})\\s*$`).test(before) || new RegExp(`^\\s*(?:${M.total.after})(?=[\\s.,;:!?)]|$)`).test(after)) totals.add(n);
    }
    return totals.size === 1 ? [...totals][0] : null;
  }
  // Every sum of money in the words, in the order written, each with the words of its part of the sentence before and after it
  // (nearest first), for reading the part it plays (core/roles.js): [{ n, before, after }].
  function sumsInWords(text) {
    const M = L.money;
    if (!M) return [];
    const words = ' ' + wholeNumbers(cleanWords(text).toLowerCase()) + ' ', found = [], num = '(\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.(\\d{1,2}))?(k)?';
    const add = (m, whole, cents, k) => { let n = Number(String(whole).replace(/,/g, '') + (cents ? '.' + cents : '')); if (k) n = Math.round(n * 1000 * 100) / 100; if (Number.isFinite(n) && !found.some(f => f.at === m.index)) found.push({ n, at: m.index, end: m.index + m[0].length }); };
    for (const m of words.matchAll(new RegExp(`(?:^|[\\s(])(?:${M.before})\\s?${num}(?![\\d.,]?\\d)`, 'g'))) add(m, m[1], m[2], m[3]);
    for (const m of words.matchAll(new RegExp(`(?:^|[\\s(])${num}\\s?(?:${M.after})(?=[\\s.,;:!?)]|$)`, 'g'))) add(m, m[1], m[2], m[3]);
    found.sort((a, b) => a.at - b.at);
    const wordsIn = t => t.match(/[\p{L}]+|=|×|@/gu) || [];
    return found.map(f => {
      const left = words.slice(0, f.at + 1).split(/[,;]|\.(?=\s)/).pop(), right = words.slice(f.end).split(/[,;]|\.(?=\s|$)/)[0];
      return { n: f.n, before: wordsIn(left).reverse(), after: wordsIn(right), total: new RegExp(`(?:^|\\s)(?:${M.total?.before || '\\b\\B'})\\s*$`).test(words.slice(0, f.at + 1)) || new RegExp(`^\\s*(?:${M.total?.after || '\\b\\B'})(?=[\\s.,;:!?)]|$)`).test(words.slice(f.end)) };
    });
  }
  /* A plain number that is the sum, for a bullet whose tag takes a sum ("Gas 64.28", "Paycheck 3850"): the one number in the words
     that is not part of a day ("Nov 20", "the 4th"), a time ("8am", "8:30"), a count of things ("2 lattes", "x2") or a year
     ("2026"), and not after a word that makes it something else ("for 2", "#4", "cycle 5"). Read only where no sum with its
     currency is in the words; a guess like every sum. */
  function plainSum(text) {
    const B = L.plainSum;
    if (!B) return null;
    const words = ' ' + wholeNumbers(cleanWords(text).toLowerCase()) + ' ';
    if (/\d\s*[:/]\s*\d/.test(words)) return null;   // a time or a written date: the number is not plain
    const month = L.monthPattern.replace(/\(\?=\\s\)$/, ''), found = [];
    for (const m of words.matchAll(/(?<=[\s(])(\d+(?:\.\d{1,2})?)(?=[\s.,;!?)])/g)) {
      const n = Number(m[1]), before = words.slice(0, m.index).trim().split(/\s+/).pop() || '', after = words.slice(m.index + m[1].length).replace(/^[.,;!?)]+/, '').trim().split(/\s+/)[0] || '';
      if (!m[1].includes('.') && n >= 1900 && n <= 2100) continue;                       // a year
      if (new RegExp(`^(?:${month})\\.?$`).test(before) || new RegExp(`^(?:${month})`).test(after)) continue;   // a day: "Nov 20", "20 Nov"
      if (B.notAfter.includes(before.replace(/[.,]$/, '')) || /^[#x×]$/.test(before)) continue;
      if (B.notBefore.includes(after) || /^(?:st|nd|rd|th)$/.test(after) || (/^\p{L}{2,}s$/u.test(after) && !B.notCount.includes(after))) continue;   // "2 lattes"
      found.push(n);
    }
    const one = new Set(found);   // the same number twice is one sum
    return one.size === 1 ? found[0] : null;
  }
  // Does a property's name say it takes this meaning? By a whole word of the name: "Amount paid", "Due date".
  function nameMeans(meaning, propTitle) {
    const names = L[meaning]?.names;
    if (!names) return false;
    const own = String(propTitle).toLowerCase().split(/[^\p{L}\p{N}-]+/u).filter(Boolean);
    return own.some(w => names.includes(w));
  }
  // A word a day can start with: a weekday, a month, a number, "next", "the", "in", a relative day, a word like "on" or "by".
  const startsDay = new RegExp(`^(?:\\d|${L.weekdayPattern}$|${L.monthPattern.replace(/\(\?=\\s\)$/, '')}$|(?:${[L.next, L.the, L.inWord, ...L.before, ...Object.keys(L.relative), ...(L.dayLeads || [])].map(escape).join('|')})$|mid-)`);   // each a whole word: "invoice" is not "in"
  // The day named right after a word of this meaning ("due Friday", "scheduled for the 4th"), or after the words given ({ words }:
  // a property's own name, "renews Mar 3"): one day, or null. Completed reads by part of the sentence (completedDay).
  function dayMeant(meaning, text, base) {
    if (meaning === 'completed') return completedDay(text, base);
    const W = typeof meaning === 'string' ? L[meaning] : meaning;
    if (!W?.words?.length) return null;
    const words = ' ' + cleanWords(text).toLowerCase().replace(/[,;]/g, ' | ').replace(/[:!?()]/g, ' ') + ' ', found = new Set();
    for (const m of words.matchAll(new RegExp(`\\s(${W.words.map(escape).join('|')})\\s+((?:\\S+\\s+){0,5})`, 'g'))) {
      const onlyAhead = (W.aheadOnly || []).includes(m[1]);
      // The word before the cue can make it another thing: "the day before yesterday" is a day, "ends by Friday" an end.
      const prev = words.slice(0, m.index).trim().split(/\s+/).pop() || '';
      if ((W.notAfter || []).includes(prev) || (W.notAfterOther || []).some(k => (L[k]?.words || []).includes(prev))) continue;
      // Up to the end of the sentence or the comma ("starting Dec 1, ends Dec 12"), and the day must start right after the word:
      // "diagnosed by Dr. Chen on Friday" is no deadline.
      const rest = m[2].split('|')[0].trim().split(/\.(?=\s|$)/)[0].trim(), first = rest.split(/\s+/)[0] || '';
      if (W.not?.includes(first) || !startsDay.test(first)) continue;
      for (const day of daysInWords(`${L.before.includes('by') ? 'by' : L.before[0]} ${rest}`, base)) if (!onlyAhead || day > base) found.add(day);
    }
    // Then a strong word anywhere earlier in the same part of the sentence ("Deadline for the deposit is Nov 25"), where that part
    // has one day and no word of another kind.
    // A word of the kind right after the day ("Dec 4 deadline").
    if (!found.size && W.after?.length) for (const part of partsOf(text)) {
      const lower = ' ' + part.toLowerCase() + ' ', days = daysInWords(part, base);
      if (days.length === 1 && new RegExp(`\\s(?:${W.after.map(escape).join('|')})(?=\\s)`).test(lower.slice(firstDayAt(lower)))) found.add(days[0]);
    }
    if (!found.size && W.loose?.length) {
      const others = MEANING_KEYS.filter(k => L[k] !== W).flatMap(k => L[k]?.words || []);
      for (const part of partsOf(text)) {
        const lower = ' ' + part.toLowerCase() + ' ', days = daysInWords(part, base);
        if (days.length !== 1 || hasWord(lower, others) || rangeIn(part, base)) continue;
        const before = lower.slice(0, firstDayAt(lower));
        if (hasWord(before, W.loose) && !(W.notLoose || []).some(n => lower.includes(` ${n} `))) found.add(days[0]);
      }
    }
    return found.size === 1 ? [...found][0] : null;
  }
  const MEANING_KEYS = ['deadline', 'scheduled', 'start', 'end', 'completed'];
  const hasWord = (part, list) => list.length > 0 && new RegExp(`(?:^|\\s)(?:${list.map(escape).join('|')})(?=\\s|$)`).test(part);
  // The parts of a sentence: split at commas, semicolons and full stops ("Window replaced Nov 9, invoice due Dec 9").
  // A full stop after a short month or weekday ("Dec. 4", "Fri. the 4th") ends no part.
  const shortNames = [...new Set([...L.months, ...L.weekdays].flatMap(n => [n.slice(0, 3), n.slice(0, 4)]))].map(escape).join('|');
  const partsOf = text => cleanWords(text).split(new RegExp(`[,;]|(?<!(?:^|[^\\p{L}])(?:${shortNames}))\\.(?=\\s|$)`, 'iu')).map(t => t.trim()).filter(Boolean);
  // The grammar library, where it is loaded: tells a verb in the past ("swapped", "fixed", "took") from other words.
  const grammar = () => (typeof window !== 'undefined' && window.nlp) || (() => { try { return typeof require === 'function' ? require('../../threads/vendor/compromise.js') : null; } catch (error) { return null; } })();
  const pastAction = text => { const away = ['scheduled', 'deadline'].flatMap(k => L[k]?.words || []); const words = cleanWords(text).toLowerCase().replace(new RegExp(`(?:^|\\s)(?:${away.map(escape).join('|')})(?=\\s|$)`, 'g'), ' '); return /\p{L}/u.test(words) && pastVerb(words); };
  const pastVerb = words => { const nlp = grammar(); if (!nlp) return /\b\p{L}{3,}ed\b/u.test(words); try { return nlp(words).has('#PastTense'); } catch (error) { return false; } };
  // A part of the sentence with one day that says it was done: a word of completing anywhere before the day, or a verb in the past
  // for a day not after the day written. A part with a word of another meaning ("due", "from") is that meaning's.
  function completedDay(text, base) {
    const W = L.completed;
    if (!W) return null;
    const others = ['deadline', 'scheduled', 'start', 'end'].flatMap(k => L[k]?.words || []), found = new Set();
    const has = (part, list) => new RegExp(`(?:^|\\s)(?:${list.map(escape).join('|')})(?=\\s|$)`).test(part);
    // A day ahead that is no deadline ("Called the roofer today, he's coming Dec 1"): the job is not done yet. A deadline ahead is
    // ("Window replaced Nov 9, invoice due Dec 9": the bill comes after the work).
    const ahead = partsOf(text).some(part => !has(' ' + part.toLowerCase() + ' ', L.deadline?.words || []) && daysInWords(part, base).some(d => d > base));
    for (const part of partsOf(text)) {
      const lower = ' ' + part.toLowerCase() + ' ', days = daysInWords(part, base);
      if (days.length !== 1 || has(lower, others) || rangeIn(part, base)) continue;
      const before = lower.slice(0, firstDayAt(lower));
      if (has(before, W.words) || (W.past && days[0] <= base && !ahead && pastVerb(part.slice(0, Math.max(0, before.length - 1))))) found.add(days[0]);
    }
    // Several done days ("Filed the claim Nov 2, paid out Nov 16"): it was completed on the last.
    return found.size ? Math.max(...found) : null;
  }
  // Where the day of a part begins: the last word from which, read on, the words still hold a day ("the deadline to file is Dec
  // 15" begins at "Dec", not at "the").
  function firstDayAt(lower) {
    const ws = [...lower.matchAll(/\S+/g)], now = dayNumber(new Date());
    for (let i = ws.length - 1; i >= 0; i--) if (daysInWords(lower.slice(ws[i].index), now).length) return ws[i].index;
    return lower.length;
  }
  // Two days joined as a span ("from Jan 5 to Jun 30", "Jan 5–Jun 30", "between Dec 1 and Dec 12"): { start, end }, or null.
  function rangeIn(text, base) {
    const R = L.range;
    if (!R) return null;
    const month = L.monthPattern.replace(/\(\?=\\s\)$/, '');
    let words = ' ' + cleanWords(text).toLowerCase().replace(/[,;:!?()]/g, ' ') + ' ';
    words = words.replace(new RegExp(`(\\d|${month})\\s*[–—-]\\s*(?=\\d|${month})`, 'g'), `$1 ${R.joiners[0]} `);   // Jan 5–Jun 30
    const toks = words.trim().split(/\s+/), dayOf = ws => { const d = daysInWords(ws.join(' '), base); return d.length === 1 ? d[0] : null; };
    for (let i = 1; i < toks.length - 1; i++) {
      if (!R.joiners.includes(toks[i])) continue;
      let start = null, from = -1;
      for (let k = 1; k <= 3 && i - k >= 0 && start == null; k++) { const d = dayOf(toks.slice(i - k, i)); if (d != null && startsDay.test(toks[i - k])) { start = d; from = i - k; } }
      if (start == null) continue;
      if (R.needsOpener.includes(toks[i]) && !R.openers.includes(toks[from - 1])) continue;
      let end = null;
      for (let k = 1; k <= 3 && i + k < toks.length && end == null; k++) if (startsDay.test(toks[i + 1])) end = dayOf(toks.slice(i + 1, i + 1 + k));
      // "Monday until Wednesday": a weekday read before the start is the one after it, not a year on.
      if (end != null && end <= start && (asDate(start) - asDate(end)) / 864e5 < 7) end = dayNumber(dayAfter(asDate(end), 7 * Math.ceil(((asDate(start) - asDate(end)) / 864e5 + 1) / 7)));
      if (end != null && end <= start && end + 10000 > start) end += 10000;   // "Jan 1–Dec 31": the end is in the start's year or after
      if (end != null && end > start) return { start, end };
    }
    return null;
  }
  /* Each part of the sentence that names one day, with the words right before that day: the last two and the last one, small
     words (L.cueFiller) passed over ("Roof cutoff Dec 4": ["roof cutoff", "cutoff"]; "last day is Dec 12": ["last day", "day"]).
     For learning which date you put such a day in (core/date-words.js). [{ day, words }]. */
  function dayWords(text, base) {
    const out = [];
    for (const part of partsOf(text)) {
      const lower = ' ' + part.toLowerCase().replace(/[:!?()"“”]/g, ' ') + ' ', starts = [...lower.matchAll(/\S+/g)].reverse();
      // A day read only after a word like "by" ("visit the 12th"): read so, from the word where the day begins.
      const lead = `${L.before.includes('by') ? 'by' : L.before[0]} `, after = m => daysInWords(lead + lower.slice(m.index), base);
      let days = daysInWords(part, base), read = m => daysInWords(lower.slice(m.index), base);
      if (!days.length) { const m = starts.find(m => startsDay.test(m[0]) && after(m).length === 1); if (m) { days = after(m); read = after; } }
      if (days.length !== 1 || rangeIn(part, base)) continue;
      // Where the day begins: the shortest end of the part that reads this very day ("a week from today", not "today").
      const at = starts.find(m => { const d = read(m); return d.length === 1 && d[0] === days[0]; })?.index ?? lower.length;
      const ws = lower.slice(0, at).split(/\s+/).filter(w => /\p{L}/u.test(w) && !/\d/.test(w) && !w.startsWith('#'));
      while (ws.length && (L.cueFiller || []).includes(ws[ws.length - 1])) ws.pop();
      if (!ws.length) continue;
      const last = ws[ws.length - 1], pair = ws.length > 1 ? ws.slice(-2).join(' ') : null;
      // A small word that only means something with the word before it ("picked up", "set up", "signed off") is never taught alone.
      const words = (L.particles || []).includes(last) ? (pair ? [pair] : []) : pair ? [pair, last] : [last];
      if (words.length) out.push({ day: days[0], words });
    }
    return out;
  }
  /* Where each day stands in the words: [{ day, from, to }], token places in the words split at spaces (toks). A day's words are
     the fewest that read it: "next Friday", "Dec 5", "the 14th". For setting a day aside (core/roles.js days). */
  function daySpans(text, base) {
    const toks = cleanWords(text).split(/\s+/).filter(Boolean), spans = [];
    const bare = ws => ws.join(' ').replace(/[,.;:!?)]+$/, '');
    const one = ws => { const d = daysInWords(bare(ws), base); return d.length === 1 ? d[0] : null; };
    for (let s = 0; s < toks.length; s++) {
      let best = 0, day = null;
      for (let n = 1; n <= 5 && s + n <= toks.length; n++) {
        const d = one(toks.slice(s, s + n));
        if (d == null) continue;
        if (n > 1 && (one(toks.slice(s + 1, s + n)) === d || one(toks.slice(s, s + n - 1)) === d)) continue;   // a word more than the day needs
        best = n; day = d;
        if (/[,.;:!?)]$/.test(toks[s + n - 1])) break;
      }
      if (best) { spans.push({ day, from: s, to: s + best }); s += best - 1; }
    }
    return { toks, spans };
  }
  const cueWords = MEANING_KEYS.flatMap(k => [...(L[k]?.words || []), ...(L[k]?.loose || [])]);
  const anyCue = text => hasWord(' ' + cleanWords(text).toLowerCase().replace(/[,;:!?()]/g, ' ') + ' ', cueWords);
  return { locale: L, anyCue, parseDay, daysInWords, numberInWords, moneyInWords, sumsInWords, daySpans, plainSum, nameMeans, dayMeant, rangeIn, dayWords, ahead: L.ahead };
}

/* A day written in a date format of Logseq's (its preferredDateFormat, "MMM do, yyyy" unless set otherwise), as Logseq titles
   a journal page: the pencil then reads as the value will once written. The tokens Logseq's formats use; anything else is
   kept as written. */
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
const cap = w => w.replace(/^./, c => c.toUpperCase());
function formatDay(day, format = 'MMM do, yyyy', locale = en) {
  const d = asDate(day), month = locale.months[d.getMonth()] || '', weekday = locale.weekdays[d.getDay()] || '';
  const two = n => String(n).padStart(2, '0');
  const parts = { yyyy: String(d.getFullYear()), yy: two(d.getFullYear() % 100), MMMM: cap(month), MMM: cap(month.slice(0, 3)), MM: two(d.getMonth() + 1), M: String(d.getMonth() + 1),
    do: ordinal(d.getDate()), dd: two(d.getDate()), d: String(d.getDate()), EEEE: cap(weekday), EEE: cap(weekday.slice(0, 3)), EE: cap(weekday.slice(0, 3)), E: cap(weekday.slice(0, 3)) };
  return String(format || 'MMM do, yyyy').replace(/yyyy|yy|MMMM|MMM|MM|M|do|dd|d|EEEE|EEE|EE|E/g, t => parts[t]);
}

const api = { en, makeReader, formatDay, dayAfter, dayNumber, asDate, sameDay, exactDay, reader: makeReader(en) };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') (window.Flow ||= {}).dates = api;
})();
