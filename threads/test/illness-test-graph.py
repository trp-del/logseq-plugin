#!/usr/bin/env python3
"""Writes test/illness-test-graph.edn (and its three parts), the seed of the Illness Test Graph.

A fictional person, Daniel Okoro, 58, through a colon cancer diagnosis, surgery and chemotherapy, from
2026-06-22 to 2026-10-20 with appointments booked into December.

Shaped on the owner's own map (2026-10-20), expanded by its own principle: a few tags, one to three properties each, and every record a
line written the way one writes a journal, first person and short, a link only where one would naturally make one. The structure is extracted from the words: a link to a page that
has a tag already carries its quality (Dr. Chen is a #Doctor, Nausea a #Symptom), so the sentence says which
property the link belongs in, and the main bits live in both the words and the properties. A tag exists only
where its nodes need properties the others don't; a property only for what one would list or sort by.
Rules: docs/MODELLING.md.

Some records are left half-filled on purpose, so the proposals have something to do (marked "on purpose").
Run: python3 test/illness-test-graph.py
"""
import datetime as dt
import random
from pathlib import Path

random.seed(11)
OUT = Path(__file__).with_name('illness-test-graph.edn')
TODAY = dt.date(2026, 10, 20)


# ---------- EDN helpers ----------
def s(text):
    return '"' + text.replace('\\', '\\\\').replace('"', '\\"') + '"'

def uid(kind, n):
    return f'{kind}000000-0000-4000-8000-{n:012x}'

def ref(u):
    return f'[:block/uuid #uuid "{u}"]'

def refs(us):
    return '#{' + ' '.join(ref(u) for u in dict.fromkeys(us)) + '}'

def day(d):
    return f'[:build/page {{:build/journal {d:%Y%m%d}}}]'

def ms(d):
    return int(dt.datetime(d.year, d.month, d.day, tzinfo=dt.timezone.utc).timestamp() * 1000)

def D(text):
    return dt.date.fromisoformat(text)

def props(m):
    return '{' + ' '.join(f':user.property/{k} {v}' if not k.startswith(':') else f'{k} {v}' for k, v in m.items() if v is not None) + '}'


# ---------- Properties: one for each thing worth listing or sorting by ----------
P = {}
CHOICE = {}
_choice_n = [0]

def prop(slug, title, typ, many=False, classes=None, choices=None):
    parts = [f':block/title {s(title)}', f':logseq.property/type :{typ}',
             f':db/cardinality :db.cardinality/{"many" if many else "one"}']
    if classes:
        parts.append(':build/property-classes [' + ' '.join(f':user.class/{c.replace(" ", "-")}' for c in classes) + ']')
    if choices:
        vals = []
        for v in choices:
            _choice_n[0] += 1
            u = uid('7a', _choice_n[0])
            CHOICE[(slug, v)] = u
            vals.append(f'{{:value {s(v)} :uuid #uuid "{u}"}}')
        parts.append(':build/closed-values [' + ' '.join(vals) + ']')
    P[slug] = '{' + ' '.join(parts) + '}'

def ch(slug, value):
    return ref(CHOICE[(slug, value)])

prop('date', 'Date', 'date')
prop('provider', 'Provider', 'node', classes=['Doctor'])
prop('topic', 'Topic', 'node', classes=['Phenomena'])             # a cancer, a disease or a symptom
prop('spoke-with', 'Spoke with', 'node', many=True, classes=['Person'])
prop('status', 'Status', 'default', choices=['Planned', 'Done', 'Moved', 'Missed'])
prop('hospital', 'Hospital', 'node', classes=['Hospital'])
prop('end', 'End', 'date')
prop('symptom-type', 'Symptom type', 'node', classes=['Symptom'])
prop('severity', 'Severity', 'number')                           # 1 to 5: the one thing worth plotting over time
prop('agent', 'Agent', 'node', many=True, classes=['Pharmacological Agent'])
prop('cycle', 'Cycle', 'number')
prop('decided-by', 'Decided by', 'node', classes=['Doctor'])
prop('findings', 'Findings', 'default')
prop('diagnosed-by', 'Diagnosed by', 'node', classes=['Doctor'])
prop('confirmation', 'Confirmation Status', 'default', choices=['Suspected', 'Confirmed', 'Ruled out'])
prop('definition', 'Definition', 'default')
prop('location', 'Location', 'default')
prop('specialty', 'Specialty', 'default', choices=['Oncology', 'Colorectal surgery', 'Gastroenterology', 'General practice', 'Anaesthesia'])
prop('works-at', 'Works at', 'node', classes=['Organization'])
prop('notes', 'Notes', 'default')
prop('target', 'Target', 'node', classes=['Phenomena'])            # what the drug is for
prop('regimen', 'Therapy regimen', 'default')
prop('side-effects', 'Side Effects', 'node', many=True, classes=['Symptom'])

# ---------- Tags: a tag only where its nodes need properties of their own ----------
C = {}
def cls(name, parent=None, fields=(), extra=''):
    key = name.replace(' ', '-')
    parts = [f':block/title {s(name)}']
    if parent:
        parts.append(f':build/class-extends [:user.class/{parent.replace(" ", "-")}]')
    if fields:
        parts.append(':build/class-properties [' + ' '.join(f':user.property/{f}' for f in fields) + ']')
    if extra:
        parts.append(extra)
    C[key] = '{' + ' '.join(parts) + '}'

BIDI = ':build/properties {:logseq.property.class/enable-bidirectional? true}'
cls('Entity'); cls('Occurrence', fields=['date']); cls('Interpretation'); cls('Phenomena')
cls('Organization', 'Entity')
cls('Hospital', 'Organization', ['location'])
cls('Person', 'Entity', ['notes'])
cls('Doctor', 'Person', ['specialty', 'works-at'])
cls('Pharmacological Agent', 'Entity', ['target', 'regimen', 'side-effects'])
cls('Consultation', 'Occurrence', ['provider', 'topic'], BIDI)
cls('Conversation', 'Occurrence', ['topic', 'spoke-with'])
cls('Expectation', 'Occurrence', ['status'])
cls('Treatment', 'Occurrence', ['agent', 'cycle'])
cls('Hospitalization', 'Occurrence', ['hospital', 'end'])
cls('Symptom Log', 'Occurrence', ['symptom-type', 'severity'])
cls('Report', 'Interpretation', ['date', 'findings'], BIDI)
cls('research', 'Interpretation')
cls('Decision', 'Interpretation', ['decided-by', 'date'])
cls('Cancer', 'Phenomena', ['diagnosed-by', 'confirmation'])
cls('Disease', 'Phenomena', ['definition'])
cls('Symptom', 'Phenomena')

def tags(*names):
    return '[' + ' '.join(f':user.class/{n.replace(" ", "-")}' for n in names) + ']'


# ---------- Pages ----------
PAGES = []
ID = {}
_n = {}
def new_id(kind):
    _n[kind] = _n.get(kind, 0) + 1
    return uid(kind, _n[kind])

def page(key, title, tag=None, fields=None, blocks=(), alias=None, kind='1a'):
    u = ID[key] = new_id(kind)
    parts = [f':block/title {s(title)}', f':block/uuid #uuid "{u}"', ':build/keep-uuid? true']
    if tag:
        parts.append(f':build/tags {tags(tag)}')
    f = dict(fields or {})
    if alias:
        f[':block/alias'] = '#{' + f'[:build/page {{:block/title {s(alias)}}}]' + '}'
    if f:
        parts.append(f':build/properties {props(f)}')
    PAGES.append((key, '{:page {' + ' '.join(parts) + '} :blocks [' + ' '.join(blocks) + ']}'))
    return u

def B(title, tag=None, fields=None, children=(), uuid=None, collapsed=False):
    # Every block gets a fixed uuid, so importing the seed twice changes nothing instead of doubling the blocks.
    uuid = uuid or new_id('8a')
    parts = [f':block/title {s(title)}', f':block/uuid #uuid "{uuid}"', ':build/keep-uuid? true']
    if tag:
        parts.append(f':build/tags {tag if tag.startswith("[") else tags(tag)}')
    if fields:
        parts.append(f':build/properties {props(fields)}')
    if collapsed:
        parts.append(':block/collapsed? true')
    if children:
        parts.append(':build/children [' + ' '.join(children) + ']')
    return '{' + ' '.join(parts) + '}'

STATUS = {'todo': 'todo', 'doing': 'doing', 'done': 'done', 'canceled': 'canceled', 'backlog': 'backlog'}
def T(title, status='todo', priority=None, deadline=None, children=()):
    f = {':logseq.property/status': f':logseq.property/status.{STATUS[status]}'}
    if priority:
        f[':logseq.property/priority'] = f':logseq.property/priority.{priority}'
    if deadline:
        f[':logseq.property/deadline'] = ms(D(deadline))
    return B(title, '[:logseq.class/Task]', f, children)

R = lambda k: ref(ID[k])
who = lambda *keys: refs(ID[k] for k in keys)

# Organizations
page('riverside', 'Riverside General Hospital', 'Hospital', {'location': s('1 River Lane, Eastbridge')},
     [B('Parking in the multi-storey on Mill Road; the endoscopy unit is on level 2. Ward 6B is the surgical ward.')], alias='Riverside')
page('northgate', 'Northgate Cancer Center', 'Hospital', {'location': s('40 Northgate Road, Eastbridge')},
     [B('Day unit on the ground floor. Chemo chairs by the window if you ask early.'), B('Acute oncology line, 24 hours: 020 7946 0999.')], alias='Northgate')
page('elm', 'Elm Street Medical Centre', 'Hospital', {'location': s('12 Elm Street, Eastbridge')}, [B('My GP practice. Repeat prescriptions take two working days.')])
page('medlab', 'Medlab Diagnostics', 'Organization', None, [B('Blood tests without an appointment, 7:30 to 11 on weekdays.')])
page('lakeside', 'Lakeside Pharmacy', 'Organization', None, [B('Mrs. Lin keeps the anti-sickness tablets in stock for me.')])

# People
page('daniel', 'Daniel Okoro', 'Person', {'notes': s('Me. Retired maths teacher, 58.')},
     [B('Lives in Eastbridge with [[Ruth Okoro]]. Children [[Amara Okoro]] in Leeds and [[Tunde Okoro]] in Lagos.')])
page('ruth', 'Ruth Okoro', 'Person', {'notes': s('Wife. Comes to most appointments and keeps the paper folder.')})
page('amara', 'Amara Okoro', 'Person', {'notes': s('Daughter, in Leeds.')})
page('tunde', 'Tunde Okoro', 'Person', None)  # sparse on purpose
page('graham', 'Graham Whitlock', 'Person', {'notes': s('Old colleague. Drives me when Ruth is at work.')})
page('zoe', 'Zoë Müller', 'Person', {'notes': s('Chemo nurse on the day unit at Northgate. Always remembers Ruth\'s name.')})
page('marcus', 'Marcus Bell', 'Person', {'notes': s('Nurse on ward 6B at Riverside.')})
page('hannah', 'Hannah Reyes', None, None, [B('Dietitian at Northgate.')])  # no tag on purpose: a link whose quality the plugin cannot know
page('chen', 'Dr. Mei Chen', 'Doctor', {'specialty': ch('specialty', 'Oncology'), 'works-at': R('northgate')},
     [B('Consultant medical oncologist. Explains things with drawings. Secretary Paula, 020 7946 0880.')], alias='Dr. Chen')
page('patel', 'Dr. Raj Patel', 'Doctor', {'specialty': ch('specialty', 'Colorectal surgery'), 'works-at': R('riverside')},
     [B('Consultant colorectal surgeon. Did the operation on Aug 4.')])
page('alvarez', 'Dr. Sofia Alvarez', 'Doctor', {'specialty': ch('specialty', 'Gastroenterology'), 'works-at': R('riverside')},
     [B('Did the colonoscopy and gave me the biopsy result.')])
page('brooks', 'Dr. Helen Brooks', 'Doctor', {'specialty': ch('specialty', 'General practice'), 'works-at': R('elm')},
     [B('My GP for twenty years. First to take the bleeding seriously.')])
page('watanabe', 'Dr. Kenji Watanabe', 'Doctor', {'specialty': ch('specialty', 'Anaesthesia')})  # no workplace on purpose

# Phenomena: what is wrong, what is felt
SYMPTOMS = ['Fatigue', 'Nausea', 'Abdominal pain', 'Diarrhoea', 'Tingling fingers', 'Cold sensitivity', 'Blood in stool', 'Loss of appetite', 'Mouth sores']
for name in SYMPTOMS:
    page('sym:' + name, name, 'Symptom', None, [])
page('crc', 'Colon cancer', 'Cancer', {'diagnosed-by': R('alvarez'), 'confirmation': ch('confirmation', 'Confirmed')},
     [B('Adenocarcinoma of the ascending colon, found on the colonoscopy of Jul 3 and confirmed by the biopsy on Jul 8.'),
      B('Stage IIIB after surgery: 3 of 18 lymph nodes. Treatment: surgery, then eight cycles of FOLFOX.')], alias='CRC')
page('anaemia', 'Anaemia', 'Disease', {'definition': s('Too few red blood cells, here from slow bleeding in the bowel. Tiredness and breathlessness.')})
page('neuropathy', 'Peripheral neuropathy', 'Disease', {'definition': s('Nerve damage in the hands and feet, a side effect of oxaliplatin: tingling, numbness, cold sensitivity.')})
page('neutropenia', 'Neutropenia', 'Disease', {'definition': s('Too few neutrophils after chemotherapy, so infections are dangerous. A cycle is delayed until they recover.')})

# Pharmacological agents
page('oxali', 'Oxaliplatin', 'Pharmacological Agent', {'target': R('crc'), 'regimen': s('85 mg/m² each cycle, 65 from cycle 4'),
     'side-effects': who('sym:Tingling fingers', 'sym:Cold sensitivity')},
     [B('The one that causes the cold tingling. No cold drinks for three days after.')])
page('fu', 'Fluorouracil (5-FU)', 'Pharmacological Agent', {'target': R('crc'), 'regimen': s('pump over 46 hours each cycle'),
     'side-effects': who('sym:Diarrhoea', 'sym:Nausea', 'sym:Mouth sores')},
     [B('Goes home in a bottle on my belt; the district nurse takes it off on day 3.')], alias='5-FU')
page('leuco', 'Leucovorin', 'Pharmacological Agent', {'target': R('crc'), 'regimen': s('400 mg/m² each cycle')})
page('ondan', 'Ondansetron', 'Pharmacological Agent', {'target': R('sym:Nausea'), 'regimen': s('8 mg as needed')})
page('lopera', 'Loperamide', 'Pharmacological Agent', {'target': R('sym:Diarrhoea'), 'regimen': s('2 mg after each loose stool, up to 8 a day')})
page('iron', 'Ferrous sulphate', 'Pharmacological Agent', {'target': R('anaemia'), 'regimen': s('200 mg twice a day')})

# Reports (interpretations of tests): the date, the findings, a line or two
REPORTS = {}
def report(key, title, on, findings, blocks=()):
    REPORTS[key] = page(key, title, 'Report', {'date': day(D(on)), 'findings': s(findings)}, blocks, kind='5a')
report('r-bc-0626', 'Blood count 2026-06-26', '2026-06-26', 'Haemoglobin 98 g/L, low. Iron low.', [B('Ordered by [[Dr. Helen Brooks]]. Points at [[Anaemia]].')])
report('r-colo', 'Colonoscopy report 2026-07-03', '2026-07-03', 'Mass in the ascending colon, 4 cm. Biopsies taken.', [B('By [[Dr. Sofia Alvarez]] at [[Riverside]]. Two small polyps removed as well.')])
report('r-biopsy', 'Biopsy pathology 2026-07-08', '2026-07-08', 'Moderately differentiated adenocarcinoma.', [B('This is the [[Colon cancer]] diagnosis.')])
report('r-ct-0714', 'CT chest abdomen pelvis 2026-07-14', '2026-07-14', 'Two enlarged lymph nodes near the tumour. No spread to liver or lungs.')
report('r-discharge', 'Discharge summary 2026-08-08', '2026-08-08', 'Laparoscopic right hemicolectomy Aug 4. Uneventful recovery. Home on day 4.')
report('r-path', 'Surgical pathology 2026-08-11', '2026-08-11', 'pT3 N1b: 3 of 18 lymph nodes involved. Margins clear. Stage IIIB.')
report('r-letter-0820', 'Letter from Dr. Chen 2026-08-20', '2026-08-20', 'Recommends eight cycles of FOLFOX starting early September.')
report('r-bc-0901', 'Blood count 2026-09-01', '2026-09-01', 'All counts fine for cycle 1.')
report('r-bc-0915', 'Blood count 2026-09-15', '2026-09-15', 'Neutrophils 2.1, fine.')
report('r-bc-0929', 'Blood count 2026-09-29', '2026-09-29', 'Neutrophils 1.6, borderline but fine. CEA 2.8, back to normal.')
report('r-letter-1007', 'Clinic letter 2026-10-07', '2026-10-07', 'Grade 1 neuropathy. Oxaliplatin reduced by 25% from cycle 4.')
report('r-bc-1013', 'Blood count 2026-10-13', '2026-10-13', 'Neutrophils 0.9, too low: cycle 4 delayed a week.', [B('See [[Neutropenia]].')])

# Decisions: the few lines one would most want listed in a year, with who said them
def decision(key, title, by, on, blocks=()):
    page(key, title, 'Decision', {'decided-by': R(by), 'date': day(D(on))}, blocks, kind='5a')
decision('d-surgery', 'Surgery first, then chemotherapy depending on the lymph nodes', 'patel', '2026-07-17', [B('From the team meeting. Keyhole, right side.')])
decision('d-folfox', 'Eight cycles of FOLFOX, every two weeks from Sep 2', 'chen', '2026-08-20', [B('Cuts the risk of it coming back by about a third.')])
decision('d-reduce', 'Oxaliplatin reduced by a quarter from cycle 4', 'chen', '2026-10-07', [B('Because of the [[Tingling fingers]]; grade 1 [[Peripheral neuropathy]].')])
decision('d-delay', 'Cycle 4 delayed a week', 'chen', '2026-10-14', [B('Neutrophils 0.9 on Oct 13: [[Neutropenia]].')])

page('research-folfox', 'FOLFOX side effects, what to expect', 'research', None,
     [B('Oxaliplatin: [[Tingling fingers]] and [[Cold sensitivity]] in most people, usually fading after treatment.'),
      B('5-FU: [[Diarrhoea]], [[Mouth sores]], [[Nausea]] in the first days of each cycle.'),
      B('Neutrophils dip around day 10; a cycle is delayed if they are under 1.0.')])


# ---------- Journals: every record a sentence, written freely, with its links ----------
J = {}
def add(d, *blocks):
    J.setdefault(D(d) if isinstance(d, str) else d, []).extend(blocks)

REC = {}
def rec(key, written, words, tag, fields=None, children=(), collapsed=False):
    u = REC[key] = new_id('6a')
    add(written, B(words, tag, fields, children, uuid=u, collapsed=collapsed))
    return u

def log(d, words, symptom, severity, dated=True):
    add(d, B(words, 'Symptom Log', {'date': day(D(d)) if dated else None, 'symptom-type': R('sym:' + symptom), 'severity': severity}))

# --- June: first signs
add('2026-06-22', B('Blood again this morning. Third time this month. Not telling Ruth yet.'))
log('2026-06-22', '[[Blood in stool]] again this morning. Third time this month.', 'Blood in stool', 2)
add('2026-06-23', B('Told [[Ruth Okoro]]. She made me promise to ring the surgery.'), T('Ring Elm Street for a GP appointment', 'done', 'high'))
add('2026-06-24', B('Got an appointment for tomorrow with [[Dr. Helen Brooks]].'))
rec('gp-0625', '2026-06-25', 'Saw [[Dr. Helen Brooks]] about the bleeding. Blood test tomorrow, and she\'s referring me to gastro.',
    'Consultation', {'date': day(D('2026-06-25')), 'provider': R('brooks'), 'topic': R('sym:Blood in stool')},
    [B('She examined me and said she wants it looked at properly.')])
add('2026-06-26', B('Blood test at [[Medlab Diagnostics]] first thing. Result: [[Blood count 2026-06-26]].'))
rec('brooks-call', '2026-06-29', '[[Dr. Helen Brooks]] rang. Haemoglobin\'s low, so iron tablets for now, and they\'re booking a colonoscopy.',
    'Conversation', {'date': day(D('2026-06-29')), 'spoke-with': who('brooks'), 'topic': R('anaemia')})
add('2026-06-29', T('Pick up the iron tablets from [[Lakeside Pharmacy]]', 'done'))
rec('booking', '2026-06-30', 'Riverside rang: colonoscopy on Friday. Prep instructions in the post.',
    'Conversation', {'date': day(D('2026-06-30'))})
rec('x-colo', '2026-06-30', 'Colonoscopy on Friday', 'Expectation', {'date': day(D('2026-07-03')), 'status': ch('status', 'Done')})
add('2026-07-01', B('Prep letter came. Low-fibre diet from today.'))
add('2026-07-02', B('Prep day. Not pleasant. [[Graham Whitlock]] will drive tomorrow.'))
rec('colo', '2026-07-03', 'Colonoscopy with [[Dr. Sofia Alvarez]]. She found something she wants to biopsy.',
    'Consultation', {'date': day(D('2026-07-03')), 'provider': R('alvarez')},
    [B('Her face said more than she did. [[Ruth Okoro]] and [[Graham Whitlock]] waited outside.')])
add('2026-07-04', B('Couldn\'t sleep. Read about colon cancer until 2am, which was a mistake.'))
log('2026-07-06', 'Low day. No energy at all.', 'Fatigue', 3)
add('2026-07-07', B('[[Amara Okoro]] called. I didn\'t tell her yet. I will once I know.'))
rec('biopsy-call', '2026-07-08', '[[Dr. Sofia Alvarez]] rang with the biopsy. It\'s cancer. She was kind about it.',
    'Conversation', {'date': day(D('2026-07-08')), 'spoke-with': who('alvarez'), 'topic': R('crc')},
    [B('Rang [[Amara Okoro]] and [[Tunde Okoro]] in the evening.')])
rec('patel-0709', '2026-07-09', 'Met the surgeon, [[Dr. Raj Patel]]. CT first, then most likely keyhole surgery.',
    'Consultation', {'date': day(D('2026-07-09')), 'provider': R('patel'), 'topic': R('crc')},
    [B('He drew the colon on a napkin. Right side, which he says is the easier side.'), B('Asked about a stoma: no, the bowel can be joined straight away.')])
add('2026-07-10', B('Told my book group. More hugs than I knew what to do with.'))
log('2026-07-11', 'Dull ache on the right side this morning.', 'Abdominal pain', 2, dated=False)  # no date on purpose
rec('x-ct', '2026-07-11', 'CT scan on Tuesday. Nothing to eat from midnight.', 'Expectation', {'date': day(D('2026-07-14')), 'status': ch('status', 'Done')},
    [B('Report: [[CT chest abdomen pelvis 2026-07-14]]. The contrast makes you feel like you\'ve wet yourself. Nobody warns you.')])
log('2026-07-15', 'Better day. Gardened, then flagged by mid-afternoon.', 'Fatigue', 1)
# two doctors in the words, Provider empty: the plugin must stay quiet (on purpose)
rec('mdt', '2026-07-17', 'Saw [[Dr. Raj Patel]] and [[Dr. Mei Chen]] together about the results. Surgery first, then chemo depending on the lymph nodes.',
    'Consultation', {'date': day(D('2026-07-17')), 'topic': R('crc')},
    [B('[[Ruth Okoro]] and [[Amara Okoro]] came. Amara took notes.'), B('Decided: [[Surgery first, then chemotherapy depending on the lymph nodes]].')])
add('2026-07-18', B('Amara stayed the night. We watched old films and didn\'t talk about it.'))
add('2026-07-20', B('Before surgery', collapsed=True, children=[
    T('Pre-op assessment Jul 21', 'done'), T('Sort out power of attorney with Ruth', 'todo', 'medium', '2026-08-01'),
    T('Freeze some meals', 'done'), T('Ask the library to cover my Thursday shift', 'canceled')]))
rec('preop', '2026-07-21', 'Pre-op with [[Marcus Bell]]. ECG, bloods and a lot of questions.',
    'Conversation', {'date': day(D('2026-07-21')), 'spoke-with': who('marcus')})
for d, text in [('2026-07-23', 'Long walk by the river with Ruth.'), ('2026-07-24', 'Bad night. Scared about the anaesthetic.'),
                ('2026-07-27', 'Tunde video call from Lagos. He wants to fly over; I told him to wait for chemo.'),
                ('2026-07-29', 'Bought loose trousers for after the operation.'), ('2026-07-31', 'Hair cut. Silly thing to do but I wanted to.')]:
    add(d, B(text))
# the person is named only in the words, Spoke with empty (on purpose)
rec('anaes', '2026-07-30', 'The anaesthetist rang, [[Dr. Kenji Watanabe]]. Very calm voice.',
    'Conversation', {'date': day(D('2026-07-30'))})
rec('x-surgery', '2026-07-30', 'Operation on the 4th. In at 7.', 'Expectation', {'date': day(D('2026-08-04')), 'status': ch('status', 'Done')})
add('2026-08-03', T('Pack the hospital bag', 'done', 'high', '2026-08-03'), B('Shower with the pink antiseptic. Bed early.'))
rec('stay', '2026-08-04', 'In for the operation. Ward 6B, bed 14.',
    'Hospitalization', {'date': day(D('2026-08-04')), 'hospital': R('riverside'), 'end': day(D('2026-08-08'))},
    [B('In at 7, theatre at 9:30, awake by 2.'), B('Day 1: walked to the window and back. [[Marcus Bell]] cheered.'),
     B('Day 2: first cup of tea. Best tea of my life.'), B('Day 4: home. Report: [[Discharge summary 2026-08-08]].')])
log('2026-08-05', 'Day 1 after. Very sore, on the oxycodone.', 'Abdominal pain', 5)
log('2026-08-06', 'Day 2. The pain is easing.', 'Abdominal pain', 3)
add('2026-08-08', T('Book the post-op check for Aug 18', 'done'))
for d, text in [('2026-08-09', 'Sleeping a lot. Ruth keeps checking I\'m breathing.'), ('2026-08-10', 'Short walk to the end of the road.')]:
    add(d, B(text))
rec('path-call', '2026-08-11', '[[Dr. Raj Patel]] rang with the pathology. Three lymph nodes, so chemo after all.',
    'Conversation', {'date': day(D('2026-08-11')), 'spoke-with': who('patel'), 'topic': R('crc')})
for d in ['2026-08-12', '2026-08-13', '2026-08-15', '2026-08-16']:
    add(d, B(random.choice(['Wound healing well.', 'Walked to the park bench and back.', 'Read in the garden.', 'Tired, but less sore.'])))
    log(d, random.choice(['Tired by evening.', 'Flagging again by teatime.']), 'Fatigue', random.choice([1, 2]), dated=d != '2026-08-15')  # one no date on purpose
add('2026-08-14', B('[[Amara Okoro]] went back to Leeds. House very quiet.'))
# the doctor and the hospital in plain words, no links, Provider empty (on purpose: a guess for a later piece, not a sure piece)
rec('postop', '2026-08-18', 'Post-op check with Dr. Patel. Wounds fine, I can drive in two weeks.',
    'Consultation', {'date': day(D('2026-08-18'))})
add('2026-08-19', B('Stopped the oxycodone. Paracetamol is enough now.'))
rec('chen-0820', '2026-08-20', 'First appointment with my oncologist, [[Dr. Mei Chen]]. Eight cycles of chemo, every two weeks from Sep 2.',
    'Consultation', {'date': day(D('2026-08-20')), 'provider': R('chen'), 'topic': R('crc')},
    [B('The drugs are [[Oxaliplatin]], [[Fluorouracil (5-FU)]] and [[Leucovorin]]. Bloods the day before each one.'),
     B('Why chemo if the surgery got it all? To mop up cells that may have spread through the lymph nodes.'), B('Decided: [[Eight cycles of FOLFOX, every two weeks from Sep 2]].'),
     T('Get a thermometer', 'done'), T('Dentist check before chemo', 'done', deadline='2026-08-28')])
for d, text in [('2026-08-21', 'Told the library I\'ll be off until the new year.'), ('2026-08-22', 'Ruth and I had a proper dinner out.'),
                ('2026-08-24', 'Dentist: all fine.'), ('2026-08-26', 'Line fitted for the chemo. Arm is sore.'),
                ('2026-08-27', 'Read the chemo booklet twice.'), ('2026-08-29', 'Weekend by the sea with Ruth.'), ('2026-08-30', 'Sea air. Slept ten hours.')]:
    add(d, B(text))
# a link to a page with no tag, Provider empty (on purpose): the plugin cannot know Hannah's quality
rec('diet', '2026-08-25', 'Video call with [[Hannah Reyes]], the dietitian. Little and often, and ginger for the nausea.',
    'Consultation', {'date': day(D('2026-08-25'))})

# --- Chemo cycles: an expectation each, done or planned; a blood count the day before; a rough few days after.
CYCLES = [(1, '2026-09-02'), (2, '2026-09-16'), (3, '2026-09-30'), (4, '2026-10-21'), (5, '2026-11-04'), (6, '2026-11-18'), (7, '2026-12-02'), (8, '2026-12-16')]
BOOKED_ON = {4: '2026-10-14', 5: '2026-10-14', 6: '2026-10-14', 7: '2026-10-19', 8: '2026-10-19'}
for n, when in CYCLES:
    w = D(when)
    past = w <= TODAY
    if past:
        # the day before: a plain line shaped like its siblings (on purpose: material for the tag-from-siblings guess)
        add(w - dt.timedelta(days=1), B(f'Bloods for tomorrow\'s chemo. Results: [[{ {1: "Blood count 2026-09-01", 2: "Blood count 2026-09-15", 3: "Blood count 2026-09-29"}[n] }]].'))
        rec(f'c{n}', w, f'Chemo cycle {n} done. [[Zoë Müller]] did the drip, pump home for two days.',
            'Treatment', {'date': day(w), 'agent': who('oxali', 'fu', 'leuco'), 'cycle': n})
        for k, (sym, text) in enumerate([('Nausea', '[[Nausea]] all evening.'), ('Fatigue', 'Wiped out all day.'),
                                         ('Cold sensitivity', 'Cold hurts my fingers, even the fridge door.'), ('Fatigue', 'A bit better. Still tired.')], start=1):
            dd = w + dt.timedelta(days=k)
            if dd > TODAY:
                break
            undated = (n == 2 and k in (1, 3)) or (n == 3 and k == 2)  # no date on purpose
            log(dd.isoformat(), text, sym, [3, 3, 2, 1][k - 1] + (1 if n == 2 else 0), dated=not undated)
    else:
        rec(f'c{n}', D(BOOKED_ON[n]), f'Chemo cycle {n}' + ('. Bring the pump bag back.' if n == 4 else ''),
            'Expectation', {'date': day(w), 'status': ch('status', 'Planned')})
add('2026-09-01', B('Nervous about tomorrow. [[Amara Okoro]] drove down.'))
add('2026-09-02', T('Take dexamethasone with breakfast days 1 to 3', 'done'))
add('2026-09-04', B('Pump off. Felt like a weight lifted, literally.'), T('Pick up the [[Ondansetron]] refill', 'done'))
add('2026-09-06', B('Good day. Walked into town.'))
add('2026-09-08', B('Amara left. Ruth and I back to normal routine, sort of.'))
add('2026-09-10', B('Best day since the operation.'))
add('2026-09-12', B('Weekend. [[Graham Whitlock]] came for lunch.'))
rec('acute', '2026-09-17', 'Rang the acute line about the [[Diarrhoea]]. [[Zoë Müller]] said loperamide and lots of water.',
    'Conversation', {'date': day(D('2026-09-17')), 'spoke-with': who('zoe'), 'topic': R('sym:Diarrhoea')})
add('2026-09-18', T('Drink three litres a day', 'doing'))
add('2026-09-22', B('Picked up again. Cooked for Ruth.'))
add('2026-09-24', B('Haircut number two. Thinning a bit at the front.'))
add('2026-09-26', B('Long talk with [[Tunde Okoro]]. He\'s coming at Christmas.'))
add('2026-10-01', B('Fingers tingle when I take milk from the fridge. Gloves on the fridge door now.'))
log('2026-10-03', '[[Tingling fingers]] worse today. Ruth says I should mention it.', 'Tingling fingers', 2)
add('2026-10-03', T('Tell Dr. Chen about the tingling', 'done', 'high'))
add('2026-10-05', B('Walked the river loop again, slowly.'))
rec('chen-1007', '2026-10-07', 'Video call with [[Dr. Mei Chen]] about the tingling. She\'s cutting the oxaliplatin by a quarter.',
    'Consultation', {'date': day(D('2026-10-07')), 'provider': R('chen'), 'topic': R('neuropathy')},
    [B('She thinks the tingling will mostly fade, but not always fully.'), B('Decided: [[Oxaliplatin reduced by a quarter from cycle 4]].')])
rec('x-ct2', '2026-10-07', 'CT scan after six cycles', 'Expectation', {'date': day(D('2026-11-12')), 'status': ch('status', 'Planned')},
    [T('Book the patient transport', 'todo', 'medium', '2026-11-05'), T('Nil by mouth from midnight', 'todo')], collapsed=True)
add('2026-10-08', B('Library sent flowers.'))
log('2026-10-09', '[[Tingling fingers]] again tonight, and tired.', 'Tingling fingers', 2, dated=False)  # no date on purpose
add('2026-10-12', T('Ask [[Dr. Helen Brooks]] about the flu jab', 'done'))
add('2026-10-13', B('Bloods for cycle 4 today: [[Blood count 2026-10-13]].'))
rec('moved', '2026-10-14', '[[Zoë Müller]] rang. Neutrophils too low, so cycle 4 moves to the 21st.',
    'Conversation', {'date': day(D('2026-10-14')), 'spoke-with': who('zoe'), 'topic': R('neutropenia')},
    [B('Annoyed and relieved at the same time. A free week.'), B('Decided: [[Cycle 4 delayed a week]].')])
rec('x-flu', '2026-10-14', 'Flu jab with [[Dr. Helen Brooks]]', 'Expectation', {'date': day(D('2026-11-06')), 'status': ch('status', 'Planned')})
add('2026-10-15', B('Free week. Went to the library to see everyone.'))
add('2026-10-16', B('Long lunch with [[Graham Whitlock]]. Talked about anything but this.'))
log('2026-10-17', 'Good energy today. Just the [[Tingling fingers]].', 'Tingling fingers', 1)
add('2026-10-18', B('Sunday. Made a list for the week.'), B(f'Rereading the first visit with the surgeon: [[{REC["patel-0709"]}]]'))
add('2026-10-19', B('Back on track for Wednesday. Feeling strong.'),
    B('This week', children=[T('Bloods tomorrow at Northgate', 'todo', 'high', '2026-10-20'), T('Charge the tablet for the chemo chair', 'todo'),
                             T('Order more [[Loperamide]]', 'todo', 'low', '2026-10-23')], collapsed=True))
rec('x-review', '2026-10-19', 'Review with [[Dr. Mei Chen]] after cycle 6', 'Expectation', {'date': day(D('2026-11-25')), 'status': ch('status', 'Planned')})
# today
add('2026-10-20', B('Bloods at [[Northgate]] this morning for cycle 4 tomorrow. Fingers crossed for the neutrophils.'))

# Ordinary days: a line on most days in between, with some skipped as real journals have.
FILLER = ['Slept badly.', 'Slept well for once.', 'Walked to the shop and back.', 'Ruth\'s sister rang.', 'Did the crossword with Ruth.',
          'Rain all day. Stayed in with a book.', 'Weeded the front bed.', 'Lunch with Graham.', 'Felt more like myself today.',
          'Watched the cricket.', 'Tired after lunch, napped.', 'Wrote a card to Tunde.', 'Made soup for the week.', 'Quiet day.']
d = D('2026-06-22')
while d <= TODAY:
    if d not in J and random.random() < 0.7:
        add(d, B(random.choice(FILLER)))
    d += dt.timedelta(days=1)


# ---------- Write ----------
journal_entries = []
for d in sorted(J):
    journal_entries.append('{:page {:build/journal ' + f'{d:%Y%m%d}' + '} :blocks [' + ' '.join(J[d]) + ']}')

home = ('{:page {:block/title "Care overview"} :blocks ['
        + B('Coming up', '[:logseq.class/Query]', {':logseq.property/query': s('(tags Expectation)')}) + ' '
        + B('Treatments', '[:logseq.class/Query]', {':logseq.property/query': s('(tags Treatment)')}) + ' '
        + B('Open to-dos', '[:logseq.class/Query]', {':logseq.property/query': s('(task todo doing)')}) + ' '
        + B('Medicines: [[Oxaliplatin]], [[Fluorouracil (5-FU)]], [[Leucovorin]], [[Ondansetron]], [[Loperamide]]') + ']}')

head = [';; Seed data for the Illness Test Graph (a fictional patient, Daniel Okoro). Made by test/illness-test-graph.py; edit that, not this.',
        ';; Shaped like the owner\'s map: few tags, one to three properties each, every record a sentence with its links. Rules: docs/MODELLING.md.',
        ';; Import into a graph made in the app; see GUIDE.md, "Graph ownership".',
        '{:properties', ' {' + '\n  '.join(f':user.property/{k} {v}' for k, v in P.items()) + '}',
        ' :classes', ' {' + '\n  '.join(f':user.class/{k} {v}' for k, v in C.items()) + '}']
out = head + [' :pages-and-blocks', ' [' + '\n  '.join([p for _, p in PAGES] + [home] + journal_entries) + ']}']
OUT.write_text('\n'.join(out) + '\n')
print(f'{OUT.name}: {OUT.stat().st_size // 1024} KB, {len(PAGES)} pages, {len(J)} journal days, {len(REC)} records')

# The same seed in three parts (GUIDE.md, "Chunk EDN imports"): the tags, properties and pages; then the journals in two halves.
split = D('2026-09-01')
early = [e for d, e in zip(sorted(J), journal_entries) if d < split]
late = [e for d, e in zip(sorted(J), journal_entries) if d >= split]
parts = [head + [' :pages-and-blocks', ' [' + '\n  '.join([p for _, p in PAGES] + [home]) + ']}'],
         head + [' :pages-and-blocks', ' [' + '\n  '.join(early) + ']}'],
         head + [' :pages-and-blocks', ' [' + '\n  '.join(late) + ']}']]
for i, lines in enumerate(parts, 1):
    path = OUT.with_name(f'illness-test-graph-{i}.edn')
    path.write_text('\n'.join(lines) + '\n')
    print(f'{path.name}: {path.stat().st_size // 1024} KB')
