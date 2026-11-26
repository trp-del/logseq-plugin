/* How a property reads from the page it points to, decided by English grammar. No Logseq here.
   A property is named from the node that holds it ("Prescribed by", on a prescription). On the page it points to, the list of
   the nodes holding it reads back: "Prescribed". back(title) answers that reading; a name the person gave wins (named).
     "Prescribed by" -> "Prescribed"      "Symptom of" -> "Symptoms"      "Child of" -> "Children"
     "Located in" -> "Location of"        "Works at" -> "Employer of"     "Treats" -> "Treated by"
     a role ("Provider") -> "Provider of"; a plain noun ("Topic", "From account") and a link both ways ("Spoke with") keep their name. */
(function (root) {
const FIXED = { 'located in': 'Location of', 'diagnosed with': 'Diagnosis of', 'works at': 'Employer of', 'works for': 'Employer of', 'lives in': 'Home of', 'born in': 'Birthplace of', 'studied at': 'School of',
  'member of': 'Members', 'part of': 'Parts', 'belongs to': 'Has', 'reports to': 'Reports', 'married to': 'Married to', 'related to': 'Related to' };
const VERBS = { treats: 'Treated by', mentions: 'Mentioned in', owns: 'Owned by', manages: 'Managed by', causes: 'Caused by', includes: 'Included in', contains: 'Contained in', uses: 'Used by', requires: 'Required by', affects: 'Affected by',
  supports: 'Supported by', blocks: 'Blocked by', follows: 'Followed by', cites: 'Cited by', references: 'Referenced by', employs: 'Employed by', teaches: 'Taught by', leads: 'Led by', funds: 'Funded by', pays: 'Paid by', covers: 'Covered by', replaces: 'Replaced by' };
const ROLES = new Set(['provider', 'doctor', 'author', 'owner', 'manager', 'teacher', 'advisor', 'adviser', 'sponsor', 'supervisor', 'creator', 'editor', 'director', 'founder', 'leader', 'mentor', 'parent', 'spouse', 'partner', 'employer',
  'client', 'patient', 'customer', 'vendor', 'supplier', 'merchant', 'payee', 'payer', 'agent', 'attendee', 'organizer', 'speaker', 'host', 'guest', 'contact', 'assignee', 'reviewer', 'investigator', 'surgeon', 'nurse', 'physician',
  'specialist', 'therapist', 'landlord', 'tenant', 'lender', 'borrower', 'insurer', 'beneficiary', 'prescriber', 'referrer', 'caregiver', 'guardian', 'lawyer', 'accountant']);
const MANY = { child: 'Children', person: 'People', man: 'Men', woman: 'Women', foot: 'Feet', tooth: 'Teeth', mouse: 'Mice' };
const cap = text => text.charAt(0).toUpperCase() + text.slice(1);
function plural(word) {
  const low = word.toLowerCase();
  if (MANY[low]) return MANY[low];
  if (/s$/i.test(word)) return word;
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + 'ies';
  if (/(x|z|ch|sh)$/i.test(word)) return word + 'es';
  return word + 's';
}
function back(title, named = {}) {
  const name = String(title || '').trim(), low = name.toLowerCase();
  if (named[name]) return named[name];
  if (FIXED[low]) return FIXED[low];
  const words = name.split(/\s+/);
  if (words.length >= 2 && /^by$/i.test(words[words.length - 1])) return words.slice(0, -1).join(' ');             // "Prescribed by" -> "Prescribed"
  if (words.length >= 2 && /^of$/i.test(words[words.length - 1])) return cap([...words.slice(0, -2), plural(words[words.length - 2])].join(' '));   // "Symptom of" -> "Symptoms"
  if (words.length === 1 && VERBS[low]) return VERBS[low];
  if (words.length === 1 && (ROLES.has(low) || /(ist|ian)$/.test(low))) return `${name} of`;
  return name;
}
const api = { back };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).reads = api;
})(typeof window !== 'undefined' ? window : globalThis);
