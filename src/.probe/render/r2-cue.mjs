/**
 * WHAT DOES THE CHILD HEAR? — THE OBSERVATION ROUND 2 NEVER MADE.
 *
 * Round 2's charge was that three Playroom props answered a tap with
 * `sfx_shared_tap_fallback`, the cue `acknowledgeMiss` plays for a tap that hit
 * nothing. That charge was read out of source and repaired in source, and the
 * instrument that graded the repair — `__firePropMuted` — calls the registry handler
 * directly and therefore CANNOT SEE THAT CUE AT ALL. The fallback is not in any prop's
 * source; `interactionController.ts:147` plays it on the prop's behalf when the
 * handler asks for no sound. So the repair was confirmed by an instrument blind to the
 * thing repaired.
 *
 * This taps through the canvas instead, and records every cue.
 *
 * THE FIRST TWO ROWS ARE THE INSTRUMENT'S OWN TEST, not results. A probe about to
 * report "no fallback cue was heard" must first demonstrate it can hear one, or its
 * silence means nothing: `miss` taps empty sky, which MUST produce
 * `sfx_shared_tap_fallback`, and `silent-prop` is any prop known to make no sound of
 * its own. If `miss` comes back without the fallback, every other row in this table is
 * uninterpretable and the run is void.
 *
 * The rows that matter are the two cars, tapped TWICE. Before the fix the second tap
 * fell out of `driveHandler` at `if (driving) return;` and the controller supplied the
 * miss's cue; after it, the second tap must carry a cue of its own and a burst.
 */

import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error(`  [pageerror] ${e.message}`));
await page.goto('http://localhost:5199/.probe/render/room.html?room=playroom', { waitUntil: 'load' });
await page.waitForFunction('window.__shotReady === true', null, { timeout: 60000 });

const out = await page.evaluate(() => {
  window.__gsapSleep();
  const targets = window.__propTargets();
  const at = (name) => targets.find((t) => t.name === name);
  const rows = [];
  const tap = (label, ndcX, ndcY) => {
    const r = window.__tapThroughCanvas(ndcX, ndcY);
    rows.push({ label, sounds: r.sounds, emits: r.emits });
    return r;
  };

  // ── instrument self-test ──
  // Empty sky, well above every prop. This is a genuine miss and MUST be answered by
  // the fallback cue; if it is not, this probe cannot detect the defect it is here to
  // rule out and nothing below is evidence.
  tap('SELFTEST miss (empty sky)', 0, 0.92);

  // ── the two cars, tapped twice each ──
  for (const name of ['shelfCar', 'toyCarBody']) {
    const t = at(name);
    if (!t) {
      rows.push({ label: `${name} NOT FOUND`, sounds: [], emits: [] });
      continue;
    }
    tap(`${name} tap 1`, t.ndcX, t.ndcY);
    tap(`${name} tap 2`, t.ndcX, t.ndcY);
    // A third tap, after time has passed and the car has travelled, is the case a
    // child actually produces: they tap, they watch, they tap again later. The car has
    // MOVED by then, so this deliberately taps the car's ORIGINAL screen position —
    // which is now empty floor — and then its current one, so a row that reads as a
    // miss is visibly a miss of the probe's aim rather than of the child's finger.
    for (let s = 0; s < 40; s += 1) window.__gsapAdvance(0.25);
    const moved = window.__propTargets().find((x) => x.name === name);
    tap(`${name} tap 3 (old spot, 10 s later)`, t.ndcX, t.ndcY);
    if (moved) tap(`${name} tap 3 (where it is now)`, moved.ndcX, moved.ndcY);
  }

  // ── controls: props whose latches release, and one with no latch ──
  for (const name of ['webSlinger', 'musicPlayer']) {
    const t = at(name);
    if (!t) continue;
    tap(`${name} tap 1`, t.ndcX, t.ndcY);
    tap(`${name} tap 2`, t.ndcX, t.ndcY);
  }
  return rows;
});

console.log(`\n${'tap'.padEnd(38)} ${'cues heard'.padEnd(46)} bursts`);
for (const r of out) {
  console.log(`  ${r.label.padEnd(36)} ${(r.sounds.join(', ') || '(SILENT)').padEnd(46)} ${r.emits.join(',') || '(none)'}`);
}

const selftest = out[0];
const heardFallback = selftest.sounds.includes('sfx_shared_tap_fallback');
console.log(`\nINSTRUMENT SELF-TEST: a miss ${heardFallback ? 'DID' : 'DID NOT'} produce sfx_shared_tap_fallback`);
if (!heardFallback) {
  console.log('  => this probe cannot detect the cue it exists to rule out. Every row above is void.');
} else {
  const guilty = out
    .filter((r) => r.label.startsWith('shelfCar') || r.label.startsWith('toyCarBody'))
    .filter((r) => r.sounds.includes('sfx_shared_tap_fallback'));
  const silent = out.filter((r) => !r.label.startsWith('SELFTEST') && r.sounds.length === 0);
  console.log(`  => car taps answered with the MISS'S cue: ${guilty.length ? guilty.map((r) => r.label).join(', ') : 'none'}`);
  console.log(`  => taps that made no sound at all:        ${silent.length ? silent.map((r) => r.label).join(', ') : 'none'}`);
}

await page.close();
await browser.close();
