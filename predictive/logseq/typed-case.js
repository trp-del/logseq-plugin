/* Your capitals in a link (core/typed-case.js says why). While a bullet is open, what you typed for each [[link]] is kept,
   through Logseq's list putting in the page's own name when you pick it. When you leave the bullet and Logseq has saved it, a
   link typed with other capitals than the page's is written as a link with your words: [dr. mei chen]([[Dr. Mei Chen]]). It
   looks and opens as any link, and Cmd-Z puts the page's name back. A name that differs in more than its capitals (a few
   letters typed, then a page picked) is left as Logseq wrote it. Back in the bullet, such a link shows as [[dr. mei chen]]
   while you edit. Setting: linkKeepCase. */
(function () {
const Flow = window.Flow;
const { app } = Flow;
const { plainLinks, carry, keepCase, tagIds, tagsByName, asTyped } = Flow.typedCase;

const sessions = new Map();   // by the bullet's uuid: { uuid, box, names, typed }
let timer = 0;
const plain = text => String(text ?? '').replace(/#\[\[([^\[\]]+)\]\]/g, '#$1').trim().toLowerCase();
const same = (a, b) => plain(a) === plain(b);
const namesIn = box => plainLinks(box.value).map(link => link.name);

// A look at the open bullet: what is typed now, carried from the last look.
function look(box) {
  if (!app.isBlockBox(box)) return;
  const uuid = app.uuidOf(box);
  if (!uuid) return;
  const names = namesIn(box), was = sessions.get(uuid);
  sessions.set(uuid, { uuid, box, names, value: box.value, typed: was ? carry(was.names, was.typed, names) : names.slice() });
  if (!timer) timer = setInterval(check, 400);
}

/* Back in the bullet: a link kept with your words shows as you typed it, [[dr. mei chen]], not as Logseq keeps it. The words
   are put in as typing is (so Logseq's editor takes them), the cursor kept on its letter; leaving writes them back as before. */
function showTyped(box) {
  if (!app.isBlockBox(box) || !app.setting('linkKeepCase') || sessions.has(app.uuidOf(box))) return;
  const shown = asTyped(box.value);
  if (!shown) return;
  const [start, end] = [box.selectionStart, box.selectionEnd];
  Object.getOwnPropertyDescriptor(box.ownerDocument.defaultView.HTMLTextAreaElement.prototype, 'value').set.call(box, shown.text);
  box.dispatchEvent(new box.ownerDocument.defaultView.InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
  box.setSelectionRange(shown.at(start), shown.at(end));
}

// A bullet is left when its text box is gone or no longer has the keys.
function check() {
  const active = app.host().activeElement;
  for (const session of [...sessions.values()]) {
    if (session.box.isConnected && session.box === active) { look(session.box); continue; }   // Logseq's list puts a name in without an input event
    leave(session);
  }
  if (!sessions.size) { clearInterval(timer); timer = 0; }
}

/* Left: what was typed is drawn on the bullet's links at once (draw), and written to the graph once Logseq has saved it
   (settle). Logseq draws the bullet with the page's own name the moment it is left, and the write takes a moment more, so
   without the drawing Dr. Mei Chen would show before dr. mei chen. The drawing stands until the write is in or given up. */
const drawing = new Map();   // by the bullet's uuid: the names typed in other capitals than the words now in the box
function leave(session) {
  if (!sessions.has(session.uuid) || sessions.get(session.uuid) !== session) return;
  sessions.delete(session.uuid);
  if (!session.typed.length || !app.setting('linkKeepCase')) return;
  const mine = session.typed.slice();
  drawing.set(session.uuid, mine);
  draw(app.host());
  settle(session).catch(error => app.warnOnce('a link could not keep its capitals', error)).finally(() => { if (drawing.get(session.uuid) === mine) drawing.delete(session.uuid); });
}
// Each link of a left bullet that shows a typed name in other capitals shows the typed name, before the screen is painted.
function draw(doc) {
  for (const [uuid, typed] of drawing) {
    for (const block of doc.querySelectorAll(`.ls-block[blockid="${uuid}"]`)) {
      const left = typed.slice();
      for (const ref of block.querySelectorAll('.page-ref')) {
        if (ref.closest('.ls-block') !== block) continue;
        const words = ref.firstElementChild?.childElementCount === 0 ? ref.firstElementChild : null;
        if (!words) continue;
        const i = left.findIndex(name => name.toLowerCase() === words.textContent.toLowerCase());
        if (i < 0) continue;
        if (words.textContent !== left[i]) words.textContent = left[i];
        left.splice(i, 1);
      }
    }
  }
}
// The text box gone is a bullet left: seen at once, as the screen changes, so the drawing is in before the bullet is painted.
function onScreen(doc) {
  for (const session of [...sessions.values()]) if (!session.box.isConnected) leave(session);
  if (drawing.size) draw(doc);
}

// Once Logseq has saved the bullet (its links line up with what was typed), the links typed in other capitals get your words.
async function settle(session, tries = 0) {
  if (!session.typed.length || !app.setting('linkKeepCase')) return;
  const block = await logseq.Editor.getBlock(session.uuid);
  const saved = String(block?.title ?? '');
  const links = plainLinks(saved);
  // Saved means the words Logseq holds are the words last seen in the box (names read in any capitals): never write over a save
  // still on its way.
  const ready = links.length === session.typed.length && links.every(link => Flow.text.UUID.test(link.name)) && same(block?.fullTitle, session.value);
  if (!ready) { if (tries < 8) setTimeout(() => settle(session, tries + 1).catch(() => {}), 250); return; }
  const titles = new Map();
  for (const uuid of [...links.map(link => link.name), ...tagIds(saved)]) if (!titles.has(uuid)) titles.set(uuid, (await logseq.Editor.getPage(uuid).catch(() => null))?.title || '');
  const changed = keepCase(saved, session.typed, uuid => titles.get(uuid));
  const words = changed && tagsByName(changed, uuid => titles.get(uuid));
  if (!words) return;
  // Back in the bullet already: it waits for the next time it is left, what was typed still kept.
  if (String((await logseq.Editor.checkEditing()) || '') === session.uuid) {
    const box = app.host().activeElement;
    if (app.isBlockBox(box) && app.uuidOf(box) === session.uuid) { sessions.set(session.uuid, { ...session, box }); look(box); }
    return;
  }
  if (String((await logseq.Editor.getBlock(session.uuid))?.title ?? '') !== saved) return;   // changed meanwhile: nothing guessed
  await window.PluginDoor.write.setWords(session.uuid, words);
}

function start() {
  const doc = app.host(), win = doc.defaultView || window.parent;
  app.listen(win, ['focusin'], event => { showTyped(event.target); look(event.target); }, true);
  app.listen(win, ['input'], event => look(event.target), true);
  const unwatch = window.PluginDoor.watch(onScreen, { early: true });
  app.onStop(() => { clearInterval(timer); timer = 0; sessions.clear(); drawing.clear(); unwatch(); });
  if (doc.activeElement) { showTyped(doc.activeElement); look(doc.activeElement); }
}

Flow.typedCaseUi = { start };
})();
