/* A large made-up graph for measuring (tools/harness/measure.js): one fictional patient's notes over a long illness, about no
   one real. Deterministic (seeded), so the same numbers come out each run and a change in the plugin is what moves them.

   Two sets written from DIFFERENT sentences, which is the point: the graph's notes (what Predictive has learned from) and the
   held-out notes (what is asked about, each with what a careful person would have filled in). A held-out note never shares
   its sentence with a graph note, and where it describes a symptom in other words, the words are ones the graph never used.
   So a right answer is read from the note, not copied from its twin.

   Each held-out property says how the note carries its value (how): 'link' ([[page]]), 'name' (the page's whole name in plain
   words), 'part' (a telling part of it: "Dr. Chen", "Zoë", "Northgate"), 'other' (described in other words: "could not keep
   food down" for Nausea), 'absent' (not in the words at all: only habit could know it), or 'number'.

   The world has habits, as a real one does: each doctor sees the patient at one place and mostly about two symptoms, each nurse
   works at one place, each drug has its usual doses. */
const synthetic = require('../../test/synthetic.js');

const DOCTORS = ['Dr. Mei Chen', 'Dr. Samuel Okafor', 'Dr. Priya Raman', 'Dr. Tomás Vidal', 'Dr. Hannah Lindqvist', 'Dr. Yusuf Demir', 'Dr. Claire Fontaine', 'Dr. Kwame Mensah', 'Dr. Aiko Tanabe', 'Dr. Robert Hale'];
const NURSES = ['Zoë Müller', 'Grace Adeyemi', 'Liam Byrne', 'Marta Kowalska', 'Sunita Rao', 'Paul Leclerc'];
const RELATIVES = ['Ruth Okoro', 'Daniel Okoro', 'Beatrice Lane', 'Jonas Weber', 'Nina Castell', 'Tom Ashby'];
const HOSPITALS = ['St Mary\'s Hospital', 'Northgate Clinic', 'Riverside Day Unit', 'Harbour Imaging Centre', 'Elm Street Surgery', 'Queen Anne Infirmary'];
const HOSPITAL_PART = { 'St Mary\'s Hospital': 'St Mary\'s', 'Northgate Clinic': 'Northgate', 'Riverside Day Unit': 'Riverside', 'Harbour Imaging Centre': 'Harbour Imaging', 'Elm Street Surgery': 'Elm Street', 'Queen Anne Infirmary': 'Queen Anne' };
const MEDICATIONS = { Cisplatin: [50, 75, 100], Ondansetron: [4, 8], Dexamethasone: [4, 8, 12], Zoloft: [25, 50, 100], Gabapentin: [100, 300], Filgrastim: [300, 480], Omeprazole: [20, 40], Morphine: [5, 10], Paclitaxel: [135, 175], Lorazepam: [1, 2] };
const PROCEDURES = ['Port insertion', 'Biopsy', 'Bone marrow aspirate', 'Endoscopy', 'Lumbar puncture', 'Blood transfusion'];
const SCANS = ['CT scan', 'MRI', 'PET scan', 'Chest X-ray', 'Ultrasound'];
// A symptom: [the words the graph's notes use for it, the words only held-out notes use].
const SYMPTOMS = {
  Nausea: [['felt sick to my stomach', 'queasy all morning', 'threw up after breakfast'], ['could not keep food down', 'stomach turning since lunch']],
  Fatigue: [['wiped out by noon', 'no energy at all', 'slept most of the day'], ['too tired to climb the stairs', 'drained after the short walk']],
  'Dry mouth': [['mouth so dry I could not swallow', 'tongue sticking to the roof of my mouth'], ['mouth feels like sandpaper', 'needed water for every bite']],
  Neuropathy: [['pins and needles in both hands', 'fingers numb and tingling'], ['could not feel the buttons on my shirt', 'feet prickling like static']],
  Headache: [['pounding behind the eyes', 'head throbbing since waking'], ['a tight band around my skull', 'temples aching all afternoon']],
  Insomnia: [['awake until four', 'could not fall asleep again'], ['lay staring at the ceiling for hours', 'up three times before dawn']],
  'Mouth sores': [['ulcers on the inside of my cheek', 'sore patches on my gums'], ['blisters under my tongue', 'it stings to eat anything salty']],
  Fever: [['temperature up to 38.4', 'shivering then burning hot'], ['woke up soaked and hot', 'the thermometer read 38.9']],
  Breathlessness: [['out of breath on the stairs', 'short of breath walking to the car'], ['had to stop twice to catch my breath', 'winded just getting dressed']],
  'Hair loss': [['hair coming out in the shower', 'clumps on the pillow'], ['more hair in the brush than before', 'scalp showing at the crown']],
  Dizziness: [['room spinning when I stood up', 'lightheaded in the queue'], ['had to hold the wall to stay upright', 'floor tilting under me']],
  'Appetite loss': [['could not face dinner', 'left most of the plate'], ['nothing tastes of anything', 'two bites and I was done']],
};

/* The sentences. A slot in braces is filled from the note's scenario: {doc} {nurse} {rel} {rel2} {hosp} {med} {proc} {scan} name
   a page (as a link, its whole name or a part of it); {sym} names the symptom's page; {sym~} describes it in other words;
   {dose} and {sev} are numbers. A property with no slot in the sentence is 'absent' from the words. [graph sentences, held-out]. */
const FRAMES = {
  Consultation: [[
    'Saw {doc} about the {sym}', 'Appointment with {doc} at {hosp}, mostly about {sym}', 'Follow-up with {doc}, she asked about the {sym}',
    '{doc} went through the bloods and the {sym}', 'Clinic visit with {doc}: {sym~}, told to rest', 'Met {doc} at {hosp} to review how things are going',
    'Long talk with {doc} because {sym~}', 'Check-in with {doc}, nothing new', 'Told {doc} that {sym~}', 'Review with {doc} at {hosp}',
  ], [
    'Spoke to {doc} in the consulting room about my {sym}', '{doc} examined me at {hosp} and noted the {sym}', 'Brought up with {doc} that {sym~}',
    'Twenty minutes with {doc}, who is not worried', 'Went in to see {doc}; {sym~}', 'Sat down with {doc} at {hosp} for the monthly review',
  ]],
  'Symptom Log': [[
    '{sym~}, about {sev} out of 10', 'Bad day: {sym~}', '{sym} again, {sev} out of 10', 'Woke up and {sym~}', '{sym~} since yesterday, {sev} out of 10',
    'The {sym} is back', 'Rough afternoon, {sym~}', '{sym} worse than last week, maybe {sev} out of 10',
  ], [
    'All day today: {sym~}', '{sym~}. I would call it {sev} out of 10', 'Still {sym}, {sev} out of 10 at its worst', 'By evening {sym~}', 'No let-up from the {sym}',
  ]],
  'Treatment Session': [[
    '{med} infusion at {hosp}, {nurse} did the drip', 'Cycle of {med} today, {dose} mg, {nurse} looked after me', '{nurse} gave the {med}, {dose} mg', 'Chemo day: {med} at {hosp}',
    '{med} {dose} mg this morning with {nurse}', 'In the chair at {hosp} for {med}', '{nurse} set up the {med} pump', 'Had the {med}, {dose} mg, home by three',
  ], [
    'Hooked up to {med} by {nurse}', 'Day unit: {dose} mg of {med} went in over two hours', '{nurse} ran the {med} through the port at {hosp}', 'Another round of {med} done', 'Sat through {med}, {dose} mg, while {nurse} checked on me',
  ]],
  'Imaging Session': [[
    '{scan} at {hosp} this morning', 'Had the {scan}, results next week', '{scan} done at {hosp}, took an hour', 'In for a {scan}', 'Lay still for the {scan} at {hosp}', 'The {scan} was moved to today',
  ], [
    'Went for my {scan}', 'They did the {scan} at {hosp} with contrast', 'Forty minutes inside the machine for the {scan}', 'Drove to {hosp} for the {scan}',
  ]],
  'Procedure Event': [[
    '{proc} with {doc} at {hosp}', '{doc} did the {proc}', 'Had the {proc} today, sore after', '{proc} at {hosp}, under sedation', '{doc} performed the {proc} this morning', 'Day case for the {proc}',
  ], [
    'Came round after the {proc}; {doc} said it went well', 'In theatre at {hosp} for the {proc}', 'The {proc} is done, {doc} was quick', 'Booked in and had the {proc}',
  ]],
  'Medication Change': [[
    '{doc} started me on {med}, {dose} mg', '{med} raised to {dose} mg', 'New prescription from {doc}: {med} {dose} mg', '{doc} cut the {med} to {dose} mg', 'Switching to {med} from tonight', 'Dose of {med} now {dose} mg, per {doc}',
  ], [
    'From tomorrow {dose} mg of {med}, says {doc}', '{doc} wrote me up for {med}', 'The {med} goes down to {dose} mg', 'Picked up the {med} that {doc} ordered, {dose} mg',
  ]],
  Conversation: [[
    'Called {rel} about the week', '{rel} rang, long chat', 'Coffee with {rel} and {rel2}', 'Talked it all through with {rel}', '{rel} came by with soup', 'On the phone with {rel} for an hour', 'Walked with {rel} and {rel2}',
  ], [
    'Caught up with {rel} over lunch', '{rel} and {rel2} dropped in after work', 'Rang {rel} to tell her the news', 'Had {rel} over for the evening',
  ]],
  Hospitalization: [[
    'Admitted to {hosp} overnight, {sym~}', 'Kept in at {hosp} because of the {sym}', 'Back on the ward at {hosp}', 'Two nights in {hosp} with {sym}', 'They admitted me: {sym~}',
  ], [
    'Ended up staying at {hosp}, {sym~}', 'On the ward again after the {sym} got worse', 'Wheeled up to a bed at {hosp}', 'Discharged from {hosp} after three nights of {sym}',
  ]],
  Recommendation: [[
    '{doc} suggests trying {med}', '{doc} recommends {med} if it gets worse', 'Advice from {doc}: think about {med}', '{doc} thinks {med} could help', 'Was told to consider {med}',
  ], [
    '{doc} would like me to try {med}', 'Worth a go, says {doc}: {med}', 'The suggestion is {med}', '{doc} raised the idea of {med}',
  ]],
};
const PLAIN = [[
  'Remember to water the plants', 'Coffee machine is broken again', 'Parked on level three near the lift', 'Birthday card for the neighbour', 'Rain all afternoon, stayed in',
  'Bread ran out before breakfast', 'Finished the crossword at last', 'The cat knocked the vase over', 'Bins go out on Thursday', 'Watched the football with the sound off',
  'Need new batteries for the radio', 'Tidied the bookshelf by colour', 'Bus was late both ways', 'Tomatoes are coming up on the windowsill', 'Paid the electricity bill',
  'Found the spare keys behind the sofa', 'Neighbour is drilling again', 'Ordered a new kettle', 'Sun out, sat on the bench for a while', 'Library books are due back',
], [
  'The boiler is making that noise again', 'Bought stamps and a newspaper', 'Garden gate needs oiling', 'Made soup from the leftover carrots', 'Trains were cancelled all morning',
  'Wrote the shopping list twice by mistake', 'The radio play was better than expected', 'Hung the washing out before the rain', 'Swapped the winter duvet for the light one', 'Fox in the garden at dusk',
]];
const TAILS = ['', '', '', ' this morning', ' after lunch', ' today', ' again', ' before tea', ' on the way home', ' as planned'];

const SPEC = {
  tags: ['Consultation', 'Symptom Log', 'Treatment Session', 'Imaging Session', 'Procedure Event', 'Medication Change', 'Conversation', 'Hospitalization', 'Recommendation',
    'Doctor', 'Nurse', 'Relative', 'Hospital', 'Symptom', 'Medication', 'Procedure', 'Scan Type'],
  props: [
    { title: 'With', type: 'node', accepts: ['Doctor'], on: ['Consultation'] },
    { title: 'About', type: 'node', accepts: ['Symptom'], on: ['Consultation'] },
    { title: 'Where', type: 'node', accepts: ['Hospital'], on: ['Consultation', 'Treatment Session', 'Imaging Session', 'Procedure Event', 'Hospitalization'] },
    { title: 'Symptom', type: 'node', accepts: ['Symptom'], on: ['Symptom Log'] },
    { title: 'Severity', type: 'number', on: ['Symptom Log'] },
    { title: 'Medication', type: 'node', accepts: ['Medication'], on: ['Treatment Session', 'Medication Change', 'Recommendation'] },
    { title: 'Given by', type: 'node', accepts: ['Nurse'], on: ['Treatment Session'] },
    { title: 'Dose', type: 'number', on: ['Treatment Session', 'Medication Change'] },
    { title: 'Scan', type: 'node', accepts: ['Scan Type'], on: ['Imaging Session'] },
    { title: 'Procedure', type: 'node', accepts: ['Procedure'], on: ['Procedure Event'] },
    { title: 'Performed by', type: 'node', accepts: ['Doctor'], on: ['Procedure Event'] },
    { title: 'Prescribed by', type: 'node', accepts: ['Doctor'], on: ['Medication Change'] },
    { title: 'Spoke with', type: 'node', many: true, accepts: ['Relative'], on: ['Conversation'] },
    { title: 'Reason', type: 'node', accepts: ['Symptom'], on: ['Hospitalization'] },
    { title: 'Recommended by', type: 'node', accepts: ['Doctor'], on: ['Recommendation'] },
  ],
  people: { Doctor: DOCTORS, Nurse: NURSES, Relative: RELATIVES, Hospital: HOSPITALS, Symptom: Object.keys(SYMPTOMS), Medication: Object.keys(MEDICATIONS), Procedure: PROCEDURES, 'Scan Type': SCANS },
};
// Which property each slot fills, per tag.
const SLOT_PROP = {
  Consultation: { doc: 'With', hosp: 'Where', sym: 'About' },
  'Symptom Log': { sym: 'Symptom', sev: 'Severity' },
  'Treatment Session': { med: 'Medication', nurse: 'Given by', hosp: 'Where', dose: 'Dose' },
  'Imaging Session': { scan: 'Scan', hosp: 'Where' },
  'Procedure Event': { proc: 'Procedure', doc: 'Performed by', hosp: 'Where' },
  'Medication Change': { med: 'Medication', doc: 'Prescribed by', dose: 'Dose' },
  Conversation: { rel: 'Spoke with' },
  Hospitalization: { hosp: 'Where', sym: 'Reason' },
  Recommendation: { doc: 'Recommended by', med: 'Medication' },
};
const NOTE_TAGS = Object.keys(FRAMES);

/* make({ notes, plain, held, heldPlain, seed, untagged }) -> { ctx, g, held: [{ text, tag, truth: Map(ident -> { kind, ids | number }),
   how: Map(ident -> how) }], heldPlain: [text] }. */
function make({ notes = 6000, plain = 1500, held = 600, heldPlain = 150, seed = 7, untagged = 0 } = {}) {
  const heldNotes = [], heldPlainLines = [];
  const g = synthetic.build({
    ...SPEC, seed, journal: [{ id: 9902, day: 20261102 }],
    lines({ rand, tagPage, peoplePages, prop, page, add, pick }) {
      const P = Object.fromEntries(Object.entries(peoplePages).map(([kind, list]) => [kind, list]));
      // The world's habits.
      const home = new Map(P.Doctor.map((d, i) => [d, P.Hospital[i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : 4]]));
      const usual = new Map(P.Doctor.map((d, i) => [d, [P.Symptom[(2 * i) % P.Symptom.length], P.Symptom[(2 * i + 1) % P.Symptom.length]]]));
      const ward = new Map(P.Nurse.map((n, i) => [n, P.Hospital[i % 2 ? 2 : 0]]));
      const scenario = tag => {
        const doc = pick(P.Doctor), nurse = pick(P.Nurse), med = pick(P.Medication), rel = pick(P.Relative);
        let rel2 = pick(P.Relative); if (rel2 === rel) rel2 = P.Relative[(P.Relative.indexOf(rel) + 1) % P.Relative.length];
        const sym = rand() < .8 && tag === 'Consultation' ? pick(usual.get(doc)) : pick(P.Symptom);
        const hosp = tag === 'Treatment Session' ? ward.get(nurse) : tag === 'Imaging Session' ? (rand() < .7 ? P.Hospital[3] : P.Hospital[0])
          : tag === 'Hospitalization' ? (rand() < .8 ? P.Hospital[0] : P.Hospital[5]) : rand() < .85 ? home.get(doc) : pick(P.Hospital);
        return { doc, nurse, med, rel, rel2, sym, hosp, proc: pick(P.Procedure), scan: pick(P['Scan Type']), dose: pick(MEDICATIONS[med.title]), sev: 1 + Math.floor(rand() * 10) };
      };
      // A page said in the words: a link, its whole name, or a telling part of it.
      const said = (p, kind) => {
        const r = rand(), lower = ['med', 'proc', 'scan', 'sym'].includes(kind);
        if (r < .4) return [`[[${p.uuid}]]`, 'link'];
        if (r < .75 || kind === 'med' || kind === 'proc' || kind === 'scan' || kind === 'sym') return [lower && kind !== 'scan' && kind !== 'med' ? p.title.toLowerCase() : p.title, 'name'];
        if (kind === 'doc') return ['Dr. ' + p.title.split(' ').pop(), 'part'];
        if (kind === 'hosp') return [HOSPITAL_PART[p.title], 'part'];
        return [p.title.split(' ')[0], 'part'];
      };
      const write = (tag, heldOut) => {
        const s = scenario(tag), frame = pick(FRAMES[tag][heldOut ? 1 : 0]), how = new Map(), slots = SLOT_PROP[tag];
        const text = frame.replace(/\{(\w+)(~?)\}/g, (m, slot, other) => {
          const key = slot === 'rel2' ? 'rel' : slot, ident = prop(slots[key]).ident;
          if (slot === 'dose' || slot === 'sev') { how.set(ident, 'number'); return String(s[slot]); }
          if (other) { how.set(ident, 'other'); return pick(SYMPTOMS[s.sym.title][heldOut ? 1 : 0]); }
          const [words, kind] = said(s[slot], key);
          if (!(slot === 'rel2' && how.has(ident))) how.set(ident, slot === 'rel2' ? how.get(ident) || kind : kind);
          return words;
        }) + pick(TAILS);
        // What a careful person fills in: everything the scenario holds for this tag's properties; Spoke with holds both when two came.
        const truth = new Map(), values = new Map();
        for (const [slot, title] of Object.entries(slots)) {
          const p = prop(title);
          if (slot === 'dose' || slot === 'sev') { if (how.has(p.ident)) truth.set(p.ident, { kind: 'number', number: s[slot] }); continue; }   // a number only when written
          const ids = slot === 'rel' && frame.includes('{rel2}') ? [s.rel.id, s.rel2.id] : [s[slot].id];
          truth.set(p.ident, { kind: 'ids', ids }); values.set(p.ident, ids);
          if (!how.has(p.ident)) how.set(p.ident, 'absent');
        }
        if (heldOut) heldNotes.push({ text, tag: tagPage[tag].id, tagTitle: tag, truth, how });
        // untagged: the share of the graph's notes of these kinds that were left with no tag and no values, as a person leaves many.
        else if (rand() < untagged) add({ title: text, tags: [], values: new Map() });
        else add({ title: text, tags: [tagPage[tag].id], values });
      };
      for (let i = 0; i < notes; i++) write(NOTE_TAGS[i % NOTE_TAGS.length], false);
      for (let i = 0; i < held; i++) write(NOTE_TAGS[i % NOTE_TAGS.length], true);
    },
    plain({ add, pick }) {
      for (let i = 0; i < plain; i++) add(pick(PLAIN[0]) + pick(TAILS));
      for (let i = 0; i < heldPlain; i++) heldPlainLines.push(pick(PLAIN[1]) + pick(TAILS));
    },
  });
  // Only the kinds of note are tags a bullet carries; the kinds of page (Doctor, Hospital ...) are never offered for a note.
  g.ctx.knownTags = new Set(SPEC.tags.map(t => g.tagPage[t].id));
  g.ctx.graph = 'predictive-harness';
  return { ctx: g.ctx, g, held: heldNotes, heldPlain: heldPlainLines };
}

module.exports = { make, NOTE_TAGS };
