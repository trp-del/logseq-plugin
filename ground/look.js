/* GROUND: the look's ground. The greys, sizes and faces every piece is drawn from, mixed from Logseq's own text colour so
   they follow light, dark and any theme. A piece names what it draws with these and carries no colour or size of its own.
   A longer motion's length and curve are named here too (MOTION). */
(function () {
const G = window.PluginDoor;
G.look = {
  /* Focusing into a bullet and out (the owner picked it, 11 and 26 November 2026). The bullet moves for ms on ease. The views
     fade on fade, over parts of ms: the old one goes in away (awayStill where the Mac asks for less motion and nothing moves),
     the new one comes in over in, after inDelay going in and outDelay stepping out. wait: how long the new view is waited for; rest: how long a bullet
     drawn late must stand still before it moves;
     cap: when a copy of the old view or a lifted cut is cleared although its motion never ended (a window in the background). */
  MOTION: { glide: { ms: 280, ease: 'cubic-bezier(.2,.7,.2,1)', fade: 'ease-out', away: .35, awayStill: .6, in: .8, inDelay: .35, outDelay: .25, wait: 2000, rest: 40, cap: 2000 } },
  /* The faces. Logseq reaches no face of the Mac by its name alone ("New York" came out as Georgia, "SF Mono" as Menlo), so
     each face the look uses comes with the plugin, in fonts/, and is said from there once Logseq has told the plugin where its
     folder is (root: logseq.baseInfo.lsr, known at the start, not at load). A tag is written in Commissioner with its stroke ends widened, a property's name in
     Fragment Mono (the owner, 26 November 2026); the words are in Logseq's own text face. Both are free under the SIL Open
     Font License, the licences beside the files. Commissioner is one file for all its weights; the widened ends are
     its FLAR setting at 100. Where a file is not
     there the next face in the token stands in. */
  faces: root => root ? ['Commissioner.ttf|LK Commissioner|100 900|normal|"FLAR" 100', 'FragmentMono-Regular.ttf|LK Fragment|400|normal'].map(one => { const [file, name, weight, style, set] = one.split('|'); return `@font-face { font-family: "${name}"; font-weight: ${weight}; font-style: ${style}; ${set ? `font-variation-settings: ${set}; ` : ''}src: url("${root}fonts/${file}") format("truetype"); }`; }).join('\n') : '',
  TOKENS: `
:root { --lk-text: var(--ls-primary-text-color, hsl(var(--foreground))); --lk-paper: var(--ls-primary-background-color, hsl(var(--background)));
  --lk-quiet: color-mix(in srgb, var(--lk-text) 70%, transparent); --lk-off: color-mix(in srgb, var(--lk-text) 46%, transparent);
  --lk-hair: color-mix(in srgb, var(--lk-text) 12%, transparent); --lk-line: color-mix(in srgb, var(--lk-text) 26%, transparent);
  --lk-link: color-mix(in srgb, var(--lk-text) 45%, transparent); --lk-link-width: .5px;
  --lk-wash: color-mix(in srgb, var(--lk-text) 7%, transparent); --lk-lit: color-mix(in srgb, var(--lk-text) 16%, transparent);
  --lk-glass: color-mix(in srgb, var(--lk-paper) 72%, transparent); --lk-glass-blur: blur(22px) saturate(1.6); --lk-float-shadow: 0 12px 34px rgba(0,0,0,.22);
  --lk-tag-face: "LK Commissioner", system-ui, sans-serif; --lk-tag-size: .92em;
  --lk-prop-face: "LK Fragment", Menlo, Monaco, monospace; --lk-prop-weight: 400;
  --lk-words-size: 16px; --lk-small: 13px; --lk-label: 12px; --lk-prop-size: .87em;   /* the sizes: a page's words (a window's and a menu's are --lk-line-size), small, a label; a property's name a touch under the words beside it */
  --lk-corner: 6px; --lk-corner-float: 10px; --lk-corner-round: 999px;   /* three corners: a lit line, a field and a small box; what floats; a press */
  --lk-line-size: 14px; --lk-line-lead: 21px; --lk-line-h: 28px;
  --lk-mark-box: 16px; --lk-mark-gap: 4px;   /* a mark before words (a bullet, a fold arrow, a list's mark) stands in a box 16 wide that ends 4 before them */
  --lk-bullet: var(--lx-gray-08, var(--ls-block-bullet-color, var(--rx-gray-08, color-mix(in srgb, var(--lk-text) 28%, transparent))));
  --lk-bullet-ring: var(--lx-gray-04-alpha, var(--ls-block-bullet-border-color, var(--rx-gray-04-alpha, color-mix(in srgb, var(--lk-text) 7%, transparent))));   /* Logseq's bullet and the ring of a folded one, by Logseq's own names */
  --lk-coming: var(--rx-green-11, #18794e); --lk-going: var(--rx-red-10, #dc3e42); }`,
  /* What is pressed, and what a change will do. One kind for each job: the yes that decides (filled), a plain press (a quiet
     capsule), a third-level press (no ground), Delete in red with its bin, the blue yes Undo cannot take back, a word that opens a
     menu, a tick box; a small picture before a press's word where its job has one. What a change brings is green text; what it takes away is struck
     through in red; both read where they will happen, before the change is made. */
  PRESS: `
.lk-btn, .lk-accent, .lk-del { appearance: none; border: 0; font: inherit; cursor: pointer; border-radius: var(--lk-corner-round); display: inline-flex; align-items: center; gap: .35em; padding: 4px 12px; margin: 0; line-height: 1.35; white-space: nowrap; color: var(--lk-text); }
.lk-btn { background: var(--lk-wash); }
.lk-btn:hover, .lk-btn:focus-visible { background: color-mix(in srgb, currentColor 13%, transparent); outline: none; }
.lk-btn.lk-low { background: none; padding: 4px 8px; }
.lk-btn.lk-low:hover, .lk-btn.lk-low:focus-visible { background: var(--lk-wash); }
.lk-accent { background: var(--lk-text); color: var(--lk-paper); font-weight: 600; padding-inline: 16px; }
.lk-accent:hover, .lk-accent:focus-visible { background: color-mix(in srgb, var(--lk-text) 82%, transparent); outline: none; }
/* The presses as the plugin drew them before the rebuild (0.5.17; the owner chose the old buttons back, 26 November 2026): Delete
   in red on no ground with its bin, at whatever level it stands; the one yes that Undo cannot put back filled in blue (lk-big);
   a word with a chevron after it that opens a menu (lk-change, "By day ⌄"); and a small picture before a
   press's word (lk-i-…), each drawn once here. */
.lk-del { background: none; color: var(--lk-going); padding: 4px 8px; }
.lk-del:hover, .lk-del:focus-visible { background: var(--lk-wash); outline: none; }
.lk-del:not([class*="lk-i-"])::before { content: ""; display: inline-block; width: 1.05em; height: 1.05em; vertical-align: -.15em; margin-right: .38em; background: currentColor; -webkit-mask: var(--lk-ic-bin) center / contain no-repeat; mask: var(--lk-ic-bin) center / contain no-repeat; }
.lk-btn.lk-low.lk-going-btn, .lk-btn.lk-low.lk-pick-del { color: var(--lk-going); }
.lk-big { appearance: none; border: 0; font: inherit; font-weight: 600; cursor: pointer; border-radius: var(--lk-corner-round); display: inline-flex; align-items: center; gap: .35em; padding: 4px 14px; margin: 0; line-height: 1.35; white-space: nowrap; background: color-mix(in srgb, var(--rx-blue-09, #0091ff) 80%, #000); color: #fff; }
.lk-big:hover, .lk-big:focus-visible { background: color-mix(in srgb, var(--rx-blue-09, #0091ff) 68%, #000); outline: none; }
.lk-change { appearance: none; border: 0; background: none; font: inherit; cursor: pointer; border-radius: var(--lk-corner); color: var(--lk-quiet); padding: 0 4px; }
.lk-change:hover, .lk-change:focus-visible { color: var(--lk-text); background: var(--lk-wash); outline: none; }
.lk-change { font-size: var(--lk-small); white-space: nowrap; padding: 1px 4px; }
.lk-change::after { content: ""; display: inline-block; width: .9em; height: .9em; margin-left: .2em; vertical-align: -.12em; background: currentColor; -webkit-mask: var(--lk-ic-chevron) center / contain no-repeat; mask: var(--lk-ic-chevron) center / contain no-repeat; }
:is(.lk-btn, .lk-accent, .lk-del, .lk-big):disabled { opacity: .45; cursor: default; pointer-events: none; }
:root { --lk-ic-go: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'%23000'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'M2.5%208h11M9.5%204l4%204-4%204'%2F%3E%3C%2Fsvg%3E"); --lk-ic-up: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'%23000'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'M8%2013.5v-11M4%206.5l4-4%204%204'%2F%3E%3C%2Fsvg%3E"); --lk-ic-move: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'%23000'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'M3%202.5V8a2%202%200%200%200%202%202h8.5M10%206.5l3.5%203.5-3.5%203.5'%2F%3E%3C%2Fsvg%3E"); --lk-ic-child: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'%23000'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'M3%202.5V6a2%202%200%200%200%202%202h2M11%204.5v7M7.5%208h7'%2F%3E%3C%2Fsvg%3E"); --lk-ic-merge: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'%23000'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'M3%202.5%208%208l5-5.5M8%208v5.5M5%2010.5l3%203%203-3'%2F%3E%3C%2Fsvg%3E"); --lk-ic-split: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'%23000'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'M2.5%208h4l6-4.5M6.5%208l6%204.5M9.5%203.5h3v3M9.5%2012.5h3v-3'%2F%3E%3C%2Fsvg%3E"); --lk-ic-plus: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'%23000'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'M8%202.5v11M2.5%208h11'%2F%3E%3C%2Fsvg%3E"); --lk-ic-chevron: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'%23000'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'M4%206l4%204%204-4'%2F%3E%3C%2Fsvg%3E"); --lk-ic-minus: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'%23000'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'M2.5%208h11'%2F%3E%3C%2Fsvg%3E"); --lk-ic-bin: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'%23000'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'M2.5%204.5h11M5.5%204.5V3a1%201%200%200%201%201-1h3a1%201%200%200%201%201%201v1.5M4%204.5l.7%209a1%201%200%200%200%201%20.9h4.6a1%201%200%200%200%201-.9l.7-9'%2F%3E%3C%2Fsvg%3E"); --lk-ic-rename: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'%23000'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'M10.4%202.9%2013.1%205.6%205.4%2013.3l-3%20.3.3-3zM8.8%204.5l2.7%202.7'%2F%3E%3C%2Fsvg%3E"); --lk-ic-copy: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'%23000'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'M6.4%205.2h6.4A1.2%201.2%200%200%201%2014%206.4v6.4a1.2%201.2%200%200%201-1.200%201.200H6.400a1.200%201.200%200%200%201-1.200-1.200V6.400a1.200%201.200%200%200%201%201.200-1.200zM11%202.400H3.600a1.200%201.200%200%200%200-1.200%201.200V11'%2F%3E%3C%2Fsvg%3E"); --lk-ic-eq: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'%23000'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'M3%205.800h10M3%2010.200h10'%2F%3E%3C%2Fsvg%3E"); --lk-ic-sidel: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'%23000'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'M3%203h10a1.200%201.200%200%200%201%201.200%201.200v7.600A1.200%201.200%200%200%201%2013%2013H3a1.200%201.200%200%200%201-1.200-1.200V4.200A1.200%201.200%200%200%201%203%203zM6%203v10'%2F%3E%3C%2Fsvg%3E"); --lk-ic-side: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'%23000'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'M3%203h10a1.200%201.200%200%200%201%201.200%201.200v7.600A1.200%201.200%200%200%201%2013%2013H3a1.200%201.200%200%200%201-1.200-1.200V4.200A1.200%201.200%200%200%201%203%203zM10%203v10'%2F%3E%3C%2Fsvg%3E"); --lk-ic-tick: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'%23000'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'M3.500%208.200%206.500%2011.200%2012.500%205.200'%2F%3E%3C%2Fsvg%3E"); --lk-ic-x: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'%23000'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'm3.800%203.800%208.400%208.400M12.200%203.800l-8.400%208.400'%2F%3E%3C%2Fsvg%3E"); --lk-ic-save: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'%23000'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'M8%202.500v8M4.500%207%208%2010.500%2011.500%207M3%2013.500h10'%2F%3E%3C%2Fsvg%3E"); --lk-ic-tag: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'%23000'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'M2.500%202.500h5l6%206-5%205-6-6zM5.300%205.300h.010'%2F%3E%3C%2Fsvg%3E"); --lk-ic-list: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'%23000'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'M5.500%204h8M5.500%208h8M5.500%2012h8M2.500%204h.010M2.500%208h.010M2.500%2012h.010'%2F%3E%3C%2Fsvg%3E"); --lk-ic-history: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'%23000'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'M8%205v3l2%201.500M2.700%207a5.500%205.500%200%201%201%20.800%203.600M2.500%2013.500V10.500h3'%2F%3E%3C%2Fsvg%3E"); --lk-ic-calendar: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'%23000'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'M3%204h10v9.500H3zM3%207h10M5.500%202.500v3M10.500%202.500v3'%2F%3E%3C%2Fsvg%3E"); --lk-ic-undo: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'%23000'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'M6%209.500%203%206.500l3-3M3%206.500h7.500a3%203%200%200%201%200%206H9'%2F%3E%3C%2Fsvg%3E"); --lk-ic-reload: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'%23000'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'M13%208a5%205%200%201%201-1.500-3.500M13%202v3.500H9.500'%2F%3E%3C%2Fsvg%3E"); --lk-ic-enter: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'%23000'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'M13%203.500V7.800a2%202%200%200%201-2%202H3.500M6.800%206.500%203.500%209.800l3.300%203.300'%2F%3E%3C%2Fsvg%3E"); }
.lk-i-go { --lk-ic: var(--lk-ic-go); }
.lk-i-up { --lk-ic: var(--lk-ic-up); }
.lk-i-move { --lk-ic: var(--lk-ic-move); }
.lk-i-child { --lk-ic: var(--lk-ic-child); }
.lk-i-merge { --lk-ic: var(--lk-ic-merge); }
.lk-i-split { --lk-ic: var(--lk-ic-split); }
.lk-i-plus { --lk-ic: var(--lk-ic-plus); }
.lk-i-chevron { --lk-ic: var(--lk-ic-chevron); }
.lk-i-minus { --lk-ic: var(--lk-ic-minus); }
.lk-i-bin { --lk-ic: var(--lk-ic-bin); }
.lk-i-rename { --lk-ic: var(--lk-ic-rename); }
.lk-i-copy { --lk-ic: var(--lk-ic-copy); }
.lk-i-eq { --lk-ic: var(--lk-ic-eq); }
.lk-i-sidel { --lk-ic: var(--lk-ic-sidel); }
.lk-i-side { --lk-ic: var(--lk-ic-side); }
.lk-i-tick { --lk-ic: var(--lk-ic-tick); }
.lk-i-x { --lk-ic: var(--lk-ic-x); }
.lk-i-save { --lk-ic: var(--lk-ic-save); }
.lk-i-tag { --lk-ic: var(--lk-ic-tag); }
.lk-i-list { --lk-ic: var(--lk-ic-list); }
.lk-i-history { --lk-ic: var(--lk-ic-history); }
.lk-i-calendar { --lk-ic: var(--lk-ic-calendar); }
.lk-i-undo { --lk-ic: var(--lk-ic-undo); }
.lk-i-reload { --lk-ic: var(--lk-ic-reload); }
.lk-i-enter { --lk-ic: var(--lk-ic-enter); }
:is(.lk-btn, .lk-accent, .lk-del, .lk-big)[class*="lk-i-"]::before { content: ""; display: inline-block; width: 1.05em; height: 1.05em; vertical-align: -.15em; margin-right: .38em; background: currentColor; -webkit-mask: var(--lk-ic) center / contain no-repeat; mask: var(--lk-ic) center / contain no-repeat; }
:is(.lk-btn, .lk-accent, .lk-del, .lk-big)[class*="lk-i-"] { gap: 0; }
/* A key is told only where it is not a common one, as the Mac writes it, with no box round it (the owner, 25 November 2026). */
.lk-key { color: var(--lk-off); font-size: var(--lk-small); letter-spacing: .04em; white-space: nowrap; }
/* The one place keys are what is read, the key sheet: each key in a small box in mono, in the text colour (the owner, 12 and
   26 November 2026); the Mac's marks in the system face, which draws them whole. */
.lk-keycap { display: inline-block; padding: 0 6px; border: 1px solid var(--lk-line); border-radius: var(--lk-corner); font-family: var(--lk-prop-face); font-size: var(--lk-line-size); font-weight: var(--lk-prop-weight); line-height: 1.35; }
.lk-keymark { font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
input.lk-tick[type=checkbox] { appearance: none; -webkit-appearance: none; position: relative; box-sizing: border-box; width: 14px; height: 14px; margin: 0; padding: 0; flex: none; border: 1.5px solid var(--lk-line); border-radius: 4px; background: none; color: inherit; cursor: pointer; vertical-align: -1px; box-shadow: none; outline: none; }
input.lk-tick[type=checkbox]:is(:checked, :indeterminate, :focus, :hover) { border-color: currentColor; background: none; box-shadow: none; outline: none; }
input.lk-tick[type=checkbox]:checked::before { content: ""; position: absolute; inset: 0; background: currentColor; -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3.5 8.2 6.5 11.2 12.5 5.2'/%3E%3C/svg%3E") center / 8px 8px no-repeat; }
input.lk-tick[type=checkbox]:indeterminate::before { content: ""; position: absolute; left: 2.5px; right: 2.5px; top: 4.75px; height: 1.5px; border-radius: 1px; background: currentColor; }
/* lk-window: a window in the middle of the screen, the page dimmed behind it (lk-clear leaves the page as it is); lk-pop: what
   floats beside the thing pressed, on the Mac's glass. As before the rebuild (the owner chose them back, 26 November 2026). */
.lk-window { background: var(--lk-paper); color: var(--lk-text); border: 1px solid var(--lk-hair); border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,.14); font-size: 14px; line-height: 1.5; text-align: left; }
.lk-window::backdrop { background: rgba(0,0,0,.16); }
.lk-window.lk-clear::backdrop { background: transparent; }
.lk-pop { background: var(--lk-glass); -webkit-backdrop-filter: var(--lk-glass-blur); backdrop-filter: var(--lk-glass-blur); color: var(--lk-text); border: .5px solid var(--lk-line); border-radius: var(--lk-corner-float); box-shadow: var(--lk-float-shadow); font-size: 14px; line-height: 1.4; text-align: left; }
.lk-coming { color: var(--lk-coming); }
.lk-going { color: var(--lk-going); text-decoration: line-through; text-decoration-thickness: 1.5px; }`,
};
})();
