/* The owner, 24 November 2026, of Ontology's lines above Logseq's table on a property's page (Property type with "Merge into…", Node
   tags with "Specify node tags…", On tags with "Move from … to another tag…", "Split … by value…", "Remove from …", and "Put on a
   tag…"), sent as a picture: "the things that appear on a property page are also either unnecessary or getting ahead of itself";
   then yes to the drawing with nothing of the plugin's above the table. Open a property's page with the right sidebar shut: no
   line of Ontology's stands on the page, and Logseq's own table does. */
module.exports = {
  parts: ['structure'],
  name: 'A property\'s page: nothing of Ontology\'s above Logseq\'s table',
  from: '24 Nov: "either unnecessary or getting ahead of itself"',
  graph: 'Personal Finance',
  async check(box, T) {
    const { page } = box;
    await T.go(page, 'Charged by'); await T.still(page); await T.sleep(2500);
    const seen = await page.evaluate(() => { const main = document.querySelector('#main-content-container'); const lines = main.querySelector('.st-tagholder .st-lines-t, .st-tagholder .st'); return { title: main.querySelector('.ls-page-title')?.innerText.trim() || '', lines: lines ? lines.innerText.replace(/\s+/g, ' ').slice(0, 70) : '', table: !!main.querySelector('.ls-table-rows, .ls-table-row, .page-tabs'), side: !!document.querySelector('#right-sidebar .sidebar-item') }; });
    if (!/Charged by/.test(seen.title)) return { ok: false, said: `the page shown is “${seen.title}”, not Charged by` };
    if (seen.side) return { ok: false, said: 'the right sidebar is open, so the case cannot tell the page from the Ontology section' };
    if (seen.lines) return { ok: false, said: `Ontology's lines stand above the table (“${seen.lines}”)` };
    if (!seen.table) return { ok: false, said: 'Logseq\'s own table is not on the property\'s page' };
    return { ok: true, said: 'only Logseq\'s own table on Charged by\'s page' };
  },
};
