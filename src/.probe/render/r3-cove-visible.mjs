/**
 * IS THE SHIP WHEEL'S ANSWER SMALLER THAN THE ANSWER IT SUPPRESSED?
 *
 * `r3-cove.mjs` established that the cannon and the ship wheel both play the miss
 * cue and both lose the shared sparkle. For the audible half that settles it: the
 * cue they play IS the miss's cue, byte for byte, so a child cannot tell the cannon
 * from empty air by ear.
 *
 * THE VISIBLE HALF IS NOT SETTLED BY THAT PROBE, AND I NEARLY CLAIMED IT WAS.
 * `__tapThroughCanvas` records particle emits. The ship wheel emits nothing, and it
 * would have been easy — and wrong — to write "the wheel's answer is strictly
 * poorer than a miss's" from that column alone. The wheel does not emit, but it
 * ROTATES, and a rotation is a visible answer that an emit-recorder is constitutionally
 * unable to see. Round 2's own bar is a comparison of what the child perceives, not
 * of what the particle engine was asked for, so it has to be measured in pixels.
 *
 * `__reactionScan` does that: within a crop sized to the prop it reports `propHigh`,
 * the peak change the prop's own reaction makes to the picture, and `sparkleHigh`,
 * the peak change the shared sparkle would make in that same crop. The comparison
 * this probe exists to make is `propHigh` against `sparkleHigh`, per target.
 *
 * THE PREDICTION, WRITTEN BEFORE THE RUN, AND WHAT WOULD REFUTE THE CHARGE
 * -----------------------------------------------------------------------
 *   - `chest_body` (control): propHigh comfortably above sparkleHigh. It has its own
 *     sound and its own gold burst; if the instrument cannot show the chest winning,
 *     it cannot show anyone winning and nothing below is readable.
 *   - `cannon_barrel`: propHigh above sparkleHigh. It keeps `cannonConfetti`. The
 *     charge against the cannon is expected to be AUDIBLE ONLY, and if the numbers
 *     say so, the charge must be narrowed to that in the write-up.
 *   - `wheel_ring`: THIS IS THE OPEN QUESTION. If propHigh < sparkleHigh, the wheel's
 *     rotation is a smaller change to the picture than the sparkle it displaced, and
 *     the tap that found the wheel is answered more poorly than a tap that found
 *     nothing — Round 2's bar, failed, in the scene Round 2 never looked at. If
 *     propHigh > sparkleHigh, THE CHARGE AGAINST THE WHEEL'S VISIBLE HALF IS REFUTED,
 *     the rotation is a real answer, and what remains is the audible half alone. That
 *     outcome gets published exactly as loudly as the other one.
 */

import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error(`  [pageerror] ${e.message}`));
await page.goto('http://localhost:5199/.probe/render/room.html?room=pirate-cove', { waitUntil: 'load' });
await page.waitForFunction('window.__shotReady === true', null, { timeout: 60000 });

const rows = await page.evaluate(() => window.__reactionScan(1.5, 0.15));

const OF_INTEREST = /chest_body|cannon_barrel|wheel_ring|parrot_prop|ship_sailGroup|ship_ocean/;
console.log("\n=== pirate-cove — the prop's own visible answer vs the sparkle it displaced");
console.log(`  ${'target'.padEnd(20)} ${'propHigh'.padEnd(10)} ${'sparkleHigh'.padEnd(12)} ${'ratio'.padEnd(8)} ${'peakAt'.padEnd(8)} emits`);
for (const r of rows.filter((x) => OF_INTEREST.test(x.name))) {
  const ratio = r.sparkleHigh > 0 ? (r.propHigh / r.sparkleHigh).toFixed(3) : 'n/a';
  const e = r.emits.map((x) => x.preset).join(',') || '(none)';
  console.log(
    `  ${r.name.slice(0, 19).padEnd(20)} ${r.propHigh.toFixed(4).padEnd(10)} ${r.sparkleHigh.toFixed(4).padEnd(12)} ${ratio.padEnd(8)} ${String(r.peakAt).padEnd(8)} ${e}`,
  );
}

const get = (n) => rows.find((r) => r.name === n);
const chest = get('chest_body');
const wheel = get('wheel_ring');
const cannon = get('cannon_barrel');

console.log('');
if (!chest || chest.propHigh <= chest.sparkleHigh) {
  console.log('  GUARD FAILED: the control prop does not out-answer the sparkle it keeps. Nothing above is readable.');
} else {
  console.log(`  guard passed — control chest_body answers ${(chest.propHigh / chest.sparkleHigh).toFixed(2)}x the displaced sparkle.`);
  for (const r of [cannon, wheel].filter(Boolean)) {
    const poorer = r.propHigh < r.sparkleHigh;
    console.log(
      `  ${r.name}: visible answer is ${poorer ? 'SMALLER' : 'larger'} than the sparkle it suppressed ` +
        `(${r.propHigh.toFixed(4)} vs ${r.sparkleHigh.toFixed(4)}) -> charge on the VISIBLE half ${poorer ? 'STANDS' : 'REFUTED, narrow it to the audible half'}`,
    );
  }
}

await page.close();
await browser.close();
