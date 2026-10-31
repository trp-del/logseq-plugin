#!/usr/bin/env python3
"""Writes flesh-out.json: more of the Illness Test Graph (a fictional patient, Daniel Okoro, 58, colon cancer), for testing
what the plugin does on a bigger, less tidy graph. Nothing here is real.

It adds to the seed of logseq-db-refinements (test/illness-test-graph.py, whose pages and records it refers to by title) in
the seed's own voice and conventions: first person, short, a link only where one would naturally make one, a few records
half-filled on purpose.

  - the months before the diagnosis, 2026-01-05 to 2026-06-21: a tired man and a worried wife, two GP visits that find
    nothing, the first spots of blood in June (the seed's "third time this month" is June 22);
  - the days between and around the chemo cycles that the seed left bare, 2026-06-22 to 2026-10-28, and cycle 4 itself;
  - a wider cast: more people, doctors, symptoms, medicines, places, reports, and a few pages of reading.

The writer (tools/graph/write-in-app.js) puts it into the open graph through the plugin's own editor calls, so it merges
into journal days that already exist; every block has a fixed uuid, so running it twice adds nothing.

Property values are given by page title, so the writer can find the pages: {"node": [titles]}, {"day": "YYYY-MM-DD"},
{"choice": "Done"} (Status), or a plain number.
Run: python3 test/graph/flesh-out.py
"""
import datetime as dt
import json
import random
from pathlib import Path

random.seed(2027)
OUT = Path(__file__).with_name('flesh-out.json')
D = dt.date.fromisoformat
TODAY = D('2026-10-28')
SEED_TODAY = D('2026-10-20')

pages, journals, _n = [], {}, [0]
def uuid():
    _n[0] += 1
    return f'c2000000-0000-4000-8000-{_n[0]:012x}'
def page(title, tag=None, props=None, blocks=(), alias=None):
    pages.append({'title': title, 'tag': tag, 'props': props or {}, 'blocks': [{'uuid': uuid(), 'text': t} for t in blocks], 'alias': alias})
def add(d, text, tag=None, props=None, kids=()):
    d = D(d) if isinstance(d, str) else d
    journals.setdefault(d.isoformat(), []).append({'uuid': uuid(), 'text': text, 'tag': tag, 'props': props or {}, 'kids': [{'uuid': uuid(), 'text': k} for k in kids]})
node = lambda *t: {'node': list(t)}
dayof = lambda d: {'day': d if isinstance(d, str) else d.isoformat()}
pick = random.choice
chance = lambda p: random.random() < p

# ---------------------------------------------------------------- the cast
for name, note in [('Grace Mbeki', 'Ruth\'s sister, in Bristol. Rings on Sundays and worries out loud.'), ('Joan Harcourt', 'Next-door neighbour. Waters the garden when we are away.'),
                   ('Sam Doyle', 'Hosts the book group. Strong opinions about endings.'), ('Peter Lindgren', 'Fellow library volunteer. Does the Thursday shift with me.'),
                   ('Paula Reddy', 'Dr. Chen\'s secretary at Northgate. Answers on the second ring.'), ('Lena Park', 'District nurse. Takes the pump off on day 3.'),
                   ('Priya Lin', 'Pharmacist at Lakeside. Keeps the anti-sickness tablets behind the counter for me.'), ('Ngozi Okoro', 'Tunde\'s wife, in Lagos.'),
                   ('Callum Reid', 'Physiotherapist at Eastbridge Physio Clinic.'), ('Beth Navarro', 'Ruth\'s friend from the choir. Brings casseroles.')]:
    page(name, 'Person', {'Notes': note})
page('Dr. Tom Okonkwo', 'Doctor', {'Specialty': {'choice': 'General practice'}, 'Works at': node('Elm Street Medical Centre')}, ['Locum at Elm Street. Said it was probably IBS.'])
page('Dr. Julia Fenn', 'Doctor', {'Specialty': {'choice': 'Oncology'}, 'Works at': node('Northgate Cancer Center')}, ['Oncology registrar. Sees me when Dr. Chen is away; asks the practical questions.'])
page('Dr. Amir Haddad', 'Doctor', {'Works at': node('Riverside General Hospital')}, ['Radiologist. Reported the CT.'])
page('Eastbridge Physio Clinic', 'Organization', None, ['Callum does the walking programme. Ten minutes on the bike first.'])
page('Eastbridge Library', 'Organization', None, ['Volunteer shifts on Thursdays. The reading room radiator clanks.'])
page('Cancer Support Eastbridge', 'Organization', None, ['Drop-in on Tuesdays, tea and a leaflet for everything.'])
for name, desc in [('Insomnia', None), ('Headache', None), ('Constipation', None), ('Bloating', None), ('Taste changes', None), ('Hair thinning', None),
                   ('Dizziness', None), ('Low mood', None), ('Weight loss', None), ('Hiccups', None)]:
    page(name, 'Symptom')
page('Iron deficiency', 'Disease', {'Definition': 'Low iron stores, often from slow blood loss. Tiredness, pale skin, sometimes breathlessness.'})
page('Haemorrhoids', 'Disease', {'Definition': 'Swollen veins in the lower rectum. Common, usually harmless, and the first thing blood in the stool gets blamed on.'})
page('Irritable bowel syndrome', 'Disease', {'Definition': 'Cramps and changing bowel habit with no visible cause. A diagnosis of exclusion.'})
for name, target, regimen in [('Dexamethasone', 'Nausea', '8 mg with breakfast on days 1 to 3'), ('Paracetamol', 'Headache', '1 g up to four times a day'),
                              ('Oxycodone', 'Abdominal pain', '5 mg as needed after the operation'), ('Senna', 'Constipation', '2 tablets at night'),
                              ('Benzydamine mouthwash', 'Mouth sores', 'Rinse before meals'), ('Melatonin', 'Insomnia', '2 mg an hour before bed')]:
    page(name, 'Pharmacological Agent', {'Target': node(target), 'Therapy regimen': regimen})
page('Blood count 2026-02-12', 'Report', {'Date': dayof('2026-02-12'), 'Findings': 'Haemoglobin 128 g/L, borderline. Ferritin 22, low.'}, ['Ordered by [[Dr. Helen Brooks]]. Points at [[Iron deficiency]], maybe.'])
page('Stool test 2026-04-02', 'Report', {'Date': dayof('2026-04-02'), 'Findings': 'FIT 4 µg/g, below the threshold. Reassuring, they said.'}, ['I held on to that number for two months.'])
page('Blood count 2026-06-26 recheck', 'Report', {'Date': dayof('2026-06-26'), 'Findings': 'Ferritin 9. Haemoglobin 98.'})
page('Blood count 2026-10-27', 'Report', {'Date': dayof('2026-10-27'), 'Findings': 'Neutrophils 1.8, fine. Platelets fine.'}, ['For cycle 5. See [[Neutropenia]] for what low looks like.'])
page('CT report 2026-07-14, radiology', 'Report', {'Date': dayof('2026-07-14'), 'Findings': 'Two prominent nodes near the tumour, no distant disease.'}, ['Reported by [[Dr. Amir Haddad]].'])
page('Questions for Dr. Chen', 'research', None, ['Will the tingling go away? How long does it take?', 'Can I fly to Lagos between cycles 6 and 7?',
     'What do I do about the taste of metal?', 'Is a scan after cycle 6 standard, or because of the nodes?', 'Who do I ring at night?'])
page('Eating through chemo', 'research', None, ['Little and often. Cold food has less smell, which helps with [[Nausea]].', 'Ginger biscuits, plain pasta, scrambled egg. Rice pudding on the bad days.',
     'Mouth rinse before eating if there are [[Mouth sores]]. Soft food. Nothing sharp.', '[[Taste changes]]: metal on everything, tea tastes odd. Plastic cutlery helps, oddly.'])
page('Iron and bowel habit, notes before the colonoscopy', 'research', None, ['Iron deficiency in a man over fifty needs a cause found. Said the leaflet.', 'Which is what the colonoscopy was for.'])

# ---------------------------------------------------------------- words
LIFE = ['Slept badly again.', 'Up at six, watered the tomatoes before the heat.', 'Library shift. Re-shelved half the travel section.', 'Crossword done by ten. The cryptic was a stinker.',
        'Rain all day. Finished the Tuesday jigsaw.', 'Pasta bake for dinner. Too much cheese, no regrets.', 'Cricket on the radio while I sorted the shed.',
        'Took the car in for its MOT. Passed, just.', 'Dug over the vegetable bed. Back complained afterwards.', 'Walked the river loop. Herons everywhere.',
        'Cleared out the loft. Found my old chalkboard compass.', 'Marked the last of the old exam papers for the archive box.', 'Boiler man came. Forty minutes, ninety pounds.',
        'Nothing much. Read, mostly.', 'Made bread. It rose, which is the main thing.', 'The clocks go back soon and I am dreading the dark afternoons.',
        'Cut the hedge, then sat down for an hour.', 'Fixed the dripping tap with a new washer and a lot of swearing.', 'Quiet day. Radio, tea, a little tidying.',
        'Pottered in the garden until it rained.', 'Ruth\'s choir practice tonight. Had the house to myself.', 'Listened to the whole of the Brahms on the walk back.',
        'Posted the birthday card for Tunde, three weeks early because of the post.', 'Bought a new pair of reading glasses. The old ones are somewhere.',
        'Cooked a curry from scratch. Ruth had seconds.', 'Went through the bank statements. Boring but done.', 'Painted the fence. Half of it.',
        'Library: a child asked me whether books were free. Yes, I said, and he looked suspicious.', 'Stayed in bed with the paper until nine.',
        'The cat from number 12 sat on the bonnet again.', 'Short walk, then soup.', 'Finally reread the whole of Middlemarch. Eliot never lets you off.',
        'Washing, ironing, the usual. Radio 3 throughout.', 'Charity shop run. Dropped off four bags.', 'Watched the football with the sound down.']
LIFE_LINKS = ['[[Ruth Okoro]] and I went to the garden centre. She bought more pots than the patio can hold.', 'Lunch with [[Graham Whitlock]]. He talked about his knee; I let him.',
              '[[Joan Harcourt]] brought round a lemon cake.', 'Rang [[Grace Mbeki]] back. She asked after everyone and told me about her boiler.',
              'Book group at [[Sam Doyle]]\'s. We argued about the ending for an hour.', 'Did the Thursday shift at [[Eastbridge Library]] with [[Peter Lindgren]].',
              '[[Ruth Okoro]] made a lemon drizzle. I am not supposed to be hungry and yet.', 'Sunday roast at [[Graham Whitlock]]\'s. Slept in the chair afterwards.']
WORRY = ['Lay awake going over everything. Nothing new, just louder at night.', 'Googled again, which I promised not to.', 'Ruth watched me eat tonight. She says nothing, which says plenty.',
         'Tried not to think about Thursday. Thought about Thursday.', 'Stood on the scales. Lighter, and not on purpose.', 'Found myself counting the days in my head.']
GOOD = ['A proper good day. Walked into town and back.', 'Felt like myself for most of the afternoon.', 'Slept eight hours straight through.', 'Ate everything on the plate and asked for more.']

LOG = {  # symptom: [(text, link allowed)]
    'Fatigue': ['Flat as a pancake by three.', 'Tired all day, even after nine hours in bed.', 'Needed a nap after the library shift.', 'Fine until lunch, then nothing left.',
                'Could barely get up the stairs this evening.', 'Wiped out after a short walk.', 'Yawned through the whole film.', 'Legs like lead at the bus stop.'],
    'Abdominal pain': ['Cramps after dinner, over in an hour.', 'Sharp twinge low on the right when I bent down.', 'Dull ache on the left, comes and goes.', 'Belly cramping since breakfast.',
                       'Bad cramps in the night. Woke me at three.', 'Tender when I press low on the right.'],
    'Diarrhoea': ['Loose again this morning, twice.', 'Urgent and watery after lunch.', 'Three times before ten. Staying near the house.', 'Loose stools all day. Water and plain toast.'],
    'Constipation': ['Nothing for two days, then a lot of effort.', 'Hard going this morning. Senna tonight.', 'Blocked up and bloated.'],
    'Bloating': ['Tight as a drum after supper.', 'Bloated all afternoon, trousers undone under the table.', 'Wind and bloating. Peppermint tea did nothing.'],
    'Loss of appetite': ['Pushed food around the plate.', 'Not hungry at all. Forced down half a sandwich.', 'Lunch skipped, dinner half eaten.', 'Everything tastes of nothing.'],
    'Blood in stool': ['Blood on the paper this morning. Bright red.', 'Blood again, a little more this time.'],
    'Nausea': ['Queasy from the smell of the kitchen.', 'Nausea in waves until teatime.', 'Felt sick on the bus and had to get off.', 'Ginger biscuit and a lie-down. Passing slowly.'],
    'Tingling fingers': ['Pins and needles in the fingertips when I held the cold tap.', 'Fingers buzzing again at the keyboard.', 'Tingling all evening, worse than last week.', 'Dropped a cup. The fingers just would not grip.'],
    'Cold sensitivity': ['Opened the freezer and winced.', 'Cold air hurt my throat on the walk.', 'Even the fridge handle stings.', 'Had to drink my water at room temperature.'],
    'Mouth sores': ['Sore patch on the tongue, hurts to eat.', 'Three little ulcers inside the cheek.', 'Mouth sore, mouthwash before every meal.'],
    'Taste changes': ['Tea tastes of metal.', 'Everything tastes slightly wrong, like pennies.', 'Could not face coffee at all.'],
    'Insomnia': ['Awake from two to five.', 'Could not switch my head off.', 'Slept in two hours at a time.'],
    'Headache': ['Dull headache behind the eyes all morning.', 'Banging headache, paracetamol and a dark room.'],
    'Dizziness': ['Stood up too fast and the room tilted.', 'Light-headed on the stairs.'],
    'Low mood': ['Flat and grey, no reason I can name.', 'Cried at the news, which is not like me.'],
    'Weight loss': ['Down another kilo on the scales.', 'Belt on the last hole.'],
    'Hair thinning': ['Hair on the pillow again.', 'A lot of hair in the brush this morning.'],
    'Hiccups': ['Hiccups for two hours after the drip.'],
}
SEV_NOTE = {1: ['mild'], 2: ['noticeable'], 3: ['bad'], 4: ['awful'], 5: ['the worst yet']}

def log(d, symptom, severity, linked=None, dated=True, typed=True, text=None):
    text = text or pick(LOG[symptom])
    if linked or (linked is None and chance(0.3)):
        text = f'[[{symptom}]]: ' + text[0].lower() + text[1:] if chance(0.5) else text + f' [[{symptom}]].'
    props = {'Severity': severity}
    if typed: props['Symptom type'] = node(symptom)
    if dated: props['Date'] = dayof(d)
    add(d, text, 'Symptom Log', props)

def consult(d, who, words, topic=None, dated=True, kids=(), provider=True):
    props = {}
    if dated: props['Date'] = dayof(d)
    if provider and who: props['Provider'] = node(who)
    if topic: props['Topic'] = node(topic)
    add(d, words, 'Consultation', props, kids)

def chat(d, who, words, topic=None, dated=True, kids=()):
    props = {}
    if dated: props['Date'] = dayof(d)
    if who: props['Spoke with'] = node(*who)
    if topic: props['Topic'] = node(topic)
    add(d, words, 'Conversation', props, kids)

def expect(d, written, words, status='Done', kids=()):
    add(written, words, 'Expectation', {'Date': dayof(d), 'Status': {'choice': status}}, kids)

# ---------------------------------------------------------------- before the diagnosis: 2026-01-05 .. 2026-06-21
add('2026-01-05', 'New year, the list: eat less sugar, walk every day, finish the shed. Ruth wants a holiday in the spring.')
add('2026-01-17', 'First book group of the year at [[Sam Doyle]]\'s. We read the Ishiguro. Nobody finished it.')
add('2026-02-09', 'Tired for a week now. Ruth says I look pale, which I put down to January.')
expect('2026-02-12', '2026-02-09', 'Appointment with [[Dr. Helen Brooks]] on Thursday about the tiredness. Ruth made me.')
consult('2026-02-12', 'Dr. Helen Brooks', 'Saw [[Dr. Helen Brooks]] about being tired all the time. She took bloods and said it is probably the winter.', 'Fatigue',
        kids=['She asked about my bowels, almost in passing. Said they were a bit unpredictable lately.'])
chat('2026-02-14', ['Dr. Helen Brooks'], '[[Dr. Helen Brooks]] rang. Haemoglobin borderline, iron on the low side. Eat red meat and greens and she\'ll recheck in the summer.', 'Iron deficiency')
add('2026-02-14', 'Result is in the notes: [[Blood count 2026-02-12]].')
expect('2026-06-25', '2026-02-14', 'Recheck bloods at the end of June', 'Done')
chat('2026-03-02', ['Grace Mbeki'], '[[Grace Mbeki]] rang. Told her I\'m just tired. She told me to see a specialist; she tells everyone that.')
consult('2026-03-20', 'Dr. Tom Okonkwo', 'Saw [[Dr. Tom Okonkwo]], a locum, about the cramps and the loose stools. He said it sounds like IBS and gave me a leaflet about fibre.', 'Abdominal pain',
        kids=['He was in a hurry. I left feeling slightly silly for having come.'])
add('2026-03-21', 'Looked up [[Irritable bowel syndrome]]. It fits, more or less. Relieved, and slightly unconvinced.')
add('2026-04-01', 'Stool sample kit came in the post. Not the most dignified task.')
expect('2026-04-02', '2026-04-01', 'Hand the stool sample in at Elm Street on Thursday', 'Done')
add('2026-04-04', 'Handed in the sample. Result in a week, said the receptionist.')
chat('2026-04-09', ['Dr. Helen Brooks'], 'Surgery rang. The stool test is fine. Below the threshold, so no further tests for now.', 'Irritable bowel syndrome')
add('2026-04-09', 'Result: [[Stool test 2026-04-02]]. Told Ruth, who looked relieved and then asked why I\'m still so tired.')
add('2026-04-12', 'Amara and the grandchildren, no, Amara and her boyfriend, Easter weekend. Roast lamb. I could not finish my plate.')
chat('2026-04-20', ['Amara Okoro'], '[[Amara Okoro]] said on the phone that I sounded thin. Said I was fine, which I said last time.')
add('2026-05-03', 'Ruth booked the holiday for September. I did not say that I wasn\'t sure I would manage the walking.')
add('2026-05-18', 'Weighed myself. Seventy-seven kilos. A year ago I was eighty-three.')
chat('2026-05-24', ['Peter Lindgren'], 'Peter at the library asked whether I was all right. I said never better. He didn\'t look convinced.')
add('2026-06-04', 'Blood on the paper this morning. A little. Haemorrhoids, I told myself.')
log('2026-06-04', 'Blood in stool', 2, linked=False)
add('2026-06-08', 'Ruth asked whether I\'ve been to the loo more often than usual. I said no.')
add('2026-06-13', 'Again this morning. More than before. I have not looked it up, and I am not going to.')
log('2026-06-13', 'Blood in stool', 2, linked=False, dated=False)
add('2026-06-18', 'Could not sleep. The same thought round and round. I should ring the surgery.')
add('2026-06-21', 'Sunday. Ruth\'s choir sang at the church fair. I sat at the back and sweated through it.')

# arcs: how the symptoms creep in before the diagnosis
def arc(day):
    t = (day - D('2026-01-05')).days / 168
    return {'Fatigue': (0.05 + 0.45 * t, 1 + int(2.2 * t)), 'Abdominal pain': (0.02 + 0.30 * t, 1 + int(1.8 * t)), 'Diarrhoea': (0.02 + 0.2 * t, 1 + int(1.5 * t)),
            'Constipation': (0.03 + 0.1 * t, 1 + int(1.2 * t)), 'Bloating': (0.03 + 0.2 * t, 1 + int(1.5 * t)), 'Loss of appetite': (0.0 + 0.22 * t, 1 + int(2 * t)),
            'Weight loss': (0.0 + 0.05 * t, 1 + int(1.5 * t)), 'Insomnia': (0.02 + 0.12 * t, 1 + int(2 * t))}
d = D('2026-01-05')
while d < D('2026-06-22'):
    day = d.isoformat()
    if day not in journals:
        if chance(0.62):
            add(d, pick(LIFE_LINKS) if chance(0.2) else pick(LIFE))
            if chance(0.25): add(d, pick(LIFE))
        if d.weekday() == 3 and chance(0.7): add(d, 'Library shift. Quiet, mostly.' if chance(0.5) else pick(LIFE_LINKS[4:6]))
        if d > D('2026-03-15') and chance(0.12): add(d, pick(WORRY))
        if chance(0.12): add(d, pick(GOOD))
        for symptom, (p, sev) in arc(d).items():
            if chance(p * 0.55):
                log(d, symptom, min(sev, 3), dated=chance(0.88), typed=chance(0.93))
    d += dt.timedelta(days=1)

# ---------------------------------------------------------------- treatment period gaps: 2026-06-22 .. 2026-10-20
# Chemo cycles from the seed: day 0 = the drip; the rough days follow a pattern.
CYCLE_DAYS = [D(x) for x in ['2026-09-02', '2026-09-16', '2026-09-30']]
def after_chemo(d):
    for c in CYCLE_DAYS:
        k = (d - c).days
        if 1 <= k <= 13: return k
    return None
d = D('2026-06-22')
while d <= SEED_TODAY:
    k = after_chemo(d)
    day = d.isoformat()
    if k is not None:
        if k <= 4 and chance(0.55): log(d, pick(['Nausea', 'Fatigue', 'Cold sensitivity', 'Hiccups', 'Taste changes']), pick([2, 3, 3, 4]), dated=chance(0.9))
        elif k <= 9 and chance(0.4): log(d, pick(['Tingling fingers', 'Mouth sores', 'Diarrhoea', 'Fatigue', 'Taste changes', 'Insomnia']), pick([1, 2, 2, 3]), dated=chance(0.9))
        elif chance(0.25): log(d, pick(['Fatigue', 'Tingling fingers', 'Low mood']), pick([1, 1, 2]), dated=chance(0.9))
    elif d < D('2026-09-02') and chance(0.18):
        log(d, pick(['Fatigue', 'Abdominal pain', 'Insomnia', 'Weight loss']), pick([1, 2]), dated=chance(0.9))
    if chance(0.5): add(d, pick(LIFE_LINKS) if chance(0.2) else pick(LIFE))
    if chance(0.12): add(d, pick(WORRY))
    if chance(0.1): add(d, pick(GOOD))
    d += dt.timedelta(days=1)

# a few scripted extras inside the treatment period
chat('2026-07-05', ['Ruth Okoro'], 'Ruth and I talked until midnight. About the children, about what she wants me to say to them.', 'Colon cancer')
chat('2026-07-12', ['Grace Mbeki'], '[[Grace Mbeki]] rang, in tears. I ended up comforting her. Typical.', 'Colon cancer')
consult('2026-07-22', 'Dr. Kenji Watanabe', 'Pre-op call with [[Dr. Kenji Watanabe]], the anaesthetist. Asked about teeth, allergies, my last meal. Calm voice.', None, kids=['He said I would feel nothing and I decided to believe him.'])
chat('2026-08-07', ['Marcus Bell'], 'Marcus on 6B showed me the walking route round the ward. Three laps, then a biscuit.')
consult('2026-08-31', 'Dr. Julia Fenn', 'Saw [[Dr. Julia Fenn]], the registrar, for the chemo teaching session. She went through every side effect and had me repeat the emergency numbers.', 'Colon cancer',
        kids=['Temperature of 38 or over: ring the acute line straight away. Do not wait to see.'])
add('2026-09-07', 'Gave away the shed project, for now. Ruth says it will still be there when I\'m better.')
chat('2026-09-21', ['Lena Park'], 'Lena the district nurse came about the dressing on the line. Very gentle. Said the arm was healing nicely.', None)
add('2026-09-25', 'Cancer Support drop-in with [[Ruth Okoro]]. Too many leaflets, but the tea was good and I liked the woman running it.')
chat('2026-10-02', ['Callum Reid'], 'First physio session with [[Callum Reid]]. Ten minutes on the bike, then stretching for the fingers.', 'Tingling fingers')
expect('2026-10-09', '2026-10-02', 'Physio on Friday', 'Done')
chat('2026-10-15', ['Paula Reddy'], 'Rang [[Paula Reddy]] about moving the scan. She\'ll ring back when she has a date.', None)
chat('2026-10-12', ['Priya Lin'], '[[Priya Lin]] at Lakeside had the loperamide ready before I\'d asked. Bless her.', 'Diarrhoea')
add('2026-10-18', 'Reread [[Questions for Dr. Chen]] and added three more.')

# ---------------------------------------------------------------- after the seed: cycle 4 and since, 2026-10-21 .. 2026-10-28
consult('2026-10-21', 'Dr. Julia Fenn', 'Saw [[Dr. Julia Fenn]] before the drip. Neutrophils recovered, tingling stable at grade 1. Cleared for cycle 4 at the lower dose.', 'Peripheral neuropathy')
add('2026-10-21', 'Chemo cycle 4 done. [[Zoë Müller]] did the drip, pump home for two days.', 'Treatment',
    {'Date': dayof('2026-10-21'), 'Agent': node('Oxaliplatin', 'Fluorouracil (5-FU)', 'Leucovorin'), 'Cycle': 4})
log('2026-10-21', 'Cold sensitivity', 3, linked=True)
log('2026-10-22', 'Nausea', 3, linked=True)
log('2026-10-22', 'Fatigue', 3)
add('2026-10-22', 'Dexamethasone with breakfast, ginger biscuit, bed by nine. Ruth fussing, which I let her do.')
chat('2026-10-23', ['Lena Park'], '[[Lena Park]] came to take the pump off. She remembered the arm from last time.')
log('2026-10-23', 'Taste changes', 2)
log('2026-10-24', 'Tingling fingers', 2, linked=True)
log('2026-10-24', 'Mouth sores', 2)
add('2026-10-24', 'Weekend. [[Graham Whitlock]] brought the paper round and stayed for a cup of tea.')
add('2026-10-25', 'Sunday walk, shorter than last week. [[Ruth Okoro]] took my arm without asking.')
log('2026-10-25', 'Fatigue', 2)
log('2026-10-26', 'Insomnia', 2, dated=False)
chat('2026-10-26', ['Tunde Okoro', 'Ngozi Okoro'], 'Video call with [[Tunde Okoro]] and [[Ngozi Okoro]]. They have booked flights for the week before Christmas.', None)
add('2026-10-27', 'Bloods at [[Northgate]] for cycle 5. Result: [[Blood count 2026-10-27]]. Better than I feared.')
expect('2026-11-04', '2026-10-27', 'Chemo cycle 5 on the 4th of November', 'Planned')
add('2026-10-28', 'Feeling stronger today. Wrote out Christmas lunch and then crossed half of it out.')
add('2026-10-28', 'The shed is still unfinished. Ruth says that is a reason to get better.')

# ---------------------------------------------------------------- more records: visits, calls, things coming up, reports, decisions
ISSUE = {'Fatigue': ['being so tired', 'the tiredness', 'how wiped out I get'], 'Tingling fingers': ['the tingling in my fingers', 'the pins and needles'],
         'Nausea': ['the nausea', 'feeling sick after the drip'], 'Diarrhoea': ['the diarrhoea', 'the loose stools'], 'Mouth sores': ['the mouth ulcers', 'the sore mouth'],
         'Abdominal pain': ['the cramps', 'the pain on my right side'], 'Taste changes': ['everything tasting of metal', 'the taste changes'],
         'Insomnia': ['not sleeping', 'the nights awake'], 'Weight loss': ['the weight I have lost', 'my weight'], 'Cold sensitivity': ['how the cold hurts my fingers', 'the cold sensitivity'],
         'Low mood': ['feeling low', 'my mood'], 'Anaemia': ['the iron levels', 'the anaemia'], 'Colon cancer': ['the plan', 'how the treatment is going', 'what happens next']}
OUTCOME = ['She wants bloods again next week.', 'Nothing to do but wait and see.', 'Said to keep a diary of it, which I already do.', 'Prescribed something for it.', 'Reassuring, mostly.',
           'Booked a follow-up in two weeks.', 'Ruth took notes.', 'Asked me to ring if it gets worse.', 'We agreed to leave things as they are for now.', 'Left with a leaflet and a plan.',
           'Weighed me. Down again.', 'Listened properly, which is rarer than it should be.', 'Short appointment, long wait.']
def doc_plain(name): return name.replace('Dr. ', 'Dr. ')
def consults(doctors, start, end, n, topics, places=None):
    days = [start + dt.timedelta(days=i) for i in range((end - start).days + 1)]
    for d in sorted(random.sample(days, min(n, len(days)))):
        doc = pick(doctors); topic = pick(topics); issue = pick(ISSUE[topic]); out = pick(OUTCOME)
        link = f'[[{doc}]]' if chance(0.65) else doc.replace('Dr. ', 'Dr. ')
        frame = pick([f'Saw {link} about {issue}. {out}', f'Video call with {link} about {issue}. {out}', f'Appointment with {link}: {issue}. {out}',
                      f'Clinic. {link} went through {issue}. {out}', f'Saw {link}. Mostly {issue}. {out}'])
        consult(d, doc, frame, topic, dated=chance(0.9), provider=chance(0.88))
FAMILY = {'Ruth Okoro': ['[[Ruth Okoro]] and I talked it through again over supper. {t}', 'Long talk with [[Ruth Okoro]] after the news. {t}', 'Ruth asked again how I am really. {t}'],
          'Amara Okoro': ['[[Amara Okoro]] rang. {t}', 'Video call with [[Amara Okoro]]. She wants to come down at the weekend. {t}', 'Talked to [[Amara Okoro]] for an hour. {t}'],
          'Tunde Okoro': ['[[Tunde Okoro]] rang from Lagos. {t}', 'Video call with [[Tunde Okoro]]. The line kept dropping. {t}', 'Message from [[Tunde Okoro]], then a call. {t}'],
          'Grace Mbeki': ['[[Grace Mbeki]] rang. {t}', 'Sunday call with [[Grace Mbeki]]. {t}'], 'Graham Whitlock': ['[[Graham Whitlock]] rang about the football. {t}', 'Coffee with [[Graham Whitlock]]. {t}'],
          'Sam Doyle': ['[[Sam Doyle]] rang about book group. {t}'], 'Peter Lindgren': ['[[Peter Lindgren]] rang to ask how I am. {t}'], 'Beth Navarro': ['[[Beth Navarro]] dropped off a casserole. {t}'],
          'Joan Harcourt': ['Chatted with [[Joan Harcourt]] over the fence. {t}']}
TALK = ['She worries too much.', 'We mostly talked about nothing, which was the point.', 'I said I was fine; she did not believe me.', 'It helped.', 'Made me laugh, first time in days.',
        'I got off the phone and felt lighter.', 'She wants regular updates.', 'Too tired to talk long, but glad I did.', 'We agreed not to Google.', 'Plans for the autumn, loosely.', '']
NURSE = {'Zoë Müller': ['[[Zoë Müller]] rang to check how I got on after the drip. {t}', 'Rang the day unit and got [[Zoë Müller]]. {t}'], 'Lena Park': ['[[Lena Park]] called about the pump. {t}'],
         'Paula Reddy': ['Rang [[Paula Reddy]] to move an appointment. {t}'], 'Priya Lin': ['[[Priya Lin]] rang to say the prescription was ready. {t}'], 'Marcus Bell': ['[[Marcus Bell]] rang to see how the wound is. {t}']}
NURSE_T = ['Told me what to watch for.', 'Reassuring.', 'She has heard it all before, which helps.', 'Sorted in two minutes.', 'Asked me to ring again tomorrow if it is no better.']
def talks(start, end, n, bank, notes, topics=None):
    days = [start + dt.timedelta(days=i) for i in range((end - start).days + 1)]
    for d in sorted(random.sample(days, min(n, len(days)))):
        who = pick(list(bank)); t = pick(notes).strip()
        words = pick(bank[who]).format(t=t).strip()
        chat(d, [who] if chance(0.9) else None, words, pick(topics) if topics and chance(0.35) else None, dated=chance(0.9))
THING = [('Bloods', 'Bloods'), ('Dentist', 'Dentist'), ('Physio', 'Physio'), ('Clinic with [[Dr. Mei Chen]]', 'Clinic with Dr. Chen'), ('Scan results', 'Scan results'), ('Flu jab', 'Flu jab'),
         ('Eye test', 'Eye test'), ('Hair cut', 'Hair cut'), ('Support group', 'Support group'), ('Pharmacy collection', 'Pharmacy collection'), ('Dietitian call', 'Dietitian call')]
def expects(start, end, n):
    days = [start + dt.timedelta(days=i) for i in range((end - start).days + 1)]
    for d in sorted(random.sample(days, min(n, len(days)))):
        ahead = random.randint(2, 12); event = d + dt.timedelta(days=ahead)
        # the oncology clinic only exists from Aug 20; clinics are not on weekends
        things = [t for t in THING if 'Chen' not in t[0] or event >= D('2026-08-20')]
        text, plain = pick(things)
        while event.weekday() >= 5 and ('Clinic' in text or 'Bloods' in text or 'Dentist' in text or 'Physio' in text):
            event += dt.timedelta(days=1); ahead += 1
        when = pick([f'on {event.strftime("%A")}', f'next {event.strftime("%A")}', f'on the {event.day}th'.replace('1th', '1st').replace('2th', '2nd').replace('3th', '3rd')]) if ahead > 7 else f'on {event.strftime("%A")}'
        if ahead == 1: when = 'tomorrow'
        status = 'Done' if event <= TODAY else 'Planned'
        if status == 'Done' and chance(0.1): status = pick(['Moved', 'Missed'])
        expect(event, d, f'{text} {when}', status)

consults(['Dr. Helen Brooks', 'Dr. Tom Okonkwo'], D('2026-01-10'), D('2026-06-20'), 7, ['Fatigue', 'Abdominal pain', 'Weight loss', 'Diarrhoea', 'Anaemia'])
# who he can have seen when: the surgeon and the GP before the oncologist took over on Aug 20, the oncology team after
consults(['Dr. Raj Patel', 'Dr. Helen Brooks'], D('2026-07-22'), D('2026-08-19'), 5, ['Colon cancer', 'Anaemia', 'Abdominal pain', 'Fatigue', 'Weight loss'])
consults(['Dr. Mei Chen', 'Dr. Julia Fenn', 'Dr. Helen Brooks'], D('2026-08-21'), D('2026-10-19'), 16,
         ['Colon cancer', 'Fatigue', 'Nausea', 'Diarrhoea', 'Tingling fingers', 'Mouth sores', 'Taste changes', 'Insomnia', 'Weight loss', 'Low mood'])
BEFORE = {**{k: FAMILY[k] for k in ['Amara Okoro', 'Tunde Okoro', 'Grace Mbeki', 'Graham Whitlock', 'Sam Doyle', 'Peter Lindgren', 'Joan Harcourt']},
          'Ruth Okoro': ['Ruth asked again how I am, really. {t}', '[[Ruth Okoro]] and I talked about the holiday over supper. {t}']}
talks(D('2026-01-08'), D('2026-06-21'), 22, BEFORE, ['She worries too much.', 'It helped.', 'We mostly talked about nothing.', 'Said I was fine.', 'Made me laugh.', 'Too tired to talk long.', ''],
      ['Fatigue', 'Weight loss', 'Abdominal pain'])
talks(D('2026-06-23'), D('2026-10-19'), 62, FAMILY, TALK, ['Colon cancer', 'Fatigue', 'Nausea', 'Tingling fingers'])
talks(D('2026-08-21'), D('2026-10-19'), 24, NURSE, NURSE_T, ['Nausea', 'Diarrhoea', 'Mouth sores', 'Tingling fingers', 'Neutropenia', 'Fatigue'])
talks(D('2026-10-21'), D('2026-10-28'), 4, {**FAMILY, **NURSE}, TALK + NURSE_T, ['Fatigue', 'Nausea', 'Tingling fingers'])
expects(D('2026-01-08'), D('2026-06-19'), 10)
expects(D('2026-06-23'), D('2026-10-18'), 34)
expects(D('2026-10-21'), D('2026-10-25'), 3)

for on, found, note in [('2026-09-08', 'Neutrophils 2.4. Platelets fine.', None), ('2026-09-22', 'Neutrophils 1.9. A little low but acceptable.', None),
                        ('2026-10-06', 'Neutrophils 1.3. Borderline. Watching it.', 'The tingling is the other thing on the list at the next clinic.'),
                        ('2026-10-20', 'Neutrophils 2.2. Recovered. Cycle 4 can go ahead tomorrow.', None)]:
    page(f'Blood count {on}', 'Report', {'Date': dayof(on), 'Findings': found}, [note] if note else [])
    add(on, f'Bloods at [[Northgate]] today. Result: [[Blood count {on}]].')
for title, by, on, body in [('Iron tablets first, and the colonoscopy within the fortnight', 'Dr. Helen Brooks', '2026-06-25', 'Her words: do not wait for the tablets to work before looking for the cause.'),
                            ('No flights until the scan after cycle 6', 'Dr. Mei Chen', '2026-10-21', 'Because the dates may shift if the neutrophils dip again.'),
                            ('Physio twice a week for the fingers', 'Dr. Julia Fenn', '2026-10-21', 'Callum at the clinic; ten minutes on the bike first.')]:
    page(title, 'Decision', {'Decided by': node(by), 'Date': dayof(on)}, [body])

# ---------------------------------------------------------------- check the titles
import re
SEED_TITLES = {'Riverside General Hospital', 'Northgate Cancer Center', 'Elm Street Medical Centre', 'Medlab Diagnostics', 'Lakeside Pharmacy', 'Daniel Okoro', 'Ruth Okoro', 'Amara Okoro', 'Tunde Okoro',
               'Graham Whitlock', 'Zoë Müller', 'Marcus Bell', 'Hannah Reyes', 'Dr. Mei Chen', 'Dr. Raj Patel', 'Dr. Sofia Alvarez', 'Dr. Helen Brooks', 'Dr. Kenji Watanabe', 'Fatigue', 'Nausea',
               'Abdominal pain', 'Diarrhoea', 'Tingling fingers', 'Cold sensitivity', 'Blood in stool', 'Loss of appetite', 'Mouth sores', 'Colon cancer', 'Anaemia', 'Peripheral neuropathy', 'Neutropenia',
               'Oxaliplatin', 'Fluorouracil (5-FU)', 'Leucovorin', 'Ondansetron', 'Loperamide', 'Ferrous sulphate', 'Dr. Chen', 'Riverside', 'Northgate', 'CRC', '5-FU'}
known = SEED_TITLES | {p['title'] for p in pages}
used = set()
def scan(text): used.update(re.findall(r'\[\[([^\]]+)\]\]', text))
def scan_props(props):
    for v in props.values():
        if isinstance(v, dict) and 'node' in v: used.update(v['node'])
for p in pages:
    scan_props(p['props']); [scan(b['text']) for b in p['blocks']]
for v in journals.values():
    for b in v:
        scan(b['text']); scan_props(b['props']); [scan(k['text']) for k in b['kids']]
missing = sorted(used - known)
if missing: raise SystemExit(f'pages the content points at but nobody makes: {missing}')

# ---------------------------------------------------------------- write
total = sum(1 + len(b['kids']) for v in journals.values() for b in v) + sum(len(p['blocks']) for p in pages)
data = {'pages': pages, 'journals': {k: journals[k] for k in sorted(journals)},
        'about': 'Fictional additions to the Illness Test Graph. Made by test/graph/flesh-out.py.'}
OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1))
tagged = {}
for v in journals.values():
    for b in v: tagged[b['tag'] or '(none)'] = tagged.get(b['tag'] or '(none)', 0) + 1
print(f'{OUT.name}: {OUT.stat().st_size // 1024} KB, {len(pages)} pages, {len(journals)} journal days, {total} blocks')
print('by tag:', dict(sorted(tagged.items(), key=lambda x: -x[1])))
