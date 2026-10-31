/* Odd names for the odd-text stress (docs/history/FINISHING-PROMPT-2026-10-23.md section 4): page, tag and property names a reader or a
   drawing could get wrong. Used by tools/odd-text-test.js and tools/shadow-stress.js. */
module.exports = [
  'Dr. [[Bracket]] Smith', 'Close ]] early', 'Hash #tag inside', '#Leading hash', 'Key:: value', 'Double::colon',
  'Quote " double', "Quote ' single", 'Back\\slash \\n', 'Emoji 😀 face', 'Flag 🇬🇧', 'עברית שם', 'اسم عربي', 'Mixed עברית and English',
  'x'.repeat(500), '', '   ', 'Status', 'Tags', 'Alias', 'Created at', 'Date', 'Page', 'Tag', 'Property',
  '<b>bold</b>', '<img src=x onerror=alert(1)>', '&amp; entity', '{{query}}', '((block ref))', 'Zero​width', 'Tab\tinside', 'New\nline',
  'Dr. O\'Brien [Jr.]', 'Mrs. Ño Ñandú', 'ß', 'İstanbul', '中文名字', '$100 & 50%', 'a/b/c', '../..', 'null', 'undefined', 'NaN', '0', '-1',
  'constructor', '__proto__', 'toString', 'hasOwnProperty',
];
