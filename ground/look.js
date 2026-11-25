/* GROUND: the look's ground. The greys, sizes and faces every piece is drawn from, mixed from Logseq's own text colour so
   they follow light, dark and any theme. A piece names what it draws with these and carries no colour or size of its own. */
(function () {
const G = window.PluginDoor;
G.look = {
  TOKENS: `
:root { --lk-text: var(--ls-primary-text-color, hsl(var(--foreground))); --lk-paper: var(--ls-primary-background-color, hsl(var(--background)));
  --lk-quiet: color-mix(in srgb, var(--lk-text) 70%, transparent); --lk-off: color-mix(in srgb, var(--lk-text) 46%, transparent);
  --lk-hair: color-mix(in srgb, var(--lk-text) 12%, transparent); --lk-line: color-mix(in srgb, var(--lk-text) 26%, transparent);
  --lk-link: color-mix(in srgb, var(--lk-text) 45%, transparent); --lk-link-width: .5px;
  --lk-wash: color-mix(in srgb, var(--lk-text) 7%, transparent); --lk-lit: color-mix(in srgb, var(--lk-text) 16%, transparent);
  --lk-glass: color-mix(in srgb, var(--lk-paper) 72%, transparent); --lk-glass-blur: blur(22px) saturate(1.6); --lk-float-shadow: 0 12px 34px rgba(0,0,0,.22);
  --lk-tag-face: "New York", ui-serif, Georgia, serif;
  --lk-prop-face: "SF Mono", ui-monospace, Menlo, Monaco, monospace; --lk-prop-weight: 300;
  --lk-small: 13px; --lk-label: 12px;
  --lk-line-size: 14px; --lk-line-lead: 21px; --lk-line-h: 28px;
  --lk-coming: var(--rx-green-11, #18794e); --lk-going: var(--rx-red-10, #dc3e42); }`,
  /* What is pressed, and what a change will do. One kind for each job: the yes that decides (filled), a plain press (a quiet
     capsule), a third-level press (no ground), a tick box. What a change brings is green text; what it takes away is struck
     through in red; both read where they will happen, before the change is made. */
  PRESS: `
.lk-btn, .lk-accent { appearance: none; border: 0; font: inherit; cursor: pointer; border-radius: 1em; display: inline-flex; align-items: center; gap: .35em; padding: 4px 12px; margin: 0; line-height: 1.35; white-space: nowrap; color: var(--lk-text); }
.lk-btn { background: var(--lk-wash); }
.lk-btn:hover, .lk-btn:focus-visible { background: color-mix(in srgb, currentColor 13%, transparent); outline: none; }
.lk-btn.lk-low { background: none; padding: 4px 8px; }
.lk-btn.lk-low:hover, .lk-btn.lk-low:focus-visible { background: var(--lk-wash); }
.lk-accent { background: var(--lk-text); color: var(--lk-paper); font-weight: 600; padding-inline: 16px; }
.lk-accent:hover, .lk-accent:focus-visible { background: color-mix(in srgb, var(--lk-text) 82%, transparent); outline: none; }
:is(.lk-btn, .lk-accent):disabled { opacity: .45; cursor: default; pointer-events: none; }
input.lk-tick[type=checkbox] { appearance: none; -webkit-appearance: none; position: relative; box-sizing: border-box; width: 14px; height: 14px; margin: 0; padding: 0; flex: none; border: 1.5px solid var(--lk-line); border-radius: 4px; background: none; color: inherit; cursor: pointer; vertical-align: -2px; box-shadow: none; outline: none; }
input.lk-tick[type=checkbox]:is(:checked, :focus, :hover) { border-color: currentColor; background: none; box-shadow: none; outline: none; }
input.lk-tick[type=checkbox]:checked::before { content: ""; position: absolute; left: 3px; top: .5px; width: 4px; height: 8px; border: solid currentColor; border-width: 0 1.6px 1.6px 0; transform: rotate(42deg); }
.lk-coming { color: var(--lk-coming); }
.lk-going { color: var(--lk-going); text-decoration: line-through; text-decoration-thickness: 1.5px; }`,
};
})();
