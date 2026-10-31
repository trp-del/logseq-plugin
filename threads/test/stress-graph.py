#!/usr/bin/env python3
"""Writes test/stress-graph-N.edn: a large graph for stress testing the proposals (2026-10-21, at the owner's word:
"stress test on large graph").

It is the Illness Test Graph's seed (same tags, properties and pages, imported first) plus six and a half years of
journals before it, 2020-01-01 to 2026-06-21, written by templates with varied words: about 2,400 journal days,
some 25,000 bullets, and 3,000 more pages (doctors, nurses, symptoms, medicines, hospitals), many with shared
surnames so naming in plain words is hard. Every record carries its true values, so the scorer can judge the
proposals on it as on the seed. Fixed ids and a fixed random seed: importing twice changes nothing.

Import into a scratch graph made with the command line (never one of the owner's): the seed's three parts first,
then these, in order of their number (the first three are pages, then a month per file) (GUIDE.md, "Chunk EDN imports").
Run: python3 test/stress-graph.py
"""
import datetime as dt
import random
import runpy
from pathlib import Path

HERE = Path(__file__).parent
seed = runpy.run_path(str(HERE / 'illness-test-graph.py'))  # rewrites the seed files unchanged (fixed random seed)
B, page, R, refs, day, ch, s, new_id, tags = (seed[k] for k in ['B', 'page', 'R', 'refs', 'day', 'ch', 's', 'new_id', 'tags'])
ID, PAGES = seed['ID'], seed['PAGES']
head = seed['head']
random.seed(2026)
pages_before = len(PAGES)

# ---------- Many more pages ----------
FIRST = ['Anna', 'Ben', 'Chloe', 'David', 'Ella', 'Farid', 'Grace', 'Hugo', 'Ines', 'Jamal', 'Kira', 'Liam', 'Mina', 'Noah',
         'Olga', 'Pavel', 'Quinn', 'Rosa', 'Sami', 'Tara', 'Umar', 'Vera', 'Wen', 'Yusuf', 'Zara']
LAST = ['Adams', 'Baker', 'Chen', 'Diaz', 'Evans', 'Fischer', 'Garcia', 'Hughes', 'Ito', 'Jones', 'Khan', 'Lopez', 'Moreau',
        'Nowak', 'Okafor', 'Patel', 'Quist', 'Rossi', 'Silva', 'Taylor', 'Usman', 'Vogel', 'Walsh', 'Young', 'Zhou']
TITLE = {}
used = set()
def add_page(key, title, tag, fields=None):
    TITLE[key] = title
    page(key, title, tag, fields)
    return key
def person_name(prefix=''):
    while True:
        n = f'{prefix}{random.choice(FIRST)} {random.choice(LAST)}'
        if n not in used:
            used.add(n); return n
SYLL = ['ka', 'lo', 'mi', 'ra', 'te', 'su', 'no', 'vi', 'de', 'po', 'zu', 'ber', 'tal', 'gon', 'ris', 'mel']
def word(n=3):
    return ''.join(random.choice(SYLL) for _ in range(n))
def unique(make):
    while True:
        t = make()
        if t not in used:
            used.add(t); return t
doctors = [add_page(f'sdoc{i}', person_name('Dr. '), 'Doctor', {'specialty': ch('specialty', random.choice(['Oncology', 'Gastroenterology', 'General practice']))}) for i in range(500)]
people = [add_page(f'sper{i}', person_name(), 'Person') for i in range(400)]
symptoms = [add_page(f'ssym{i}', unique(lambda: f'{word(2).capitalize()} {word(3)}'), 'Symptom') for i in range(300)]
agents = [add_page(f'sagent{i}', unique(lambda: word(3).capitalize() + random.choice(['mab', 'nib', 'platin', 'cillin', 'zole'])), 'Pharmacological Agent') for i in range(1500)]
hospitals = [add_page(f'shosp{i}', unique(lambda: f'{word(2).capitalize()} {random.choice(["General", "Royal", "City", "County"])} Hospital'), 'Hospital') for i in range(300)]
# Each symptom has its own few words, the way "tired", "wiped out", "flagging" go with Fatigue.
sym_words = {k: [word(2) for _ in range(4)] for k in symptoms}
TOPICS = symptoms[:120] + ['anaemia', 'crc', 'neutropenia']

# ---------- Journals, 2020-01-01 to 2026-06-21 ----------
J = {}
def add(d, *blocks): J.setdefault(d, []).extend(blocks)
FILLER = [' '.join(word(random.choice([1, 2])) for _ in range(random.randint(3, 9))).capitalize() + '.' for _ in range(400)]
WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
my_doctors = random.sample(doctors, 40)       # a person sees some doctors again and again
my_people = random.sample(people, 30)
my_symptoms = random.sample(symptoms, 60)
my_agents = random.sample(agents, 25)
records = bullets = 0
d = dt.date(2020, 1, 1)
END = dt.date(2026, 6, 21)
while d <= END:
    for _ in range(random.randint(4, 16)):
        bullets += 1
        r = random.random()
        if r < .35:
            add(d, B(random.choice(FILLER)))
            continue
        records += 1
        if r < .55:
            k = random.choice(my_symptoms[:20] if random.random() < .7 else my_symptoms)
            words = ' '.join(random.sample(sym_words[k], 2) + [word(2)]).capitalize()
            if random.random() < .25: words += f', the [[{TITLE[k]}]] again'
            add(d, B(words + '.', 'Symptom Log', {'date': day(d), 'symptom-type': R(k), 'severity': random.randint(1, 5)}))
        elif r < .65:
            k = random.choice(my_doctors)
            add(d, B(f'Saw [[{TITLE[k]}]] about the {word(2)} {word(2)}.', 'Consultation', {'date': day(d), 'provider': R(k), 'topic': R(random.choice(TOPICS))}))
        elif r < .75:
            k = random.choice(my_people + my_doctors[:10])
            add(d, B(f'[[{TITLE[k]}]] rang. {word(2).capitalize()} {word(3)}.', 'Conversation', {'date': day(d), 'spoke-with': refs([ID[k]]), 'topic': R(random.choice(TOPICS))}))
        elif r < .83:
            k = random.choice(my_agents); n = random.randint(1, 12)
            add(d, B(f'{TITLE[k]} cycle {n} done.', 'Treatment', {'date': day(d), 'agent': refs([ID[k]]), 'cycle': n}))
        elif r < .93:
            when = d + dt.timedelta(days=random.randint(1, 6))
            add(d, B(f'{word(2).capitalize()} scan on {WEEKDAYS[when.weekday()]}', 'Expectation', {'date': day(when), 'status': ch('status', random.choice(['Done', 'Planned', 'Moved']))}))
        else:
            k = random.choice(hospitals[:15]); end = d + dt.timedelta(days=random.randint(1, 9))
            add(d, B(f'In at [[{TITLE[k]}]] for the {word(2)}.', 'Hospitalization', {'date': day(d), 'hospital': R(k), 'end': day(end)}))
    d += dt.timedelta(days=1)

# ---------- Write: the new pages, then the journals a year at a time ----------
new_pages = [p for _, p in PAGES[pages_before:]]
parts = [new_pages[i:i + 1000] for i in range(0, len(new_pages), 1000)]
# A month per file: a year in one file (about 1 MB) made the command line's import time out (2026-10-21).
for month in sorted({(x.year, x.month) for x in J}):
    days = sorted(x for x in J if (x.year, x.month) == month)
    parts.append(['{:page {:build/journal ' + f'{x:%Y%m%d}' + '} :blocks [' + ' '.join(J[x]) + ']}' for x in days])
for old in HERE.glob('stress-graph-*.edn'): old.unlink()
for i, entries in enumerate(parts, 1):
    path = HERE / f'stress-graph-{i}.edn'
    path.write_text('\n'.join(head + [' :pages-and-blocks', ' [' + '\n  '.join(entries) + ']}']) + '\n')
print(f'stress graph: {len(new_pages)} more pages, {len(J)} journal days, {bullets} bullets, {records} records, {len(parts)} files')
