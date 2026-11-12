/* The key sheet (the owner, 12 November 2026: "can I hold option and a sheet of shortcuts appear"). Hold Option on its own
   for a moment and a sheet of keys stands in the middle of the window: writing, arranging bullets, finding, moving around,
   and Logseq's keys of two letters. While Option is still held it takes nothing: any other key puts it away and does its own
   job (Option-T read there still chooses a tag), as do a press of the mouse and leaving the window. A quick Option with a
   letter, as in typing é, is over before the sheet would come; Option with Cmd, Shift or Ctrl never brings it, nor does it
   come over one of the plugin's windows or Logseq's.
   Let go of Option once it shows and it stays (the owner: "it should stay after holding it and allow search or highlight if
   I just start typing. allow things to be set there too"): letters typed find among its lines, the words found lit; Up and
   Down light a line; a key of the plugin's own is set there, by a press on its box or Enter on its line, then the keys to
   use (Backspace: none; Escape: as it was), saved at once as the settings window saves it. Escape clears what was typed,
   then closes; so does a press outside it.
   Each key is read as it stands when the sheet opens: Logseq's from its own list (the owner's bindings among them), the
   plugin's from the settings, and a line whose part is switched off, or whose key is set to none, is left out. */
(function () {
const Look = window.Look;
const Door = window.PluginDoor;
const { host, esc, listen, onStop, style } = Look.kit, { setting } = Look.settings;
const HOLD = 700;   // ms of Option alone before the sheet comes; typing é takes a fraction of it
const ID = 'lk-key-sheet';

// Every module's settings with their defaults, for the plugin's own keys.
const plugin = Door.settingReader(() => Door.modules.flatMap(module => module.schema || []));
/* A key on the sheet: its marks, and where it is set when it can be (a setting of the plugin's, or a command of Logseq's,
   kept in the graph's config). */
const key = (mark, set) => ({ mark: mark || '', set: set || null });
// Logseq's key for a command, by the end of its id (a plugin's command id begins with the plugin's own), the one in force.
function logseqKey(end) {
  const command = Door.logseqCommands().find(c => String(c?.id || '').endsWith(end));
  return command ? key(Door.keyMarks(command.shortcut), { logseq: Door.bare(command.id) }) : key('');
}
/* Logseq's keys of two letters pressed one after the other (t r, g j, p t), the plugin's among them (g ,): every one Logseq
   lists, by its letters, named as Logseq names it. They work outside a bullet. */
function twoLetters() {
  const lines = [];
  for (const command of Door.logseqCommands()) {
    const first = String(command?.shortcut || '').split(' | ')[0].trim(), steps = first.split(/\s+/);
    if (steps.length < 2 || !steps.every(step => /^(⇧\+|shift\+)?[^\s+]$/i.test(step))) continue;
    const id = Door.bare(command.id);
    const name = Door.COMMAND_LABELS[id] || (typeof command.desc === 'string' && command.desc) || id.split('/').pop().replace(/-/g, ' ');
    lines.push([name.charAt(0).toUpperCase() + name.slice(1), [key(Door.keyMarks(first), { logseq: id })], first]);
  }
  return lines.sort((a, b) => a[2].localeCompare(b[2])).map(([name, keys]) => [name, keys]);
}
// A key of the plugin's own, from its setting: shown, as none, even when set to none, so it can be set again.
const own = (module, name) => Door.runs(module) ? key(Door.keyMarks(plugin(name)), { plugin: name }) : key('');

/* The lines, in the order a person meets them. Each gives its words and its keys (several for a pair such as indent and
   outdent); a line with no key left, and none that can be set, is not drawn. */
function groups() {
  const find = Door.runs('find'), takes = find && plugin('takesSearchKey') !== false;
  const link = Door.runs('predictive') && plugin('linkSuggest') !== false && plugin('linkSuggestRightArrow') !== false;
  const fixed = mark => key(mark);
  return [
    ['Writing', [
      ['Step through the bullet’s properties', [own('predictive', 'proposalsStepKeys')]],
      ['Choose a tag', [own('predictive', 'proposalsTagKeys')]],
      ['Say where it came from', [own('predictive', 'citeKeys')]],
      ['Make the bullet a page', [own('predictive', 'pageKeys')]],
      ['Accept all, no new bullet', [own('predictive', 'proposalsAcceptKeys')]],
      ['Take the grey link', [fixed(link ? '→' : '')]],
      ['Add a property', [logseqKey('editor/add-property')]],
      ['Undo, redo', [logseqKey('editor/undo'), logseqKey('editor/redo')]],
    ]],
    ['Arranging bullets', [
      ['Indent, outdent', [logseqKey('editor/indent'), logseqKey('editor/outdent')]],
      ['Move up, down', [logseqKey('editor/move-block-up'), logseqKey('editor/move-block-down')]],
      ['Fold, unfold', [logseqKey('editor/collapse-block-children'), logseqKey('editor/expand-block-children')]],
      ['Select the bullet above, below', [logseqKey('editor/select-block-up'), logseqKey('editor/select-block-down')]],
    ]],
    ['Finding', [
      ['Find', [fixed(find ? (takes ? '⌘K' : '⇧⌘K') : '')]],
      ['Find by sentence', [fixed(find ? '⌥⌘K' : '')]],
      ['Logseq’s search', [find ? fixed(takes ? '⇧⌘K' : '⌘K') : logseqKey('go/search')]],
      ['Logseq’s commands', [find ? fixed('⇧⌘.') : logseqKey('command-palette/toggle')]],
    ]],
    ['Moving around', [
      ['Focus into the bullet, out', setting('focusGlide') ? [fixed('⌘.'), fixed('⌘,')] : []],
      ['Back, forward', [logseqKey('go/backward'), logseqKey('go/forward')]],
    ]],
    ['Two letters, outside a bullet', twoLetters()],
  ].map(([head, lines]) => [head, lines.map(([words, keys]) => [words, keys.filter(k => k.mark || k.set)]).filter(([, keys]) => keys.length)])
    .filter(([, lines]) => lines.length);
}

// A line's keys, each in its own box. The Mac's marks in the system face: a mono face draws ⌘ and ⌥ small or not at all.
const MARK = /([⌘⌥⇧⌃↩⇥⎋⌫⌦↑↓←→])/g;
const markHtml = mark => mark ? esc(mark).replace(MARK, '<span class="lk-ks-m">$1</span>') : 'none';
const setAttr = set => set?.plugin ? ` data-set="${esc(set.plugin)}"` : set?.logseq ? ` data-cmd="${esc(set.logseq)}"` : '';
const keysHtml = keys => keys.map(k => typeof k === 'string' ? key(k) : k)
  .map(k => `<span class="lk-ks-k${k.mark ? '' : ' lk-ks-none'}"${setAttr(k.set)}>${markHtml(k.mark)}</span>`).join('');
const lineHtml = ([words, keys]) => `<div class="lk-ks-line"><span class="lk-ks-words">${esc(words)}</span><span class="lk-ks-keys">${keysHtml(keys)}</span></div>`;
const bodyHtml = () => groups().map(([head, lines]) => `<section class="lk-ks-group${lines.length > 12 ? ' lk-ks-long' : ''}"><div class="lk-ks-head">${esc(head)}</div>${lines.map(lineHtml).join('')}</section>`).join('');

/* A window of the library's (lk-window), drawn by the library, with no dimming of the page or of anything on it (the owner,
   12 November 2026: "don't dim anything"). While Option is held it takes no pointer; once it stays it does. It fades in
   where it stands. The find line is the library's field (lk-field) across the top. */
const CSS = `
.lk-window.lk-ks { position: fixed; left: 50%; top: 50%; z-index: 9999; pointer-events: none; box-sizing: border-box; width: 94vw; max-width: 1500px; max-height: 92vh; font-size: 16px;
  display: flex; flex-direction: column; opacity: 0; transform: translate(-50%, -50%) scale(.985); transition: opacity .14s ease, transform .14s ease; }
.lk-ks.on { opacity: 1; transform: translate(-50%, -50%); }
.lk-ks.stays { pointer-events: auto; }
.lk-ks .lk-ks-find { margin: 22px 36px 0; flex: none; }
.lk-ks:not(.stays) .lk-ks-find { visibility: hidden; }
.lk-ks .lk-ks-body { padding: 22px 36px 6px; columns: 3; column-gap: 56px; overflow: auto; min-height: 0; }
.lk-ks .lk-ks-group { break-inside: avoid; padding-bottom: 26px; }
.lk-ks .lk-ks-group.lk-ks-long { break-inside: auto; }
.lk-ks .lk-ks-body.finding .lk-ks-group { break-inside: avoid; }   /* a few lines found: each group whole, under its heading */
.lk-ks .lk-ks-head { break-after: avoid; font-size: 14px; font-weight: 600; margin-bottom: 8px; }
/* The words first, each key right after them in a small rounded box in mono (the owner, 12 November 2026), in the text colour. */
.lk-ks .lk-ks-line { padding: 4px 6px; margin: 0 -6px; border-radius: 5px; }
.lk-ks .lk-ks-line.lit { background: var(--lk-wash); }
.lk-ks .lk-ks-keys { white-space: nowrap; margin-left: 10px; }
.lk-ks .lk-ks-k + .lk-ks-k { margin-left: 6px; }
.lk-ks .lk-ks-k { font-family: var(--lk-mono); font-size: 14px; line-height: 1.35; padding: 0 6px; border: 1px solid var(--lk-line); border-radius: 5px; display: inline-block; }
.lk-ks.stays .lk-ks-k:is([data-set], [data-cmd]) { cursor: pointer; }
.lk-ks.stays .lk-ks-k:is([data-set], [data-cmd]):hover { background: var(--lk-wash); }
.lk-ks .lk-ks-k.lk-ks-setting { border-color: currentColor; }
.lk-ks .lk-ks-m { font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
.lk-ks mark { all: unset; background: var(--lk-wash); border-radius: 2px; }
.lk-ks .lk-ks-nothing { padding: 0 0 20px; }
@media (max-width: 1000px) { .lk-ks .lk-ks-body { columns: 2; } .lk-ks { font-size: 14px; } }
@media (prefers-reduced-motion: reduce) { .lk-ks { transition: none; transform: translate(-50%, -50%); } }`;

let timer = 0, pressed = false, stays = false, setting_ = null;
const sheet = () => host().getElementById(ID);
// It fades out as it came, and is gone from the page once faded.
function hide() {
  clearTimeout(timer); timer = 0; stays = false; setting_ = null;
  const box = sheet();
  if (!box) return;
  box.removeAttribute('id'); box.classList.remove('on', 'stays');
  box.ownerDocument.defaultView.setTimeout(() => box.remove(), 160);
}
// One of the plugin's windows or Logseq's is open: it has its own keys, and the sheet would stand behind it.
const windowOpen = doc => !!doc.querySelector('dialog[open], [role="dialog"]:not(.lk-ks)');
function show() {
  timer = 0;
  const doc = host();
  if (!setting('keySheet') || windowOpen(doc)) return;
  const box = Look.kit.el(doc, 'div', { id: ID, class: 'lk-own lk-window lk-ks', role: 'dialog', 'aria-label': 'Keys',
    html: `<input class="lk-field lk-ks-find" placeholder="find a key" spellcheck="false" autocomplete="off"><div class="lk-ks-body">${bodyHtml()}</div>` });
  doc.body.append(box);
  box.getBoundingClientRect();   // laid out first, so it fades in
  box.classList.add('on');
  box.addEventListener('mousedown', onPress);
  box.querySelector('.lk-ks-find').addEventListener('input', () => narrow(box));
}
// Option let go once the sheet shows: it stays, and takes the keyboard into its find line.
function stay() {
  const box = sheet();
  if (!box) return;
  stays = true; box.classList.add('stays');
  box.style.height = box.getBoundingClientRect().height + 'px';   // finding never makes it jump: the lines go, the sheet stays its size
  box.querySelector('.lk-ks-find').focus({ preventScroll: true });
}
/* The words typed find among the lines: a line whose words hold every word typed stays, the words lit; a group left with
   none goes. Nothing typed: every line. */
function narrow(box) {
  const words = box.querySelector('.lk-ks-find').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  for (const line of box.querySelectorAll('.lk-ks-line')) {
    const text = line.querySelector('.lk-ks-words'), plain = text.textContent, low = plain.toLowerCase();
    const hit = words.every(word => low.includes(word));
    line.hidden = !hit;
    text.innerHTML = hit && words.length ? esc(plain).replace(new RegExp(`(${words.map(w => esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi'), '<mark>$1</mark>') : esc(plain);
  }
  for (const group of box.querySelectorAll('.lk-ks-group')) group.hidden = !group.querySelector('.lk-ks-line:not([hidden])');
  box.querySelector('.lk-ks-body').classList.toggle('finding', words.length > 0);
  box.querySelector('.lk-ks-nothing')?.remove();
  if (!box.querySelector('.lk-ks-group:not([hidden])')) box.querySelector('.lk-ks-body').prepend(Look.kit.el(box.ownerDocument, 'p', { class: 'lk-ks-nothing lk-none' }, 'No key does that.'));
  light(box, box.querySelector('.lk-ks-line:not([hidden])'), words.length > 0);
}
function light(box, line, on = true) {
  for (const lit of box.querySelectorAll('.lk-ks-line.lit')) lit.classList.remove('lit');
  if (line && on) { line.classList.add('lit'); line.scrollIntoView({ block: 'nearest' }); }
}
function step(box, by) {
  const lines = [...box.querySelectorAll('.lk-ks-line:not([hidden])')], at = lines.indexOf(box.querySelector('.lk-ks-line.lit'));
  light(box, lines[Math.max(0, Math.min(lines.length - 1, at < 0 ? (by > 0 ? 0 : lines.length - 1) : at + by))]);
}
// A press on a key that can be set sets it; a press elsewhere on the sheet keeps the keyboard in the find line.
const SETTABLE = '.lk-ks-k:is([data-set], [data-cmd])';
function onPress(event) {
  const box = sheet(), target = event.target.closest?.(SETTABLE);
  if (!box || !stays) return;
  event.preventDefault();
  if (target) return startSetting(box, target);
  box.querySelector('.lk-ks-find').focus({ preventScroll: true });
}
// The box waits for the keys: "type the keys", its edge firmer. A second letter is waited for after a plain one (Logseq's "t y").
let first = '', firstTimer = 0;
function startSetting(box, target) {
  if (setting_) endSetting();
  setting_ = target; first = '';
  light(box, target.closest('.lk-ks-line'));
  target.classList.add('lk-ks-setting');
  target.textContent = 'type the keys';
}
// What the box holds now, read again: as it was after Escape, as asked after a key.
function endSetting(spelling) {
  const target = setting_;
  setting_ = null; first = ''; clearTimeout(firstTimer);
  if (!target) return;
  target.classList.remove('lk-ks-setting');
  const mark = spelling !== undefined ? Door.keyMarks(spelling) : target.dataset.set ? Door.keyMarks(plugin(target.dataset.set))
    : Door.keyMarks(Door.logseqCommands().find(c => Door.bare(c.id) === target.dataset.cmd)?.shortcut);
  target.innerHTML = markHtml(mark);
  target.classList.toggle('lk-ks-none', !mark);
}
// The keys pressed, as the settings spell them ("mod+alt+t"): a letter or digit by its place, as Option changes what it types.
const CODES = { Semicolon: ';', Comma: ',', Period: '.', Slash: '/', Backslash: '\\', BracketLeft: '[', BracketRight: ']', Quote: "'", Backquote: '`', Minus: '-', Equal: '=', Space: 'space' };
const keyName = event => { const code = event.code || ''; return /^Key[A-Z]$/.test(code) ? code.slice(3).toLowerCase() : /^Digit\d$/.test(code) ? code.slice(5) : CODES[code] || String(event.key || '').toLowerCase(); };
function spelled(event) {
  const mac = /Mac/i.test(host().defaultView.navigator.platform || '');
  return [mac && event.metaKey ? 'mod' : '', !mac && event.ctrlKey ? 'mod' : '', mac && event.ctrlKey ? 'ctrl' : '', event.altKey ? 'alt' : '', event.shiftKey ? 'shift' : '', keyName(event)].filter(Boolean).join('+');
}
// The same keys as Logseq's config spells them ("meta+shift+p", "alt+up"), its arrows by name.
const ARROWS = { arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right' };
const logseqSpelled = event => [event.ctrlKey ? 'ctrl' : '', event.altKey ? 'alt' : '', event.shiftKey ? 'shift' : '', event.metaKey ? 'meta' : '', ARROWS[keyName(event)] || keyName(event)].filter(Boolean).join('+');
/* Logseq's key for a command, written into the graph's config (its :shortcuts), every other key there kept: Logseq takes it
   at once. None is an empty list, as Logseq's keymap writes it. */
function saveLogseq(id, spelling) {
  const keys = { ...Door.logseqConfigKeys(), [id]: spelling ? [spelling] : [] };
  // Made in Logseq's own window: Logseq reads only an object of its window, and one from the plugin's frame is passed over.
  window.parent.logseq.api.set_current_graph_configs(window.parent.JSON.parse(JSON.stringify({ shortcuts: keys })));
}
function save(target, plugin_, logseq_) {
  if (target.dataset.set) { logseq.updateSettings({ [target.dataset.set]: plugin_ }); return endSetting(plugin_); }
  saveLogseq(target.dataset.cmd, logseq_);
  endSetting(logseq_);
}
function setKey(event) {
  const target = setting_;
  if (['Alt', 'Meta', 'Control', 'Shift', 'CapsLock'].includes(event.key)) return;   // a modifier alone: wait for the key
  if (event.key === 'Escape') return endSetting();
  if (event.key === 'Backspace' || event.key === 'Delete') return save(target, '', '');
  const plain = !event.metaKey && !event.altKey && !event.ctrlKey;
  // A key of Logseq's may be two plain letters, one after the other, as Logseq's own are; a plain key alone would be typed.
  if (plain && target.dataset.cmd && /^[a-z0-9,.;/]$/.test(keyName(event))) {
    if (!first) { first = keyName(event); target.textContent = first + ' …'; clearTimeout(firstTimer); firstTimer = host().defaultView.setTimeout(() => { if (setting_ === target) endSetting(); }, 2000); return; }
    return save(target, '', `${first} ${keyName(event)}`);
  }
  if (plain && !/^f\d+$/.test(keyName(event))) return;   // the plugin's keys take Cmd, Option or Ctrl
  save(target, spelled(event), logseqSpelled(event));
}
// The keys while the sheet stays: they are the sheet's, none reaches Logseq or the other parts.
function stayingKey(event) {
  const box = sheet();
  event.stopPropagation();
  if (setting_) { event.preventDefault(); return setKey(event); }
  const find = box.querySelector('.lk-ks-find'), lit = box.querySelector('.lk-ks-line.lit');
  if (event.key === 'Escape') { event.preventDefault(); if (find.value) { find.value = ''; narrow(box); } else hide(); return; }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); return step(box, event.key === 'ArrowDown' ? 1 : -1); }
  if (event.key === 'Enter') { event.preventDefault(); const target = lit?.querySelector(SETTABLE); if (target) startSetting(box, target); return; }
  if (event.target !== find && !event.metaKey && !event.ctrlKey) find.focus({ preventScroll: true });
}
function onKeyDown(event) {
  if (stays && sheet()) return stayingKey(event);
  if (event.key !== 'Alt') return hide();   // any other key goes on to its own job
  if (event.repeat) return;
  hide();
  if (event.metaKey || event.ctrlKey || event.shiftKey || pressed || event.isComposing || !setting('keySheet')) return;
  timer = setTimeout(show, HOLD);
}
function onKeyUp(event) {
  if (event.key !== 'Alt' || stays) return;
  if (sheet()) stay(); else hide();
}
function start() {
  const doc = host(), win = doc.defaultView;
  style('keys', CSS);
  // On the window, on the way down: Look starts before the others, so this hears a key before any part that keeps it
  // (Predictive keeps Option-T for its tag list).
  listen(win, 'keydown', onKeyDown, true);
  listen(win, 'keyup', onKeyUp, true);
  // A press of the mouse: while Option is held it puts the sheet away; once it stays, only a press outside it does.
  listen(doc, ['mousedown', 'pointerdown'], event => { pressed = true; if (!stays || !sheet()?.contains(event.target)) hide(); }, true);
  listen(doc, ['mouseup', 'pointerup'], () => { pressed = false; }, true);
  listen(doc, 'wheel', event => { if (!stays || !sheet()?.contains(event.target)) hide(); }, { capture: true, passive: true });
  listen(win, 'blur', () => { pressed = false; if (!stays) hide(); });
  listen(doc, 'visibilitychange', hide);
  onStop(hide);
  // Another way in, from Logseq's list of commands: the sheet open and staying, as after a hold.
  logseq.App.registerCommandPalette({ key: 'key-sheet', label: 'Show the keys' }, () => host().defaultView.setTimeout(() => { if (!setting('keySheet')) return; hide(); show(); stay(); }, 150));
}
function stop() { hide(); style('keys', ''); }
Look.keys = { start, stop, groups, keysHtml, spelled, HOLD };
})();
