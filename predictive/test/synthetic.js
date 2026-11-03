/* Pretend graphs for the tests, written to look NOTHING like each other, because the plugin must not care:
   - "work": English, meetings and actions, properties Owner / Assignee / Project / When / Due (no property called "date");
   - "libros": Spanish, books, properties Autor / Género / Leído el (accents, another language, another date name);
   - "empty": a graph with no tags and no properties at all.
   Deterministic (a seeded generator), so a test that passes once passes always. */
const { buildContext } = require('../core/context.js');

const seeded = seed => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
const pickOf = (rand, list) => list[Math.floor(rand() * list.length)];
const uuid = id => `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`;

// Builds the pieces every graph needs from a short description.
function build({ tags, props, people, lines, plain, dated = new Map(), journal = [], seed = 1, locale }) {
  const pages = [], byTitle = new Map();
  let nextId = 1000;
  const page = (title, extra = {}) => {
    const p = { id: nextId++, title, lower: title.toLowerCase(), tags: [], isTag: false, aliasOf: null, ...extra };
    p.uuid = uuid(p.id); pages.push(p); byTitle.set(title, p); return p;
  };
  const tagPage = {};
  for (const name of tags) { const p = page(name, { isTag: true, tags: [{ id: 1, title: 'Tag', ident: 'logseq.class/Tag' }] }); p.ident = 'user.class/' + name; tagPage[name] = p; }
  const asTag = name => ({ id: tagPage[name].id, title: name, ident: 'user.class/' + name });
  const peoplePages = {};
  for (const [kind, names] of Object.entries(people)) peoplePages[kind] = names.map(n => page(n, { tags: [asTag(kind)] }));
  const schema = { props: [], byId: new Map(), classProps: new Map(), parentsOf: new Map(), builtIn: new Set([1]) };
  let propId = 100;
  for (const p of props) {
    const prop = { id: propId++, ident: 'user.property/' + p.title.toLowerCase().replace(/\s+/g, '-'), title: p.title, lower: p.title.toLowerCase(), type: p.type, many: !!p.many,
      classes: (p.accepts || []).map(n => ({ id: tagPage[n].id, title: n, uuid: tagPage[n].uuid })), choices: [] };
    schema.props.push(prop); schema.byId.set(prop.id, prop);
    for (const owner of p.on) { const id = tagPage[owner].id; schema.classProps.set(id, [...(schema.classProps.get(id) || []), prop.id]); }
  }
  const prop = title => schema.props.find(p => p.title === title);
  const rand = seeded(seed);
  const entries = [], days = new Map();
  let day = 20260101;
  for (const spec of journal) days.set(spec.id, spec.day);
  lines({ rand, tagPage, peoplePages, prop, page: byTitle, add(entry) { entries.push({ id: nextId++, ...entry }); }, link: p => `[[${p.uuid}]]`, pick: list => pickOf(rand, list) });
  plain({ rand, add(title) { entries.push({ id: nextId++, title, tags: [], values: new Map() }); }, pick: list => pickOf(rand, list) });
  const datedByIdent = new Map();
  for (const [title, perTag] of dated) datedByIdent.set(prop(title).ident, new Map([...perTag].map(([tag, n]) => [tagPage[tag].id, n])));
  const ctx = buildContext({ schema, pages, aliases: [], userTagIds: tags.map(t => tagPage[t].id), entries, days, dated: datedByIdent, locale });
  return { ctx, schema, pages, tagPage, peoplePages, prop, page: byTitle, entries, nextId: () => nextId++, uuid };
}

function work() {
  const projects = { Atlas: ['pricing', 'invoice', 'billing', 'tariff'], Beacon: ['onboarding', 'tutorial', 'signup', 'welcome'], Cobalt: ['database', 'migration', 'schema', 'index'], Delta: ['campaign', 'newsletter', 'audience', 'segment'] };
  const g = build({
    tags: ['Meeting', 'Action', 'Person', 'Project'],
    props: [
      { title: 'Owner', type: 'node', accepts: ['Person'], on: ['Meeting'] },
      { title: 'Assignee', type: 'node', accepts: ['Person'], on: ['Action'] },
      { title: 'Project', type: 'node', accepts: ['Project'], on: ['Meeting', 'Action'] },
      { title: 'When', type: 'date', on: ['Meeting'] },
      { title: 'Due', type: 'date', on: ['Action'] },
    ],
    people: { Person: ['Ana Ruiz', 'Ben Okafor', 'Chloe Martin', 'Dev Patel', 'Elena Rossi', 'Farid Haddad'], Project: Object.keys(projects) },
    dated: new Map([['When', new Map([['Meeting', { same: 200, other: 0 }]])], ['Due', new Map([['Action', { same: 4, other: 90 }]])]]),
    lines({ rand, tagPage, peoplePages, prop, add, link, pick }) {
      const [owner, assignee, project] = [prop('Owner'), prop('Assignee'), prop('Project')];
      for (let i = 0; i < 200; i++) {
        const person = pick(peoplePages.Person), proj = pick(peoplePages.Project), kw = projects[proj.title];
        add({ title: `Sync with ${link(person)} about ${pick(kw)} and ${pick(kw)} for the roadmap`, tags: [tagPage.Meeting.id], values: new Map([[owner.ident, [person.id]], [project.ident, [proj.id]]]) });
      }
      for (let i = 0; i < 200; i++) {
        const person = pick(peoplePages.Person), proj = pick(peoplePages.Project), kw = projects[proj.title];
        add({ title: `Send the ${pick(kw)} summary to ${link(person)} before the ${pick(kw)} review`, tags: [tagPage.Action.id], values: new Map([[assignee.ident, [person.id]], [project.ident, [proj.id]]]) });
      }
    },
    plain({ add, pick }) {
      const pool = ['Remember to water the plants', 'Coffee machine is broken again', 'Parked on level three near the lift', 'Birthday card for the neighbour', 'Rain all afternoon, stayed in', 'Bread ran out before breakfast'];
      for (let i = 0; i < 150; i++) add(pick(pool) + (i % 3 ? '' : ' today'));
    },
  });
  g.projects = projects;
  return g;
}

function libros() {
  const genres = { Ficción: ['novela', 'cuento', 'trama'], Ensayo: ['ensayo', 'argumento', 'tesis'], Poesía: ['poemas', 'versos', 'poemario'] };
  const g = build({
    tags: ['Libro', 'Autor', 'Género'],
    props: [
      { title: 'Autor', type: 'node', accepts: ['Autor'], on: ['Libro'] },
      { title: 'Género', type: 'node', accepts: ['Género'], on: ['Libro'] },
      { title: 'Leído el', type: 'date', on: ['Libro'] },
    ],
    people: { Autor: ['Marta Soler', 'Iván Cobo', 'Lucía Prada'], Género: Object.keys(genres) },
    dated: new Map([['Leído el', new Map([['Libro', { same: 3, other: 40 }]])]]),
    lines({ prop, tagPage, peoplePages, add, link, pick }) {
      for (let i = 0; i < 150; i++) {
        const author = pick(peoplePages.Autor), genre = pick(peoplePages.Género), kw = genres[genre.title];
        add({ title: `Terminé ${pick(['el', 'la'])} ${pick(kw)} de ${link(author)}, muy ${pick(['lento', 'intenso', 'breve'])} y con ${pick(kw)}`, tags: [tagPage.Libro.id], values: new Map([[prop('Autor').ident, [author.id]], [prop('Género').ident, [genre.id]]]) });
      }
    },
    plain({ add, pick }) {
      const pool = ['Compré pan y leche en la esquina', 'Llovió toda la tarde', 'Llamar al dentista mañana'];
      for (let i = 0; i < 60; i++) add(pick(pool));
    },
  });
  g.genres = genres;
  return g;
}

function empty() {
  return build({ tags: [], props: [], people: {}, lines() {}, plain({ add }) { add('A plain note with no structure at all'); add('Another plain note, still nothing to learn'); } });
}

module.exports = { work, libros, empty, uuid, build };
