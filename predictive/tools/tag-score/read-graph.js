/* Reads a Logseq DB graph's db.sqlite (a copy; opened read-only) without Logseq: the datoms Logseq stores in its kvs table, as
   transit JSON. Every leaf of the stored sets holds datoms [e, attr, value, tx]; the same datom sits in several sets, so they are
   met once each. Returns entities: Map(id -> { attr: value | [values] }).

   Only for measuring outside Logseq (tools/tag-score). Nothing here is loaded by the plugin. */
const { DatabaseSync } = require('node:sqlite');

// Transit JSON, the compact form: "^ " opens a map, "~:" a keyword, "~u" a uuid, "~i" a big integer, "~m" a time, "~#tag" a
// tagged value; strings longer than 3 that are keywords or map keys are cached and later written as "^<code>".
const CODE = 44, BASE = 48;
const codeOf = s => s.length === 2 ? (s.charCodeAt(1) - BASE) : (s.charCodeAt(1) - BASE) * CODE + (s.charCodeAt(2) - BASE);
function decode(json) {
  let cache = [];
  const remember = s => { if (cache.length === CODE * CODE) cache = []; cache.push(s); };
  const str = (s, asKey) => {
    if (s.length > 1 && s[0] === '^' && s !== '^ ') return cache[codeOf(s)];
    if (s.length > 3 && (asKey || s.startsWith('~:') || s.startsWith('~$') || s.startsWith('~#'))) remember(s);
    return s;
  };
  const scalar = s => {
    if (s[0] !== '~') return s;
    const t = s[1], rest = s.slice(2);
    if (t === ':') return { kw: rest };
    if (t === 'u' || t === '$') return rest;
    if (t === 'i' || t === 'n' || t === 'd' || t === 'm') return Number(rest);
    if (t === '~' || t === '^' || t === '`') return s.slice(1);
    return s;
  };
  const read = (v, asKey = false) => {
    if (typeof v === 'string') { const raw = str(v, asKey); return raw.startsWith?.('~#') ? raw : scalar(raw); }
    if (!Array.isArray(v)) return v && typeof v === 'object' ? v : v;
    if (v[0] === '^ ') {
      const out = new Map();
      for (let i = 1; i < v.length; i += 2) out.set(keyName(read(v[i], true)), read(v[i + 1]));
      return out;
    }
    if (typeof v[0] === 'string' && v.length === 2) {
      const head = str(v[0], false);
      if (typeof head === 'string' && head.startsWith('~#')) return { tag: head.slice(2), value: read(v[1]) };
      return [scalar(head), read(v[1])];
    }
    return v.map(x => read(x));
  };
  return read(JSON.parse(json));
}
const keyName = k => k && k.kw ? k.kw : k;

function readGraph(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  const seen = new Set(), entities = new Map();
  for (const { content } of db.prepare('SELECT content FROM kvs WHERE addresses IS NULL').iterate()) {
    let node; try { node = decode(content); } catch { continue; }
    const keys = node instanceof Map ? node.get('keys') : null;
    if (!Array.isArray(keys)) continue;
    for (const d of keys) {
      if (!Array.isArray(d) || d.length < 3) continue;
      const [e, a, v] = d, attr = keyName(a), value = v && v.kw ? v.kw : v;
      const key = e + '\u0001' + attr + '\u0001' + (value && typeof value === 'object' ? JSON.stringify([...(value instanceof Map ? value : [])]) : value);
      if (seen.has(key)) continue;
      seen.add(key);
      let ent = entities.get(e);
      if (!ent) entities.set(e, ent = { 'db/id': e });
      if (ent[attr] === undefined) ent[attr] = value;
      else if (Array.isArray(ent[attr]) && ent[attr].multi) ent[attr].push(value);
      else { const list = [ent[attr], value]; list.multi = true; ent[attr] = list; }
    }
  }
  db.close();
  return entities;
}
const all = v => v === undefined ? [] : Array.isArray(v) && v.multi ? v : [v];

module.exports = { readGraph, decode, all };
