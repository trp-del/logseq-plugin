/* The owner, 24 November 2026, of the note after a folded bullet, made two days before to fit the place it stands in (the due day
   moved to the front, the bullet's own properties, the line Find's words were found in, a tag left out when the page already says
   it): "the folded feature does not seem to know what to show. i think it is better if we don't try to get creative and return to
   the more conservative approach … return to original version of it showing todos, etc". On Dr. Mei Chen's page the folded
   Consultation of Oct 7 read "↳ Peripheral neuropathy" (its Topic) and said nothing of what is under it. The note holds only the
   lead, counts with their icons, tags and a due day at its end, and the Consultation of Aug 20 still counts its two tasks. */
module.exports = {
  parts: ['look', 'threads'],
  name: 'A folded row’s note is plain: the tasks under it, files, tags and a due day, never the row’s own properties',
  from: '24 Nov: “the folded feature does not seem to know what to show … return to original version of it showing todos, etc”',
  graph: 'Illness Test Graph',
  async check(box, T) {
    await T.go(box.page, 'Dr. Mei Chen'); await T.still(box.page); await T.sleep(2500);
    const said = await box.page.evaluate(() => {
      const notes = [...document.querySelectorAll('.lk-folded')].filter(n => n.offsetParent);
      if (!notes.length) return 'no folded row on the page has a note';
      for (const note of notes) {
        const kids = [...note.children];
        const odd = kids.find((k, i) => !(k.matches('.lk-lead, .lk-pair, .lk-sep, a.lk-tag') || (i === kids.length - 1 && /^(due|was due) /.test(k.textContent))));
        if (odd) return `a note holds something other than counts, tags and a last due day: “${odd.textContent}”`;
      }
      if (!notes.some(n => /\d/.test(n.querySelector('.lk-pair')?.textContent || ''))) return 'no note counts the tasks under its row';
      return '';
    });
    return said ? { ok: false, said } : { ok: true, said: 'every note is counts, tags and a due day' };
  },
};
