/* node tools/app/check.js   (see door.js for what it needs)
   Drives the plugin in the real Logseq with real keystrokes, against the Seed Check test graph (a Consultation tag with Provider,
   Topic and Date; doctors named Dr. Mei Chen and Dr. Raj Patel). Each check says what it proves. The scratch page "flow test" is
   emptied at the end. */
const assert = require('node:assert/strict');
const { connect, reload, scratch, cleanup, held, ghosts, sleep } = require('./door.js');

let passed = 0, failed = 0;
const check = async (name, fn) => { try { await fn(); passed++; console.log('  ok  ' + name); } catch (error) { failed++; console.log('FAIL  ' + name + '\n      ' + String(error.message).split('\n').join('\n      ')); } };

(async () => {
  const c = await connect();
  const type = (text, delay = 15) => c.page.keyboard.type(text, { delay });
  const press = async (key, wait = 800) => { await c.page.keyboard.press(key); await sleep(wait); };
  const active = () => c.page.evaluate(() => { const a = document.activeElement; return { tag: a.tagName, placeholder: a.placeholder || '', inSelect: !!a.closest('.cp__select') }; });
  try {
    await reload(c);

    await check('an untagged bullet that reads like earlier consultations is offered the tag, with its properties; Enter writes the tag and the properties', async () => {
      // First, straight after a fresh reading: lines typed untagged are remembered as plain notes, which vote "no tag".
      const uuid = await scratch(c, null);
      await type('Video call with Dr. Mei Chen about the tingling'); await sleep(1000);
      const shown = await c.page.evaluate(u => [...document.querySelectorAll(`.ls-block[blockid="${u}"] .flow-ghost`)].map(g => (g.closest('.bottom-property-pill')?.firstElementChild?.textContent || (g.closest('.ls-block-right') ? 'right end of the line' : '?')).replace(/:$/, '') + '=' + g.textContent), uuid);
      assert.ok(shown.includes('right end of the line=#Consultation'), 'the tag is not proposed where Logseq draws tags: ' + JSON.stringify(shown));
      assert.ok(!shown.some(s => /^Tags=/.test(s)), 'the tag is also in a pill of its own: ' + JSON.stringify(shown));
      assert.ok(shown.some(s => s.startsWith('Provider=')), 'the tag\'s properties are not offered with it: ' + JSON.stringify(shown));
      await press('Enter', 3500);
      const now = await held(c, uuid);
      assert.deepEqual(now.tags, ['Consultation']); assert.deepEqual(now.Provider, ['Dr. Mei Chen']);
    });

    await check('a click away does not give an untagged bullet a tag', async () => {
      const uuid = await scratch(c, null);
      await type('Video call with Dr. Raj Patel about the scan results'); await sleep(1000);
      await c.page.mouse.click(1100, 800); await sleep(2500);
      assert.deepEqual((await held(c, uuid)).tags, []);
    });

    const listed = () => c.page.evaluate(() => { const l = document.querySelector('.flow-pick'); return l ? [...l.querySelectorAll('.flow-pick-tag')].map(x => x.textContent) : null; });
    await check('Option-T on an untagged line lists the tags the named page allows, best first; Enter picks, the bullet is tagged and its properties are proposed', async () => {
      const uuid = await scratch(c, null);
      await type('Saw Dr. Mei Chen about the pins and needles in my fingers'); await sleep(900);
      await press('Alt+t', 900);
      const tags = await listed();
      assert.ok(tags, 'no list'); assert.equal(tags[0], '#Consultation'); assert.ok(tags.includes('#Conversation'), JSON.stringify(tags));
      assert.equal(await c.page.evaluate(() => document.activeElement.value), 'Saw Dr. Mei Chen about the pins and needles in my fingers', 'the words changed');
      await press('Enter', 1800);
      assert.equal(await listed(), null, 'the list stayed open');
      assert.deepEqual((await held(c, uuid)).tags, ['Consultation']);
      assert.ok((await ghosts(c, uuid)).some(g => /^provider=/.test(g)), 'the properties are not proposed after the pick: ' + JSON.stringify(await ghosts(c, uuid)));
      assert.ok(await c.page.evaluate(u => !!document.querySelector(`.ls-block[blockid="${u}"] .flow-undo`), uuid), 'no undo arrow');
    });
    await check('a number picks the second tag, and a click on a row picks it too', async () => {
      let uuid = await scratch(c, null);
      await type('Spoke to Dr. Raj Patel about the scar and the follow-up'); await sleep(900);
      await press('Alt+t', 800);
      const tags = await listed(); assert.ok(tags && tags.length >= 2, JSON.stringify(tags));
      await press('2', 1800);
      assert.deepEqual((await held(c, uuid)).tags, [tags[1].slice(1)]);
      uuid = await scratch(c, null);
      await type('Chat with Dr. Helen Brooks about the flu jab'); await sleep(900);
      await press('Alt+t', 800);
      const second = await listed(); assert.ok(second && second.length >= 2, JSON.stringify(second));
      await c.page.click('.flow-pick-row:nth-child(2)'); await sleep(1800);
      assert.deepEqual((await held(c, uuid)).tags, [second[1].slice(1)]);
    });
    await check('Escape closes the list and writes nothing; typing on closes it and the words continue', async () => {
      let uuid = await scratch(c, null);
      await type('Saw Dr. Mei Chen about the pins and needles in my fingers'); await sleep(900);
      await press('Alt+t', 800); assert.ok(await listed());
      await press('Escape', 600); assert.equal(await listed(), null);
      assert.deepEqual((await held(c, uuid)).tags, []);
      assert.equal((await active()).tag, 'TEXTAREA', 'Escape left the bullet');
      await press('Alt+t', 800); assert.ok(await listed());
      await c.page.keyboard.type(' again', { delay: 20 }); await sleep(300);
      assert.equal(await listed(), null); assert.match(await c.page.evaluate(() => document.activeElement.value), /fingers again$/);
      assert.deepEqual((await held(c, uuid)).tags, []);
    });
    await check('a tagged bullet is offered no list; a line with no word the graph knows gets none', async () => {
      await scratch(c, 'Consultation');
      await type('Saw Dr. Mei Chen about the pins'); await sleep(600); await press('Alt+t', 800);
      assert.equal(await listed(), null, 'a list for a bullet that has a tag');
      await scratch(c, null);
      await type('Quokka zephyr flibbertigibbet marmoset'); await sleep(600); await press('Alt+t', 800);
      assert.equal(await listed(), null, 'a list for a line that shares no word with anything');
    });

    await check('proposals are drawn inside Logseq\'s own property pills, not in a line of their own', async () => {
      const uuid = await scratch(c, 'Consultation');
      await type('Saw Dr. Mei Chen about the tingling');
      await sleep(900);
      const where = await c.page.evaluate(u => [...document.querySelectorAll(`.ls-block[blockid="${u}"] .flow-ghost`)].map(g => g.closest('.bottom-property-pill')?.firstElementChild?.textContent.replace(/:$/, '')), uuid);
      assert.ok(where.includes('Provider'), `no Provider ghost in a pill: ${JSON.stringify(where)}`);
      assert.equal(await c.page.evaluate(() => document.querySelector('.flow-strip')), null);
    });

    await check('leaving by a click writes only what is sure; Enter writes the guesses too', async () => {
      // A line with a sure Provider (a doctor linked) and a guessed Topic: which phrasing gets a guess depends on the graph's history, so a few are tried.
      const candidates = ['Saw [[Dr. Raj Patel]] about the bleeding again, blood in my stool', 'Saw [[Dr. Mei Chen]] about the tingling in my fingers again', 'Saw [[Dr. Helen Brooks]] about being tired all the time'];
      let text = null;
      for (const candidate of candidates) {
        const uuid = await scratch(c, 'Consultation');
        await type(candidate); await sleep(900);
        const shown = await ghosts(c, uuid);
        if (shown.some(s => /^provider=.*\(sure\)/.test(s)) && shown.some(s => /^topic=.*\(guess\)/.test(s))) { text = candidate; break; }
      }
      if (!text) { console.log('      (skipped: none of the lines tried gets a guessed Topic in this graph)'); return; }
      let uuid = await scratch(c, 'Consultation');
      await type(text); await sleep(900);
      await c.page.mouse.click(1100, 800); await sleep(2500);
      let now = await held(c, uuid);
      assert.ok(now.Provider?.length, 'the sure Provider was not written'); assert.equal(now.Topic, undefined, 'a guess was written by a click');
      uuid = await scratch(c, 'Consultation');
      await type(text); await sleep(900); await press('Enter', 2500);
      now = await held(c, uuid);
      assert.ok(now.Provider?.length); assert.ok(now.Topic?.length, 'Enter did not write the guess');
    });

    await check('the faded arrow takes back what was filled in', async () => {
      const uuid = await scratch(c, 'Consultation');
      await type('Video call with Dr. Mei Chen about the tingling'); await sleep(900); await press('Enter', 2500);
      assert.ok((await held(c, uuid)).Provider, 'nothing was filled in');
      await c.page.click(`.ls-block[blockid="${uuid}"] .flow-undo`); await sleep(1500);
      assert.equal((await held(c, uuid)).Provider, undefined);
    });

    await check('Escape hides the proposals and nothing is written', async () => {
      const uuid = await scratch(c, 'Consultation');
      await type('Saw [[Dr. Raj Patel]] about the bleeding'); await sleep(900);
      await press('Escape', 600);
      assert.deepEqual(await ghosts(c, uuid), []);
      await c.page.mouse.click(1100, 800); await sleep(2000);
      assert.equal((await held(c, uuid)).Provider, undefined);
    });

    await check('Option-Enter opens the first guessed property\'s list with the guess typed in; Enter moves on; Escape comes back', async () => {
      await scratch(c, 'Consultation');
      await type('Video call with Dr. Mei Chen about the tingling'); await sleep(900);
      await press('Alt+Enter', 900);
      let a = await active();
      assert.ok(a.inSelect && /Provider/.test(a.placeholder), JSON.stringify(a));
      assert.equal(await c.page.evaluate(() => document.activeElement.value), 'Dr. Mei Chen');
      await press('Enter', 1200);
      a = await active(); assert.ok(a.inSelect && /Topic/.test(a.placeholder), JSON.stringify(a));
      await press('Escape', 900);
      assert.equal((await active()).tag, 'TEXTAREA');
    });

    await check('Tab skips; a date stop takes words ("next fri") and Enter finishes the bullet with a new one in edit', async () => {
      const uuid = await scratch(c, 'Consultation');
      await type('Video call with Dr. Mei Chen about the tingling'); await sleep(900);
      await press('Alt+Enter', 900); await press('Tab', 900); await press('Tab', 1800);
      const a = await active(); assert.ok(/e\.g\./.test(a.placeholder), 'the date picker\'s text box has no keyboard: ' + JSON.stringify(a));
      await c.page.keyboard.type('next fri', { delay: 30 }); await sleep(300); await press('Enter', 3000);
      const now = await held(c, uuid);
      assert.ok(now.Date?.[0] > 20260101, 'no date: ' + JSON.stringify(now));
      assert.notEqual(now.Date[0], new Date().getFullYear() * 10000 + (new Date().getMonth() + 1) * 100 + new Date().getDate(), 'the date is today: the words went to the calendar');
      assert.equal((await active()).tag, 'TEXTAREA', 'no new bullet in edit');
      assert.equal((await c.frame().evaluate(async () => (await logseq.Editor.getPageBlocksTree('flow test')).length)), 2);
    });

    const suggest = async how => {
      await scratch(c, null);
      await type('Spoke with Dr. Mei', 25); await sleep(900);
      const grey = await c.page.evaluate(() => document.querySelector('.flow-link-suggest .flow-grey')?.textContent);
      assert.equal(grey, ' Chen', 'no grey words');
      await how();
      await sleep(700);
      return c.page.evaluate(() => document.activeElement.value);
    };
    const hyper = async (down, mid) => { for (const k of ['Meta', 'Control', 'Alt', 'Shift']) await c.page.keyboard.down(k); if (mid) await mid(); await sleep(60); for (const k of ['Shift', 'Alt', 'Control', 'Meta']) await c.page.keyboard.up(k); };
    await check('Right arrow takes the suggested link', async () => assert.equal(await suggest(() => c.page.keyboard.press('ArrowRight')), 'Spoke with [[Dr. Mei Chen]]'));
    await check('a tap of the Hyper key takes it', async () => assert.equal(await suggest(() => hyper()), 'Spoke with [[Dr. Mei Chen]]'));
    await check('Hyper held with another key does not', async () => assert.equal(await suggest(() => hyper(null, () => c.page.keyboard.press('KeyZ'))), 'Spoke with Dr. Mei'));

    await check('empty properties are hidden on a bullet that is not being written, and shown (faint) on the one that is', async () => {
      const uuid = await scratch(c, 'Consultation');
      await type('Coffee'); await sleep(600);
      const editing = await c.page.evaluate(u => [...document.querySelectorAll(`.ls-block[blockid="${u}"] .bottom-property-pill`)].map(p => getComputedStyle(p).display), uuid);
      assert.ok(editing.every(d => d !== 'none'), 'hidden while writing: ' + editing);
      await c.page.mouse.click(1100, 800); await sleep(1500);
      const left = await c.page.evaluate(u => [...document.querySelectorAll(`.ls-block[blockid="${u}"] .bottom-property-pill`)].map(p => getComputedStyle(p).display), uuid);
      assert.ok(left.every(d => d === 'none'), 'not hidden after leaving: ' + left);
    });
  } finally {
    await cleanup(c);
    await c.close();
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(error => { console.error('ERR', error.message); process.exit(1); });
