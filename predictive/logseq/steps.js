/* Option-Enter: stepping through a bullet's own properties. Ported from logseq-db-refinements (parts/shadow-steps.js). It moves
   Logseq's own lists and writes through them.

   From the words of a bullet, Option-Enter opens Logseq's own list for the first of the record's properties that is empty or
   holds a guess (the "Set Topic" list a click on its empty value opens; a date opens Logseq's date picker with the keyboard
   in its text box, so "next fri" and Enter set it). Enter in a list keeps your choice and moves on to the next such property
   (past the last, it finishes the bullet: everything shown is filled in and the next bullet is made); Tab skips (Shift-Tab
   back); past either end, back to the words. Escape comes back to the words with the proposals still shown. A guess is typed
   into the list when its stop opens, so Enter keeps it and typing puts something else. Option-Enter again, from anywhere in
   the properties, finishes the bullet. Leaving any other way (a click elsewhere) is leaving the bullet: what is sure is
   filled in. Tab and Shift-Tab go through every property, filled or empty: an empty one opens ready to type; on a filled one
   the keyboard only rests (nothing changes by passing it) and Enter opens it. Down at the very end of the words goes to the
   bullet's first property, and from there Tab, Left and Right step the same way.

   Logseq has no key of its own into the properties shown under a bullet, so the plugin presses the empty value's own trigger,
   as a click does. A text value's box makes the value as soon as it opens, so moving on from one left blank takes the empty
   value off again: passing through a property leaves nothing behind. */
(function () {
const Flow = (window.Flow ||= {});
const { app, db } = Flow;
const { setting, host, warnOnce } = app;
const P = Flow.proposeUi;
const { S, ownRow, pillName, pillsOf, uuidOf, editingBox } = P;

const picking = { uuid: '', text: '', live: null, rowUuid: '', names: [], stops: new Set(), restEl: null, wasOpen: false, at: -1, keyAt: 0, lastKey: '', timer: 0, moving: 0, tab: 0, returning: '', pickerRoot: null, settle: 0, guesses: null, prefill: '', ownKey: false };
const later = (fn, ms) => setTimeout(() => { if (!S.stopped) fn(); }, ms);
const recordRow = (doc, rowUuid) => [...doc.querySelectorAll(`.ls-block[blockid="${rowUuid}"]`)].find(r => r.offsetParent !== null) || doc.querySelector(`.ls-block[blockid="${rowUuid}"]`);
const press = el => {
  const win = el.ownerDocument.defaultView;
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'])
    el.dispatchEvent(new (type.startsWith('pointer') && win.PointerEvent ? win.PointerEvent : win.MouseEvent)(type, { bubbles: true, cancelable: true, view: win, button: 0, buttons: type.endsWith('down') ? 1 : 0, pointerType: 'mouse', isPrimary: true }));
};
// Types words into one of Logseq's boxes as typing would (its boxes listen for input); selects them, so the next key typed replaces them.
function typeInto(box, words) {
  const win = box.ownerDocument.defaultView, proto = box.matches('textarea') ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
  const set = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (set) set.call(box, words); else box.value = words;
  box.dispatchEvent(new win.Event('input', { bubbles: true }));
  box.select?.();
}

// An empty value's own trigger, for the kinds whose list, box or picker is followed here: a link, a text (or choice), a web
// address, a number, a date. A checkbox's trigger is the box itself, which a press would tick.
const emptyTrigger = el => el.querySelector(['node', 'default', 'url', 'number', 'date'].map(type => `.empty-value[data-type="${type}"] .jtrigger`).join(', '));
const isDateTrigger = el => el?.closest?.('[data-type]')?.dataset.type === 'date';
// A filled value's own trigger, pressed by Enter while the keyboard rests on it: the value's, not the name's.
const valueTrigger = el => [...el.querySelectorAll('.jtrigger')].find(t => !t.closest('.property-key-inner'));
// Where the keyboard rests on a filled one: the capsule itself (Logseq gives it a tabindex for its own Left/Right), else the value's trigger.
const restTarget = el => el.hasAttribute('tabindex') ? el : valueTrigger(el) || el;
const OPEN_WAIT = 600, SLOW_OPEN = 4000, KEY_CLOSES = 400;

// Logseq's date picker, once it has opened: the keyboard goes to its text box ("e.g. Next week"), found by its placeholder, and
// the picker is the top-level element the box sits in; no class names of Logseq's are needed. Without the box, the calendar
// keeps the keys, and whatever outside the page took the focus counts as the picker, so the plugin still moves on when it closes.
function settleInDatePicker(doc) {
  clearInterval(picking.settle);
  const started = Date.now(), main = doc.querySelector('#main-content-container');
  picking.settle = setInterval(() => {
    // Logseq may open the picker later than a list (seen in 2.0.2: over 600 ms), so it is looked for as long as a slow list is waited for.
    if (!picking.uuid || Date.now() - started > SLOW_OPEN) { clearInterval(picking.settle); picking.settle = 0; return; }
    const box = [...doc.querySelectorAll('input[placeholder]')].find(el => /^e\.g\./i.test(el.placeholder) && !el.closest('.ls-block'));
    const active = doc.activeElement;
    const root = box ? box.closest('body > *') : active && active !== doc.body && !(main || doc.body).contains(active) ? active.closest('body > *') : null;
    if (!root) return;
    picking.pickerRoot = root;
    if (!box) return;   // the calendar's day button has the keyboard before the box is drawn: keep looking while there is time
    if (active !== box) box.focus();
    clearInterval(picking.settle); picking.settle = 0;
  }, 50);
}
// The record's properties, as Logseq shows them: capsules under the bullet, and rows of their own, by name, in the order they show.
// Capsules the plugin made for a proposal are left out.
function propertyPlaces(row) {
  if (!row) return [];
  const own = ownRow(row);
  const capsules = pillsOf(row).filter(p => !p.classList.contains('flow-made')).map(el => ({ el, name: pillName(el) }));
  const rows = [...row.querySelectorAll('.ls-block-properties .property-pair[data-property-title]')].filter(own).map(el => ({ el, name: String(el.getAttribute('data-property-title')).toLowerCase() }));
  return [...capsules, ...rows].sort((a, b) => a.el.compareDocumentPosition(b.el) & 4 ? -1 : 1);
}
// The record's properties that are empty and not surely filled by a proposal, by name, taken once at Option-Enter (the
// proposals may go from the screen while a list is open). A property holding a guess is a stop too: only what the plugin is
// sure of is passed over.
function emptyNames(doc, rowUuid) {
  const live = S.live?.recordUuid === rowUuid ? S.live : null;
  const sure = new Set((live?.pieces || []).filter(p => !p.guess).map(p => p.prop.lower));
  return propertyPlaces(recordRow(doc, rowUuid)).filter(({ el, name }) => !sure.has(name) && !el.querySelector('.flow-ghost:not(.flow-guess)') && emptyTrigger(el)).map(p => p.name);
}
// The guess shown for each stop, by name: its words are typed into Logseq's list when that stop opens (one value only).
function guessesAt(rowUuid) {
  const live = S.live?.recordUuid === rowUuid ? S.live : null;
  return new Map((live?.pieces || []).filter(p => p.guess && p.kind !== 'tag' && p.ids.length === 1 && !p.tagPage).map(p => [p.prop.lower, p.shown]));
}
// The i-th of the bullet's properties, or the next one going by step: with Tab (any) every property, with its trigger when it is
// empty; with Enter only the empty ones Option-Enter stops at (one filled meanwhile is passed over).
function placeAt(doc, i, step, any) {
  const places = propertyPlaces(recordRow(doc, picking.rowUuid));
  for (; i >= 0 && i < picking.names.length; i += step) {
    const name = picking.names[i], place = places.find(p => p.name === name);
    if (!place) continue;
    const trigger = emptyTrigger(place.el);
    if (any || (trigger && picking.stops.has(name))) return { i, place, trigger };
  }
  return null;
}
// In what a property's value opened: Logseq's list ("Set Topic"), or the box of a text or number value, which Logseq opens
// inside the record's own properties. Nothing else counts.
const ownWords = el => !!el && el.matches?.('textarea') && (el.id ? el.id === `edit-block-${picking.uuid}` : uuidOf(el) === picking.uuid);
function inPicker(el) {
  if (!el?.closest) return false;
  if (el.closest('.cp__select')) return true;
  if (picking.pickerRoot && picking.pickerRoot.contains(el)) return true;   // Logseq's date picker
  if (!picking.rowUuid || !el.matches('input, textarea, [contenteditable="true"]') || ownWords(el)) return false;
  // Only inside one of the record's own property places: a child bullet inside the record is not.
  const place = el.closest('.property-pair, .bottom-property-pill');
  return !!place && [...el.ownerDocument.querySelectorAll(`.ls-block[blockid="${picking.rowUuid}"]`)].some(row => ownRow(row)(place));
}
// A text value's box makes the value as soon as it opens: moving on from one left blank takes that empty value off again.
function leaveBlank(rowUuid, name) {
  if (!rowUuid || !name) return;
  later(async () => {
    try {
      if (!await app.allowed()) return;   // writes only where the proposals are on
      const schema = (await app.context())?.schema;
      const prop = schema?.props.find(p => p.lower === name && (p.type === 'default' || p.type === 'url'));
      if (!prop || !Flow.text.UUID.test(rowUuid)) return;
      if (await db.valueTitle(rowUuid, prop.ident) === '') await db.unsetValue(rowUuid, prop.ident);
    } catch (error) { warnOnce('an empty value could not be taken off again', error); }
  }, 300);
}
const passOn = () => { if (picking.at >= 0) leaveBlank(picking.rowUuid, picking.names[picking.at]); };
// The property being filled in carries the ring (logseq/propose-ui.js), so it is clear where you are.
function markAt(doc, el) {
  if (el?.matches?.('.property-pair')) el = el.querySelector('.property-key-inner') || el;   // on a row of its own the ring goes round the name
  for (const old of doc.querySelectorAll('[data-flow-at]')) if (old !== el) old.removeAttribute('data-flow-at');
  if (el && !el.hasAttribute('data-flow-at')) el.setAttribute('data-flow-at', '');
}
// Opens the i-th remembered property (with Tab, any: a filled one only gets the keyboard). Past the end going forward (Enter):
// the bullet is done; past either end with Tab: back to the words.
function openAt(doc, i, step = 1, pastEnd = backToWords, any = false) {
  passOn();
  const found = placeAt(doc, i, step, any);
  if (!found) return pastEnd();
  Object.assign(picking, { at: found.i, keyAt: 0, lastKey: '', pickerRoot: null, wasOpen: false, restEl: null, prefill: '' });
  markAt(doc, found.place.el);
  if (!found.trigger) return rest(found.place.el);
  picking.moving = Date.now();
  picking.prefill = picking.guesses?.get(picking.names[found.i]) || '';
  press(found.trigger);
  if (isDateTrigger(found.trigger)) settleInDatePicker(doc);
  watchPicker();
}
function rest(el) {   // the keyboard rests on a filled property; nothing is opened
  picking.moving = 0;
  picking.restEl = restTarget(el);
  picking.restEl.focus({ preventScroll: true });
  watchPicker();
}
function openRested(doc) {   // Enter on the property the keyboard rests on: its value opens, as a click on it does
  const place = propertyPlaces(recordRow(doc, picking.rowUuid)).find(p => p.name === picking.names[picking.at]);
  const trigger = place && valueTrigger(place.el);
  if (!trigger) return;
  picking.moving = Date.now();
  picking.wasOpen = false;
  press(trigger);
  if (isDateTrigger(trigger)) settleInDatePicker(doc);
}
/* Watches the focus while a list is meant to be open. The list closed: right after Enter in it, on to the next empty property
   (past the last, the next bullet); right after Escape, back to the words; back in the bullet's own words (a click there), simply
   done; anything else is leaving the bullet, and what is sure is filled in. A press that opened nothing within a moment ends it
   with nothing taken. A list that stays open after Enter (a property that holds several) is still in it. */
function watchPicker() {
  clearInterval(picking.timer);
  picking.timer = setInterval(() => {
    const doc = host();
    let active = doc.activeElement;
    // Logseq draws a row again when its value's box opens: the mark is put back.
    const place = picking.at >= 0 ? propertyPlaces(recordRow(doc, picking.rowUuid)).find(p => p.name === picking.names[picking.at]) : null;
    if (place) markAt(doc, place.el);
    if (picking.restEl && place && !place.el.contains(picking.restEl)) {   // resting on a filled one, drawn again: the keyboard is put back
      picking.restEl = restTarget(place.el);
      if (!active || active === doc.body || !active.isConnected) { picking.restEl.focus({ preventScroll: true }); active = doc.activeElement; }
    }
    const onRest = !!picking.restEl?.contains?.(active);
    if (!onRest && inPicker(active)) {
      picking.moving = 0;
      picking.wasOpen = true;
      if (picking.prefill && active.matches?.('input, textarea')) { typeInto(active, picking.prefill); picking.prefill = ''; }
      return;
    }
    if (picking.moving && Date.now() - picking.moving < OPEN_WAIT) return;
    // A long list has its box, with the keyboard on it, open well before Logseq puts the keyboard in the list's field: while
    // that box has the keyboard, the list is still opening.
    if (picking.moving && !picking.wasOpen && active?.closest?.('.ui__popover-content') && Date.now() - picking.moving < SLOW_OPEN) return;
    if (ownWords(active)) return endPicking(false);
    if (picking.wasOpen && picking.keyAt && Date.now() - picking.keyAt < KEY_CLOSES) {
      if (picking.lastKey === 'Enter') return openAt(doc, picking.at + 1, 1, finishBullet);
      return backToWords();
    }
    if (onRest) { picking.moving = 0; return; }   // resting on a filled one, or its value opened nothing (a checkbox)
    if (!picking.wasOpen) return endPicking(false);   // nothing opened
    endPicking(true);
  }, 100);
}
async function backToWords() {
  passOn();
  const { uuid, text } = picking;
  endPicking(false);
  picking.returning = uuid;   // coming back is not leaving: the focus-out it may cause takes nothing
  const box = editingBox(host().activeElement);
  try { if (!(box && uuidOf(box) === uuid)) await logseq.Editor.editBlock(uuid, text ? { pos: text.length } : undefined); }
  catch (error) { warnOnce('could not go back to the words', error); }
  setTimeout(() => { if (picking.returning === uuid) picking.returning = ''; }, 400);
}
// Done with the bullet from its properties (Enter past the last one, or Option-Enter): as Enter at the end of the words, everything
// proposed and shown is filled in, guesses too, and the next bullet is made and put in edit.
async function finishBullet() {
  passOn();
  const { uuid, live } = picking;
  endPicking(false);
  if (!Flow.text.UUID.test(uuid)) return;
  picking.returning = uuid;
  try {
    if (live) P.leave(live, P.shownPieces(live));   // the fill goes on behind the next bullet
    if (S.hushed.uuid === uuid) S.hushed.uuid = '';
    // Where Logseq's own Enter puts it: the first child of a bullet whose children show, else the next sibling.
    const row = recordRow(host(), uuid);
    const kids = row && [...row.querySelectorAll('.block-children-container .ls-block[blockid]')].some(el => el.parentElement?.closest('.ls-block[blockid]') === row);
    const next = kids ? await logseq.Editor.insertBlock(uuid, '', { sibling: false, before: true }) : await logseq.Editor.insertBlock(uuid, '', { sibling: true });
    if (next?.uuid) await logseq.Editor.editBlock(next.uuid);
  } catch (error) { warnOnce('could not go on to the next bullet', error); }
  later(() => { if (picking.returning === uuid) picking.returning = ''; }, 400);
}
function endPicking(left) {
  if (left) passOn();
  const live = picking.live;
  clearInterval(picking.timer); clearTimeout(picking.tab); clearInterval(picking.settle);
  markAt(host(), null);
  Object.assign(picking, { uuid: '', text: '', live: null, rowUuid: '', names: [], stops: new Set(), restEl: null, wasOpen: false, at: -1, keyAt: 0, lastKey: '', moving: 0, tab: 0, pickerRoot: null, settle: 0, guesses: null, prefill: '' });
  if (left) P.leave(live);   // left from the list: as leaving the words, the sure values only
}
// Closes what is open in the properties with an Escape of the plugin's own (Logseq closes its list, or saves and closes a value's box), then does next.
function closeThen(target, next) {
  const doc = target.ownerDocument;
  picking.moving = Date.now();
  picking.ownKey = true;   // not a way back to the words
  target.dispatchEvent(new doc.defaultView.KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
  picking.ownKey = false;
  picking.tab = setTimeout(() => { picking.tab = 0; if (picking.uuid) next(doc); }, 60);
}
// The date picker's box is not one: Enter there is Logseq's, which sets the day and closes the picker.
const isTextBox = el => !!el?.matches?.('input, textarea, [contenteditable="true"]') && !el.closest('.cp__select') && !picking.pickerRoot?.contains(el);

// Option-Enter: in the words, step through the bullet's properties; in the properties, done with the bullet. True when taken.
function stepKey(event) {
  if (event.isComposing) return false;
  if (!picking.uuid) {
    const box = editingBox(event.target);
    if (!box || !setting('proposals') || !S.allowedNow) return false;
    const uuid = uuidOf(box), doc = box.ownerDocument;
    const rowUuid = S.live?.uuid === uuid ? S.live.recordUuid : uuid;
    const stops = new Set(emptyNames(doc, rowUuid));
    if (!stops.size) return false;   // nothing to go to: the key is Logseq's
    endPicking(false);
    Object.assign(picking, { uuid, text: box.value, live: S.live?.uuid === uuid ? S.live : null, rowUuid, names: propertyPlaces(recordRow(doc, rowUuid)).map(p => p.name), stops, guesses: guessesAt(rowUuid) });
    openAt(doc, 0);
    return true;
  }
  if (picking.restEl?.contains(event.target)) { finishBullet(); return true; }   // on a filled property the keyboard rests on: done with the bullet
  if (!inPicker(event.target)) return false;
  if (isTextBox(event.target) && app.editorPopupOpen()) return false;
  if (!picking.tab) closeThen(event.target, () => finishBullet());
  return true;
}
function onPickKey(event) {
  if (event.isComposing) return;
  const plainEnter = event.key === 'Enter' && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  // Down at the very end of the words: into the bullet's first property, filled or empty.
  if (event.key === 'ArrowDown' && !picking.uuid && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey && downIntoProperties(event)) return;
  // Tab, Left and Right in the bullet's properties reached with Logseq's own Down: the same stepping from there.
  const plainKey = !event.metaKey && !event.ctrlKey && !event.altKey;
  if (event.key === 'Tab' && !picking.uuid && plainKey && startFromVisit(event, event.shiftKey ? -1 : 1, backToWords)) return;
  const side = plainKey && !event.shiftKey ? { ArrowRight: 1, ArrowLeft: -1 }[event.key] : 0;
  if (side && !picking.uuid && startFromVisit(event, side, () => endPicking(false))) return;
  // On a filled property the keyboard rests on: Enter opens it, Escape goes back to the words, Tab moves on; other keys are Logseq's.
  if (picking.uuid && picking.restEl?.contains(event.target)) {
    const doc = event.target.ownerDocument;
    if (event.key === 'Tab') { event.preventDefault(); event.stopImmediatePropagation(); const step = event.shiftKey ? -1 : 1; openAt(doc, picking.at + step, step, backToWords, true); }
    else if (side) { event.preventDefault(); event.stopImmediatePropagation(); openAt(doc, picking.at + side, side, () => {}, true); }   // at an end: it stays
    else if (plainEnter) { event.preventDefault(); event.stopImmediatePropagation(); openRested(doc); }
    else if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); backToWords(); }
    return;
  }
  if (!picking.uuid || !inPicker(event.target)) return;
  // A list or menu of Logseq's open inside a value's box ("[[" pages, "/" commands) keeps its keys.
  if (isTextBox(event.target) && app.editorPopupOpen()) return;
  if (event.key === 'Tab') {
    event.preventDefault(); event.stopImmediatePropagation();
    if (picking.tab) return;   // one move at a time
    const step = event.shiftKey ? -1 : 1, next = picking.at + step;
    closeThen(event.target, doc => openAt(doc, next, step, backToWords, true));
    return;
  }
  // Enter in a text or number value: keep what was typed and move on (Shift-Enter stays a new line in it). In a list, Enter is
  // Logseq's pick; the move on comes when the list closes.
  if (plainEnter && isTextBox(event.target)) {
    event.preventDefault(); event.stopImmediatePropagation();
    if (!picking.tab) closeThen(event.target, doc => openAt(doc, picking.at + 1, 1, finishBullet));
    return;
  }
  if ((event.key === 'Enter' || event.key === 'Escape') && !picking.ownKey) { picking.keyAt = Date.now(); picking.lastKey = event.key; }
}
// Tab, Left or Right on one of a bullet's own properties that Logseq's keys put the keyboard on: stepping starts from there, with
// the bullet's proposals kept as they are; past an end, pastEnd.
function startFromVisit(event, step, pastEnd) {
  const target = event.target;
  if (!target?.closest || target.matches('input, textarea, [contenteditable="true"]')) return false;
  if (!setting('proposals') || !S.allowedNow) return false;
  const placeEl = target.closest('.bottom-property-pill, .property-pair');
  const row = placeEl?.parentElement?.closest('.ls-block[blockid]');
  if (!row || !ownRow(row)(placeEl)) return false;
  const doc = target.ownerDocument, rowUuid = row.getAttribute('blockid');
  const places = propertyPlaces(row), at = places.findIndex(p => p.el === placeEl || p.el.contains(placeEl));
  if (at < 0) return false;
  event.preventDefault(); event.stopImmediatePropagation();
  const live = [S.visiting?.live, S.live].find(l => l?.recordUuid === rowUuid) || null;
  endPicking(false);
  Object.assign(picking, { uuid: live?.uuid || rowUuid, text: live?.text || '', live, rowUuid, names: places.map(p => p.name), stops: new Set(emptyNames(doc, rowUuid)), guesses: guessesAt(rowUuid) });
  openAt(doc, at + step, step, pastEnd, true);
  return true;
}
// Down in a bullet's words with the caret at the very end, when the bullet has properties of its own: the stepping starts on the first one.
function downIntoProperties(event) {
  const box = editingBox(event.target);
  if (!box || box !== event.target || box.selectionStart !== box.value.length || box.selectionEnd !== box.value.length) return false;
  if (!setting('proposals') || !S.allowedNow) return false;
  const doc = box.ownerDocument;
  if (app.editorPopupOpen(doc)) return false;
  const uuid = uuidOf(box), places = propertyPlaces(recordRow(doc, uuid));
  if (!places.length) return false;   // nothing under the bullet: Logseq's Down goes on to the next bullet
  event.preventDefault(); event.stopImmediatePropagation();
  const live = S.live?.uuid === uuid ? S.live : null;
  endPicking(false);
  Object.assign(picking, { uuid, text: box.value, live, rowUuid: uuid, names: places.map(p => p.name), stops: new Set(emptyNames(doc, uuid)), guesses: guessesAt(uuid) });
  openAt(doc, 0, 1, backToWords, true);
  return true;
}

function onKeyDown(event) {
  if (app.keyMatches(event, setting('proposalsStepKeys'))) { if (stepKey(event)) { event.preventDefault(); event.stopImmediatePropagation(); } return; }
  onPickKey(event);
}
function start() {
  app.listen(host().defaultView, ['keydown'], onKeyDown, true);
  app.onStop(() => { endPicking(false); picking.returning = ''; });
}
Flow.steps = { start, picking, stepKey, onPickKey, endPicking };
})();
