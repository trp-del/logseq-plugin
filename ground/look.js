/* GROUND: the look's ground. The greys, sizes and faces every piece is drawn from, mixed from Logseq's own text colour so
   they follow light, dark and any theme. A piece names what it draws with these and carries no colour or size of its own. */
(function () {
const G = window.PluginDoor;
G.look = {
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
     capsule), a third-level press (no ground), the red yes, a tick box. What a change brings is green text; what it takes away is struck
     through in red; both read where they will happen, before the change is made. */
  PRESS: `
.lk-btn, .lk-accent, .lk-del { appearance: none; border: 0; font: inherit; cursor: pointer; border-radius: var(--lk-corner-round); display: inline-flex; align-items: center; gap: .35em; padding: 4px 12px; margin: 0; line-height: 1.35; white-space: nowrap; color: var(--lk-text); }
.lk-btn { background: var(--lk-wash); }
.lk-btn:hover, .lk-btn:focus-visible { background: color-mix(in srgb, currentColor 13%, transparent); outline: none; }
.lk-btn.lk-low { background: none; padding: 4px 8px; }
.lk-btn.lk-low:hover, .lk-btn.lk-low:focus-visible { background: var(--lk-wash); }
.lk-accent { background: var(--lk-text); color: var(--lk-paper); font-weight: 600; padding-inline: 16px; }
.lk-accent:hover, .lk-accent:focus-visible { background: color-mix(in srgb, var(--lk-text) 82%, transparent); outline: none; }
/* The yes to a change that reaches far and may not come back whole: filled in red, with Cancel beside it (the owner, 25 November 2026). */
.lk-del { background: var(--lk-going); color: #fff; font-weight: 600; padding-inline: 16px; }
.lk-del:hover, .lk-del:focus-visible { background: color-mix(in srgb, var(--lk-going) 86%, var(--lk-text)); outline: none; }
:is(.lk-btn, .lk-accent, .lk-del):disabled { opacity: .45; cursor: default; pointer-events: none; }
/* A key is told only where it is not a common one, as the Mac writes it, with no box round it (the owner, 25 November 2026). */
.lk-key { color: var(--lk-off); font-size: var(--lk-small); letter-spacing: .04em; white-space: nowrap; }
input.lk-tick[type=checkbox] { appearance: none; -webkit-appearance: none; position: relative; box-sizing: border-box; width: 14px; height: 14px; margin: 0; padding: 0; flex: none; border: 1.5px solid var(--lk-line); border-radius: 4px; background: none; color: inherit; cursor: pointer; vertical-align: -1px; box-shadow: none; outline: none; }
input.lk-tick[type=checkbox]:is(:checked, :indeterminate, :focus, :hover) { border-color: currentColor; background: none; box-shadow: none; outline: none; }
input.lk-tick[type=checkbox]:checked::before { content: ""; position: absolute; inset: 0; background: currentColor; -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3.5 8.2 6.5 11.2 12.5 5.2'/%3E%3C/svg%3E") center / 8px 8px no-repeat; }
input.lk-tick[type=checkbox]:indeterminate::before { content: ""; position: absolute; left: 2.5px; right: 2.5px; top: 4.75px; height: 1.5px; border-radius: 1px; background: currentColor; }
.lk-coming { color: var(--lk-coming); }
.lk-going { color: var(--lk-going); text-decoration: line-through; text-decoration-thickness: 1.5px; }`,
};
})();
