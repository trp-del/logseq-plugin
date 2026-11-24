# Measures of place, size and movement

The guard sees each screen at rest. This tool watches what happens between the press and the rest: every animation frame of a
bar, list, menu or window as it opens, and the screen's own frames from the debugging port. It answers, in numbers, whether a
thing opens fast, in one step, where it belongs, as big as what it holds, without moving anything else and without a flash.
Made on 24 November 2026 at the owner's word: "compare to the pixel and measure movement to make sure everything works properly,
fast, without flickering, and in the right space and alignment. use maths".

    node tools/measure/measure.js --list
    node tools/measure/measure.js --runs 5 --out <folder>                      # today's numbers
    node tools/measure/measure.js --runs 5 --out <folder> --against <main's measures.json>   # a change, beside main

It starts a Logseq of its own (port 9480, 700 × 560, a copy of the flow's test graph) and closes it. Nothing here ships.

| | What is measured | Passes when |
|---|---|---|
| M1 | time from the last key or press to the first frame the thing is shown | median ≤ 80 ms, 95th percentile ≤ 120 ms |
| M2 | time it goes on changing after that | ≤ its named motion + 34 ms |
| M3 | the largest move of anything the person did not move | ≤ 0.5 pt |
| M4 | changes of direction, and overshoot, of its place, size and opacity | 0, ≤ 0.5 pt |
| M5 | shown, gone, shown again; and pixels whose brightness goes one way and back within three frames, (b − a)(c − b) < 0 with both steps over 12 | 0; ≤ 0.1% of the screen |
| M6 | the longest gap between frames while it moves | ≤ 34 ms |
| M7 | while typing: rows that stay keep their place, no empty list between two full ones, the corner stays, height changes | 0, 0, ≤ 0.5 pt, ≤ 1 a letter |
| M8 | sizes it takes with no motion named for it | 1 |
| G1 | distance from the edge of what called it (or from the caret), and the gap | ≤ 0.5 pt (for a caret: it starts 0 to 32 pt left of the caret, where the typed sign starts, or ends there); 4 to 8 pt |
| G2 | the tallest band in it where nothing stands; the room beside its widest row | ≤ 36 pt; ≤ 40 pt |
| G3 | its nearest edge of the window | ≥ 8 pt |
| G4 | area of what the person is acting on that it covers | 0 |
| G5 | spread of its rows' heights and edges | ≤ 0.5 pt |
| T1 | words in the wrong face (a property's name mono, a tag serif) | 0 |

Against a baseline, a line that failed before and is no worse does not stop the run; a line that is worse does. A flash over the
line saves its three frames beside the results (`<flow>.flash0.png` to `flash2.png`). The maths is `maths.js`
(`node tools/measure/maths.js --test`), the flows `flows.js`: add a flow in the same change that adds a bar, list or window.
