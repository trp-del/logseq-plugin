/* A document made by hand, with one of everything a DB graph can hold, for the core tests and the preview page.
   Loaded after the core files (window.DbExport.doc); exports DbExport.sample(). */
(function () {
const E = (window.DbExport ||= {});
const { node: N } = E.doc;
const prop = (ident, name, type, ...values) => ({ ident: `user.property/${ident}`, name, type, values });
const page = text => ({ text });
const day = (text, day) => ({ text, day });

E.sample = () => E.doc.document({
  title: 'Dr. Mei Chen', kind: 'page', journalDay: null, tags: ['Doctor'],
  properties: [prop('specialty', 'Specialty', 'node', page('Oncology')), prop('works-at', 'Works at', 'node', page('Northgate Cancer Center')), prop('phone', 'Phone', 'default', { text: '020 7946 0880' })],
  nodes: [
    N({ uuid: 'u1', text: 'Consultant medical oncologist. Explains things with **drawings**. Secretary Paula, 020 7946 0880.' }),
    N({ uuid: 'u2', text: 'Appointments', children: [
      N({ uuid: 'u21', text: 'Spoke with [[Dr. Mei Chen]] about fatigue #[[Consultation]]', tags: ['Consultation'], journalDay: 20261020,
        properties: [prop('provider', 'Provider', 'node', page('Dr. Mei Chen')), prop('date', 'Date', 'date', day('Oct 29th, 2026', 20261029)), prop('topic', 'Topic', 'node', page('Fatigue'))],
        children: [N({ uuid: 'u211', text: 'She suggested *shorter walks* and a blood test, see https://example.org/bloods.' }), N({ uuid: 'u212', text: 'Ask about the ==iron== levels next time' })] }),
      N({ uuid: 'u22', text: 'Chest X-ray results #[[Consultation]]', tags: ['Consultation'], journalDay: 20261023,
        properties: [prop('provider', 'Provider', 'node', page('Dr. Mei Chen')), prop('date', 'Date', 'date', day('Oct 23rd, 2026', 20261023)), prop('severity', 'Severity', 'number', { text: '4' })] }),
      N({ uuid: 'u23', text: 'Stay at [[Northgate Cancer Center]] #[[Hospitalization]]', tags: ['Hospitalization'],
        properties: [prop('date', 'Date', 'date', day('Sep 9th, 2026', 20260909)), prop('end', 'End', 'date', day('Sep 12th, 2026', 20260912)), prop('hospital', 'Hospital', 'node', page('Northgate Cancer Center'))] }),
    ] }),
    N({ uuid: 'u3', text: 'Things to do', children: [
      N({ uuid: 'u31', text: 'Sort out power of attorney with Ruth', task: { status: 'todo', priority: 'high', deadline: new Date(2026, 6, 31).getTime(), scheduled: null }, tags: ['Task'] }),
      N({ uuid: 'u32', text: 'Pack the hospital bag', task: { status: 'done', priority: '', deadline: null, scheduled: 20260908 }, tags: ['Task'] }),
      N({ uuid: 'u33', text: 'Ring the pharmacy', task: { status: 'canceled', priority: '', deadline: null, scheduled: null }, tags: ['Task'] }),
    ] }),
    N({ uuid: 'u4', text: 'Steps for the morning', numbered: true, children: [N({ uuid: 'u41', text: 'Tablets with water' }), N({ uuid: 'u42', text: 'Breakfast, then a walk', children: [N({ uuid: 'u421', text: 'Twenty minutes is enough' })] })] }),
    N({ uuid: 'u5', text: 'const dose = (weight) => weight * 85; // mg/m²\nconsole.log(dose(70));', display: 'code', lang: 'js' }),
    N({ uuid: 'u6', text: 'Hope is not a plan, but it is a good companion.', display: 'quote' }),
    N({ uuid: 'u7', text: 'Papers on cholangiocarcinoma from the oncology team', children: [
      N({ uuid: 'u71', kind: 'file', text: 'Intrahepatic cholangiocarcinoma hidden within cancer of unknown primary', file: { file: 'assets/6adbf698-ab17-44a4-ade4-78804115a46f.pdf', name: 'Intrahepatic cholangiocarcinoma hidden within cancer of unknown primary', type: 'pdf' }, children: [
        N({ uuid: 'u711', kind: 'highlight', text: 'In this study, 34% of patients with liver-involved pCUP, fulﬁlled the radiological criteria for an iCCA diagnosis', highlight: { page: 1, pdf: 'Intrahepatic cholangiocarcinoma hidden within cancer of unknown primary', area: null } }),
        N({ uuid: 'u712', kind: 'highlight', text: 'Oct 23, 2026', highlight: { page: 1, pdf: 'Intrahepatic cholangiocarcinoma hidden within cancer of unknown primary', area: { file: 'assets/6adbf876-d939-4be9-89cc-92032d55b1c5.png' } } }),
      ] }),
    ] }),
    N({ uuid: 'u8', text: 'The scan', children: [N({ uuid: 'u81', kind: 'image', image: { file: 'assets/6adbf876-d939-4be9-89cc-92032d55b1c5.png', name: 'pdf area highlight', width: 300 } })] }),
    N({ uuid: 'u9', text: 'Open to-dos', kind: 'query', query: { text: '(task todo)', columns: ['Name', 'Tags', 'Deadline'], rows: [
      N({ uuid: 'q1', text: 'Book the patient transport', tags: ['Task'], task: { status: 'todo', priority: 'medium', deadline: new Date(2026, 10, 5).getTime(), scheduled: null }, properties: [prop('deadline', 'Deadline', 'date', day('Nov 5th, 2026', 20261105))] }),
      N({ uuid: 'q2', text: 'Ask about the second opinion', tags: ['Task'], task: { status: 'doing', priority: '', deadline: null, scheduled: null } }),
    ] } }),
    N({ uuid: 'u10', kind: 'embed', children: [N({ uuid: 'e1', text: 'Northgate Cancer Center, ward 4B, visiting 2–8 pm' })] }),
    N({ uuid: 'u11', kind: 'value', text: '4' }),
    N({ uuid: 'u12', text: '' }),
    N({ uuid: 'u13', text: 'Formula', children: [N({ uuid: 'u131', text: 'E = mc^2', display: 'math' })] }),
  ],
  tagged: [],
});
})();
