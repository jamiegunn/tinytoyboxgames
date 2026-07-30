/**
 * THE SECOND TAP CENSUS — EVERY PROP, EVERY ROOM.
 *
 * `r2-cue.mjs` was written to confirm the toy-car repair and instead convicted its own
 * control: `webSlinger`'s second tap, taken immediately, came back
 * `sfx_shared_tap_fallback` with no burst. That is Round 2's original charge exactly —
 * a tap that FOUND a prop answered with the cue for a tap that found nothing — in a
 * prop I had cleared minutes earlier, on the strength of a `hopping = false` at line
 * 132 and a probe that waited sixty seconds before tapping again.
 *
 * SIXTY SECONDS WAS THE WRONG WINDOW, and the mistake is worth naming because it is the
 * kind that clears a defect rather than finding one. `r2-latch.mjs` asked "does this
 * prop EVER accept another tap", and every releasing latch passes that. The question a
 * child poses is "does it accept the tap I am making NOW", and children tap again
 * immediately — that is what a toddler does when something starts moving. A latch that
 * releases in five seconds is dead for five seconds, and five seconds is the whole
 * event.
 *
 * So this stops spot-checking suspects and takes a census: every registered target in
 * every room, tapped twice back to back through the canvas, with the second tap's cue
 * and burst recorded. A prop fails if its second tap is silent, or carries
 * `sfx_shared_tap_fallback`, or emits nothing — the three shapes of "you found me and I
 * pretended you did not".
 *
 * Two targets are excluded from the verdict and reported separately rather than
 * dropped, because a silent cap is a lie of omission: doorways (a second tap during a
 * navigation is a different question, and the room is already leaving) and any target
 * whose FIRST tap already failed (that is a wiring defect, not a second-tap defect, and
 * it must not be laundered into this table).
 *
 * The instrument self-test from `r2-cue.mjs` is retained per room: a tap at empty sky
 * must produce `sfx_shared_tap_fallback`. A room whose self-test fails is reported void
 * rather than clean.
 *
 * ── 2026-07-30, AFTER THE REPAIR: THE VERDICT RULE ABOVE HAS GONE STALE, AND IT NOW
 * OVER-REPORTS. The paragraph above is left as written rather than edited, because it
 * records what the rule meant when the measurements above it were taken.
 *
 * It folded three different things into one word. When it was written, "carries
 * `sfx_shared_tap_fallback`" reliably meant "answered like a miss", because the cue
 * arrived WITHOUT a picture — `fire` played it inline and stopped. Since the
 * choke-point repair, `fire` delegates to `acknowledgeTap`, which supplies the cue AND
 * the sparkle. So a latched prop's second tap now reads cue + burst, and the old rule
 * flags it in exactly the words it used for a tap that got nothing.
 *
 * Those are not the same defect and must not print the same. The round's surviving
 * charge is a COMPARISON — a tap that found something must not be answered more poorly
 * than a tap that found nothing — and cue + burst is not more poorly. It is equal. So
 * the grading splits:
 *
 *   DEAD    — silent, or no burst. Strictly less than a miss. This is the charge.
 *   GENERIC — the shared acknowledgement, cue and burst both. Equal to a miss, not
 *             less: not a broken promise, but not a delight either, and soul.md#6
 *             wants a real answer. Reported as standing debt, not as a failure.
 *
 * Keeping the harsher label would have let the repair be scored against a rule that
 * can no longer distinguish what it repaired.
 */

import { chromium } from 'playwright';

const ROOMS = process.argv.length > 2 ? process.argv.slice(2) : ['playroom', 'living-room', 'kitchen', 'nature'];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

const MISS_CUE = 'sfx_shared_tap_fallback';

for (const room of ROOMS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.error(`  [pageerror] ${e.message}`));
  await page.goto(`http://localhost:5199/.probe/render/room.html?room=${room}`, { waitUntil: 'load' });
  await page.waitForFunction('window.__shotReady === true', null, { timeout: 60000 });

  const out = await page.evaluate(() => {
    window.__gsapSleep();
    const selftest = window.__tapThroughCanvas(0, 0.92);
    const targets = window.__propTargets();
    // Grouped by the handler the room author shared, for the reason the reaction scan
    // groups: the dispatcher wraps each registration in a fresh closure, so three
    // meshes on one `onClick` are one prop and would otherwise be counted three times
    // — and the second of three taps on the SAME handler would be scored as a first.
    const seen = new Set();
    const rows = [];
    for (const t of targets) {
      const key = window.__handlerKeyOf(t.index);
      if (seen.has(key)) continue;
      seen.add(key);
      const first = window.__tapThroughCanvas(t.ndcX, t.ndcY);
      const second = window.__tapThroughCanvas(t.ndcX, t.ndcY);
      rows.push({
        name: t.name,
        navigated: window.__navCalls().length > 0,
        first: { sounds: first.sounds, emits: first.emits },
        second: { sounds: second.sounds, emits: second.emits },
      });
    }
    return { selftest, rows, navAll: window.__navCalls() };
  });

  const ok = out.selftest.sounds.includes(MISS_CUE);
  console.log(`\n=== ${room} — instrument self-test: a miss ${ok ? 'produced' : 'DID NOT PRODUCE'} ${MISS_CUE}${ok ? '' : ' — THIS ROOM IS VOID'}`);
  if (!ok) {
    await page.close();
    continue;
  }

  const firstFailed = out.rows.filter((r) => r.first.sounds.length === 0 || r.first.sounds.includes(MISS_CUE) || r.first.emits.length === 0);
  const doors = out.rows.filter((r) => /door|toybox/i.test(r.name));
  const graded = out.rows.filter((r) => !firstFailed.includes(r) && !doors.includes(r));
  // Strictly less than a miss gets, which is the round's charge.
  const dead = graded.filter((r) => r.second.sounds.length === 0 || r.second.emits.length === 0);
  // Exactly what a miss gets. Not a broken promise; not a delight. Standing debt.
  const generic = graded.filter((r) => !dead.includes(r) && r.second.sounds.includes(MISS_CUE));

  console.log(`  ${'prop'.padEnd(24)} ${'1st cue'.padEnd(26)} ${'2nd cue'.padEnd(26)} 2nd burst`);
  for (const r of graded) {
    const flag = dead.includes(r) ? ' <-- DEAD SECOND TAP' : generic.includes(r) ? ' <-- generic (equal to a miss)' : '';
    console.log(
      `  ${r.name.slice(0, 23).padEnd(24)} ${(r.first.sounds.join(',') || '(silent)').padEnd(26)} ${(r.second.sounds.join(',') || '(silent)').padEnd(26)} ${r.second.emits.join(',') || '(none)'}${flag}`,
    );
  }
  console.log(`\n  VERDICT — second tap answered MORE POORLY than a miss: ${dead.length ? dead.map((r) => r.name).join(', ') : 'none'}`);
  console.log(`  standing debt — second tap answered exactly AS a miss: ${generic.length ? generic.map((r) => r.name).join(', ') : 'none'}`);

  // NO SILENT CAPS. The two exclusions are exclusions from the VERDICT, not from
  // the report: a first-tap failure is a wiring defect rather than a second-tap
  // defect, but it is still a defect, and the first draft of this probe printed
  // only the names — which is how `rug`'s failed first tap in the Playroom got
  // recorded as a bare word with no evidence beside it. Print what they did.
  const dump = (label, rows) => {
    console.log(`  ${label}`);
    if (!rows.length) {
      console.log('    (none)');
      return;
    }
    for (const r of rows) {
      console.log(
        `    ${r.name.slice(0, 23).padEnd(24)} 1st ${(r.first.sounds.join(',') || '(silent)').padEnd(26)} ${(r.first.emits.join(',') || '(no burst)').padEnd(16)}` +
          ` | 2nd ${(r.second.sounds.join(',') || '(silent)').padEnd(26)} ${r.second.emits.join(',') || '(no burst)'}`,
      );
    }
  };
  dump('excluded from the verdict, FIRST tap already failed:', firstFailed);
  dump('excluded from the verdict, doorway/toybox (navigates):', doors);
  await page.close();
}

await browser.close();
