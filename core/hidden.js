/* Which of Logseq's menu lines are hidden, as kept in one setting. No Logseq here. The words are the ones the plugin kept
   before the rebuild ("Where: name; Where: name"), so what was hidden then is hidden still.
     list(words)                 [{ where, name, word }] in the order kept
     has(list, where, name)      whether that line is hidden there (a line kept with no place is hidden everywhere)
     add(words, where, name)     the words with it added, once
     drop(words, word)           the words without that one */
(function (root) {
const parts = words => String(words || '').split(/[;\n]/).map(one => one.trim()).filter(Boolean);
const list = words => parts(words).map(word => { const at = word.indexOf(': '); return { where: at < 0 ? '' : word.slice(0, at), name: at < 0 ? word : word.slice(at + 2), word }; });
const low = text => String(text).toLowerCase();
const has = (kept, where, name) => !!name && kept.some(one => low(one.name) === low(name) && (!one.where || one.where === where));
const add = (words, where, name) => { const word = `${where}: ${String(name).replace(/;/g, ',')}`; return parts(words).some(one => low(one) === low(word)) ? parts(words).join('; ') : [...parts(words), word].join('; '); };
const drop = (words, word) => parts(words).filter(one => low(one) !== low(word)).join('; ');
const api = { list, has, add, drop };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).hidden = api;
})(typeof window !== 'undefined' ? window : globalThis);
