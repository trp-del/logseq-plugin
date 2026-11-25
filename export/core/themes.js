/* The looks of a PDF, each a small set of rules over the classes core/html.js writes (x-title, x-p, x-li, …), and the
   page: paper, margins, text size, a footer and page numbers. Minimal on purpose: one text colour, greys for what is
   secondary, hairlines, no colour. A look's `rules` can be written inline (the clipboard); its `extra` is what only a
   stylesheet can say (a grid, a ::before), for the printed and previewed sheet. The same rules, written inline, dress the HTML for the clipboard. Pure, runs in Node.

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
    typed: `font-family:${MONO};font-size:.92em;color:${INK};`,   // a task's mark typed, [ ], in any look
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
    // Prose: a heading's number, a citation's number, the contents rows, the notes.
    num: `color:${FAINT};font-weight:400;margin-right:0.5em;font-variant-numeric:tabular-nums;`,
    ref: `font-size:0.7em;line-height:0;vertical-align:super;color:${QUIET};font-variant-numeric:tabular-nums;`,
    'toc-row': `margin:0;line-height:1.6;`,
    'toc-in': `padding-left:${s(1.7)};color:${QUIET};`,
    'toc-in2': `padding-left:${s(3.4)};`,
    'toc-first': `border-top:0.5pt solid ${HAIR};padding-top:${s(0.6)};`,
    'toc-last': `border-bottom:0.5pt solid ${HAIR};padding-bottom:${s(0.6)};margin-bottom:${s(1.6)};`,
    'notes-head': `margin-top:${s(2.2)};padding-top:${s(0.9)};border-top:0.5pt solid ${HAIR};border-bottom:0;font-size:${s(1.15)};text-transform:none;letter-spacing:0;`,
    note: `margin:0 0 ${s(0.25)};padding-left:${s(1.9)};text-indent:${s(-1.9)};font-size:${s(0.9)};text-align:left;`,
    'note-first': `margin-top:${s(1.8)};padding-top:${s(0.8)};border-top:0.5pt solid ${HAIR};`,
    'note-n': `display:inline-block;width:${s(1.9)};text-indent:0;color:${QUIET};font-variant-numeric:tabular-nums;`,
  };
}

/* What only a printed or previewed sheet can draw (a pasting app keeps none of it, and reads the plain words under it): the
   task circles, Logseq's own four, drawn over the round glyph the words hold; a task's line without the bullet its mark replaces. */
const MARK = '#555';
const shared = () => `
.x-task:not(.x-typed) { display: inline-block; width: .78em; height: .78em; border: .9pt solid ${MARK}; border-radius: 50%; vertical-align: -.06em; margin-right: .1em; position: relative; overflow: hidden; color: transparent; font-size: 1em; line-height: 1; }
.x-task.x-doing:not(.x-typed) { background: linear-gradient(90deg, ${MARK} 50%, transparent 50%); }
.x-task.x-done:not(.x-typed) { background: ${MARK}; }
.x-task.x-done:not(.x-typed)::after { content: ""; position: absolute; left: 28%; top: 10%; width: 28%; height: 52%; border: solid #fff; border-width: 0 1.1pt 1.1pt 0; transform: rotate(40deg); }
.x-task.x-off:not(.x-typed) { border-color: ${FAINT}; }
.x-task.x-off:not(.x-typed)::after { content: ""; position: absolute; left: 15%; right: 15%; top: 46%; border-top: .9pt solid ${FAINT}; }
.x-li:has(> .x-task) { list-style: none; margin-left: -1.35em; }
.x-li:has(> .x-task.x-typed) { margin-left: -2.4em; }`;
// A look's sizes are written for the normal text size (10.5pt) and follow the size chosen.
const scale = b => x => `${+(x * b / 10.5).toFixed(2)}pt`;
const RULE = '#bbb', SOFT = '#888', BASK = 'Baskerville, "Baskerville Old Face", "Iowan Old Style", Georgia, serif', TAGFACE = '"Iowan Old Style", Charter, Georgia, serif';
const oneLine = `.x-props br { display: none; } .x-prop + br + .x-prop::before { content: "  ·  "; white-space: pre; }`;

const book = b => ({ ...common(b, SERIF), doc: `font-family:${SERIF};font-size:${b * 1.05}pt;line-height:1.5;color:${INK};max-width:${b * 44}pt;margin:0 auto;`,
  head: `margin:0 0 ${b * 2.2}pt;text-align:center;`, title: `margin:0 0 ${b * 0.5}pt;font-size:${b * 2}pt;font-weight:400;line-height:1.2;`,
  h2: `margin:${b * 2}pt 0 ${b * 0.6}pt;font-size:${b * 1.3}pt;font-weight:600;line-height:1.3;`, props: `margin:0;padding:${b * 0.6}pt 0 0;font-size:${b * 0.9}pt;color:${QUIET};border-top:0;line-height:1.5;`,
  p: `margin:0 0 ${b * 0.8}pt;text-align:justify;hyphens:auto;` });
/* Prose in Book, refined (the owner, 22 November 2026: "just make the current version more refined"): the line above the title
   in small spaced capitals, the subtitle in italics, the properties on one line, a quotation centred in italics with no bar,
   a heading's number hung in the margin so the headings stand on the text's edge, the notes under a short hairline. */
const bookProse = b => { const k = scale(b), c = common(b, SERIF); return { ...book(b),
  kicker: `margin:0 0 ${k(10)};font-size:${k(8)};letter-spacing:.14em;text-transform:uppercase;color:${QUIET};`,
  title: `margin:0 0 ${k(5)};font-size:${k(23)};font-weight:400;line-height:1.2;`, subtitle: `margin:0 0 ${k(8)};font-size:${k(12)};font-style:italic;color:#444;`,
  byline: `margin:0 0 ${k(4)};font-size:${k(9)};color:#777;`, props: `margin:0;padding:${k(2)} 0 0;font-size:${k(9)};color:#777;border-top:0;line-height:1.5;`,
  quote: `margin:0 0 ${k(20)};padding:0 2.2em;border-left:0;font-style:italic;color:#333;text-align:center;`,
  h2: `margin:${k(24)} 0 ${k(8)};font-size:${k(13)};font-weight:600;line-height:1.3;`, h3: `margin:${k(16)} 0 ${k(5)};font-size:${k(11.5)};font-weight:400;font-style:italic;line-height:1.3;`,
  ref: c.ref.replace(`color:${QUIET}`, `color:${INK}`),
  'notes-head': `margin-top:${k(30)};padding-top:0;border-top:0;border-bottom:0;font-size:${k(9)};font-weight:400;font-style:normal;letter-spacing:.14em;text-transform:uppercase;color:${QUIET};`,
  note: c.note + `font-size:${k(9)};color:#333;` }; };
const bookProseExtra = b => `${oneLine}
.x-h2, .x-h3, .x-h4 { position: relative; }
:is(.x-h2, .x-h3, .x-h4) > .x-num { position: absolute; right: 100%; margin-right: .9em; white-space: nowrap; font-style: normal; }
.x-notes-head::before { content: ""; display: block; width: 30%; border-top: .5pt solid ${SOFT}; margin-bottom: ${scale(b)(9)}; }`;

const looks = [
  /* Plain, redrawn 22 November 2026 after a specification sheet: a lighter title, the properties as names beside values
     between two hairlines, a heading small under a hairline, grey bullets, a tag in the serif the plugin gives tags. */
  { key: 'plain', name: 'Plain', about: 'A sans-serif on hairlines: names beside values, small headings under a line.',
    rules: b => { const k = scale(b); return { ...common(b, SANS), doc: `font-family:${SANS};font-size:${k(10)};line-height:1.5;color:#1a1a1a;`,
      head: `margin:0 0 ${k(26)};`, kicker: `margin:0 0 ${k(6)};font-size:${k(8)};letter-spacing:.08em;text-transform:uppercase;color:${SOFT};`,
      title: `margin:0 0 ${k(4)};font-size:${k(24)};font-weight:500;line-height:1.15;letter-spacing:-0.015em;`, byline: `margin:0 0 ${k(14)};font-size:${k(8.5)};color:${SOFT};`,
      props: `margin:0;padding:${k(7)} 0;font-size:${k(8.5)};color:${SOFT};border-top:0.5pt solid ${RULE};border-bottom:0.5pt solid ${RULE};line-height:1.4;`, pl: `color:${SOFT};`, pv: `color:${INK};`,
      h2: `margin:${k(22)} 0 ${k(7)};padding-top:${k(6)};border-top:0.5pt solid ${RULE};font-size:${k(10)};font-weight:600;line-height:1.3;`, h3: `margin:${k(14)} 0 ${k(4)};font-size:${k(10)};font-weight:600;line-height:1.3;`,
      p: `margin:0 0 ${k(7)};`, ul: `margin:0 0 ${k(6)};padding-left:1.35em;`, li: `margin:0 0 ${k(3)};`, meta: `font-size:${k(8.5)};color:${SOFT};`,
      month: `margin:${k(22)} 0 ${k(8)};padding-bottom:${k(3)};font-size:${k(10)};font-weight:600;border-bottom:0.5pt solid ${RULE};`,
      tag: `font-family:${TAGFACE};font-size:.9em;color:${SOFT};`, quote: `margin:0 0 ${k(8)};padding:0 0 0 1.35em;border-left:0;color:#555;font-style:italic;`,
      a: `color:inherit;text-decoration:underline;text-decoration-color:${RULE};text-decoration-thickness:0.5pt;text-underline-offset:2px;`, mark: `background:#f1eedd;`,
      th: `text-align:left;font-weight:400;font-size:${k(8)};color:${SOFT};padding:${k(3.5)} ${k(8)} ${k(3.5)} 0;border-bottom:0.5pt solid ${RULE};vertical-align:bottom;`,
      td: `padding:${k(4)} ${k(8)} ${k(4)} 0;border-bottom:0.5pt solid #ddd;vertical-align:top;` }; },
    extra: () => `.x-props { display: grid; grid-template-columns: max-content 1fr; gap: .25em 1.6em; } .x-prop { display: contents; } .x-props br, .x-pc { display: none; } .x-ptl::before { content: "Tag"; }
.x-li::marker { color: #aaa; }` },
  { key: 'book', name: 'Book', about: 'A serif in a narrower measure, a centred title, like a printed page.',
    rules: (b, layout) => layout === 'prose' ? bookProse(b) : book(b), extra: (b, layout) => layout === 'prose' ? bookProseExtra(b) : '' },
  /* Formal (22 November 2026, the owner: the redrawn Book "as formal version", without red and without a large first
     letter): Baskerville, a spaced capital title, centred spaced headings, the properties one centred line of small capitals. */
  { key: 'formal', name: 'Formal', about: 'Baskerville, a spaced capital title, centred spaced headings.',
    rules: b => { const k = scale(b); return { ...common(b, BASK), doc: `font-family:${BASK};font-size:${k(11.5)};line-height:1.45;color:#1a1a1a;max-width:${b * 38}pt;margin:0 auto;`,
      head: `margin:0 0 ${k(26)};text-align:center;`, kicker: `margin:0 0 ${k(10)};font-size:${k(9)};letter-spacing:.32em;text-transform:uppercase;color:#1a1a1a;`,
      title: `margin:0 0 ${k(10)};font-size:${k(27)};font-weight:400;line-height:1.2;letter-spacing:.14em;text-transform:uppercase;`,
      subtitle: `margin:0 0 ${k(8)};font-size:${k(12)};font-style:italic;color:#444;`, byline: `margin:0 0 ${k(12)};font-size:${k(11)};font-style:italic;color:#444;`,
      props: `margin:0;padding:0;font-size:${k(9)};letter-spacing:.14em;text-transform:uppercase;color:#1a1a1a;border-top:0;line-height:1.8;`, pl: `color:${SOFT};`,
      h2: `margin:${k(24)} 0 ${k(9)};font-size:${k(10)};font-weight:400;line-height:1.3;letter-spacing:.28em;text-transform:uppercase;text-align:center;`,
      h3: `margin:${k(16)} 0 ${k(5)};font-size:${k(11.5)};font-weight:400;font-style:italic;line-height:1.3;`, h4: `margin:${k(12)} 0 ${k(3)};font-size:${k(11.5)};font-weight:400;font-style:italic;`,
      month: `margin:${k(24)} 0 ${k(9)};padding-bottom:${k(3)};font-size:${k(10)};font-weight:400;letter-spacing:.28em;text-transform:uppercase;text-align:center;border-bottom:0.5pt solid #1a1a1a;`,
      p: `margin:0 0 ${k(8)};`, ul: `margin:0 0 ${k(6)};padding-left:1.35em;`, meta: `font-size:${k(9.5)};font-style:italic;color:#777;`, tag: `font-style:italic;font-size:.95em;color:#777;`,
      quote: `margin:${k(14)} 0;padding:0;border-left:0;font-style:italic;font-size:${k(11)};letter-spacing:.02em;text-transform:uppercase;`, mark: `background:none;font-style:italic;`,
      th: `text-align:left;font-weight:400;font-style:italic;padding:${k(3.5)} ${k(8)} ${k(3.5)} 0;border-bottom:0.5pt solid #1a1a1a;vertical-align:bottom;`,
      td: `padding:${k(4)} ${k(8)} ${k(4)} 0;border-bottom:0.5pt solid #ccc;vertical-align:top;` }; },
    extra: () => `${oneLine} .x-pc { display: none; } .x-pl { margin-right: .6em; } .x-li::marker { color: ${FAINT}; }` },
  { key: 'compact', name: 'Compact', about: 'Smaller type, tighter spacing, narrow margins: for long notes.',
    rules: b => ({ ...common(b * 0.9, SANS), doc: `font-family:${SANS};font-size:${b * 0.9}pt;line-height:1.35;color:${INK};`,
      p: `margin:0 0 ${b * 0.4}pt;`, li: `margin:0;`, ul: `margin:0 0 ${b * 0.3}pt;padding-left:${b * 1.3}pt;`, ol: `margin:0 0 ${b * 0.3}pt;padding-left:${b * 1.5}pt;`,
      h2: `margin:${b * 1.2}pt 0 ${b * 0.3}pt;font-size:${b * 1.15}pt;font-weight:600;`, head: `margin:0 0 ${b * 1}pt;`, title: `margin:0 0 ${b * 0.3}pt;font-size:${b * 1.7}pt;font-weight:600;line-height:1.15;` }) },
  /* Typewriter, redrawn 22 November 2026 after a form card and a typed letter: the title and the properties in a ruled form
     with small capital labels, typed values, [ ] for a task, a dash for a bullet. */
  { key: 'typewriter', name: 'Typewriter', about: 'One typed face; the title and properties in a ruled form, [ ] for tasks.', marks: 'bracket',
    rules: b => { const k = scale(b), label = `font-family:${SANS};font-size:${k(6.5)};font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:${INK};`, line = `0.6pt solid ${INK}`;
      return { ...common(b * 0.84, MONO), doc: `font-family:${MONO};font-size:${k(8.8)};line-height:1.55;color:${INK};`,
      head: `margin:0 0 ${k(22)};border:${line};`, kicker: `${label}margin:0;padding:${k(5)} ${k(7)} 0;`,
      title: `margin:0;padding:${k(6)} ${k(7)} ${k(9)};font-size:${k(15)};font-weight:400;line-height:1.2;`, subtitle: `margin:0;padding:0 ${k(7)} ${k(7)};font-size:${k(8.8)};color:${QUIET};`,
      byline: `margin:0;padding:${k(5)} ${k(7)};font-size:${k(8.8)};color:${INK};border-top:${line};`, props: `margin:0;padding:0;font-size:${k(8.8)};color:${INK};border-top:${line};line-height:1.5;`, pl: label,
      h2: `${label}font-size:${k(6.8)};margin:${k(20)} 0 ${k(7)};padding-bottom:${k(3)};border-bottom:${line};`,
      h3: `margin:${k(14)} 0 ${k(4)};font-size:${k(8.8)};font-weight:700;text-decoration:underline;`,
      tag: `font-family:${MONO};font-size:1em;color:#777;`, meta: `font-size:${k(8.8)};color:#777;`, task: `color:${INK};`, done: `color:${INK};`,
      quote: `margin:0 0 ${k(8)};padding:0 0 0 2.4em;border-left:0;color:${INK};`, mark: `background:none;text-decoration:underline;`,
      pre: `font-family:${MONO};font-size:${k(8.8)};background:none;padding:0 0 0 2.4em;margin:0 0 ${k(8)};white-space:pre-wrap;`, code: `font-family:${MONO};background:none;`,
      th: `${label}text-align:left;padding:${k(3.5)} ${k(8)} ${k(3.5)} 0;border-bottom:${line};vertical-align:bottom;`, td: `padding:${k(4)} ${k(8)} ${k(4)} 0;border-bottom:${line};vertical-align:top;`,
      month: `${label}font-size:${k(6.8)};margin:${k(20)} 0 ${k(7)};padding-bottom:${k(3)};border-bottom:${line};` }; },
    extra: b => { const k = scale(b), line = `.6pt solid ${INK}`; return `.x-props { display: grid; grid-template-columns: 9em 1fr; } .x-prop { display: contents; } .x-props br, .x-pc { display: none; }
.x-pl { padding: ${k(6)} ${k(7)} ${k(4)}; border-bottom: ${line}; } .x-pv { padding: ${k(4)} ${k(7)}; border-bottom: ${line}; } .x-prop:last-of-type > * { border-bottom: 0; }
.x-ptl::before { content: "Tag"; } .x-tag::before { content: "#"; } .x-ul { list-style: "–  "; }`; } },
];
const look = key => looks.find(l => l.key === key) || looks[0];
const page = (p = {}) => ({ paper: p.paper === 'Letter' ? 'Letter' : 'A4', margins: MARGINS[p.margins] ? p.margins : 'normal', size: SIZES[p.size] ? p.size : 'normal',
  footer: String(p.footer || '').trim(), pageNumbers: p.pageNumbers !== false, layout: String(p.layout || 'document'),
  elements: p.elements && typeof p.elements === 'object' ? p.elements : {} });
/* The elements of a sheet a person can change by picking, in place of writing CSS (the owner, 22 November 2026: "instead of
   css editing of elements, there is a graphical way to adjust the different elements"). An element is one or more of the
   classes core/html.js writes; a setting is one of a short list; what is not set stays the look's own. The settings are
   kept as { element: { setting: value } } and written after the look's rules: in the stylesheet, and inline for the clipboard. */
const FACES = { sans: SANS, serif: SERIF, baskerville: BASK, mono: MONO };
const ELEMENTS = [
  { key: 'title', name: 'Title', parts: ['title'], block: true }, { key: 'heading', name: 'Heading', parts: ['h2', 'h3', 'h4', 'month'], block: true },
  { key: 'paragraph', name: 'Paragraph', parts: ['p'], block: true }, { key: 'bullet', name: 'Bullet', parts: ['li'] }, { key: 'task', name: 'Task mark', parts: ['task'], mark: true },
  { key: 'quote', name: 'Quotation', parts: ['quote'], block: true }, { key: 'link', name: 'Web link', parts: ['a'] }, { key: 'tag', name: 'Tag', parts: ['tag'] },
  { key: 'props', name: 'Properties', parts: ['props', 'meta', 'pl', 'pv'] }, { key: 'table', name: 'Table', parts: ['table', 'th', 'td'] }, { key: 'note', name: 'Note', parts: ['note'] }];
const SETTINGS = [
  ['face', 'Typeface', [['sans', 'Helvetica Neue'], ['serif', 'Charter'], ['baskerville', 'Baskerville'], ['mono', 'Menlo']]],
  ['size', 'Size', [['xs', 'Smaller'], ['s', 'Small'], ['l', 'Large'], ['xl', 'Larger']]],
  ['weight', 'Weight', [['300', 'Light'], ['400', 'Regular'], ['500', 'Medium'], ['700', 'Bold']]],
  ['slant', 'Slant', [['normal', 'Upright'], ['italic', 'Italic']]],
  ['letters', 'Letters', [['plain', 'As written'], ['caps', 'Capitals'], ['spaced', 'Spaced capitals']]],
  ['colour', 'Colour', [['ink', 'Black'], ['grey', 'Grey'], ['faint', 'Light grey']]],
  ['align', 'Placed', [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']], 'block'],
  ['under', 'Space under', [['0', 'None'], ['s', 'Small'], ['m', 'Normal'], ['l', 'Large']], 'block']];
const MARKS = [['circle', 'Circles'], ['bracket', '[ ]']];
const TIMES = { xs: 0.8, s: 0.9, l: 1.15, xl: 1.3 }, GAPS = { 0: 0, s: 0.3, m: 0.8, l: 1.6 }, COLOURS = { ink: INK, grey: QUIET, faint: FAINT };
// The settings an element can take, and only values from their lists: anything else in the kept settings is dropped.
const settingsFor = el => el.mark ? [['mark', 'Mark', MARKS]] : SETTINGS.filter(st => !st[3] || el.block);
function cleanElements(kept) {
  const out = {};
  for (const el of ELEMENTS) { const set = kept?.[el.key]; if (!set || typeof set !== 'object') continue;
    const mine = Object.fromEntries(settingsFor(el).filter(([k, , items]) => items.some(([v]) => v === set[k])).map(([k]) => [k, set[k]]));
    if (Object.keys(mine).length) out[el.key] = mine; }
  return out;
}
// The marks a task takes: the person's own, else the look's.
const marksOf = (key, kept) => { const mine = cleanElements(kept).task?.mark; return mine || look(key).marks || 'circle'; };
// The declarations a person's settings add to each class, over the look's rules (the size is the look's own size, scaled).
function elementRules(key, pg) {
  const b = SIZES[pg.size], rules = look(key).rules(b, pg.layout), kept = cleanElements(pg.elements), out = {};
  for (const el of ELEMENTS) { const set = kept[el.key]; if (!set || el.mark) continue;
    el.parts.forEach((part, at) => { const d = [], own = (rules[part] || '').match(/font-size:([\d.]+)(pt|em)/);
      if (set.face) d.push(`font-family:${FACES[set.face]}`);
      if (set.size && (own || at === 0)) d.push(own ? `font-size:${+(own[1] * TIMES[set.size]).toFixed(2)}${own[2]}` : `font-size:${TIMES[set.size]}em`);
      if (set.weight) d.push(`font-weight:${set.weight}`);
      if (set.slant) d.push(`font-style:${set.slant}`);
      if (set.letters) d.push(set.letters === 'plain' ? 'text-transform:none;letter-spacing:0' : `text-transform:uppercase;letter-spacing:${set.letters === 'spaced' ? '.14em' : '.04em'}`);
      if (set.colour) d.push(`color:${COLOURS[set.colour]}`);
      if (set.align) d.push(`text-align:${set.align}`);
      if (set.under) d.push(`margin-bottom:${+(b * GAPS[set.under]).toFixed(2)}pt`);
      if (d.length) out[part] = d.join(';') + ';'; }); }
  return out;
}
const cssString = text => `"${String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/</g, '\\3c ').replace(/\n/g, ' ')}"`;

/* The printed page. The footer and page numbers sit in the page's margin boxes (Chromium 131 and later draws them;
   Logseq 2.0.2 is on 148). Breaks: nothing short is split across pages, a heading never ends one. */
function stylesheet(key, p = {}) {
  const pg = page(p), lk = look(key), rules = lk.rules(SIZES[pg.size], pg.layout);
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
    `.x-newsheet { break-before: page; }`,
    `.x-note, .x-toc-row { break-inside: avoid; } .x-notes-head { break-after: avoid; }`,
    `img { max-width: 100%; }`,
    shared(), lk.extra ? lk.extra(SIZES[pg.size], pg.layout) : '',
    ...Object.entries(elementRules(key, pg)).map(([name, decl]) => `.x-${name}.x-${name} { ${decl} }`),
  ].filter(Boolean).join('\n');
}
/* The same rules written inline, for the clipboard. */
function inliner(key, p = {}) {
  const pg = page(p), rules = { ...look(key).rules(SIZES[pg.size], pg.layout) };
  for (const [name, decl] of Object.entries(elementRules(key, pg))) rules[name] = (rules[name] || '') + decl;
  const cls = names => { const decl = names.split(' ').map(n => rules[n] || '').join(''); return decl ? ` style="${decl.replace(/"/g, "'")}"` : ''; };
  return { cls, root: rules.doc.replace(/max-width:[^;]+;|margin:0 auto;/g, '').replace(/"/g, "'") };
}
/* The parts of a sheet a rule of your own can change, in plain words, each with the class core/html.js writes on it. The
   export window lists them: pointed at, the part lights on the sheet; pressed, its rule in the look in force is written
   into the box, to change from there. */
const PARTS = [['doc', 'The whole text'], ['kicker', 'Line above the title'], ['title', 'Title'], ['subtitle', 'Subtitle'], ['byline', 'Date and prepared by'], ['props', 'The page’s properties'],
  ['toc-row', 'Contents row'], ['h2', 'Heading'], ['h3', 'Heading inside it'], ['h4', 'Smallest heading'], ['num', 'A heading’s number'], ['p', 'Paragraph'], ['li', 'Bullet'],
  ['ref', 'Citation number'], ['notes-head', 'Heading over the notes'], ['note', 'Note'], ['note-n', 'A note’s number'], ['tag', 'Tag'], ['meta', 'Properties under a line'], ['task', 'Task box'],
  ['quote', 'Quotation'], ['cite', 'A quotation’s source'], ['pre', 'Code'], ['table', 'Table'], ['th', 'Table heading'], ['td', 'Table cell'], ['figure', 'Picture'], ['caption', 'Caption'], ['a', 'Web link'],
  ['month', 'Month heading'], ['date', 'Date of an entry']];
// A part's rule as the look writes it, one line a declaration, ready to change.
const ruleText = (key, part, p = {}) => { const decl = look(key).rules(SIZES[page(p).size], page(p).layout)[part] || ''; return `.x-${part} {\n${decl.split(';').map(d => d.trim()).filter(Boolean).map(d => `  ${d.replace(/:\s*/, ': ')};`).join('\n')}\n}`; };
E.themes = { ELEMENTS, settingsFor, cleanElements, marksOf, PARTS, ruleText, looks, look, page, stylesheet, inliner, SIZES, MARGINS, VARIABLE_FONTS };
})();
