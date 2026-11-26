/* What Update plugins brought, said in one line, and which of two versions is newer. No Logseq here.
   said(before, now, market) takes the plugins loaded from a folder as they were and as they are, each { id, title, version },
   and what Logseq's own updater did for the plugins it installed from its marketplace: { updated: [{ title, version, to }],
   same: [{ title, version }], failed: [{ title, why }] }. It answers the notice: which plugins now run another version, which
   are up to date, which could not be updated. '' when there is nothing to say.
   newer(latest, current) whether a release's version ('v1.2.0') is newer than the one installed ('1.1.9'). */
(function (root) {
const at = one => `${one.title}${one.version ? ' ' + one.version : ''}`;
function said(before = [], now = [], market = {}) {
  const was = new Map(before.map(one => [one.id, one.version || '']));
  const here = now.filter(one => was.has(one.id));
  const changed = here.filter(one => (one.version || '') !== was.get(one.id)).map(one => `${one.title} ${was.get(one.id) || 'no version'} to ${one.version || 'no version'}`)
    .concat((market.updated || []).map(one => `${one.title} ${one.version || 'no version'} to ${one.to || 'no version'}`));
  const same = here.filter(one => (one.version || '') === was.get(one.id)).map(at).concat((market.same || []).map(at));
  const failed = (market.failed || []).map(one => `${one.title}${one.why ? ' (' + one.why + ')' : ''}`);
  const parts = [];
  if (changed.length) parts.push('Plugins updated: ' + changed.join(', '));
  if (same.length) parts.push((changed.length ? 'Up to date: ' : 'Plugins up to date: ') + same.join(', '));
  if (failed.length) parts.push('Could not be updated: ' + failed.join(', '));
  return parts.join('. ');
}
const parts = version => String(version || '').trim().replace(/^v/i, '').split(/[.+-]/).slice(0, 3).map(n => parseInt(n, 10) || 0);
function newer(latest, current) {
  if (!latest) return false;
  const a = parts(latest), b = parts(current);
  for (let i = 0; i < 3; i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  return false;
}
const api = { said, newer };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).update = api;
})(typeof window !== 'undefined' ? window : globalThis);
