/* node tools/nuance/measure.js [--fresh] [--kind role] [--show all|bad]
   How finely the proposals read language: tools/nuance/sentences.js on a pretend graph with no earlier lines, so only the
   words can say which property a value belongs in. Per sentence: whole (everything a careful person would fill, nothing
   else), missed (a value left out, nothing wrong), wrong (a value put where it does not belong). Outside Logseq. */
const path = require('node:path');
const { propose } = require('../../core/propose.js');
const synthetic = require('../../test/synthetic.js');
const sentences = process.argv.includes('--fresh') ? require('./fresh.js') : require('./sentences.js');
const arg = (n, f) => { const i = process.argv.indexOf('--' + n); return i < 0 ? f : process.argv[i + 1]; };

function graph() {
  return synthetic.build({
    tags: ['Purchase', 'Transfer', 'Bill payment', 'Loan', 'Consultation', 'Procedure', 'Task', 'Meeting', 'Account', 'Merchant', 'Person', 'Doctor', 'Place', 'Bills'],
    props: [
      { title: 'Merchant', type: 'node', accepts: ['Merchant'], on: ['Purchase'] },
      { title: 'Paid with', type: 'node', accepts: ['Account'], on: ['Purchase'] },
      { title: 'Bought for', type: 'node', accepts: ['Person'], on: ['Purchase'] },
      { title: 'Amount', type: 'number', on: ['Purchase', 'Transfer', 'Bill payment', 'Loan'] },
      { title: 'Tip', type: 'number', on: ['Purchase'] },
      { title: 'Discount', type: 'number', on: ['Purchase'] },
      { title: 'From account', type: 'node', accepts: ['Account'], on: ['Transfer'] },
      { title: 'To account', type: 'node', accepts: ['Account'], on: ['Transfer'] },
      { title: 'Fee', type: 'number', on: ['Transfer'] },
      { title: 'Bill', type: 'node', accepts: ['Bills'], on: ['Bill payment'] },
      { title: 'Payment Source', type: 'node', accepts: ['Account'], on: ['Bill payment'] },
      { title: 'Due date', type: 'date', on: ['Bill payment', 'Task'] },
      { title: 'Paid on', type: 'date', on: ['Bill payment'] },
      { title: 'Lender', type: 'node', accepts: ['Person'], on: ['Loan'] },
      { title: 'Borrower', type: 'node', accepts: ['Person'], on: ['Loan'] },
      { title: 'Repay by', type: 'date', on: ['Loan'] },
      { title: 'Provider', type: 'node', accepts: ['Doctor'], on: ['Consultation'] },
      { title: 'Referred by', type: 'node', accepts: ['Doctor'], on: ['Consultation'] },
      { title: 'Accompanied by', type: 'node', accepts: ['Person'], many: true, on: ['Consultation'] },
      { title: 'Location', type: 'node', accepts: ['Place'], on: ['Consultation', 'Procedure'] },
      { title: 'Performed by', type: 'node', accepts: ['Doctor'], on: ['Procedure'] },
      { title: 'Ordered by', type: 'node', accepts: ['Doctor'], on: ['Procedure'] },
      { title: 'Assignee', type: 'node', accepts: ['Person'], on: ['Task'] },
      { title: 'Requested by', type: 'node', accepts: ['Person'], on: ['Task'] },
      { title: 'Organizer', type: 'node', accepts: ['Person'], on: ['Meeting'] },
      { title: 'Attendees', type: 'node', accepts: ['Person'], many: true, on: ['Meeting'] },
    ],
    people: { Account: ['Chase Checking', 'Ally Savings', 'Amex Gold'], Merchant: ['Blue Bottle', 'Starbucks', 'Target'], Person: ['Sam Ortiz', 'Ana Ruiz', 'Ben Okafor', 'Chloe Martin', 'Ruth Okoro'],
      Doctor: ['Dr. Mei Chen', 'Dr. Raj Patel'], Place: ['Northgate Clinic'], Bills: ['Electric bill'] },
    lines() {}, plain() {},
  });
}

const DAY = 20261118;
function run(g, s) {
  g.ctx.days.set(9918, DAY); g.ctx.dayIds = null;
  const b = { id: -1, uuid: '', text: s.s, tags: [g.tagPage[s.t].id], values: new Map(), parent: null, page: { id: 9918, uuid: synthetic.uuid(9918), title: 'Nov 18th, 2026', day: DAY, tags: [] } };
  const got = {};
  for (const p of propose(g.ctx, b).pieces) got[p.prop.title] = p.kind === 'day' ? p.day : p.kind === 'number' ? p.ids[0] : p.ids.map(id => g.ctx.byId.get(id)?.title).sort();
  return got;
}
const same = (want, got) => Array.isArray(got) ? [].concat(want).sort().join('|') === got.join('|') : want === got;
function judge(s, got) {
  const missed = [], wrong = [];
  for (const [k, v] of Object.entries(s.w)) { if (!(k in got)) missed.push(k); else if (!same(v, got[k])) wrong.push(`${k}: ${JSON.stringify(got[k])} for ${JSON.stringify(v)}`); }
  for (const k of Object.keys(got)) if (!(k in s.w)) wrong.push(`${k}: ${JSON.stringify(got[k])} for nothing`);
  return { missed, wrong, verdict: wrong.length ? 'wrong' : missed.length ? 'missed' : 'whole' };
}
function main() {
  const g = graph(), only = arg('kind', ''), show = arg('show', 'bad');
  const kinds = new Map();
  for (const s of sentences) {
    if (only && s.k !== only) continue;
    const got = run(g, s), j = judge(s, got);
    const c = kinds.get(s.k) || { whole: 0, missed: 0, wrong: 0 }; c[j.verdict]++; kinds.set(s.k, c);
    if (show === 'all' || j.verdict !== 'whole') console.log(`${j.verdict.padEnd(6)} [${s.t}] ${s.s}${j.wrong.length ? '\n         wrong: ' + j.wrong.join('; ') : ''}${j.missed.length ? '\n         missed: ' + j.missed.join(', ') : ''}`);
  }
  let W = 0, M = 0, X = 0;
  console.log('\nkind      whole  missed  wrong');
  for (const [k, c] of kinds) { console.log(`${k.padEnd(9)} ${String(c.whole).padStart(5)} ${String(c.missed).padStart(7)} ${String(c.wrong).padStart(6)}`); W += c.whole; M += c.missed; X += c.wrong; }
  console.log(`${'all'.padEnd(9)} ${String(W).padStart(5)} ${String(M).padStart(7)} ${String(X).padStart(6)}   of ${W + M + X}`);
}
if (require.main === module) main();
module.exports = { graph, run, judge };
