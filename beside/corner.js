/* BESIDE: the corner. The plugin's own commands, out of the way of what you read and write (the owner, 26 November 2026:
   "actions can be corner based, so out of the way of the main things"), in the bottom right corner where Logseq's ? stood.
   Nothing shows there until the pointer comes near or the keys reach it; then a quiet ···, and a press opens a list to type
   into, as Logseq's own command palette (the owner, 26 November 2026: "the action in the corner was supposed to be commands
   where you could begin searching for them, not just a menu"): the plugin's commands first (Search, Todo, Ontology, a new
   page, the Recycle list, Update plugins and the rest), then every command of Logseq's own, each with its key. What is done to a node stays on its right-click (the
   owner: "actions is not meant to replace what can be done with right click"). The Todo and Ontology buttons of the top bar
   come here (the owner's answer on "A Leaner Logseq", 26 November 2026). */
(function () {
const G = window.PluginDoor;
G.part({
  key: 'corner', title: 'The corner', about: 'Commands in the bottom right corner, to type into: the plugin’s, then Logseq’s own with their keys. It shows when the pointer comes near.',
  start(base) {
    base.style('corner', `
.lk-corner { position: fixed; right: 0; bottom: 0; z-index: 9997; width: 64px; height: 64px; display: grid; place-items: center; pointer-events: auto; }
.lk-corner > button { width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: var(--lk-corner-round); background: none; color: var(--lk-quiet); cursor: pointer; opacity: 0; transition: opacity .12s ease; }
.lk-corner:hover > button, .lk-corner > button:focus-visible, .lk-corner > button[aria-expanded="true"] { opacity: 1; outline: none; }
.lk-corner > button:hover, .lk-corner > button:focus-visible, .lk-corner > button[aria-expanded="true"] { background: var(--lk-wash); color: var(--lk-text); }
.lk-corner > button svg { width: 18px; height: 18px; }`);
    const doc = G.host(), box = doc.createElement('div'); box.className = 'lk-corner';
    box.innerHTML = `<button type="button" title="Commands" aria-label="Commands" aria-haspopup="menu" aria-expanded="false">${G.touch.icon('dots', 18)}</button>`;
    doc.body.appendChild(box);
    base.onStop(() => box.remove());
    const press = box.firstElementChild;
    const run = name => () => G.touch.commands().find(one => one.name === name)?.run();
    const make = words => G.write.newPage(words).then(uuid => G.touch.open(uuid)).catch(error => G.say(`The page could not be made: ${error?.message || 'Logseq refused'}`, 'warning'));
    const open = () => {
      const mine = G.touch.commands(), have = new Map(mine.map(one => [one.name, one])), items = [], used = new Set(['lk-corner']);
      const add = (name, word, value = '') => { if (have.has(name) && !used.has(name)) { used.add(name); items.push({ word, value, take: run(name) }); } };
      add('lk-search', 'Search', G.setting('searchTakesSearchKey') === false ? '' : '⌘K'); add('lk-todo-side', 'Todo'); add('lk-ontology', 'Ontology');
      items.push({ word: 'New page…', take: () => G.menu(press, [], { find: 'The new page’s name', enter: make }) });
      add('lk-recycle', 'Recycle'); add('lk-update-plugins', 'Update plugins');
      for (const one of mine) if (!/^(lk-todo|lk-ontology-side)$/.test(one.name)) add(one.name, one.label);   // Todo and Ontology stand once, where they open
      const theirs = G.touch.logseqCommands().sort((a, b) => a.id.localeCompare(b.id));   // the ones of a kind together: editor, go, graph, ui
      if (theirs.length) items.push({ gap: true });
      for (const one of theirs) items.push({ word: one.label, value: one.key, take: () => Promise.resolve(one.run()).catch(error => G.say(`“${one.label}” could not be done: ${error?.message || 'Logseq refused'}`, 'warning')) });
      press.setAttribute('aria-expanded', 'true');
      // One list to type into, as Logseq's own command palette: the words narrow it, Enter does the lit line; words no line
      // has offer a new page of that name.
      G.menu(press, items, { find: 'Type a command', rank: true, height: 420, make: name => ({ word: `New page “${name}”`, take: () => make(name) }) });
      // The menu stands over the corner, opening up and to the left; the press keeps its look until the menu goes.
      const watch = doc.defaultView.setInterval(() => { if (!doc.querySelector('.lk-menu')) { press.setAttribute('aria-expanded', 'false'); doc.defaultView.clearInterval(watch); } }, 150);
    };
    press.addEventListener('click', open);
    G.touch.command('lk-corner', 'Commands (the corner)', () => { press.focus(); open(); });
  },
});
})();
