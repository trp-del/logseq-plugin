/* Loaded by main.js after parts/title-row.js. Kept in its own scope; main.js adds its settings and starts it. */
(() => {
/* A node property's mark, left of its name in a page's or a bullet's list of property rows (0.4.334, the owner, with a
   picture of Jay Varughese's page: "why don't the properties of pages not have the icons of the tag map page?"). Logseq
   draws a grey dot there (or its point icon); for a property whose value is a node (one or several) it gives way to the
   kit's three dots joined in a triangle (0.4.468, docs/ONTOLOGY.md 8: a node property is what joins nodes into the web).
   Every property shows the icon of what it holds, a fact too (0.4.477, the owner, 2026-10-28: "there is no visual
   clarity of tag, property, page"; "a property always shows its icon, on pages too"): the calendar for a date, lines
   for words, 123, the choice box, so a property's name never reads like a page's or the plugin's words (the facts'
   icons of 0.4.334 had gone at 0.4.468). An icon you gave a property yourself stays, and a property the plugin does not
   know (Alias) keeps Logseq's. The mark takes the dot's place in Logseq's own button, so nothing moves and a click on it
   does what Logseq's does. Only in the list under a page's title, though (the owner, 2026-10-30, "properties inline under
   a node should not have icons, just plain text"): a node's rows of properties and the line of them under its words
   ("Provider: Dr. Mei Chen · Date: …") keep Logseq's dot and the name alone, as Look draws them.
   A property's whole name, too (2026-10-23, the loose end of CLAUDE.md section 7: Logseq's narrow name column cuts a long
   name short on a row of its own, "Therapy regimen" just fitting): when the pointer rests on a name Logseq has cut, it
   gets a tooltip with the whole name. Nothing is drawn and nothing is measured until the pointer is there; a wider
   column was not taken, since it would move every row. */
const shared = window.refinementShared;
const { host, kindIcon } = shared;
const { warnOnce, onUnload, runUnloadTasks, listen } = shared.lifecycle({ prefix: 'Threads (property kinds): ', leaves: { elements: '.property-m > .rf-kind, .rf-pill-kind', attributes: ['data-rf-kind'],
  reset: doc => { for (const el of doc.querySelectorAll('[data-rf-fullname]')) { el.removeAttribute('title'); el.removeAttribute('data-rf-fullname'); } } } });
let model, sendStyle, watchDom, watchDomEarly, addsElements, onDatabaseChange, onSettingsChange;
const take = (core, names) => shared.take(core, names, warnOnce);

const settingsSchema = [
  { key: 'propertyKindsHeading', type: 'heading', group: 'reading', rank: 2, title: 'Marks', default: null,
    legend: 'A mark before every property in a page\u2019s list',
    zone: `<div><span class="m">${shared.iconHtml('node')}</span> Works at &nbsp; <span class="m">${shared.iconHtml('text')}</span> Notes</div>`,
    description: 'Changes here apply right away.' },
  { key: 'propertyKindIcons', type: 'boolean', title: 'Mark every property in a page’s list with what it holds', default: true,
    description: 'In the list of properties under a page’s title, a property’s name starts with an icon of what it holds: three dots joined in a triangle for a link to nodes, a calendar for a date, lines for words, 123 for a number, a box for a choice. So a property never looks like a page or plain words. An icon you gave a property yourself stays. Under a node, a property is plain text: its rows and the line under its words keep Logseq’s dot and the name alone. Applies at once.' },
  { key: 'propertyNameTips', type: 'boolean', title: 'A cut property name whole on hover', default: true,
    description: 'Logseq gives a property’s name a narrow column and cuts a long one short with “…”. With the pointer on such a name, its whole name shows as a tooltip. Nothing moves and nothing is added to the page. Applies at once.' },
];
const setting = shared.settingReader(settingsSchema);

const css = `
/* Logseq's dot gives way to the kind's icon, in the same button (0.4.334). */
.property-m[data-rf-kind] > :is(.bullet-container, .ls-icon-point-filled) { display: none; }
.property-m > .rf-kind { display: inline-flex; justify-content: center; width: 15px; font-size: 15px; vertical-align: 0;
  opacity: .5; } /* as faint as Logseq's own icons beside it (Alias, Date): the mark never outweighs the name */
.property-m > .rf-kind.rf-drawn { align-items: center; height: 15px; }
`;
const ROWS = '.ls-page-properties .property-pair.property-panel-row[data-property-title]';
let byTitle = null, loading = null, timer = 0, stopped = false;
async function load() {
  const asked = loading = model.propSchema();
  try {
    const schema = await asked;
    if (asked !== loading || stopped) return;
    byTitle = new Map(schema.props.map(prop => [prop.title, prop]));
    draw(host());
  } catch (error) { warnOnce('could not read the properties’ kinds', error); }
}
const kindOf = prop => prop.choices.length ? 'choice' : prop.type;
function draw(doc) {
  if (!doc || !byTitle) return;
  const on = setting('propertyKindIcons');
  for (const row of doc.querySelectorAll(ROWS)) {
    const button = row.querySelector(':scope > .property-key-panel .property-icon > .property-m');
    if (!button) continue;
    const prop = on ? byTitle.get(row.getAttribute('data-property-title')) : null;
    // Only Logseq's own dot is taken over; a property with an icon of its own keeps it.
    const dot = button.querySelector(':scope > :is(.bullet-container, .ls-icon-point-filled)');
    const want = prop && dot && !prop.icon ? `${kindOf(prop)}${prop.many ? '+' : ''}` : '';
    let mine = button.querySelector(':scope > .rf-kind');
    if (!want) { if (mine) { mine.remove(); button.removeAttribute('data-rf-kind'); } continue; }
    if (mine?.dataset.kind === want) continue;
    mine?.remove();
    mine = kindIcon(doc, kindOf(prop), { several: prop.many });
    mine.dataset.kind = want;
    button.append(mine);
    button.setAttribute('data-rf-kind', '');
  }
}
// The pointer on a property's name: if Logseq has cut it, the whole name as the tooltip (only names it cut; one it no
// longer cuts loses the tooltip again).
const NAMES = '.property-key-inner';
function onOver(event) {
  if (!setting('propertyNameTips')) return;
  const name = event.target?.closest?.(NAMES);
  if (!name) return;
  const cut = [name, ...name.querySelectorAll('*')].some(el => el.scrollWidth > el.clientWidth + 1);
  if (cut && !name.hasAttribute('title')) { name.setAttribute('title', name.textContent.trim()); name.setAttribute('data-rf-fullname', ''); }
  else if (!cut && name.hasAttribute('data-rf-fullname')) { name.removeAttribute('title'); name.removeAttribute('data-rf-fullname'); }
}
// Before the screen is drawn, whenever rows came (a page opening, a property added); the frame pass catches the rest.
const drawEarly = (doc, records) => { if (addsElements(records)) draw(doc); };
function clear() {
  for (const el of host().querySelectorAll('[data-rf-fullname]')) { el.removeAttribute('title'); el.removeAttribute('data-rf-fullname'); }
  for (const el of host().querySelectorAll('.property-m > .rf-kind, .rf-pill-kind')) el.remove();
  for (const el of host().querySelectorAll('.property-m[data-rf-kind]')) el.removeAttribute('data-rf-kind');
}

function start() {
  ({ sendStyle, watchDom, watchDomEarly, addsElements, onDatabaseChange, onSettingsChange } = take(window.refinementCore, ['sendStyle', 'watchDom', 'watchDomEarly', 'addsElements', 'onDatabaseChange', 'onSettingsChange', 'propSchema']));
  model = window.refinementCore.provided; // the graph through the model's doors
  stopped = false;
  sendStyle('refinement-property-kinds', css);
  watchDomEarly(drawEarly);
  watchDom(function drawPropertyKinds(doc) { if (!stopped) draw(doc); });
  // A property made, renamed or turned into another kind shows soon after (the model reads its schema again).
  onDatabaseChange(() => {
    if (stopped) return;
    clearTimeout(timer); timer = setTimeout(load, 900);
  });
  onSettingsChange((now, before) => {
    if (stopped) return;
    if (now?.propertyKindIcons !== before?.propertyKindIcons) draw(host());
  });
  listen(host().defaultView, ['mouseover'], onOver);
  onUnload(() => { stopped = true; clearTimeout(timer); loading = null; clear(); });
  load();
}
(window.refinementParts ||= []).push({ name: 'property-kinds', schema: settingsSchema, start, stop: runUnloadTasks });
})();
