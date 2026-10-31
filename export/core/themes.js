/* The looks of a PDF, each a small set of rules over the classes core/html.js writes (x-title, x-p, x-li, …), and the
   page: paper, margins, text size, a footer and page numbers. Minimal on purpose: one text colour, greys for what is
   secondary, hairlines, no colour. The same rules, written inline, dress the HTML for the clipboard. Pure, runs in Node.

   stylesheet(key, page) → the CSS for a printed or previewed page.   inliner(key, page) → { cls, root }: cls(name) gives
   a style attribute for a class name, root the style of the wrapping element. */
(function () {
const E = (window.DbExport ||= {});

/* Static fonts only, never the system font (-apple-system, system-ui, BlinkMacSystemFont) or SF Mono: San Francisco is a
   variable font, which Chromium's PDF writer cannot embed, so it draws its glyphs as Type 3 outlines, and the Mac's print
   window then flattens those to paths: a PDF whose words cannot be selected or searched (seen in Logseq 2.0.2,
   2026-10-29). Helvetica Neue, Charter, Menlo and the rest are static and come out as embedded text. */
const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const SERIF = 'Charter, "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif';
const MONO = 'Menlo, Consolas, "Liberation Mono", "Courier New", monospace';
const VARIABLE_FONTS = /-apple-system|BlinkMacSystemFont|system-ui|SF Mono|SF Pro|Segoe UI Variable|Inter Variable/i;
const INK = '#111', QUIET = '#666', FAINT = '#999', HAIR = '#d4d4d4', WASH = '#f4f4f4';

const SIZES = { small: 9.5, normal: 10.5, large: 12 };
const MARGINS = { narrow: '14mm 15mm 16mm', normal: '20mm 20mm 22mm', wide: '26mm 30mm 28mm' };

/* The rules every look shares; a look overrides what makes it itself. Sizes in pt from the base `b`. */
function common(b, font) {
  const s = n => `${(b * n).toFixed(2).replace(/\.?0+$/, '')}pt`;
  return {
    doc: `font-family:${font};font-size:${s(1)};line-height:1.45;color:${INK};`,
    head: `margin:0 0 ${s(1.6)};`,
    kicker: `margin:0 0 ${s(0.2)};font-size:${s(0.9)};color:${QUIET};`,
    title: `margin:0 0 ${s(0.4)};font-size:${s(2.1)};font-weight:600;line-height:1.15;letter-spacing:-0.01em;`,
    subtitle: `margin:0 0 ${s(0.5)};font-size:${s(1.15)};color:${QUIET};`,
    byline: `margin:0 0 ${s(0.6)};font-size:${s(0.9)};color:${QUIET};`,
    props: `margin:0;padding:${s(0.6)} 0 0;font-size:${s(0.9)};color:${QUIET};border-top:0.5pt solid ${HAIR};line-height:1.5;`,
    h2: `margin:${s(1.8)} 0 ${s(0.5)};font-size:${s(1.35)};font-weight:600;line-height:1.25;`,
    h3: `margin:${s(1.4)} 0 ${s(0.4)};font-size:${s(1.15)};font-weight:600;line-height:1.3;`,
    h4: `margin:${s(1.2)} 0 ${s(0.3)};font-size:${s(1)};font-weight:600;`,
    p: `margin:0 0 ${s(0.7)};`,
    ul: `margin:0 0 ${s(0.6)};padding-left:${s(1.6)};`,
    ol: `margin:0 0 ${s(0.6)};padding-left:${s(1.8)};`,
    li: `margin:0 0 ${s(0.25)};`,
    meta: `font-size:${s(0.86)};color:${QUIET};`,
    'meta-line': `margin-top:${s(-0.4)};`,
    tag: `font-family:${MONO};font-size:${s(0.8)};color:${FAINT};`,
    task: `color:${FAINT};font-size:${s(1)};`,
    done: `color:${FAINT};`,
    pre: `font-family:${MONO};font-size:${s(0.85)};line-height:1.45;background:${WASH};padding:${s(0.6)} ${s(0.8)};margin:0 0 ${s(0.8)};white-space:pre-wrap;word-break:break-word;`,
    code: `font-family:${MONO};font-size:${s(0.88)};background:${WASH};padding:0 ${s(0.2)};`,
    quote: `margin:0 0 ${s(0.8)};padding:0 0 0 ${s(1)};border-left:1.5pt solid ${HAIR};color:#333;`,
    cite: `font-style:normal;font-size:${s(0.86)};color:${QUIET};white-space:nowrap;`,
    figure: `margin:${s(0.4)} 0 ${s(0.9)};`,
    img: `max-width:100%;height:auto;display:block;`,
    caption: `margin-top:${s(0.3)};font-size:${s(0.86)};color:${QUIET};`,
    file: `text-decoration:none;border-bottom:0.5pt solid ${HAIR};`,
    a: `color:inherit;text-decoration:underline;text-decoration-color:${FAINT};text-underline-offset:2px;`,
    mark: `background:#eee;`,
    math: `font-family:${SERIF};font-style:italic;`,
    hr: `border:0;border-top:0.5pt solid ${HAIR};margin:${s(1.6)} 0;`,
    table: `border-collapse:collapse;width:100%;margin:${s(0.3)} 0 ${s(1)};font-size:${s(0.92)};`,
    th: `text-align:left;font-weight:600;padding:${s(0.35)} ${s(0.8)} ${s(0.35)} 0;border-bottom:1pt solid ${INK};vertical-align:bottom;`,
    td: `padding:${s(0.4)} ${s(0.8)} ${s(0.4)} 0;border-bottom:0.5pt solid ${HAIR};vertical-align:top;`,
    name: `width:40%;`,
    query: `margin-bottom:${s(0.3)};`,
    month: `margin:${s(1.8)} 0 ${s(0.6)};padding-bottom:${s(0.25)};font-size:${s(1.25)};font-weight:600;border-bottom:1pt solid ${INK};`,
    entry: `display:flex;gap:${s(1.2)};margin:0 0 ${s(0.9)};`,
    stay: `background:${WASH};padding:${s(0.5)} ${s(0.8)};margin-left:${s(-0.8)};`,
    date: `flex:0 0 ${s(7.5)};font-weight:600;font-size:${s(0.95)};line-height:1.45;`,
    under: `display:block;font-weight:400;color:${QUIET};font-size:${s(0.86)};`,
    what: `flex:1;min-width:0;`,
    cal: `border-collapse:collapse;width:100%;margin:0 0 ${s(0.5)};`,
    calrow: `border-bottom:0.5pt solid ${HAIR};`,
    calday: `width:${s(6)};padding:${s(0.6)} ${s(1)} ${s(0.6)} 0;vertical-align:top;white-space:nowrap;`,
    weekday: `display:block;font-size:${s(0.78)};color:${QUIET};text-transform:uppercase;letter-spacing:0.05em;`,
    calitems: `padding:${s(0.6)} 0 ${s(0.4)};vertical-align:top;`,
    calitem: `margin:0 0 ${s(0.4)};`,
    time: `color:${QUIET};font-variant-numeric:tabular-nums;`,
    embed: `list-style:none;`,
    pic: `list-style:none;`,
  };
}

const looks = [
  { key: 'plain', name: 'Plain', about: 'A sans-serif, black on white, headings by weight alone.',
    rules: b => common(b, SANS) },
  { key: 'book', name: 'Book', about: 'A serif in a narrower measure, a centred title, like a printed page.',
    rules: b => ({ ...common(b, SERIF), doc: `font-family:${SERIF};font-size:${b * 1.05}pt;line-height:1.5;color:${INK};max-width:${b * 44}pt;margin:0 auto;`,
      head: `margin:0 0 ${b * 2.2}pt;text-align:center;`, title: `margin:0 0 ${b * 0.5}pt;font-size:${b * 2}pt;font-weight:400;line-height:1.2;`,
      h2: `margin:${b * 2}pt 0 ${b * 0.6}pt;font-size:${b * 1.3}pt;font-weight:600;line-height:1.3;`, props: `margin:0;padding:${b * 0.6}pt 0 0;font-size:${b * 0.9}pt;color:${QUIET};border-top:0;line-height:1.5;`,
      p: `margin:0 0 ${b * 0.8}pt;text-align:justify;hyphens:auto;` }) },
  { key: 'compact', name: 'Compact', about: 'Smaller type, tighter spacing, narrow margins: for long notes.',
    rules: b => ({ ...common(b * 0.9, SANS), doc: `font-family:${SANS};font-size:${b * 0.9}pt;line-height:1.35;color:${INK};`,
      p: `margin:0 0 ${b * 0.4}pt;`, li: `margin:0;`, ul: `margin:0 0 ${b * 0.3}pt;padding-left:${b * 1.3}pt;`, ol: `margin:0 0 ${b * 0.3}pt;padding-left:${b * 1.5}pt;`,
      h2: `margin:${b * 1.2}pt 0 ${b * 0.3}pt;font-size:${b * 1.15}pt;font-weight:600;`, head: `margin:0 0 ${b * 1}pt;`, title: `margin:0 0 ${b * 0.3}pt;font-size:${b * 1.7}pt;font-weight:600;line-height:1.15;` }) },
  { key: 'typewriter', name: 'Typewriter', about: 'One monospaced face, one size; headings underlined.',
    rules: b => ({ ...common(b * 0.95, MONO), doc: `font-family:${MONO};font-size:${b * 0.95}pt;line-height:1.5;color:${INK};`,
      title: `margin:0 0 ${b * 0.5}pt;font-size:${b * 1.3}pt;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;`,
      h2: `margin:${b * 1.8}pt 0 ${b * 0.5}pt;font-size:${b * 0.95}pt;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1pt solid ${INK};padding-bottom:${b * 0.2}pt;`,
      h3: `margin:${b * 1.4}pt 0 ${b * 0.4}pt;font-size:${b * 0.95}pt;font-weight:700;text-decoration:underline;`,
      pre: `font-family:${MONO};font-size:${b * 0.95}pt;background:none;padding:0 0 0 ${b * 1.5}pt;margin:0 0 ${b * 0.8}pt;white-space:pre-wrap;`, code: `font-family:${MONO};background:none;`,
      month: `margin:${b * 1.8}pt 0 ${b * 0.6}pt;font-size:${b * 0.95}pt;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1pt solid ${INK};` }) },
];
const look = key => looks.find(l => l.key === key) || looks[0];
const page = (p = {}) => ({ paper: p.paper === 'Letter' ? 'Letter' : 'A4', margins: MARGINS[p.margins] ? p.margins : 'normal', size: SIZES[p.size] ? p.size : 'normal',
  footer: String(p.footer || '').trim(), pageNumbers: p.pageNumbers !== false, customCss: String(p.customCss || '') });
const cssString = text => `"${String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/</g, '\\3c ').replace(/\n/g, ' ')}"`;

/* The printed page. The footer and page numbers sit in the page's margin boxes (Chromium 131 and later draws them;
   Logseq 2.0.2 is on 148). Breaks: nothing short is split across pages, a heading never ends one. */
function stylesheet(key, p = {}) {
  const pg = page(p), rules = look(key).rules(SIZES[pg.size]);
  const box = `font-family:${SANS};font-size:8pt;color:${FAINT};`;
  const margin = (pg.footer || pg.pageNumbers) ? [(pg.footer ? `@bottom-left { content: ${cssString(pg.footer)}; ${box} }` : ''),
    (pg.pageNumbers ? `@bottom-right { content: counter(page) " / " counter(pages); ${box} }` : '')].join(' ') : '';
  return [
    `@page { size: ${pg.paper}; margin: ${MARGINS[pg.margins]}; ${margin} }`,
    `html, body { margin: 0; padding: 0; background: #fff; }`,
    `body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`,
    `@media screen { body { padding: ${MARGINS[pg.margins]}; } }`,
    `* { box-sizing: border-box; }`,
    ...Object.entries(rules).map(([name, decl]) => `.x-${name} { ${decl} }`),
    `.x-p, .x-li, .x-figure, .x-pre, .x-quote, .x-entry, .x-calrow, .x-calitem, tr { break-inside: avoid; }`,
    `.x-title, .x-h2, .x-h3, .x-h4, .x-month, .x-query { break-after: avoid; }`,
    `.x-head { break-after: avoid; }`,
    `img { max-width: 100%; }`,
    pg.customCss ? `/* your own rules */\n${pg.customCss}` : '',
  ].filter(Boolean).join('\n');
}
/* The same rules written inline, for the clipboard. */
function inliner(key, p = {}) {
  const pg = page(p), rules = look(key).rules(SIZES[pg.size]);
  const cls = names => { const decl = names.split(' ').map(n => rules[n] || '').join(''); return decl ? ` style="${decl.replace(/"/g, "'")}"` : ''; };
  return { cls, root: rules.doc.replace(/max-width:[^;]+;|margin:0 auto;/g, '') };
}
E.themes = { looks, look, page, stylesheet, inliner, SIZES, MARGINS, VARIABLE_FONTS };
})();
