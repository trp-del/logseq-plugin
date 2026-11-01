/* Suggested links, the drawing and the keys (the rule is core/link.js). Ported from logseq-db-refinements
   (parts/link-suggest.js) and trimmed: no hidden-bracket font and no Hyper-key tap, so there is less to break across
   Logseq versions. The grey words sit where the box itself would put them: a copy of the box is laid over it, the same
   size, padding and font, with the typed words transparent and the rest of the name after them in grey. */
(function () {
const Flow = (window.Flow ||= {});
const { app, db, link } = Flow;
const { setting, host, warnOnce } = app;

const COPIED = ['boxSizing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth',
  'borderLeftWidth', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'textTransform', 'wordSpacing', 'textIndent', 'tabSize', 'textAlign'];
const el = (doc, tag, attrs = {}, ...kids) => { const e = doc.createElement(tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); e.append(...kids); return e; };

let showing = null, quiet = null, version = 0, lastPages = [], pauseTimer = 0, graph = '';
const boosts = new Map();
const minLetters = () => Math.max(0, Number(setting('linkSuggestMinLetters')) || 0);

function layOver(box, over, hit) {
  const doc = box.ownerDocument, outer = box.getBoundingClientRect(), style = doc.defaultView.getComputedStyle(box);
  for (const p of COPIED) over.style[p] = style[p];
  Object.assign(over.style, { left: outer.left + 'px', top: (outer.top - box.scrollTop) + 'px', width: outer.width + 'px', minHeight: outer.height + 'px', borderStyle: 'solid', borderColor: 'transparent', color: style.color });
  over.style.setProperty('--flow-ink', style.color);
  const [typed, grey] = over.children;
  // After the space that ends a name (hit.after): nothing grey, a dotted line under the words until the next letter.
  typed.replaceChildren(doc.createTextNode(box.value.slice(0, hit.after ? hit.start : hit.end)));
  if (hit.after) typed.append(el(doc, 'u', { class: 'flow-offer' }, box.value.slice(hit.start, hit.end)), doc.createTextNode(box.value.slice(hit.end, box.selectionStart)));
  grey.textContent = hit.after ? '' : hit.ghost;
  if (hit.name && !hit.after) grey.setAttribute('data-name', hit.name); else grey.removeAttribute('data-name');
  grey.title = `Right arrow: [[${hit.title}]]`;
}
function clear() { if (!showing) return; showing.ghost.remove(); showing = null; }
function draw(box, hit) {
  const doc = box.ownerDocument;
  const ghost = showing?.box === box ? showing.ghost : el(doc, 'div', { class: 'flow-link-suggest', 'aria-hidden': 'true' }, el(doc, 'span', { class: 'flow-typed' }), el(doc, 'span', { class: 'flow-grey' }));
  if (showing && showing.box !== box) clear();
  showing = { box, hit, ghost };
  layOver(box, ghost, hit);
  if (!ghost.isConnected) doc.body.append(ghost);
}

/* What the graph has taught: the pages that would fill an empty link property of the bullet (by its tags), read once per
   bullet and forgotten when the graph changes. */
async function boostOf(box, pages) {
  const uuid = app.uuidOf(box);
  if (!uuid) return null;
  if (!boosts.has(uuid)) boosts.set(uuid, (async () => {
    const ctx = await app.context({ wait: false });
    const block = ctx && await db.pullBlock(uuid);
    const tagIds = (db.pick(block, 'block/tags') || []).map(db.idOf).filter(Boolean);
    return tagIds.length ? link.boostFor(tagIds, ctx.schema, pages) : null;
  })().catch(error => { warnOnce('the bullet’s properties could not be read for the suggestions', error); return null; }));
  return boosts.get(uuid);
}

// What was taken or passed over, by name, kept in a setting under the graph's name (the plugin's settings are shared by
// every graph), the last MEMORY_MOST names.
const MEMORY_MOST = 400;
const SAVE_EVERY = 60000;
let memoryAll = null, unsaved = false, savedAt = 0;
const memoryNow = () => (memoryAll || logseq.settings?.linkSuggestMemory || {})[graph] || null;
function remember(lower, taken) {
  if (!graph || !setting('linkSuggestLearn')) return;
  const all = { ...(memoryAll || logseq.settings?.linkSuggestMemory || {}) }, mine = { ...(all[graph] || {}) };
  const entry = [...(mine[lower] || [0, 0])];
  entry[taken ? 0 : 1]++;
  delete mine[lower]; mine[lower] = entry;   // the newest last, so the oldest go first when there are too many
  const keys = Object.keys(mine);
  for (const key of keys.slice(0, Math.max(0, keys.length - MEMORY_MOST))) delete mine[key];
  all[graph] = mine;
  memoryAll = all;
  unsaved = true;
}
// Saved on leaving a bullet, at most once a minute: a setting saved wakes every module's listener in Logseq.
function saveMemory(force) {
  if (!unsaved || (!force && Date.now() - savedAt < SAVE_EVERY)) return;
  unsaved = false; savedAt = Date.now();
  app.remember('linkSuggestMemory', memoryAll);
}
// A suggestion shown and then passed over (the next letter did not take it, or the bullet was left): once per showing.
const passed = new WeakSet();
function passedOver(hit) { if (!hit || hit.after || passed.has(hit)) return; passed.add(hit); remember(hit.title.toLowerCase(), false); }

async function look(box) {
  if (!setting('linkSuggest') || !app.isBlockBox(box) || box.selectionStart !== box.selectionEnd) return clear();
  const text = box.value, caret = box.selectionStart;
  if (quiet && quiet.box === box && quiet.text === text) return;   // Escape: quiet until something else is typed
  quiet = null;
  const mine = ++version;
  const pages = lastPages = await app.pages();
  if (mine !== version || !box.isConnected || box.value !== text || box.selectionStart !== caret || host().activeElement !== box) return;
  if (app.popupOpen()) return clear();                             // Logseq's own list ([[, /, a picker) has the keys
  const learn = setting('linkSuggestLearn');
  const [rates, boost] = learn ? await Promise.all([ratesNow(), boostOf(box, pages)]) : [null, null];
  if (mine !== version || !box.isConnected || box.value !== text || box.selectionStart !== caret) return;
  const hit = link.suggestFor(text, caret, pages, { min: minLetters(), rates, memory: learn ? memoryNow() : null, boost });
  if (!hit) return clear();
  draw(box, hit);
}
// How often each name is linked: counted with the graph's reading, and kept up line by line as lines change. Never waited for.
const ratesNow = async () => (await app.context({ wait: false }))?.linkLines?.counter.rates || null;

function onInput(event) {
  const box = event.target;
  if (!app.isBlockBox(box)) return;
  keepUp(box);
  // Nothing new shows while letters keep coming: the pages are looked at once typing pauses. Grey words already showing
  // follow at once.
  clearTimeout(pauseTimer);
  const wait = Math.max(0, Number(setting('linkSuggestPause')) || 0);
  const lookNow = () => look(box).catch(error => warnOnce('the suggestion could not be made', error));
  if (showing?.box === box || !wait) lookNow(); else pauseTimer = setTimeout(lookNow, wait);
  // Logseq makes the box taller after this (a new line): the drawing is placed again before the screen is painted.
  const win = box.ownerDocument.defaultView;
  win.cancelAnimationFrame(onInput.frame);
  onInput.frame = win.requestAnimationFrame(() => { if (showing?.box === box && box.isConnected) layOver(box, showing.ghost, showing.hit); });
}
// The grey words follow each letter at once, as on a phone: a letter that matches the next grey one takes it off the front;
// anything else hides them until the reading is back.
function keepUp(box) {
  if (!showing || showing.box !== box) return;
  const { hit } = showing, value = box.value, caret = box.selectionStart;
  const typed = value.slice(hit.end, caret);
  if (caret > hit.end && box.selectionStart === box.selectionEnd && value.slice(hit.start, hit.end) === hit.span && caret === value.length
      && typed.length <= hit.ghost.length && hit.ghost.slice(0, typed.length).toLowerCase() === typed.toLowerCase()) {
    showing.hit = { ...hit, end: caret, span: value.slice(hit.start, caret), ghost: hit.ghost.slice(typed.length) };
    layOver(box, showing.ghost, showing.hit);
  } else { if (caret > hit.end) passedOver(hit); clear(); }
}
// Logseq takes Backspace and Delete itself in places and sets the words without the usual typing signal; the key's release looks again.
function onKeyUp(event) { if (event.key === 'Backspace' || event.key === 'Delete') onInput(event); }

// The words become the link, typed as if by hand, so Cmd+Z takes it back in one step.
function accept(event) {
  if (!showing || event?.target !== showing.box) return false;
  const { box } = showing;
  let { hit } = showing;
  clear();
  // The screen may be behind the words: what is suggested for the words as they are now.
  if (box.value.slice(hit.start, hit.end) !== hit.span || box.selectionStart !== hit.end) hit = box.selectionStart === box.selectionEnd ? link.suggestFor(box.value, box.selectionStart, lastPages, { min: minLetters() }) : null;
  if (!hit) return false;
  const text = `[[${hit.title}]]`;
  box.focus();
  box.setSelectionRange(hit.start, hit.end);
  let typed = false;
  try { typed = box.ownerDocument.execCommand('insertText', false, text); } catch (error) { typed = false; }
  if (!typed || box.value.slice(hit.start, hit.start + text.length) !== text) {
    box.setRangeText(text, hit.start, hit.end, 'end');
    box.dispatchEvent(new box.ownerDocument.defaultView.InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  }
  const after = hit.start + text.length + (hit.after && box.value[hit.start + text.length] === ' ' ? 1 : 0);
  box.setSelectionRange(after, after);
  remember(hit.title.toLowerCase(), true);
  return true;
}
function onKey(event) {
  if (!showing) return;
  // Right arrow, alone, with the cursor where the grey words start: take them (it would move nowhere anyway, at the end of
  // the words). Taken before Logseq's own Right, which steps into the bullet's properties.
  if (event.key === 'ArrowRight' && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey && setting('linkSuggestRightArrow')
      && event.target === showing.box && showing.box.selectionStart === showing.box.selectionEnd && accept(event)) {
    event.preventDefault(); event.stopImmediatePropagation(); return;
  }
  // A plain key set in the settings takes it too.
  const extra = setting('linkSuggestKeys');
  if (extra && app.keyMatches(event, extra) && event.target === showing.box && accept(event)) { event.preventDefault(); event.stopImmediatePropagation(); return; }
  // Escape lets go one step at a time: the grey words alone; the proposals, then Logseq, have the next ones.
  if (event.key === 'Escape') { quiet = { box: showing.box, text: showing.box.value }; clear(); event.preventDefault(); event.stopImmediatePropagation(); return; }
  if (/^(Arrow|Enter|Home|End|Page)/.test(event.key)) clear();                                            // moving on leaves the words as typed
}

/* A lone tap of the Hyper key (Caps Lock as Cmd+Ctrl+Opt+Shift): the modifiers come down together, nothing else is
   pressed, and a modifier comes up within 600 ms. Both halves of an Escape within 300 ms of the tap are swallowed, since
   some setups send one and Logseq would leave the bullet on it. Holding Hyper with another key is untouched. */
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Hyper']);
const hyperTap = { armedAt: 0, firedAt: 0 };
function onHyperDown(event) {
  if (event.key === 'Escape' && Date.now() - hyperTap.firedAt <= 300) { event.preventDefault(); event.stopImmediatePropagation(); return; }
  if (!MODIFIER_KEYS.has(event.key)) { hyperTap.armedAt = 0; return; }
  if (event.metaKey && event.ctrlKey && event.altKey && !hyperTap.armedAt) hyperTap.armedAt = Date.now();
}
function onHyperUp(event) {
  if (event.key === 'Escape' && Date.now() - hyperTap.firedAt <= 300) { event.preventDefault(); event.stopImmediatePropagation(); return; }
  if (!MODIFIER_KEYS.has(event.key) || !hyperTap.armedAt) return;
  const quick = Date.now() - hyperTap.armedAt < 600;
  hyperTap.armedAt = 0;
  if (!quick || !showing || !setting('linkSuggestHyperTap')) return;
  if (accept({ target: showing.box })) hyperTap.firedAt = Date.now();
}

const css = `
.flow-link-suggest { position: fixed; z-index: 9; pointer-events: none; white-space: pre-wrap; overflow-wrap: break-word; overflow: hidden; background: none; }
.flow-link-suggest .flow-typed { color: transparent; }
.flow-link-suggest .flow-typed .flow-offer { text-decoration: underline dotted; text-decoration-color: color-mix(in srgb, var(--flow-ink, currentColor) 55%, transparent); text-decoration-thickness: 1px; text-underline-offset: .22em; }
.flow-link-suggest .flow-grey { opacity: .45; }
.flow-link-suggest .flow-grey[data-name]::after { content: "  " attr(data-name); font-size: .8em; opacity: .75; }
`;

async function start() {
  graph = await app.graphName();
  app.sendStyle('flow-link-suggest', css);
  const win = host().defaultView;
  app.listen(win, ['input'], onInput);
  app.listen(win, ['keydown'], onKey, true);
  app.listen(win, ['keyup'], onKeyUp);
  app.listen(win, ['keydown'], onHyperDown, true);
  app.listen(win, ['keyup'], onHyperUp, true);
  app.listen(win, ['blur'], () => { hyperTap.armedAt = 0; });
  app.listen(win, ['focusout', 'pointerdown', 'mousedown'], () => { if (showing) passedOver(showing.hit); clear(); });
  app.listen(win, ['scroll', 'resize'], clear, true);
  app.listen(win, ['focusout'], event => { if (app.isBlockBox(event.target)) saveMemory(); });
  app.onStop(() => { clear(); clearTimeout(pauseTimer); version++; saveMemory(true); });
  logseq.App.onCurrentGraphChanged?.(async () => { saveMemory(true); graph = await app.graphName(); boosts.clear(); });
  logseq.DB.onChanged?.(() => boosts.clear());
  logseq.App.onRouteChanged?.(clear);
}
Flow.linkUi = { start, accept, suggestState: () => showing };
})();
