/* What a reload of the plugins brought, said in one line. No Logseq here.
   said(before, now) takes the plugins as they were and as they are, each { id, title, version }, and answers the notice:
   which of them now run another version, or that none does and at which version they stand. '' when there is nothing to say. */
(function (root) {
function said(before = [], now = []) {
  const was = new Map(before.map(one => [one.id, one.version || '']));
  const here = now.filter(one => was.has(one.id));
  if (!here.length) return '';
  const changed = here.filter(one => (one.version || '') !== was.get(one.id));
  const at = one => `${one.title}${one.version ? ' ' + one.version : ''}`;
  if (changed.length) return 'Plugins updated: ' + changed.map(one => `${one.title} ${was.get(one.id) || 'no version'} to ${one.version || 'no version'}`).join(', ');
  return `Plugins reloaded, nothing newer in ${here.length === 1 ? 'its folder' : 'their folders'}: ${here.map(at).join(', ')}`;
}
const api = { said };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else (root.PluginDoor ||= {}).update = api;
})(typeof window !== 'undefined' ? window : globalThis);
