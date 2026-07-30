/**
 * DOES A LATCHED PROP EVER ANSWER A TAP AGAIN?
 *
 * The `clocks` pre-condition reproduced the full scan's `emits: none` on both toy cars,
 * which the `rows` and `missburst` pre-conditions had not. The difference between them
 * is elapsed gsap time, and the reason is in the source: both cars end their builder
 * with `gsap.delayedCall(15, () => { if (!driving) driveHandler(); })`. The scan spends
 * ~63 s of gsap time per row, so by the time it reaches the cars they have driven
 * themselves, set `driving`, and every later fire returns at the latch.
 *
 * That is an instrument artefact — but reading the source to explain it turned up a
 * product defect underneath it. Five room handlers latch; `webSlinger.ts:132` and
 * `deskLamp.ts:134` both assign their flag back to `false`, and NEITHER TOY CAR EVER
 * DOES. `driving` has exactly two assignments in each file: the declaration and the
 * `= true`.
 *
 * A grep is not an observation, so this asks the running page instead, on a fresh load
 * per prop so no prop can be answering for another:
 *
 *   A. `fresh`  - fire immediately. Establishes the prop answers at all.
 *   B. `auto`   - advance 16 s of gsap WITHOUT tapping, then fire. This is the child
 *                 who watched the car drive itself and then reached out for it.
 *   C. `retap`  - fire, advance 60 s, fire again. This is the child who tapped once and
 *                 came back. 60 s is far longer than any animation in these handlers.
 *
 * A prop that answers in A and is silent in B or C is a dead tap, and a dead tap is a
 * broken promise (soul.md §6). The web slinger and the desk lamp are included as the
 * controls: their latches release, so they must recover in C where the cars do not. A
 * probe that only tested the accused would be unable to tell a real defect from a
 * defect in the way this probe fires props.
 */

import { chromium } from 'playwright';

const PROPS = [
  { index: 8, name: 'shelfCar', latch: 'driving (never reset)' },
  { index: 11, name: 'toyCarBody', latch: 'driving (never reset)' },
  { index: 14, name: 'webSlinger', latch: 'hopping (reset at :132)' },
  { index: 4, name: 'lampBase', latch: 'shining (reset at :134)' },
  { index: 15, name: 'musicPlayer', latch: 'none found' },
];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

const warned = [];
const rows = [];

for (const prop of PROPS) {
  for (const phase of ['fresh', 'auto', 'retap']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => console.error(`  [pageerror] ${e.message}`));
    // `getParticleEngine` returns a NOOP engine and WARNS for an unregistered scene.
    // That warning is the difference between "the handler declined to run" and "the
    // handler ran and asked an engine the probe is not watching", and the earlier car
    // probe was not listening for it — so a silent row could not distinguish the two.
    page.on('console', (m) => {
      if (m.type() === 'warning' && m.text().includes('[particles]')) warned.push(`${prop.name}/${phase}: ${m.text()}`);
    });
    await page.goto('http://localhost:5199/.probe/render/room.html?room=playroom', { waitUntil: 'load' });
    await page.waitForFunction('window.__shotReady === true', null, { timeout: 60000 });

    const r = await page.evaluate(
      ({ index, phase: how }) => {
        window.__gsapSleep();
        const fire = () => {
          try {
            return window.__firePropMuted(index).map((e) => e.preset);
          } catch (e) {
            return [`THREW:${e && e.message ? e.message : e}`];
          }
        };
        // Time is advanced in 0.25 s steps rather than one jump, because a
        // `delayedCall` and a timeline both have to be STEPPED to fire their
        // callbacks; a single large advance is not the same experiment as the same
        // amount of time passing, and the distinction decides whether the autoplay
        // this probe is about actually runs.
        const advance = (seconds) => {
          for (let t = 0; t < seconds; t += 0.25) window.__gsapAdvance(0.25);
        };
        if (how === 'fresh') return { first: fire(), second: null };
        if (how === 'auto') {
          advance(16);
          return { first: fire(), second: null };
        }
        const first = fire();
        advance(60);
        return { first, second: fire() };
      },
      { index: prop.index, phase },
    );

    rows.push({ prop: prop.name, latch: prop.latch, phase, ...r });
    await page.close();
  }
}

const sig = (list) => (list === null ? '' : list.join(',') || '(none)');
console.log(`\nprop                 latch                     phase     first fire            second fire`);
for (const r of rows) {
  console.log(`  ${r.prop.padEnd(18)} ${r.latch.padEnd(25)} ${r.phase.padEnd(9)} ${sig(r.first).padEnd(21)} ${sig(r.second)}`);
}

// The verdict, stated as the defect rather than as a table to be read. A prop that
// answered on `fresh` and is silent afterwards has stopped accepting taps for the rest
// of the visit.
const by = (name, phase) => rows.find((r) => r.prop === name && r.phase === phase);
console.log('');
for (const prop of PROPS) {
  const fresh = by(prop.name, 'fresh');
  const auto = by(prop.name, 'auto');
  const retap = by(prop.name, 'retap');
  if (fresh.first.length === 0) {
    console.log(`  ${prop.name}: silent even on a fresh page — not a latch question, a wiring question`);
    continue;
  }
  const deadAuto = auto.first.length === 0;
  const deadRetap = retap.second !== null && retap.second.length === 0;
  console.log(
    `  ${prop.name.padEnd(14)} answers fresh; after 16 s untouched: ${deadAuto ? 'DEAD' : 'answers'}; 60 s after one tap: ${deadRetap ? 'DEAD' : 'answers'}`,
  );
}
console.log(
  `\n[particles] warnings seen: ${warned.length ? warned.join(' | ') : 'none — every silent row is a handler that declined, not a mis-aimed engine'}`,
);

await browser.close();
