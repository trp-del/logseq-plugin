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
  --lk-line-size: 14px; --lk-line-lead: 21px; --lk-line-h: 28px; }`,
};
})();
