/**
 * WHY DOES THE ROOM FLOOR'S SECOND TAP GET THE CUE BUT NOT THE PICTURE?
 *
 * The post-fix census moved `lampBase` and `webSlinger` from a second-tap burst of
 * "(none)" to `sceneSparkle`, which is what the choke-point fix in
 * `interactionController.fire` was built to do. The three room floors did not move:
 * they still read 2nd cue `sfx_shared_tap_fallback`, 2nd burst `(none)`.
 *
 * THAT COMBINATION SHOULD NOT BE CONSTRUCTIBLE, and saying why is the point of this
 * probe. The cue and the sparkle are two halves of one function: `acknowledgeTap`
 * runs `missHandler(ray)` and then `audio?.playFallback()`. `createMissAcknowledgement`
 * has no branch that returns without emitting — it emits at the hit point, or at
 * `SKY_SPARKLE_DISTANCE` when the ray meets no geometry at all. So hearing the cue is
 * evidence the function ran, and the function running means an emit was requested.
 * `__tapThroughCanvas` records emits by swapping `particles.emit`, and `particles` is
 * the very engine `setSceneParticleEngine(scene, ...)` registered, so an emit through
 * `getParticleEngine(scene)` cannot slip past the recorder.
 *
 * Two of my observations therefore cannot both be right, and reasoning further from
 * the same two numbers cannot tell me which. So this probe puts the two props on ONE
 * page, in one run, and prints them beside each other:
 *
 *   - `lampBase` (an ordinary target, latched by `shining`)
 *   - the floor  (registered `background: true`, latched by `firstTapHandled`)
 *
 * Both are silent on their second tap by construction. If the two rows differ, the
 * difference is the `background` flag and nothing else, because everything else about
 * the two taps is now held identical. If they agree, the census diff was the artefact
 * and it is the census that needs re-reading, not the controller.
 *
 * A THIRD ROW GUARDS THE INSTRUMENT. Tapping empty sky exercises `acknowledgeTap` from
 * its original caller, where no handler runs at all. If the sky row shows a sparkle and
 * the floor row does not, the acknowledgement is reachable on this page and the floor
 * is genuinely missing it. If the sky row is also bare, the recorder cannot see this
 * handler at all and NEITHER of the other two rows means anything — which would make
 * `lampBase`'s apparent improvement the thing to distrust.
 */

import { chromium } from 'playwright';

const ROOMS = process.argv.length > 2 ? process.argv.slice(2) : ['playroom', 'living-room', 'kitchen'];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

for (const room of ROOMS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.error(`  [pageerror] ${e.message}`));
  await page.goto(`http://localhost:5199/.probe/render/room.html?room=${room}`, { waitUntil: 'load' });
  await page.waitForFunction('window.__shotReady === true', null, { timeout: 60000 });

  const out = await page.evaluate(() => {
    window.__gsapSleep();
    const targets = window.__propTargets();
    const rows = [];

    // The instrument guard goes FIRST, so that if it fails the rest is known to be
    // uninterpretable rather than merely surprising.
    const sky = window.__tapThroughCanvas(0, 0.92);
    rows.push({ label: 'empty sky (miss)', bg: '-', first: sky, second: sky });

    const pick = (predicate) => targets.find(predicate);
    const floor = pick((t) => t.background) ?? pick((t) => /floor/i.test(t.name));
    const lamp = pick((t) => /lampBase|lampShade|kettleBody/i.test(t.name));

    for (const t of [lamp, floor].filter(Boolean)) {
      const first = window.__tapThroughCanvas(t.ndcX, t.ndcY);
      const second = window.__tapThroughCanvas(t.ndcX, t.ndcY);
      rows.push({ label: t.name || `(unnamed ${t.type})`, bg: t.background ? 'yes' : 'no', first, second });
    }
    return rows;
  });

  console.log(`\n=== ${room}`);
  console.log(`  ${'target'.padEnd(22)} ${'bg?'.padEnd(4)} ${'1st sounds'.padEnd(26)} ${'1st emits'.padEnd(14)} ${'2nd sounds'.padEnd(26)} 2nd emits`);
  for (const r of out) {
    console.log(
      `  ${r.label.slice(0, 21).padEnd(22)} ${r.bg.padEnd(4)} ${(r.first.sounds.join(',') || '(silent)').padEnd(26)} ${(r.first.emits.join(',') || '(none)').padEnd(14)}` +
        ` ${(r.second.sounds.join(',') || '(silent)').padEnd(26)} ${r.second.emits.join(',') || '(none)'}`,
    );
  }
  await page.close();
}

await browser.close();
