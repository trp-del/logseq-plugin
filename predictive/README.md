# Predictive

One module of Logseq Plugin (the root README says how the six fit together; `grammar.html` in the workspace draws every rule).

The structure of your graph used while you write, without making you fill in fields.

- **Proposals.** You write a plain bullet. If it has a tag, the tag's properties show faintly in Logseq's own property pills under it, with values already in them. A page you linked fills the property that takes it. A date you wrote in words ("on Friday", "in two weeks") fills a date. A weekday in words that tell of what has been ("on Friday were normal") fills nothing: it could be the day gone or the day coming. When the bullet reads like earlier ones, the value they had is offered. Leave a bullet you wrote in and the sure ones are written; leave with Enter and the dotted guesses are written too. A bullet you only passed through keeps its pencils and is left as it was, unless you press Enter or click one. A date with no year that went by in the last eight weeks is that day, further back it is next year's, and the pencil shows the year when it is not this year; your own weekday with no word like "next" is not read as a date. An untagged bullet that reads like earlier tagged ones, or uses the words a tag's lines use, is offered that tag (pencilled in as `#Tag` at the right end of the bullet's line, where Logseq draws a bullet's tags) together with the tag's properties as guesses, in the property pills; Enter gives it the tag and fills them in. How readily it does so is a setting (careful, balanced, eager; see "How readily a tag is suggested" below), because a wrong tag brings wrong properties with it. Plain notes vote "no tag".
- **Suggested links.** As you type, the rest of a page's name shows in grey after the cursor, as on a phone. Right arrow, or a tap of the Hyper key (Caps Lock as Cmd+Ctrl+Opt+Shift), turns the words into `[[the page]]`. Anything else ignores it. Escape takes the grey words alone: the next Escape hides the proposals, the one after leaves the bullet.
- **Option-T** on a bullet with no tag lists the tags it could be, best first, to pick from (Up and Down, Enter, or a click; Escape closes; typing on, a digit included, closes it too). The tags are those that have a property taking the pages the line names, linked or in plain words (a doctor can be the Provider of a Consultation, who you Spoke with in a Conversation, who Decided a Decision), put in order by the words of the earlier lines nearest this one; a line that names nothing is ordered by its words alone. Picking gives the bullet the tag and its properties are proposed as for any tagged bullet, with the faded arrow to put the tag back. Nothing is written until you pick.
- **Option-C**, or **/Cite**, says where a bullet came from, at the cursor. A line rolls out under the bullet and typing finds among the pages and the PDFs (Up and Down, Enter, or a click; a name that starts with the words comes first, a PDF before a page). Last in the list stands what you typed: a web address as a link, anything else as plain words, for a source that is not in the graph. A PDF or plain words then ask for the page; Enter with none leaves the page out. The words get `(the source, p. 3)` where the /Cite was, the bullet is left, and a faded arrow takes the citation off. Escape goes back one step, and from the first step back to the words with nothing written. A press on a citation to a PDF opens the PDF at that page. A citation to a page or PDF is a link in the words, so the source lists the bullet in Threads and in Logseq's references. A web address is written as a web link, plain words in italics in brackets, so words in italics alone in brackets read as a citation too.
- **Cmd-;** in a bullet makes its words a page. The bullet stays in the outline, open, with the cursor in its first child, and its children are the page's: the same children in both places. With a page by that name already, the bullet shows that page, with the page's children under it. Either way the words read as a link: a press opens the page, Shift in the right sidebar, and the name is changed on the page. A faded arrow turns a new page back into a bullet; for a bullet showing a page, Cmd-Z twice brings the words back. The key is a setting, and Cmd-P stays Logseq's list of commands.
- **Option-Enter** steps through a bullet's properties using Logseq's own lists: it opens the first empty or guessed one with the guess already typed in, and the property keeps its pencil while its list is open; Enter keeps it and moves on, Tab skips, Escape comes back to the words, and a date stop takes words like "next fri". Down stays Logseq's: at the end of a tagged bullet it rests on the first property, and from there Tab, Left and Right step the same way. Cmd-Option-Enter accepts everything shown and leaves the bullet without making a new one.

Proposals stay out of the way: they sit where the value will go, nothing is written until you leave the bullet, a guess you carry past is dropped, Escape hides them, a click on one accepts it, its × (under the pointer) takes it off and keeps it from being proposed on that bullet again, and a faded arrow after the bullet puts back what was filled in and keeps it from being proposed on that bullet again. A new fill's arrow takes the last one's place. Properties with no value stay hidden under a bullet until something is proposed for them, and show faint under the bullet you are writing (the one setting for this, **Hide empty properties until something is proposed**; with it off they stay on screen, faint).

It is made from the two features of the author's logseq-db-refinements plugin that did this, rebuilt to run on any graph.

## Apple's model

Where the rules leave a property empty, or have only guessed it from a name in plain words, Apple's on-device model reads the
bullet and guesses too. It reads what the rules cannot: in "Talked through the scan with Dr. Raj Patel and Dr. Mei Chen" the
rules see two doctors for one Provider and stay silent, while the model can say which one it was. It also reads a number with
no property's name beside it ("5 mg" for a Dose) and which of two days is the start and which the end.

It is held to the graph. A page property is offered only the pages the words name that fit it, so it cannot bring in a page you
did not mention; a number is kept only if the words hold it, a day only if the words name it. It is never asked about a choice
(Status), Logseq's own Deadline and Scheduled, a property that takes almost anything (a Topic), a note under a record, or a
bullet whose tag is still a proposal. What it says is always a guess, dotted, written only by Enter or a click, with the same
Undo, and its hover says it came from Apple's model. A guess with stronger evidence (a link, the page, earlier bullets) is
never replaced. It is asked once typing has paused a little longer than for the rules, since it takes about a second.

It runs on the Mac and nothing leaves it. Logseq cannot reach Apple's model by itself, so a small helper program does
(`helper/`): it listens on this Mac only, answers only Logseq, and runs the model. It needs macOS 26 or later with Apple
Intelligence on. To put it on a Mac, run once in Terminal:

```
sh ~/.logseq/plugins/logseq-plugin/predictive/helper/install.sh
```

(or the same `helper/install.sh` from this folder). It starts at every login from then on; `install.sh remove` takes it off.
Without it, or with the setting **Read my words with Apple's model on this Mac** off, Predictive works as before. Under that setting, the plugin's settings window says whether the model is connected, and if not, why: the helper is not running (with the line to run), or Apple Intelligence is off. On a Mac
with the developer tools, `sh helper/build.sh test` builds it and asks the model one example.

## What it writes

Property values on the bullet you are leaving, or on its parent bullet when only the parent's tags give the properties, and the tag you take from a proposal or Option-T. A citation you pick, in the bullet's words. With Cmd-;, the Page tag on a bullet, or Logseq's Node embed in it, and an empty first child. A page you linked with a tag right after it in the words is given that tag when the value is filled in, and Undo takes it off again. A date that names a day with no journal page yet makes that journal page; Undo takes the value and leaves the page, empty. Option-Enter's stepping can add the bullet that comes next. Leaving a bullet whose words changed writes the sure values and leaves the guesses, by the owner's ruling of 31 October.

## Why it works on any graph

Nothing in the code names a tag, a property, a page or a word of any particular graph. What the original assumed, and what replaced it:

| The original assumed | Here |
|---|---|
| A date property is the one titled "date" | A date is any property of type date. Whether the journal day suits it is read from the graph: for each tag, how many of its nodes carry the day they were written on and how many another day (`dated`). |
| A fixed list of English words "name nothing" (today, morning, with …) | The graph's own lines say which words are too common to name a page (`ctx.common`), in any language. |
| Dates in words are English | A locale object holds the words (`core/dates.js`); English ships. |
| Limits tuned on one graph (nearest ≥ .3, lead .7, tag nearest ≥ .6) | Limits live in the context, and the plugin scores and tunes them on yours (see below). |
| One start date, one `Due`, … | With two open date properties (a start and an end) the words cannot say which, so only the graph's evidence speaks. Logseq's own Deadline and Scheduled are proposed only with evidence, never by the fallback. |
| Choices (Status …) | Never proposed. Where a thing stands is rarely in its words. |

A graph with no tags, no properties, or no earlier lines gets no proposals and no errors (tested). The plugin learns only from what the graph already holds: the more you write in a consistent way, the more it can offer.

## Settings

The settings are in the plugin's one settings window, under Predictive (**Plugin settings** in the command palette, or the gear on the plugin's card).

## The look is Look's

The pencilled values (italic, grey, the dotted line), the proposed tag (its name in mono, no #), the tags in the Option-T list and the Undo arrow's fade take their look from the shared class names on what Predictive draws (`lk-pencil`, `lk-tag`, `lk-prop`, `lk-undo`; the list is in Look's README), which stand whichever modules run. With Look switched off a pencil still reads as a pencil; Logseq's own property line around it goes back to its capsules.

## Commands

In the command palette:

- **Predictive: how well do proposals work on this graph?** Takes a sample of your earlier lines, hides one value at a time, asks what would be proposed and compares. Reports how many were right, wrong and left empty.
- **Predictive: tune proposals to this graph.** Tries a small grid of limits on that same test and keeps the setting with the most right guesses among those whose wrong guesses stay under 3% of what they said. Saved per graph.
- **Predictive: read the graph again.**
- **Predictive: choose a tag for this bullet.** The same as Option-T.

## How it is built

```
core/        pure: no Logseq, no screen. Runs in Node, so it is tested there.
  text.js      words, links, tags
  engine.js    the "looks like" engine: weighted word/link/tag bags, nearest lines vote (tf-idf cosine)
  profile.js   the tags' word profiles (naive Bayes), the second way an untagged bullet gets a tag
  dates.js     dates and numbers in words, behind a locale
  schema.js    which properties a tag gives, which pages fit, "wide" properties
  context.js   builds one graph's context from plain arrays; learns one changed line at once
  names.js     a page named in plain words, only when the word is earned
  link.js      the suggested-link rule and the link learning
  propose.js   the rules: what a bullet's properties could hold, sure and guessed
  model.js     what to ask Apple's model about a bullet, and which of its answers to keep
  score.js     leave-one-out scorer and tuner
logseq/      the only code that knows Logseq
  db.js        reads Logseq into the core's data; the writes
  app.js       settings, the context kept fresh, shared helpers
  link-ui.js   the grey words and the keys
  propose-ui.js proposals drawn in Logseq's property pills, leaving a bullet, writing, Undo
  model.js     asking the helper, once typing pauses; silent when it is not there
  steps.js     Option-Enter stepping through the properties
  tag-pick.js  the Option-T list
  cite.js      /Cite, and a press on a citation to a PDF
  page-here.js Cmd-;, a bullet that is also a page, and a press on its words
  settings.js  the settings Logseq shows
helper/      the helper for Apple's model (Swift): main.swift, build.sh, install.sh
main.js      registers at the plugin's door
test/        run.js (core on pretend graphs), load.js (every file against a fake Logseq), synthetic.js
tools/       speed.js; app/ (check.js drives the plugin in the real Logseq, door.js connects to it)
```

Evidence, from most to least trusted: **sure** (a page linked in the words that fits a property; the page the bullet is on; the journal day where the graph always dates a thing the day it is written) and **guesses** (resemblance to earlier lines; plain names; dates and numbers in words; the parent's values). Where several rules speak they must agree or nothing is proposed. A wrong fill taken by habit is the one thing that must not happen; silence costs nothing.

## Tests

```
node test/run.js    # core tests on three pretend graphs
NODE_PATH=/Users/admin/logseq-value/logseq-plugin-old/node_modules node test/load.js    # the adapter against a fake Logseq
node tools/speed.js # timing on 20,000 lines
```

The pretend graphs share nothing: an English work graph (Owner, Assignee, Project, **When**, **Due**), a Spanish reading log (Autor, **Género**, **Leído el**) and an empty graph. On them, sure values were never wrong and guesses were right 99% of the time or better. These graphs are tidy and repetitive, so read that as "the rules work and nothing is tied to one graph", not as the accuracy you will see on your own notes: run the scoring command on your graph for that.

### In the real Logseq

```
NODE_PATH=/Users/admin/logseq-value/logseq-plugin-old/node_modules node tools/app/check.js   # Logseq on its debugging port, on a test graph
```

It types real keystrokes into the app and checks what is drawn and what is written: sixteen checks (proposals in the pills, a tag offered for a lookalike line, a click writes only the sure values and Enter the guesses, the undo arrow, Escape, Option-Enter and its date stop, Option-T and its list, Right arrow and the Hyper tap, hidden empty properties). It works in a scratch page called "flow test" and refuses to run on a graph not named in `TEST_GRAPHS` (default: the test graphs of the original plugin). All sixteen passed against Logseq 2.0.2, on the Seed Check graph and on the Illness Test Graph. Logseq keeps a deleted page in its Recycle, so the scratch page stays and only its blocks are removed.

### How readily a tag is suggested

A bullet with no tag is given a tag in two stages. First the **vote**: the bullet is compared with every earlier line, the nearest ones vote for their tag, and the tag is offered when the nearest is near enough (`tagNearLeast`) and the leading tag is far enough ahead (`tagLead`); plain notes vote "no tag". That needs a near-twin, which a line written afresh seldom has ("Mouth feels like sandpaper" is like no one earlier line). So when the vote finds nothing, the **word profiles** are asked (`core/profile.js`): for each tag, how often each word turns up in its lines, against the plain lines and every other tag's (naive Bayes, with the prior from how many lines each tag has, so a tag must out-argue the default of "no tag"). "Mouth", "feels" and "stings" each turn up in symptom lines far more than in conversations, and those small votes add up. The tag is offered when it leads the runner-up by `tagGap` in log-odds. Only tags that bullets carry have a profile, and only with ten bullet lines or more (`profileLeast`): a tag given to pages only (a person, a doctor) is never offered. The setting **How readily a tag is suggested** picks the numbers: careful .6 / .7 / gap 4, balanced .3 / .7 / gap 3 (the default), eager .25 / .6 / gap 2.

Measured on 45 hand-written lines that the Illness Test Graph has not seen the twin of (`test/graph/held-out.json`, 14 plain notes besides; `node tools/graph/measure-tags.js`), the vote alone and the two stages together:

| setting | right tag | wrong tag | nothing | plain notes given a tag |
|---|---|---|---|---|
| careful, vote only | 2 | 0 | 43 | 0 of 14 |
| careful, with profiles (gap 4) | 15 | 0 | 30 | 0 of 14 |
| balanced, vote only | 9 | 1 | 35 | 0 of 14 |
| balanced, with profiles (gap 3) | 21 | 1 | 23 | 0 of 14 |
| eager, vote only | 14 | 1 | 30 | 1 of 14 |
| eager, with profiles (gap 2) | 23 | 4 | 18 | 2 of 14 |

The profiles alone, at gap 3, get 17 right and none wrong; the one wrong at balanced is the vote's. Two of the 45 lines (the Treatment ones) no method can find: the graph has five Treatment lines, all on pages. The gap and the smoothing (`profileAlpha` .25) were picked on these same 59 lines, so expect a point or two less on writing of your own. A summed-vector centroid with a cosine was tried in the profiles' place and did worse (11 right, 6 wrong): without the prior, one rare word matches a small tag's profile.

Before the profiles, typed for real into the app, with real keystrokes (half the lines: 23 tagged, 7 plain; a fresh reading of the graph before each setting, because lines typed earlier are remembered as plain notes and vote "no tag"): careful 0 right, balanced 6, eager 10 of the 23, none wrong, no plain note given a tag.

Read with care. It is 45 lines written by one author (me) for one graph, so the numbers say "a line in two" and not more. And the leave-one-out score the plugin's own scorer gives (hide a line's tag, ask, compare) says 56% for careful on the same graph, because the graph's lines have near-twins in it; on lines written afresh the careful vote got 4%. That is why tag limits are not tuned by the scorer (`Flow: tune proposals to this graph` tunes the property limits only).

Tried and not kept (before the profiles): adding the **kind of page a line mentions** (a symptom, a doctor, a person, from the tags of the pages named in its words) and **cues from the plain-language reader** (a date in the words, a number beside a number property's name) as extra tokens for the vote. At the same threshold they changed the held-out count by one or two lines in either direction (14 right with words alone, 13 with kinds, 14 with cues, 13 with both, at .25 / .6), which is noise. What moves recall is the threshold, and what limits it is that a fresh line shares few words with old ones ("cramps after supper" and "abdominal pain" share none). A real fix needs meaning, not words.

### Choosing a tag with a key

Automatic suggestion has to be right before it speaks, which on fresh writing is rarely (above). A key you press on purpose can be more generous, because you choose. Measured on the same 45 hand-written lines (`core/propose.js`, `tagChoices`; the numbers are of lines the graph has no twin of):

| | lines | right tag first | right tag in the list |
|---|---|---|---|
| a page is named (linked or in plain words) | 18 | 15 | 16 |
| no page named: the words alone | 27 | 19 | 21 |
| all tagged lines | 45 | 34 (76%) | 37 (82%) |

A list was shown for 43 of the 45, and the lists are two to four tags long. On the 14 plain notes it would show a list for 13 if asked, and the order is then close to arbitrary: it is a menu, not a verdict, and the plugin never opens it by itself. A line that shares no word with anything the graph holds gets no list.

What the pages named add is the shortlist and little else. They cut the graph's 22 tags to two to four, and the true tag was among them nearly every time, but they never single out one tag, because a visit and a call take the same people; the words do the ordering. Tried as a way to guess more tags automatically (the vote restricted to those tags), the structure made things worse: it spoke more, but 12 of the extra tags were wrong on the graph's own lines, and it changed nothing on the 7 fresh lines that had a link. As a list to pick from it has no such cost.

### A bigger test graph

`test/graph/flesh-out.py` writes `flesh-out.json`: about 660 more blocks and 50 pages for the Illness Test Graph of the original plugin (a fictional patient; nothing in it is real), in that graph's own voice and conventions. It adds the months before the diagnosis, the days between and around the chemo cycles, a wider cast (people, doctors, symptoms, medicines, places, reports, decisions) and many more visits, calls and things coming up, with a few records half-filled on purpose. Then, with the Illness Test Graph open in Logseq and the plugin loaded:

```
python3 test/graph/flesh-out.py
NODE_PATH=/Users/admin/logseq-value/logseq-plugin-old/node_modules node tools/graph/write-in-app.js --trial   # three pages, two days, to see it work
NODE_PATH=/Users/admin/logseq-value/logseq-plugin-old/node_modules node tools/graph/write-in-app.js           # all of it
```

It writes through the plugin's own editor calls, so it merges into journal days that exist. It only adds, every block has a fixed id so a second run adds nothing, and it refuses any graph but the Illness Test Graph. (Logseq's command-line `graph import --type edn` into an existing graph reported success and added nothing here, which is why it is not used.) Back up the graph's folder first.

## What is NOT checked

Read this before trusting it with a graph you care about.

- **One Logseq version, one test graph.** Everything above ran on Logseq 2.0.2 and the Seed Check graph. The drawing and the stepping depend on Logseq's own page structure (`.bottom-property-pill`, `.cp__select`, the date picker's "e.g." box), which can change in any release. If Logseq changes it, proposals go quiet rather than wrong: a proposal that cannot be drawn is not written.
- **It writes to your notes.** Sure values are filled in when you leave a bullet, without asking, as in the original. Try it first in a copy of a graph, or set **Not in these graphs** to keep it out of the ones you care about.
- **Not checked in the app:** a bullet with the tag typed as `#Tag` (the tag's pill appears only after Logseq saves it), property rows shown as rows of their own (Notes) and not capsules, Left/Right stepping between capsules, clicking one name of several, a graph that is not in English, and large graphs.
- **Timing is measured on pretend data.** On 20,000 lines one proposal took about 8 ms here (it runs once typing pauses for 200 ms, not on every key; a bullet left within the pause still gets what was shown). The full reading of the graph is done in the background every five minutes, and with it how often each page's name is linked and written plain, a slice of lines at a time; a changed line then changes only its own count. What you took or passed over among suggested links is saved on leaving a bullet, at most once a minute.
- **The limits are only as good as your history.** A graph of a few dozen tagged lines has little to learn from; the scorer will say so. It also learns from what you write while testing, as it should: lines of test text change what it proposes next.
- **Apple's model has not answered yet.** This Mac cannot run it, so the helper was checked here up to the model (it builds,
  answers Logseq only, is not reachable from the network, says when the model is not there) and Predictive was checked in the
  app with a stand-in that answers as the helper does. How often the model itself is right is for the Mac that has it.
- **English only for dates in words**, until a locale is added.
- **Properties that are text, and choices:** only link properties, dates and numbers are proposed. Text and choice properties are never filled.

## What was left out of the original

Proposals on a page's own properties (the original's `shadow-page.js`), `[[Page]]#Tag` giving the page the tag, the hidden-bracket font (a link just taken shows underlined without its brackets), picker ordering (the likely values first in Logseq's own lists), and all of the original's other features (two-way links, the tag map, search, and so on). In-place proposals, Option-Enter stepping, the Hyper-key tap and hiding empty properties were left out of the first version and are now ported.

## Other languages

Copy `en` in `core/dates.js`, change the weekday and month names, `relative` words, the patterns and `ahead`, register it in `main.js` (`Flow.locales`), and add a `locale` setting to `logseq/settings.js` (an enum of the two names, default `en`; with one language there is no row). `test/run.js` has a Spanish-weekday example. For languages that do not stem with a trailing s/ed/ing, set the engine's `stem` limit to `false` or give it a function (`core/engine.js`, `stemmer`).
