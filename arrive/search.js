/* ARRIVING: Search, a section of the right sidebar (the owner, 26 November 2026: "search can be sidebar", its results opening in
   the main view), grown into what Find did (the owner's choices of 26 November 2026 on "What Search gains from Find": all seven
   as Find did them). The first step of a walk: the kind of thing, who it was with, roughly when, then the thread from there.
   - Nothing typed: the kinds in the graph, most held first, each with how many nodes it holds (counting the kinds under it),
     "more" for all of them as an outline; under them the pages opened last.
   - Letters typed: under the line, the choices they light (a kind that "cons" spells, with its count; with a kind taken, a value
     its nodes hold that "mei" begins, Dr. Mei Chen under Provider). Tab takes the lit choice as a piece of the line.
   - Plain words: Logseq's own search answers, the nodes that hold the words first, then the ones that hold them in a value (said
     after the words), then the rest of what Logseq found; the kinds among them are the choices.
   - A kind taken: its nodes, newest first, and above them what they hold to narrow by, each value with how many hold it (Provider,
     Topic …), then the months. A value or a month pressed or taken by Tab becomes a piece; words then narrow further.
   - One line, no ways to switch between: "Consultation with Mei Chen around Aug 2026" typed there is read as a kind, a value
     and a time, each said over what it read; the time shows as a strip of months, and the nodes just outside it follow under
     "Near". Words that name no time and no kind with something else are plain words, and so is a sentence that finds nothing.
     Tab puts the lit choice's name in place of the letters that lit it.
   - A row: the fold arrow, or Right, opens the node in place under its line; a press on the line, or Enter, goes to the node in
     the main view, Shift to the sidebar; right-click is the line's own menu.
     Escape  empties the words, then lets go of the pieces, then of the line     Backspace on an empty line  takes the last piece off
     Cmd-Enter  makes a page of the words
   Cmd-K opens it and puts the keys in its line. */
(function () {
const G = window.PluginDoor, S = G.search, R = G.sentence;
const LOOK = 'M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0M21 21l-6 -6';   // a magnifier, as Logseq's own line icons are drawn
const FEW = { kind: 3, value: 3, month: 4 };   // what a line of choices shows before its "more", as Find did
G.part({
  key: 'search', title: 'Search', about: 'A section of the right sidebar to search your notes: kinds, values and months to narrow by, words or a whole sentence in one line, opening in the main view or in place. Cmd-K opens it.',
  settings: [{ key: 'searchTakesSearchKey', type: 'boolean', default: true, title: 'Search opens on Cmd-K', description: 'Off: Cmd-K stays Logseq’s own search, and the plugin’s opens from the command palette.' }],
  start(base) {
    base.style('search', `
.lk-search { padding: 4px 4px 16px 10px; font-size: var(--lk-line-size); line-height: var(--lk-line-lead); }
.lk-search .lk-add { flex-wrap: wrap; align-items: baseline; gap: 4px 8px; }
.lk-search .lk-add > .lk-field { flex: 1 1 8rem; min-width: 8rem; }
.lk-search-piece { flex: none; padding: 0; border: 0; background: none; color: var(--lk-text); font: inherit; cursor: pointer; }
.lk-search-piece:hover, .lk-search-piece:focus-visible { text-decoration: line-through; text-decoration-color: var(--lk-quiet); outline: none; }
.lk-search-piece .lk-prop { margin-right: 4px; }
.lk-search-read { display: flex; flex-wrap: wrap; gap: 4px 14px; padding: 8px 0 0; }
.lk-search-read[hidden], .lk-search-choices[hidden], .lk-search-none[hidden], .lk-search .lk-time[hidden] { display: none; }
.lk-search-read > span { display: inline-flex; flex-direction: column; }
.lk-search-read small { font-size: var(--lk-label); color: var(--lk-quiet); line-height: 1.2; }
.lk-search-choices { display: flex; flex-direction: column; gap: 8px; padding: 10px 0 4px; }
.lk-choice-line { display: flex; flex-direction: column; gap: 2px; }
.lk-choice-name[hidden] { display: none; }
.lk-choice-name { font-size: var(--lk-label); color: var(--lk-quiet); }
.lk-choice-name.lk-prop { font-size: var(--lk-label); }
.lk-choice-vals { display: flex; flex-wrap: wrap; gap: 0 10px; margin-left: -4px; }
.lk-choice-vals.lk-choice-tree { flex-direction: column; }
.lk-choice-tree > * { align-self: flex-start; }
.lk-choice-tree > .lk-choice[hidden] { display: none; }
.lk-choice-fold { display: inline-flex; width: 16px; vertical-align: -2px; color: var(--lk-off); visibility: hidden; }
.lk-choice-fold svg { transform: rotate(90deg); }
.lk-choice.lk-kids > .lk-choice-fold { visibility: visible; opacity: 0; }
.lk-choice.lk-kids:is(:hover, :focus-visible, .lk-shut) > .lk-choice-fold { opacity: 1; }
.lk-choice.lk-shut > .lk-choice-fold svg { transform: none; }
.lk-choice { padding: 1px 4px; border: 0; border-radius: var(--lk-corner); background: none; color: var(--lk-text); font: inherit; text-align: left; cursor: pointer; }
.lk-choice[data-face="tag"] { font-family: var(--lk-tag-face); font-size: var(--lk-tag-size); }
.lk-choice small { margin-left: 4px; color: var(--lk-quiet); font-family: var(--lk-words-face, inherit); font-size: var(--lk-small); font-variant-numeric: tabular-nums; }
.lk-choice:hover, .lk-choice:focus-visible, .lk-choice.lit { background: var(--lk-lit); outline: none; }
.lk-choice-more { padding: 1px 4px; border: 0; background: none; color: var(--lk-quiet); font: inherit; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.lk-choice-more:hover { color: var(--lk-text); }
.lk-search .lk-list { margin-top: 0; }
.lk-search .lk-row > .lk-open { --lk-open-shift: 0px; }   /* an opened row's words exactly where its line's stood */
.lk-search .lk-rows { margin-left: -12px; }   /* the dots out near the edge of the line and the group's name */
.lk-search .lk-list-name { font-size: var(--lk-small); font-weight: 600; }
.lk-search-choices + .lk-search-none, .lk-search-choices:not([hidden]) ~ .lk-rel { margin-top: 8px; }
.lk-search .lk-search-none { color: var(--lk-quiet); padding: 8px 0 0; }
.lk-search mark.lk-hit { background: none; color: inherit; font-weight: 600; padding: 0; margin: 0; border-radius: 0; }   /* the typed letters, in the words' own ink, a step heavier */`);
    const boxes = new Set();   // every drawn Search (the sidebar's section; one at a time in practice)
    const plain = async nodes => { const names = await G.read.names(nodes.flatMap(node => G.words.named(node.words))); return nodes.map(node => ({ ...node, plain: G.words.plain(node.words, names) })); };
    // A kind's nodes with what each holds, read once a kind is taken and kept until the graph changes.
    const kept = new Map();
    const kindNodes = async tag => {
      if (!kept.has(tag.id)) kept.set(tag.id, (async () => {
        const [tags, props] = await Promise.all([G.read.tags(), G.read.properties()]), nodes = await plain(await G.read.tagged([...G.tags.under(tag.id, tags)])), held = await G.read.held(nodes.map(node => node.id));
        // Days are left to the months, as Find left them; a tick narrows nothing worth a line.
        const dated = new Set([...props.values()].filter(prop => /^(date|datetime|checkbox)$/.test(prop.type)).map(prop => prop.title));
        return nodes.map(node => { const h = Object.fromEntries(Object.entries(held.get(node.id) || {}).filter(([name]) => !dated.has(name))); return { ...node, held: h, values: Object.values(h).flat() }; }).sort((a, b) => (b.day || 0) - (a.day || 0) || a.plain.localeCompare(b.plain));
      })().catch(error => { kept.delete(tag.id); throw error; }));
      return kept.get(tag.id);
    };
    const kindCounts = async () => { const [tags, pairs] = await Promise.all([G.read.tags(), G.read.tagPairs()]); return { tags, counts: G.tags.counts(tags, pairs) }; };
    const byNorm = (list, key) => new Map(list.map(one => [R.norm(key(one)), one]));
    const shown = (nodes, words) => S.narrow(nodes.map(node => ({ ...node, shown: node.words, words: node.plain })), words).map(node => ({ ...node, words: node.shown }));
    const draw = holder => {
      const doc = holder.ownerDocument, win = doc.defaultView;
      holder.classList.add('lk-search', 'lk-day-end');
      holder.innerHTML = '<div class="lk-add"><span class="lk-search-pieces" style="display:contents"></span><input class="lk-field" type="text" placeholder="Search" spellcheck="false" autocomplete="off" aria-label="Search"></div><div class="lk-search-read" hidden></div><div class="lk-time" hidden></div><div class="lk-search-choices" hidden></div><div class="lk-search-none" hidden>Nothing holds these words</div><div class="lk-rel"></div>';
      const field = holder.querySelector('.lk-field'), piecesEl = holder.querySelector('.lk-search-pieces'), readEl = holder.querySelector('.lk-search-read'),
        timeEl = holder.querySelector('.lk-time'), choicesEl = holder.querySelector('.lk-search-choices'), noneEl = holder.querySelector('.lk-search-none'), rel = holder.querySelector('.lk-rel');
      const box = { holder, field, sentence: false, picks: [], text: '', more: new Set(), lit: null, choices: [], timer: 0, turn: 0 };
      boxes.add(box);
      const tagOf = () => box.picks.find(pick => pick.kind === 'tag')?.tag || null;
      // The lines of choices, each { key, name, face, items: [{ label, count, take, depth }] }; the lit one is the first that the letters begin.
      let paint = [];   // what an answer draws above its rows, drawn only when no later letter has overtaken it
      const drawChoices = (lines, trail) => paint.push(() => drawChoicesNow(lines, trail));
      const drawChoicesNow = (lines, trail) => {
        box.choices = lines; box.lit = null;
        const want = trail.join(' ');
        if (want) for (const line of lines) { const item = line.items.find(one => R.norm(one.label).split(/[\s.]+/).some((part, i, all) => all.slice(i).join(' ').startsWith(want)) || R.norm(one.label).includes(want)); if (item) { box.lit = item; break; } }
        choicesEl.hidden = !lines.length;
        choicesEl.replaceChildren(...lines.map(line => {
          const el = doc.createElement('div'); el.className = 'lk-choice-line';
          const name = doc.createElement('div'); name.className = 'lk-choice-name' + (line.face === 'prop' ? ' lk-prop' : ''); name.textContent = line.name; name.hidden = line.kind === 'kind';   // the kinds say what they are
          const all = box.more.has(line.key), few = FEW[line.kind] || 3, lit = box.lit && line.items.includes(box.lit);
          let items = all ? line.items : line.items.slice(0, few);
          if (!all && lit && !items.includes(box.lit)) items = [...items.slice(0, few - 1), box.lit];   // the lit one always shows
          const vals = doc.createElement('div'); vals.className = 'lk-choice-vals' + (all && line.tree ? ' lk-choice-tree' : '');
          for (const item of items) {
            const b = doc.createElement('button'); b.type = 'button'; b.className = 'lk-choice' + (item === box.lit ? ' lit' : ''); b.dataset.face = line.face === 'tag' ? 'tag' : '';
            if (all && line.tree) { b.style.paddingLeft = `${(item.depth || 0) * 14}px`; const arrow = doc.createElement('span'); arrow.className = 'lk-choice-fold'; arrow.setAttribute('aria-hidden', 'true'); arrow.innerHTML = G.touch.icon('chevron-right', 14); b.append(arrow); }
            b.append(item.label); if (item.count != null) { const n = doc.createElement('small'); n.textContent = item.count; b.append(n); }
            b.lkTake = item.take; vals.append(b);
          }
          if (line.items.length > few) { const more = doc.createElement('button'); more.type = 'button'; more.className = 'lk-choice-more'; more.textContent = all ? 'fewer' : 'more'; more.lkMore = line.key; vals.append(more); }
          if (all && line.tree) { vals.lkNames = items; foldUp(vals); }
          el.append(name, vals); return el;
        }));
      };
      // All the kinds are an outline, folded as every list of tags is (G.folds); what is folded stays folded.
      const foldUp = vals => {
        const state = G.tags.folds(vals.lkNames.map(item => ({ depth: item.depth, name: item.label })), G.folds.shut);
        [...vals.querySelectorAll('.lk-choice')].forEach((button, i) => { button.hidden = state[i].hidden; button.classList.toggle('lk-kids', state[i].kids); button.classList.toggle('lk-shut', state[i].shut); if (state[i].kids) button.setAttribute('aria-expanded', String(!state[i].shut)); });
      };
      const fold = (button, on = !button.classList.contains('lk-shut')) => {
        const vals = button.closest('.lk-choice-tree');
        if (!vals || !button.classList.contains('lk-kids')) return false;
        G.folds.set(vals.lkNames[[...vals.querySelectorAll('.lk-choice')].indexOf(button)].label, on); foldUp(vals); return true;
      };
      const drawPieces = () => {
        piecesEl.replaceChildren(...box.picks.map((pick, i) => {
          const b = doc.createElement('button'); b.type = 'button'; b.className = 'lk-search-piece'; b.title = 'Take it off'; b.dataset.i = i;
          if (pick.kind === 'tag') { const t = doc.createElement('span'); t.className = 'lk-tag'; t.textContent = pick.tag.title; b.append(t); }
          else if (pick.kind === 'value') { const p = doc.createElement('span'); p.className = 'lk-prop'; p.textContent = pick.prop; b.append(p, pick.label); }
          else b.append(pick.label);
          return b;
        }));
        field.placeholder = tagOf() ? 'Words, a value, a month' : box.picks.length ? 'Words' : 'Search';
      };
      // What a sentence read, said over what it read (kind, the property's name, page, when).
      const drawRead = picks => paint.push(() => drawReadNow(picks));
      const drawReadNow = picks => {
        readEl.hidden = !picks.length;
        readEl.replaceChildren(...picks.map(pick => {
          const el = doc.createElement('span'), note = doc.createElement('small'), what = doc.createElement('span');
          note.textContent = pick.kind === 'tag' ? 'kind' : pick.kind === 'value' ? pick.prop : pick.kind === 'page' ? 'page' : 'when';
          if (pick.kind === 'tag') { what.className = 'lk-tag'; what.textContent = pick.tag.title; } else what.textContent = pick.kind === 'page' ? pick.title : pick.label;
          el.append(note, what); return el;
        }));
      };
      const take = item => { item.take(); };
      // Taking a choice: as a piece, or in a sentence in place of the letters that lit it.
      const takeAs = (pick, label) => () => {
        if (box.sentence) {
          const words = field.value.replace(/\s+$/, ''), trail = R.read(words, box.names || {}).trail, cut = trail.length ? words.toLowerCase().lastIndexOf(trail[0]) : -1;
          field.value = (cut >= 0 ? words.slice(0, cut) : words + (words ? ' ' : '')) + label + ' ';
        } else {
          box.picks = box.picks.filter(one => !(one.kind === pick.kind && (pick.kind !== 'value' || one.prop === pick.prop)));
          box.picks.push(pick); if (pick.kind === 'tag') box.picks.sort((a, b) => (b.kind === 'tag') - (a.kind === 'tag'));
          field.value = '';
        }
        box.text = field.value; box.more.clear(); again(); field.focus();
      };
      const kindLine = (key, list, counts, tree) => ({ key, kind: 'kind', name: 'Kind', face: 'tag', tree, items: list.map(one => ({ label: one.tag.title, count: counts.get(one.tag.id) ?? one.count, depth: one.depth, take: takeAs({ kind: 'tag', tag: one.tag }, one.tag.title) })) });
      const valueLines = (nodes, taken) => {
        const { props, months } = S.choices(nodes), lines = [];
        for (const one of props) if (!taken.some(pick => pick.kind === 'value' && pick.prop === one.prop)) lines.push({ key: `v:${one.prop}`, kind: 'value', name: one.prop, face: 'prop', items: one.values.map(value => ({ label: value.label, count: value.count, take: takeAs({ kind: 'value', prop: one.prop, label: value.label }, value.label) })) });
        if (months.length > 1 && !taken.some(pick => pick.kind === 'month' || pick.kind === 'when')) lines.push({ key: 'when', kind: 'month', name: 'When', items: months.map(month => ({ label: month.label, count: month.count, take: takeAs({ kind: 'month', key: month.key, label: month.label }, month.label) })) });
        return lines;
      };
      const groupsOf = (rows, near = []) => {
        if (tagOf() || box.sentence) return [...(rows.length ? [{ key: 'search:found', kind: 'group', name: '', tag: '', rows }] : []), ...(near.length ? [{ key: 'search:near', kind: 'group', name: 'Near', tag: '', rows: near }] : [])];
        const groups = new Map();
        for (const row of rows) { const name = row.tag || (row.isPage ? 'Pages' : 'Lines'); if (!groups.has(name)) groups.set(name, []); groups.get(name).push(row); }
        const order = name => name === 'Lines' ? 2 : name === 'Pages' ? 1 : 0;
        return [...groups].sort((a, b) => order(a[0]) - order(b[0])).map(([name, list]) => ({ key: `search:${name}`, kind: 'group', name, tag: '', rows: list }));
      };
      // A line found in a note says where it sits, so two lines of the same words are told apart; a journal is the day at the end.
      const placed = async (rows, tagShown) => {
        const sits = await G.read.where(rows.filter(node => !node.isPage).map(node => node.id));
        return rows.slice(0, 120).map(node => ({ ...node, tagShown, dayShown: node.day, where: node.isPage ? [] : (sits.get(node.id) || []).filter(step => !step.day).slice(0, 2) }));
      };
      // Plain words, no kind: Logseq's own search; what holds the words first, then what holds them in a value, said after its words.
      const searched = async words => {
        const nodes = await plain(await G.read.search(words, 80)), values = await G.read.values(nodes.map(node => node.id));
        const all = nodes.map(node => ({ ...node, values: values.get(node.id) || [], shown: node.words, words: node.plain }));
        const own = S.rank(all, words), seen = new Set(own.map(node => node.uuid));
        const through = S.narrow(all.filter(node => !seen.has(node.uuid)), words).filter(node => node.why.length);
        for (const node of through) seen.add(node.uuid);
        // Then the rest of Logseq's own answers, as Find gave them (the owner's choice, 26 November 2026), last, each node once.
        const rest = all.filter(node => !seen.has(node.uuid) && seen.add(node.uuid));
        return [...own, ...through, ...rest].map(node => ({ ...node, words: node.shown }));
      };
      const readPieces = async () => {
        const text = box.text.trim(), tag = tagOf(), rest = box.picks.filter(pick => pick.kind !== 'tag'), want = S.tokens(text);
        drawRead([]); paint.push(() => { timeEl.hidden = true; });
        if (tag) {
          const base = (await kindNodes(tag)).filter(node => S.holds(node, rest));
          const said = R.read(text, {}), time = said.picks.find(pick => pick.kind === 'when');
          drawChoices(valueLines(base, rest.concat(time ? [time] : [])), time ? said.trail : want);
          if (!time) return { rows: await placed(shown(base, text), false) };
          drawRead([time]);
          const held = shown(base, said.words.join(' ')), inside = held.filter(node => node.day && node.day >= time.from && node.day <= time.to);
          const near = held.filter(node => node.day && (node.day < time.from || node.day > time.to) && node.day >= time.nearFrom && node.day <= time.nearTo);
          return { rows: await placed(inside, false), near: await placed(near, false) };
        }
        const { tags, counts } = await kindCounts();
        if (!text) {
          const top = [...tags.values()].filter(one => counts.get(one.id)).sort((a, b) => counts.get(b.id) - counts.get(a.id) || a.title.localeCompare(b.title));
          const all = box.more.has('kinds') ? G.tags.tree(tags).filter(one => counts.get(one.tag.id)).map(one => ({ tag: one.tag, depth: one.depth })) : top.map(tag => ({ tag }));
          drawChoices(top.length ? [kindLine('kinds', all, counts, true)] : [], []);
          const recent = (await G.read.recent(8)).filter(Boolean);
          return { rows: await placed(recent, true), recent: true };
        }
        const found = await searched(text), spelled = S.kinds(tags, text), among = S.kindsAmong(found), titled = new Map([...tags.values()].map(one => [one.title, one]));
        const kinds = [...spelled.map(one => ({ tag: one })), ...among.filter(one => titled.has(one.title) && !spelled.some(s => s.title === one.title)).map(one => ({ tag: titled.get(one.title), count: one.count }))];
        drawChoices(kinds.length ? [kindLine('kinds', kinds, new Map(spelled.map(one => [one.id, counts.get(one.id) || 0])), false)] : [], want);
        return { rows: await placed(found, false) };
      };
      const readSentence = async () => {
        const text = box.text, [{ tags, counts }, pages] = await Promise.all([kindCounts(), G.read.pageNames()]);
        const kinds = byNorm([...tags.values()], one => one.title);
        const names = { kinds, pages: byNorm(pages.filter(page => !kinds.has(R.norm(page.title))), page => page.title), values: null };
        let read = R.read(text, names);
        const tag = read.picks.find(pick => pick.kind === 'tag')?.tag;
        let base = null;
        if (tag) {
          base = await kindNodes(tag);
          names.values = new Map();
          for (const node of base) for (const [prop, words] of Object.entries(node.held)) for (const label of words) if (!names.values.has(R.norm(label))) names.values.set(R.norm(label), { prop, label });
          read = R.read(text, names);
        }
        box.names = names;
        drawRead(read.picks);
        const values = read.picks.filter(pick => pick.kind === 'value'), time = read.picks.find(pick => pick.kind === 'when'), page = read.picks.find(pick => pick.kind === 'page'), words = read.words.join(' ');
        let nodes;
        if (base) {
          nodes = base.filter(node => S.holds(node, values));
          if (page) { const name = R.norm(page.title); nodes = nodes.filter(node => R.norm(node.plain).includes(name) || node.values.some(value => R.norm(value) === name)); }
          drawChoices(valueLines(nodes, values.concat(time ? [time] : [])), read.trail);
        } else if (page) {
          const pagesById = pages.find(one => one.uuid === page.uuid), at = pagesById ? await G.read.pointingAt(pagesById.id) : { links: [], mentions: [] };
          const found = [...at.links.map(link => link.node), ...at.mentions], held = await G.read.held(found.map(node => node.id));
          nodes = (await plain([...new Map(found.map(node => [node.uuid, node])).values()])).map(node => { const h = held.get(node.id) || {}; return { ...node, held: h, values: Object.values(h).flat() }; }).sort((a, b) => (b.day || 0) - (a.day || 0));
          drawChoices([kindLine('kinds', S.kindsAmong(nodes).filter(one => kinds.has(R.norm(one.title))).map(one => ({ tag: kinds.get(R.norm(one.title)), count: one.count })), new Map(), false)].filter(line => line.items.length), read.trail);
        } else if (words) {
          nodes = await searched(words);
          drawChoices([], []);
        } else {
          const spelled = read.trail.length ? S.kinds(tags, read.trail.join(' ')) : [];
          drawChoices(spelled.length ? [kindLine('kinds', spelled.map(one => ({ tag: one })), counts, false)] : [], read.trail);
          nodes = [];
        }
        if (base || page) nodes = shown(nodes, words);
        let near = [];
        if (time) {
          near = nodes.filter(node => node.day && (node.day < time.from || node.day > time.to) && node.day >= time.nearFrom && node.day <= time.nearTo);
          nodes = nodes.filter(node => node.day && node.day >= time.from && node.day <= time.to);
        }
        const dots = [...nodes, ...near].filter(node => node.day).map(node => ({ day: node.day, title: node.plain || '', uuid: node.uuid }));
        paint.push(() => { timeEl.hidden = !time || !dots.length; });
        if (time && dots.length) paint.push(() => G.timeline.strip(timeEl, dots, G.days.number(new Date()), dot => { const line = holder.querySelector(`.lk-row[data-uuid="${dot.uuid}"] > .lk-line`); if (line) { line.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); line.focus({ preventScroll: true }); } }));
        return { rows: await placed(nodes, !tag), near: await placed(near, !tag) };
      };
      // One line, no ways to switch between (the owner, 26 November 2026: "one unified search like the original find"): words that
      // name a time together with something else, or a kind with something else, are read as a sentence; the rest as plain words.
      const asSentence = async () => {
        if (box.picks.length || !box.text.trim()) return false;
        const [{ tags }, pages] = await Promise.all([kindCounts(), G.read.pageNames()]);
        const kinds = byNorm([...tags.values()], one => one.title);
        return R.sentenceLike(R.read(box.text, { kinds, pages: byNorm(pages.filter(page => !kinds.has(R.norm(page.title))), page => page.title), values: null }));
      };
      const read = async () => {
        const turn = ++box.turn, mine = paint = [];
        drawPieces();
        const sentence = await asSentence();
        if (turn !== box.turn) return [];
        box.sentence = sentence;
        let got = sentence ? await readSentence() : await readPieces();
        if (sentence && !got.rows.length && !got.near?.length && turn === box.turn) { mine.length = 0; box.sentence = false; got = await readPieces(); }   // a sentence that finds nothing is plain words
        if (turn !== box.turn) return [];   // a later letter has overtaken this answer: the list drops it too
        for (const job of mine) job();
        noneEl.hidden = !!(got.rows.length || got.near?.length) || got.recent || !(box.text.trim() || box.picks.length);
        if (got.recent) return got.rows.length ? [{ key: 'search:recent', kind: 'group', name: 'Recently opened', tag: '', rows: got.rows }] : [];
        return groupsOf(got.rows, got.near || []);
      };
      const list = G.node.listing(rel, read, { few: 8, press: (row, event) => { G.touch.open(row.dataset.uuid, event.shiftKey); return true; },
        key: (row, event) => { if (event.key !== 'Enter') return false; G.touch.open(row.dataset.uuid, event.shiftKey); return true; } });
      const mark = () => { const want = box.sentence ? R.read(box.text, box.names || {}).words : S.tokens(box.text); for (const words of rel.querySelectorAll('.lk-line > .lk-words')) G.node.hit(words, want); };
      rel.addEventListener('lk-drawn', mark);
      const again = () => list.again();
      box.take = tag => { box.picks = tag ? [{ kind: 'tag', tag }] : []; box.text = ''; field.value = ''; box.more.clear(); again(); field.focus(); };
      box.again = () => { kept.clear(); again(); };
      const onInput = () => { box.text = field.value; win.clearTimeout(box.timer); box.timer = win.setTimeout(again, tagOf() ? 0 : 140); };
      const make = async () => {
        const name = field.value.trim(); if (!name || tagOf()) return;
        try { G.touch.open(await G.write.newPage(name)); } catch (error) { G.say(`The page could not be made: ${error?.message || 'Logseq refused'}`, 'warning'); }
      };
      const onKey = event => {
        const first = () => rel.querySelector('.lk-row > .lk-line');
        if (event.key === 'Tab' && !event.shiftKey) {
          if (box.lit) { event.preventDefault(); take(box.lit); }
          else { const choice = choicesEl.querySelector('.lk-choice'); if (choice) { event.preventDefault(); choice.focus(); } }
          return;
        }
        if (event.key === 'ArrowDown') { const line = first(); if (line) { event.preventDefault(); line.focus(); } return; }
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); make(); return; }
        if (event.key === 'Enter') { const row = first()?.parentElement; if (row) { event.preventDefault(); G.touch.open(row.dataset.uuid, event.shiftKey); } return; }
        if (event.key === 'Backspace' && !field.value && box.picks.length) { event.preventDefault(); box.picks.pop(); box.more.clear(); again(); return; }
        if (event.key === 'Escape') {
          event.preventDefault(); event.stopPropagation();
          if (field.value) { field.value = ''; box.text = ''; again(); } else if (box.picks.length) { box.picks = []; box.more.clear(); again(); } else field.blur();
        }
      };
      // The choices: a press takes one; Left and Right walk a line, Up and Down go between lines; Escape goes back to the words.
      const onChoice = event => {
        const choice = event.target.closest('.lk-choice'), more = event.target.closest('.lk-choice-more');
        if (event.type === 'click') {
          if (choice) { if (event.target.closest('.lk-choice-fold') && fold(choice)) return; choice.lkTake(); return; }
          if (more) { if (box.more.has(more.lkMore)) box.more.delete(more.lkMore); else box.more.add(more.lkMore); again(); }
          return;
        }
        if (!choice) return;
        if ((event.metaKey || event.ctrlKey) && (event.key === 'ArrowUp' || event.key === 'ArrowDown') && fold(choice, event.key === 'ArrowUp')) { event.preventDefault(); event.stopPropagation(); return; }   // Logseq's own keys for folding
        const all = [...choicesEl.querySelectorAll('.lk-choice')].filter(one => !one.hidden), at = all.indexOf(choice), lines = [...choicesEl.querySelectorAll('.lk-choice-line')], line = choice.closest('.lk-choice-line'), li = lines.indexOf(line);
        let to = null;
        if (event.key === 'ArrowRight') to = all[at + 1];
        else if (event.key === 'ArrowLeft') to = all[at - 1];
        else if (event.key === 'ArrowDown') to = lines[li + 1]?.querySelector('.lk-choice') || (rel.querySelector('.lk-row > .lk-line'));
        else if (event.key === 'ArrowUp') to = lines[li - 1]?.querySelector('.lk-choice') || field;
        else if (event.key === 'Escape' || (event.key === 'Tab' && event.shiftKey)) to = field;
        else if (event.key === 'Tab') { event.preventDefault(); choice.lkTake(); return; }
        if (to) { event.preventDefault(); event.stopPropagation(); to.focus(); }
      };
      const onPiece = event => { const piece = event.target.closest('.lk-search-piece'); if (!piece) return; box.picks.splice(Number(piece.dataset.i), 1); box.more.clear(); again(); field.focus(); };
      field.addEventListener('input', onInput); field.addEventListener('keydown', onKey);
      choicesEl.addEventListener('click', onChoice); choicesEl.addEventListener('keydown', onChoice);
      piecesEl.addEventListener('click', onPiece);
      drawPieces();
      return () => {
        boxes.delete(box); win.clearTimeout(box.timer);
        field.removeEventListener('input', onInput); field.removeEventListener('keydown', onKey);
        choicesEl.removeEventListener('click', onChoice); choicesEl.removeEventListener('keydown', onChoice);
        piecesEl.removeEventListener('click', onPiece);
        rel.removeEventListener('lk-drawn', mark); list.off();
      };
    };
    const section = G.touch.section('lk-search', 'Search', draw, LOOK);
    base.onStop(section.off);
    // Opened with its line ready for words: from the key, the command, the corner, or another place with a kind already taken.
    const focus = async (how = {}) => {
      section.open();
      for (let tries = 0; tries < 20; tries++) {
        const box = [...boxes].find(one => one.holder.isConnected && one.field.offsetParent);   // on screen: a line not yet shown takes no keys (the sidebar giving up a page shown beside)
        if (box) { if (how.tag) box.take(how.tag); box.field.focus(); box.field.select(); return; }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    };
    G.touch.command('lk-search', 'Search', () => focus());
    G.arrive = { ...(G.arrive || {}), search: async id => focus({ tag: (await G.read.tags()).get(id) || null }) };
    base.onStop(() => { G.arrive = { ...(G.arrive || {}), search() {} }; });
    base.onStop(G.touch.key('mod+k', () => { if (G.setting('searchTakesSearchKey') === false) return false; focus(); }));
    base.onStop(G.touch.changed(() => { kept.clear(); for (const box of boxes) if (box.holder.isConnected) box.again(); }));
  },
});
})();
