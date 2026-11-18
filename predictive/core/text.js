/* Small text helpers shared by the core. No Logseq, no screen: runs in Node for the tests and in the plugin alike. */
(function () {
const WORD = /[\p{L}\p{N}]+/gu;
// A link as the words hold it: [[Name]] in the text box, [[uuid]] as saved.
const LINK = /\[\[([^\[\]]+)\]\]/g;
const TAG = /(?:^|\s)#(?:\[\[([^\]]+)\]\]|([^\s#\[\]]+))/g;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const wordsOf = text => String(text || '').toLowerCase().match(WORD) || [];
// A saved link ([[uuid]]) read as nothing, a typed one ([[Name]]) as its name; tags stay in the words.
// Logseq pairs a typed $ (for math): "paid $5 on Friday" is in the bullet as "paid $5 on Friday$". The closing $s at the end, one
// per $ in the words before them, are not read, so the day or sum before them still is; "costs 5$" keeps its one $.
const pairedDollars = t => { const end = t.match(/\$+$/)?.[0].length || 0; return end && (t.match(/\$/g).length - end) >= end ? t.slice(0, -end) : t; };
const cleanWords = text => pairedDollars(String(text || '').trimEnd()).replace(/#?\[\[([^\[\]]+)\]\]/g, (m, key) => UUID.test(key) ? '' : key).replace(/\s+/g, ' ').trim();
const sameIds = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

const api = { WORD, LINK, TAG, UUID, wordsOf, cleanWords, sameIds };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') (window.Flow ||= {}).text = api;
})();
