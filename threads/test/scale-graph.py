#!/usr/bin/env python3
"""Writes test/scale-graph-N.edn: a graph with the shape of a large knowledge base, for judging the structure of the
tag map and the two-way section at scale (2026-10-25, docs/STRUCTURE-PROMPT-2026-10-25.md section 2.3).

The Illness Test Graph has fifteen tags, which hides every structural problem; Stress Check (test/stress-graph.py) has
volume but the same few tags. This one has the shape: a research knowledge base of claims, sources, observations,
concepts, people and places, with

- about 400 tags in six families, up to six levels deep, a few with two parents, and the umbrella tags tagged
  directly on some nodes (against the owner's principle, as a real graph drifts);
- about 300 properties of every kind (links, text, choices, dates, numbers, yes or no, web addresses), with doubles
  ("Author" and "Authors", "Date" and "Day") and near-doubles (several link properties accepting the same tag), some
  unused, some on no tag, and a few wide ones on dozens of tags;
- pages a great many nodes point at through several properties at once (a researcher, an institute, a concept),
  pages pointed at by one property only, a page with many mentions in the words and no property, and chains several
  nodes long (a source → its observations → the claims they support → the decisions they led to → the projects those
  started).

Every name is made from fixed lists with a fixed random seed and every node has a fixed id: importing twice changes
nothing. Import into a scratch graph made with the command line, never one of the owner's: `logseq graph create
--graph "Scale Check"`, then the files in order of their number (GUIDE.md, "Chunk EDN imports"), then `logseq server
stop --graph "Scale Check"`.
Run: python3 test/scale-graph.py
"""
import datetime as dt
import random
from pathlib import Path

HERE = Path(__file__).parent
random.seed(2510)


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

_n = {}
def new_id(kind):
    _n[kind] = _n.get(kind, 0) + 1
    return uid(kind, _n[kind])

def slugify(name):
    return ''.join(c if c.isalnum() else '-' for c in name.lower()).strip('-')


# ---------- Tags: six families, up to six levels deep ----------
C = {}          # key -> EDN
TAG = {}        # name -> key
PARENT = {}     # name -> [parent names]
CHILDREN = {}   # name -> [child names]

def cls(name, parents=()):
    key = slugify(name)
    assert key not in C, name
    TAG[name] = key
    PARENT[name] = list(parents)
    for p in parents:
        CHILDREN.setdefault(p, []).append(name)
    C[key] = None  # filled once the properties are known
    return name

FAMILIES = {
    'Entity': {
        'Person': {'Researcher': {'Principal investigator': {}, 'Postdoc': {}, 'Doctoral student': {}, 'Technician': {}},
                   'Clinician': {'Physician': {}, 'Nurse': {}, 'Surgeon': {}}, 'Author': {}, 'Reviewer': {}, 'Editor': {},
                   'Funder contact': {}, 'Participant': {}},
        'Organization': {'Institute': {'Research institute': {}, 'Teaching hospital': {}}, 'University': {'Faculty': {}, 'Department': {}},
                         'Company': {'Startup': {}, 'Laboratory supplier': {}}, 'Funder': {'Public funder': {}, 'Foundation': {}},
                         'Journal': {}, 'Publisher': {}, 'Consortium': {}},
        'Place': {'Country': {}, 'City': {}, 'Site': {'Field site': {}, 'Clinic site': {}}, 'Facility': {'Lab': {}, 'Archive': {}}},
    },
    'Occurrence': {
        'Event': {'Meeting': {'Lab meeting': {}, 'Review meeting': {}}, 'Conference': {'Talk': {}, 'Poster session': {}},
                  'Workshop': {}, 'Interview': {}, 'Site visit': {}},
        'Observation': {'Measurement': {'Assay': {}, 'Survey response': {}, 'Imaging result': {}}, 'Field note': {},
                        'Anomaly': {}, 'Replication': {}},
        'Experiment': {'Trial': {'Pilot trial': {}, 'Randomized trial': {}}, 'Simulation': {}, 'Pilot': {}},
        'Decision': {'Design decision': {}, 'Funding decision': {}, 'Retraction': {}},
    },
    'Interpretation': {
        'Claim': {'Hypothesis': {}, 'Finding': {}, 'Conjecture': {}, 'Counterclaim': {}},
        'Argument': {'Objection': {}, 'Rebuttal': {}, 'Synthesis': {}},
        'Question': {'Open question': {}, 'Answered question': {}},
        'Review': {'Peer review': {}, 'Literature review': {}, 'Meta-analysis': {}},
    },
    'Concept': {
        'Theory': {'Model': {'Statistical model': {}, 'Mechanistic model': {}}, 'Framework': {}},
        'Method': {'Protocol': {}, 'Technique': {'Lab technique': {}, 'Analysis technique': {}}, 'Instrument': {}},
        'Phenomenon': {'Process': {}, 'Effect': {}, 'Condition': {'Disease': {}, 'Symptom': {}}},
        'Term': {'Definition': {}, 'Acronym': {}},
    },
    'Artifact': {
        'Source': {'Paper': {'Preprint': {}, 'Journal article': {}, 'Conference paper': {}}, 'Book': {'Chapter': {}},
                   'Dataset': {'Raw dataset': {}, 'Derived dataset': {}}, 'Report': {}, 'Web page': {}, 'Patent': {}},
        'Software': {'Library': {}, 'Script': {}, 'Notebook': {}},
        'Material': {'Reagent': {}, 'Sample': {}, 'Specimen': {}},
        'Document': {'Grant proposal': {}, 'Ethics application': {}, 'Draft': {}, 'Slide deck': {}},
    },
    'Work': {
        'Project': {'Programme': {}, 'Study': {}, 'Side project': {}},
        'Milestone': {}, 'Deliverable': {}, 'Collaboration': {},
    },
}

def walk(tree, parents=()):
    for name, sub in tree.items():
        cls(name, parents)
        walk(sub, (name,))
walk(FAMILIES)

# Fill the families out to several hundred tags, the way a real graph grows: specific kinds under the broad ones.
QUALIFIERS = ['Clinical', 'Field', 'Lab', 'Archival', 'Remote', 'Comparative', 'Longitudinal', 'Exploratory', 'Applied',
              'Historical', 'Computational', 'Qualitative', 'Quantitative', 'Regional', 'Pilot', 'Follow-up', 'Annual',
              'Internal', 'External', 'Joint']
GROW = ['Researcher', 'Institute', 'Site', 'Meeting', 'Measurement', 'Trial', 'Finding', 'Hypothesis', 'Objection',
        'Model', 'Protocol', 'Technique', 'Process', 'Effect', 'Disease', 'Paper', 'Dataset', 'Report', 'Sample',
        'Project', 'Study', 'Review', 'Question', 'Document', 'Library', 'Talk', 'Field note', 'Decision', 'Term',
        'Instrument', 'Framework', 'Funder', 'Department', 'Lab', 'Workshop', 'Interview']
leafs = []
for base in GROW:
    for q in random.sample(QUALIFIERS, 8):
        name = f'{q} {base.lower()}'
        if name in TAG:
            continue
        leafs.append(cls(name, (base,)))
# A sixth level under a few of them, and a few tags with two parents.
for name in random.sample(leafs, 40):
    for q in random.sample(['early', 'late', 'minor', 'major'], 2):
        cls(f'{name} ({q})', (name,))
for name, extra in [('Physician', 'Author'), ('Dataset', 'Material'), ('Protocol', 'Document'), ('Talk', 'Source'),
                    ('Collaboration', 'Organization'), ('Symptom', 'Observation')]:
    PARENT[name].append(extra)
    CHILDREN.setdefault(extra, []).append(name)


# ---------- Properties: every kind, doubles, near-doubles, wide and unused ones ----------
P = {}          # slug -> EDN
PROP = {}       # slug -> (title, kind, many, accepts)
CHOICE = {}
_choice_n = [0]

def prop(title, kind, many=False, accepts=None, choices=None, slug=None):
    slug = slug or slugify(title)
    assert slug not in P, title
    parts = [f':block/title {s(title)}', f':logseq.property/type :{kind}',
             f':db/cardinality :db.cardinality/{"many" if many else "one"}']
    if accepts:
        parts.append(':build/property-classes [' + ' '.join(f':user.class/{TAG[c]}' for c in accepts) + ']')
    if choices:
        vals = []
        for v in choices:
            _choice_n[0] += 1
            u = uid('7b', _choice_n[0])
            CHOICE[(slug, v)] = u
            vals.append(f'{{:value {s(v)} :uuid #uuid "{u}"}}')
        parts.append(':build/closed-values [' + ' '.join(vals) + ']')
    P[slug] = '{' + ' '.join(parts) + '}'
    PROP[slug] = (title, kind, many, accepts or [], choices or [])
    return slug

def ch(slug, value):
    return ref(CHOICE[(slug, value)])

# Links: who, where, about what, from where.
LINKS = [
    ('Author', True, ['Person']), ('Authors', True, ['Person']), ('Written by', False, ['Author']),
    ('Principal investigator', False, ['Researcher']), ('Lead', False, ['Person']), ('Led by', False, ['Researcher']),
    ('Reviewed by', True, ['Reviewer', 'Researcher']), ('Decided by', False, ['Person']), ('Approved by', False, ['Person']),
    ('Observed by', False, ['Researcher']), ('Recorded by', False, ['Person']), ('Interviewed', True, ['Person']),
    ('Attendees', True, ['Person']), ('Speaker', False, ['Person']), ('Chair', False, ['Person']), ('Contact', False, ['Person']),
    ('Physician', False, ['Clinician']), ('Doctor', False, ['Physician']), ('Supervisor', False, ['Researcher']),
    ('Affiliation', True, ['Organization']), ('Institution', False, ['Institute', 'University']), ('Works at', False, ['Organization']),
    ('Funded by', True, ['Funder']), ('Funder', False, ['Funder']), ('Published in', False, ['Journal']), ('Publisher', False, ['Publisher']),
    ('Location', False, ['Place']), ('Place', False, ['Place']), ('Site', False, ['Site']), ('Held at', False, ['Facility', 'Site']),
    ('Country', False, ['Country']), ('City', False, ['City']),
    ('Topic', True, ['Concept']), ('Topics', True, ['Concept']), ('About', True, ['Concept', 'Claim']), ('Subject', False, ['Concept']),
    ('Concept', True, ['Concept']), ('Uses method', True, ['Method']), ('Method', False, ['Method']), ('Protocol used', False, ['Protocol']),
    ('Instrument', False, ['Instrument']), ('Model used', False, ['Model']),
    ('Source', True, ['Source']), ('Cites', True, ['Source']), ('Cited by', True, ['Source']), ('Based on', True, ['Source', 'Observation']),
    ('Evidence', True, ['Observation']), ('Supports', True, ['Claim']), ('Contradicts', True, ['Claim']), ('Refutes', True, ['Claim']),
    ('Answers', False, ['Question']), ('Raises', True, ['Question']), ('Objects to', False, ['Claim', 'Argument']),
    ('Led to', True, ['Decision']), ('Leads to', True, ['Decision']), ('Started', True, ['Project']), ('Part of', False, ['Project']),
    ('Project', False, ['Project']), ('Milestone', False, ['Milestone']), ('Deliverable of', False, ['Project']),
    ('Dataset', True, ['Dataset']), ('Data', True, ['Dataset']), ('Sample', True, ['Sample']), ('Reagent', True, ['Reagent']),
    ('Software', True, ['Software']), ('Library used', True, ['Library']), ('Replicates', False, ['Experiment', 'Observation']),
    ('Follows', False, ['Event']), ('Related', True, ['Entity', 'Concept', 'Artifact', 'Work', 'Interpretation', 'Occurrence']),
    ('See also', True, ['Concept', 'Artifact']), ('Condition', False, ['Condition']), ('Symptom', True, ['Symptom']),
    ('Disease', False, ['Disease']), ('Effect on', True, ['Phenomenon']), ('Causes', True, ['Phenomenon']),
    ('Caused by', True, ['Phenomenon']), ('Measures', True, ['Phenomenon']), ('Measured with', False, ['Instrument', 'Technique']),
    ('Participant', True, ['Participant']), ('Participants', True, ['Participant']), ('Collaborator', True, ['Person', 'Organization']),
    ('Partner', True, ['Organization']), ('Editor', False, ['Editor']), ('Translator', False, ['Person']),
    ('Draft of', False, ['Source']), ('Version of', False, ['Software', 'Dataset']), ('Derived from', True, ['Dataset', 'Sample']),
    ('Stored at', False, ['Archive', 'Lab']), ('Owner', False, ['Person', 'Organization']), ('Assigned to', True, ['Person']),
    ('Requested by', False, ['Person']), ('Blocked by', True, ['Question', 'Decision']), ('Depends on', True, ['Work', 'Artifact']),
    ('Next', False, ['Work']), ('Previous', False, ['Work']), ('Parent concept', False, ['Concept']), ('Broader', False, ['Concept']),
    ('Narrower', True, ['Concept']), ('Defined in', False, ['Source']), ('Term', False, ['Term']), ('Acronym of', False, ['Term']),
    ('Hypothesis tested', True, ['Hypothesis']), ('Finding', True, ['Finding']), ('Review of', False, ['Source', 'Claim']),
    ('Grant', False, ['Grant proposal']), ('Ethics approval', False, ['Ethics application']), ('Presented at', False, ['Conference', 'Meeting']),
    ('Talk at', False, ['Conference']), ('Visit to', False, ['Site', 'Organization']), ('Hosted by', False, ['Organization']),
]
for title, many, accepts in LINKS:
    prop(title, 'node', many, accepts)

TEXTS = ['Summary', 'Abstract', 'Notes', 'Note', 'Comment', 'Comments', 'Quote', 'Excerpt', 'Description', 'Details',
         'Method notes', 'Limitations', 'Caveats', 'Context', 'Background', 'Rationale', 'Outcome', 'Result', 'Results',
         'Conclusion', 'Takeaway', 'Next steps', 'To check', 'Open issues', 'Wording', 'Original wording', 'Translation',
         'Page range', 'Pages', 'Volume', 'Issue', 'Edition', 'ISBN', 'DOI', 'Identifier', 'Accession', 'Version',
         'License', 'Licence', 'Citation', 'Citation key', 'Short title', 'Running title', 'Keywords', 'Tags (old)',
         'Address', 'Room', 'Phone', 'Email', 'Role', 'Position', 'Title (job)', 'Expertise', 'Field', 'Discipline',
         'Specialty', 'Speciality', 'Funding note', 'Budget note', 'Equipment note', 'Sample notes', 'Storage notes',
         'Analysis notes', 'Formula', 'Units', 'Unit', 'Dose', 'Dosage', 'Sequence', 'Coordinates', 'Region']
for t in TEXTS:
    prop(t, 'default')

CHOICES = [
    ('Status', ['Draft', 'Active', 'Paused', 'Done', 'Dropped']), ('State', ['Open', 'Closed']),
    ('Stage', ['Idea', 'Planned', 'Running', 'Analysed', 'Written up']), ('Phase', ['I', 'II', 'III', 'IV']),
    ('Confidence', ['Low', 'Medium', 'High']), ('Certainty', ['Speculative', 'Plausible', 'Established']),
    ('Evidence level', ['Anecdote', 'Case', 'Cohort', 'Trial', 'Meta-analysis']), ('Strength', ['Weak', 'Moderate', 'Strong']),
    ('Priority', ['Low', 'Normal', 'High', 'Urgent']), ('Importance', ['Minor', 'Major']),
    ('Read status', ['To read', 'Reading', 'Read', 'Skimmed']), ('Reading status', ['Unread', 'Read']),
    ('Access', ['Open', 'Paywalled', 'Embargoed']), ('Peer reviewed', ['Yes', 'No', 'Unknown']),
    ('Verdict', ['Accept', 'Minor revisions', 'Major revisions', 'Reject']), ('Decision type', ['Go', 'No go', 'Defer']),
    ('Sentiment', ['Positive', 'Neutral', 'Negative']), ('Stance', ['For', 'Against', 'Mixed']),
    ('Format', ['PDF', 'HTML', 'Print', 'Video']), ('Medium', ['Paper', 'Talk', 'Poster']),
    ('Language', ['English', 'French', 'German', 'Spanish', 'Japanese']), ('Region scope', ['Local', 'National', 'Global']),
    ('Design', ['Observational', 'Experimental', 'Simulation']), ('Blinding', ['None', 'Single', 'Double']),
    ('Sample type', ['Blood', 'Tissue', 'Soil', 'Water']), ('Storage', ['Room', 'Fridge', 'Freezer', '-80']),
    ('Licence type', ['CC-BY', 'CC-BY-NC', 'All rights reserved']), ('Visibility', ['Private', 'Team', 'Public']),
    ('Kind', ['A', 'B', 'C']), ('Type', ['Primary', 'Secondary', 'Tertiary']), ('Category', ['Core', 'Peripheral']),
    ('Outcome type', ['Positive', 'Null', 'Negative']), ('Replication status', ['Not tried', 'Replicated', 'Failed']),
    ('Ethics status', ['Pending', 'Approved', 'Rejected']), ('Funding status', ['Applied', 'Awarded', 'Declined']),
    ('Role kind', ['Lead', 'Member', 'Advisor']), ('Seniority', ['Junior', 'Mid', 'Senior']),
    ('Frequency', ['Once', 'Weekly', 'Monthly', 'Yearly']), ('Severity', ['Mild', 'Moderate', 'Severe']),
    ('Quality', ['Poor', 'Fair', 'Good', 'Excellent']),
]
for title, values in CHOICES:
    prop(title, 'default', choices=values)

DATES = ['Date', 'Day', 'When', 'Start', 'Start date', 'End', 'End date', 'Due', 'Deadline', 'Published', 'Published on',
         'Accessed', 'Accessed on', 'Received', 'Accepted', 'Submitted', 'Collected', 'Collected on', 'Measured on',
         'Decided on', 'Reviewed on', 'Next review', 'Expires', 'Born', 'Founded', 'Visited', 'Held on', 'Recorded on',
         'Updated', 'Last checked']
for t in DATES:
    prop(t, 'date')

NUMBERS = ['Year', 'Pages count', 'Citations', 'Citation count', 'Sample size', 'N', 'Participants count', 'Effect size',
           'P value', 'Score', 'Rating', 'Rank', 'Weight', 'Duration', 'Duration (days)', 'Cost', 'Budget', 'Amount',
           'Temperature', 'Concentration', 'Count', 'Value', 'Version number', 'Cycle', 'Round', 'Wave', 'Order',
           'Progress', 'Percent', 'Hours']
for t in NUMBERS:
    prop(t, 'number')

for t in ['Done', 'Reviewed', 'Verified', 'Archived', 'Pinned', 'Public', 'Funded', 'Retracted', 'Replicated', 'Key']:
    prop(t, 'checkbox')
for t in ['URL', 'Link', 'Website', 'Homepage', 'Repository', 'Preprint link', 'Data link', 'Slides link']:
    prop(t, 'url')


# ---------- Which properties each tag carries ----------
SCHEMA = {}
def on(tag, *slugs):
    SCHEMA.setdefault(tag, [])
    for sl in slugs:
        assert sl in P, sl
        if sl not in SCHEMA[tag]:
            SCHEMA[tag].append(sl)

# The broad ones, written as a person would.
on('Occurrence', 'date'); on('Event', 'attendees', 'held-at'); on('Meeting', 'chair', 'notes'); on('Conference', 'location', 'start', 'end')
on('Talk', 'speaker', 'presented-at', 'slides-link'); on('Interview', 'interviewed', 'recorded-by'); on('Site visit', 'visit-to')
on('Observation', 'observed-by', 'measures', 'based-on'); on('Measurement', 'value', 'units', 'measured-with')
on('Experiment', 'led-by', 'uses-method', 'hypothesis-tested', 'sample-size'); on('Trial', 'phase', 'blinding', 'participants')
on('Decision', 'decided-by', 'decided-on', 'decision-type', 'started', 'about'); on('Claim', 'evidence', 'confidence', 'about', 'source')
on('Hypothesis', 'raises'); on('Finding', 'supports', 'contradicts', 'effect-size', 'p-value'); on('Counterclaim', 'refutes')
on('Argument', 'about', 'stance'); on('Objection', 'objects-to'); on('Question', 'about', 'state', 'answers')
on('Review', 'review-of', 'verdict', 'reviewed-by'); on('Peer review', 'reviewed-on')
on('Concept', 'broader', 'narrower', 'see-also', 'defined-in'); on('Theory', 'author'); on('Method', 'protocol-used', 'limitations')
on('Phenomenon', 'causes', 'caused-by'); on('Condition', 'severity', 'symptom'); on('Term', 'definition' if 'definition' in P else 'description', 'acronym-of')
on('Source', 'authors', 'published', 'year', 'doi', 'read-status', 'cites', 'topic'); on('Paper', 'published-in', 'peer-reviewed', 'abstract')
on('Book', 'publisher', 'isbn', 'edition'); on('Dataset', 'licence-type', 'data-link', 'derived-from', 'version')
on('Report', 'author', 'published-on'); on('Web page', 'url', 'accessed'); on('Software', 'repository', 'version-of', 'license')
on('Material', 'stored-at', 'storage'); on('Sample', 'collected-on', 'sample-type'); on('Document', 'owner', 'status', 'updated')
on('Grant proposal', 'funder', 'budget', 'funding-status', 'deadline'); on('Ethics application', 'ethics-status', 'submitted')
on('Person', 'affiliation', 'email', 'role'); on('Researcher', 'expertise', 'supervisor'); on('Clinician', 'specialty', 'works-at')
on('Physician', 'speciality'); on('Organization', 'country', 'city', 'website'); on('Institute', 'founded', 'partner')
on('Funder', 'homepage'); on('Journal', 'publisher', 'access'); on('Place', 'coordinates', 'region'); on('Site', 'country')
on('Project', 'lead', 'status', 'start-date', 'end-date', 'funded-by', 'part-of', 'priority'); on('Milestone', 'due', 'project', 'done')
on('Deliverable', 'deliverable-of', 'due', 'assigned-to'); on('Collaboration', 'collaborator', 'partner')
# The doubles and near-doubles a graph collects over years.
on('Study', 'principal-investigator', 'stage'); on('Programme', 'led-by', 'phase'); on('Pilot', 'lead', 'stage')
on('Field note', 'day', 'recorded-by', 'quote'); on('Lab meeting', 'when', 'comments'); on('Workshop', 'date', 'note', 'attendees')
on('Literature review', 'topics', 'sources' if 'sources' in P else 'source', 'reading-status'); on('Meta-analysis', 'data', 'sample-size', 'n')
on('Preprint', 'preprint-link', 'written-by'); on('Journal article', 'citations', 'citation-count')
on('Imaging result', 'doctor', 'physician'); on('Surgeon', 'institution'); on('Nurse', 'works-at', 'role')

# A few wide properties on dozens of tags; then every grown tag takes one to four properties.
ALL = list(TAG)
for wide, share in [('related', .25), ('topic', .12), ('notes', .1), ('status', .08), ('summary', .08)]:
    for t in random.sample(ALL, int(len(ALL) * share)):
        on(t, wide)
grown = [t for t in ALL if t not in FAMILIES and len(SCHEMA.get(t, [])) < 2]
pool = [sl for sl in P if sl not in ('related',)]
for t in grown:
    for sl in random.sample(pool, random.randint(1, 4)):
        on(t, sl)

# Some properties stay on no tag at all (left over from old habits), and some are never used by any node.
LOOSE = ['tags-old', 'running-title', 'licence', 'reading-status', 'kind', 'type', 'category', 'pinned', 'key', 'wave']
for t in SCHEMA.values():
    for sl in LOOSE:
        if sl in t:
            t.remove(sl)

for name, key in TAG.items():
    parts = [f':block/title {s(name)}']
    if PARENT[name]:
        parts.append(':build/class-extends [' + ' '.join(f':user.class/{TAG[p]}' for p in PARENT[name]) + ']')
    if SCHEMA.get(name):
        parts.append(':build/class-properties [' + ' '.join(f':user.property/{sl}' for sl in SCHEMA[name]) + ']')
    C[key] = '{' + ' '.join(parts) + '}'


# ---------- Pages: people, organizations, places, concepts, sources ----------
PAGES = []
TITLE = {}
NODE_TAG = {}
used = set()

def inherited(tag):
    seen, out, todo = set(), [], [tag]
    while todo:
        t = todo.pop()
        if t in seen:
            continue
        seen.add(t)
        out += SCHEMA.get(t, [])
        todo += PARENT[t]
    return out

def props(m):
    return '{' + ' '.join(f':user.property/{k} {v}' for k, v in m.items() if v is not None) + '}'

def page(title, tag, fields=None, blocks=()):
    u = new_id('5a')
    TITLE[u] = title
    NODE_TAG[u] = tag
    parts = [f':block/title {s(title)}', f':block/uuid #uuid "{u}"', ':build/keep-uuid? true', f':build/tags [:user.class/{TAG[tag]}]']
    if fields:
        parts.append(f':build/properties {props(fields)}')
    PAGES.append('{:page {' + ' '.join(parts) + '} :blocks [' + ' '.join(blocks) + ']}')
    return u

def B(title, tag=None, fields=None, children=()):
    u = new_id('5b')
    TITLE[u] = title
    NODE_TAG[u] = tag
    parts = [f':block/title {s(title)}', f':block/uuid #uuid "{u}"', ':build/keep-uuid? true']
    if tag:
        parts.append(f':build/tags [:user.class/{TAG[tag]}]')
    if fields:
        parts.append(f':build/properties {props(fields)}')
    if children:
        parts.append(':build/children [' + ' '.join(children) + ']')
    return u, '{' + ' '.join(parts) + '}'

FIRST = ['Amara', 'Bruno', 'Chiara', 'Dmitri', 'Esme', 'Felix', 'Greta', 'Hamid', 'Ingrid', 'Jonas', 'Keiko', 'Lars', 'Maya',
         'Nikolai', 'Odile', 'Priya', 'Rafael', 'Saoirse', 'Tomas', 'Uma', 'Viktor', 'Wanjiru', 'Xavier', 'Yara', 'Zeno']
LAST = ['Abara', 'Becker', 'Castillo', 'Dahl', 'Eriksen', 'Fontaine', 'Gupta', 'Haddad', 'Iversen', 'Jansen', 'Kowalski',
        'Laurent', 'Mbeki', 'Nakamura', 'Ortega', 'Petrov', 'Quintero', 'Rahman', 'Sato', 'Tanaka', 'Ueda', 'Varga',
        'Weber', 'Xu', 'Yilmaz', 'Zielinski']
SYLL = ['ka', 'lo', 'mi', 'ra', 'te', 'su', 'no', 'vi', 'de', 'po', 'zu', 'ber', 'tal', 'gon', 'ris', 'mel', 'an', 'or']

def word(n=3):
    return ''.join(random.choice(SYLL) for _ in range(n))

def unique(make):
    while True:
        t = make()
        if t not in used:
            used.add(t)
            return t

def leaf_under(*tags):
    out = []
    for t in tags:
        out.append(t)
        out += leaf_under(*CHILDREN.get(t, []))
    return list(dict.fromkeys(out))

person_tags = leaf_under('Researcher', 'Clinician', 'Author', 'Reviewer', 'Editor', 'Participant')
org_tags = leaf_under('Institute', 'University', 'Company', 'Funder', 'Journal', 'Publisher', 'Consortium')
place_tags = leaf_under('Country', 'City', 'Site', 'Facility')
concept_tags = leaf_under('Theory', 'Method', 'Phenomenon', 'Term')
source_tags = leaf_under('Source')

people = [page(unique(lambda: f'{random.choice(FIRST)} {random.choice(LAST)}'), random.choice(person_tags)) for _ in range(500)]
orgs = [page(unique(lambda: f'{word(2).capitalize()} {random.choice(["Institute", "University", "Foundation", "Labs", "Press", "Council"])}'),
             random.choice(org_tags)) for _ in range(150)]
places = [page(unique(lambda: f'{word(2).capitalize()}{random.choice(["ville", "berg", " Station", " Valley", " Campus"])}'),
               random.choice(place_tags)) for _ in range(100)]
concepts = [page(unique(lambda: f'{word(2).capitalize()} {random.choice(["effect", "model", "theory", "process", "method", "index", "bias", "drift", "coupling"])}'),
                 random.choice(concept_tags)) for _ in range(600)]
sources = [page(unique(lambda: f'{word(2).capitalize()} {word(3)} ({random.randint(1990, 2026)})'),
                random.choice(source_tags)) for _ in range(800)]
projects = [page(unique(lambda: f'Project {word(2).capitalize()}'), random.choice(leaf_under('Project'))) for _ in range(60)]
# Umbrella tags tagged directly, as a graph drifts.
strays = [page(unique(lambda: f'{word(2).capitalize()} thing'), random.choice(['Entity', 'Concept', 'Artifact', 'Occurrence'])) for _ in range(12)]

# The hubs: pages a great many nodes point at, through several properties at once or through one.
HUB_PERSON = people[0]          # points in through author, reviewed by, decided by, observed by, speaker, attendees …
HUB_ORG = orgs[0]               # through affiliation, works at, funded by, hosted by …
HUB_CONCEPT = concepts[0]       # through topic, about, measures, causes …
ONE_PROP = orgs[1]              # through Published in only
MENTIONED = concepts[1]         # in the words of hundreds of bullets, through no property
for u, name in [(HUB_PERSON, 'Ingrid Becker'), (HUB_ORG, 'Northfield Institute'), (HUB_CONCEPT, 'Coupling drift'),
                (ONE_PROP, 'Journal of Applied Things'), (MENTIONED, 'Tidal memory')]:
    TITLE[u] = name
# Retitle them in the written pages too (they were written with their random names).
for i, p in enumerate(PAGES):
    for u in (HUB_PERSON, HUB_ORG, HUB_CONCEPT, ONE_PROP, MENTIONED):
        if f'#uuid "{u}"' in p:
            head, rest = p.split(':block/title ', 1)
            old, rest = rest.split(' :block/uuid', 1)
            PAGES[i] = head + ':block/title ' + s(TITLE[u]) + ' :block/uuid' + rest

def L(u):
    return f'[[{TITLE[u]}]]'

def pick(pool, hub=None, share=0.0):
    return hub if hub and random.random() < share else random.choice(pool)


# ---------- Journals: records written as sentences, with chains several nodes long ----------
J = {}
def add(d, block):
    J.setdefault(d, []).append(block)

START = dt.date(2023, 1, 1)
DAYS = 1000
records = 0
observations, claims, decisions = [], [], []
obs_tags = leaf_under('Observation')
claim_tags = leaf_under('Claim')
event_tags = leaf_under('Event')
decision_tags = leaf_under('Decision')
for i in range(DAYS):
    d = START + dt.timedelta(days=i)
    for _ in range(random.randint(3, 9)):
        r = random.random()
        records += 1
        if r < .30:
            who = pick(people, HUB_PERSON, .08); src = random.choice(sources); what = pick(concepts, HUB_CONCEPT, .1)
            words = f'{L(who)} saw {word(2)} {word(3)} in {L(src)}, about {L(what)}.'
            if random.random() < .3: words += f' Reminds me of {L(MENTIONED)}.'
            u, b = B(words, random.choice(obs_tags), {'date': day(d), 'observed-by': ref(who), 'based-on': refs([src]), 'measures': refs([what])})
            observations.append(u)
        elif r < .50 and observations:
            evid = random.sample(observations[-200:], min(len(observations), random.randint(1, 3)))
            what = pick(concepts, HUB_CONCEPT, .1)
            words = f'{word(2).capitalize()} {word(3)} holds for {L(what)}.'
            if random.random() < .2: words += f' Close to {L(MENTIONED)} again.'
            u, b = B(words, random.choice(claim_tags), {'evidence': refs(evid), 'about': refs([what]), 'confidence': ch('confidence', random.choice(['Low', 'Medium', 'High'])), 'source': refs([random.choice(sources)])})
            claims.append(u)
        elif r < .60 and claims:
            who = pick(people, HUB_PERSON, .15); proj = random.choice(projects)
            words = f'{L(who)} decided to {word(2)} the {word(3)}.'
            # about: the claims it rests on, so a thread reads source → observation → claim → decision → project
            u, b = B(words, random.choice(decision_tags), {'decided-by': ref(who), 'decided-on': day(d), 'decision-type': ch('decision-type', random.choice(['Go', 'No go', 'Defer'])), 'started': refs([proj]), 'about': refs(random.sample(claims[-100:], min(len(claims), 2)))})
            decisions.append(u)
        elif r < .78:
            who = random.sample(people[:120], random.randint(2, 6))
            if random.random() < .2: who[0] = HUB_PERSON
            where = pick(places, None)
            words = f'Met {", ".join(L(w) for w in who[:2])} at {L(where)} about {word(2)} {word(2)}.'
            u, b = B(words, random.choice(event_tags), {'date': day(d), 'attendees': refs(who), 'held-at': ref(where)})
        elif r < .88:
            who = pick(people, HUB_PERSON, .1); org = pick(orgs, HUB_ORG, .3)
            words = f'{L(who)} at {L(org)} sent the {word(3)} draft.'
            u, b = B(words, 'Draft', {'owner': ref(who), 'hosted-by' if 'hosted-by' in SCHEMA.get('Draft', []) else 'related': refs([org])})
        elif r < .94:
            src = random.choice(sources); j = ONE_PROP if random.random() < .5 else random.choice(orgs[2:30])
            words = f'Read {L(src)}; {word(2)} {word(3)}.'
            u, b = B(words, 'Journal article', {'published-in': ref(j), 'cites': refs(random.sample(sources, 2)), 'read-status': ch('read-status', random.choice(['To read', 'Reading', 'Read', 'Skimmed']))})
        else:
            words = f'{word(2).capitalize()} {word(3)}, thinking of {L(MENTIONED)} and {L(random.choice(concepts))}.'
            u, b = B(words)
        add(d, b)

# ---------- Write ----------
head = [';; Scale Check: a large knowledge base for judging structure. Made by test/scale-graph.py; edit that, not this.',
        ';; Import into a scratch graph made with the command line, never one of the owner\'s.',
        '{:properties', ' {' + '\n  '.join(f':user.property/{k} {v}' for k, v in P.items()) + '}',
        ' :classes', ' {' + '\n  '.join(f':user.class/{k} {v}' for k, v in C.items()) + '}']
parts = [PAGES[i:i + 900] for i in range(0, len(PAGES), 900)]
months = sorted({(x.year, x.month) for x in J})
for m in months:
    days = sorted(x for x in J if (x.year, x.month) == m)
    parts.append(['{:page {:build/journal ' + f'{x:%Y%m%d}' + '} :blocks [' + ' '.join(J[x]) + ']}' for x in days])
for old in HERE.glob('scale-graph-*.edn'):
    old.unlink()
for i, entries in enumerate(parts, 1):
    path = HERE / f'scale-graph-{i}.edn'
    path.write_text('\n'.join(head + [' :pages-and-blocks', ' [' + '\n  '.join(entries) + ']}']) + '\n')
used_props = {sl for t in SCHEMA.values() for sl in t}
print(f'scale graph: {len(TAG)} tags, {len(P)} properties ({len(P) - len(used_props)} on no tag), '
      f'{len(PAGES)} pages, {len(J)} journal days, {records} records, {len(parts)} files')
