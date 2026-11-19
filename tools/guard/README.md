# The guard

**Run it through the one check, `node tools/check.js` (the root README): it picks the screens a change can reach, keeps the guard's
Logseq running between checks, and adds how each screen reads (`reads.js`: cut off, too faint, out of line, empty, over other
words, past the edge, an odd size, unlike Logseq's lines). A finding the change brought stops it; one that was there before is
listed as known. 19 November 2026.**

The owner, 18 November 2026: "I just want better quality changes without hand holding… Each fix comes with more errors", and
"approving every release is tiresome". The guard stands in for the owner's yes. When it passes on exactly what ships, a change may
be committed and released without asking; when it does not, nothing ships. Ask the owner only before a change that could lose data.

## Why fixes broke other things

Each of these happened more than once before the guard:

1. **A change reached further than meant.** The table bar's new style also dressed Logseq's Linked references heading (18 Nov);
   sidebar-tabs' hide rule blanked the split screen (14 Nov); Predictive's Hide empty left fold rings and gaps (11 Nov); Look's
   chevron set Logseq's property strip redrawing without end (16 Nov). Styling a Logseq class styles every place Logseq uses it.
2. **Only the changed screen was looked at again.** The owner found the rest.
3. **The first fix did not recheck the owner's exact case** ("there is still a ring").
4. **What was tested was not what shipped.** Threads share one folder; a release carried another thread's half-done work.

## The loop, for every change that ships

1. **Reproduce first.** For a complaint, write a case in `cases/` (one small file: the owner's words, the graph, a check that
   returns `{ ok, said }`) and see it fail on the plugin as it is. The case stays for good: every later change must keep it passing.
2. **Work in a folder that holds only your change**: a clean clone of origin with your hunks, never the shared checkout.
3. **Say what you mean to change, then run the guard:**
   `node tools/guard/guard.js run --change <your folder> --expect "tag with a table,row view, a row pressed"`
   (`guard.js screens` lists the screens). It starts its own Logseq for each test graph at once (ports 9340, 9341), goes round
   every screen and case on your folder, compares them with the pictures of origin/main (taken once per release and kept;
   `guard.js baseline` takes them ahead), and writes a page with each difference marked in red, before and after. Under three
   minutes.
4. **Read the page.** A difference on a screen you named: give the reason in a sentence, as the owner would read it
   (`guard.js why <run> "<screen>" "<reason>"`). A difference on any other screen, a case that passed before and fails now, a new
   console error or a screen that keeps redrawing: fix the plugin and run again. No reason passes those.
5. **When it says PASSED**, commit, release and publish its page with the release, so the owner can look if they want.

`tools/release.sh` refuses to release files the guard has not passed (the Claude hook that also refused commits was switched
off by the owner on 19 November 2026). Do not work around it. A commit that changes nothing that ships (a test, a README, a tool) needs no pass.
If the guard itself is wrong (a screen will not set up, a false difference), fix the guard in its own change and say so.

## What it does not see

Typing into the graph (writes are made and read back by `tools/write-check.js`, which the release check runs in the guard's Logseq), Apple's tools (off in its Logseq), motion
between the pictures (it sees the screen at rest and counts restless redraws), and screens not in the tour: when a change touches
one, add it to `tour.js` in the same change.
