/**
 * DID THE NEW TARGET TAKE TAPS OFF AN OLD ONE, AND HOW.
 *
 * Round 6's fix registers the sail. Measured against the pre-fix scene
 * (`r6-catch.mjs`, run either side of a `git stash`), every existing prop's
 * catchment is IDENTICAL to the sample except one: `parrot_prop` drops 10 / 0 /
 * 5 / 2 samples across the four shipping viewports.
 *
 * That number on its own does not say whether the fix is good or bad, and the
 * two readings point opposite ways:
 *
 *   RAYCAST. The pixel is sail canvas. The child put a finger on the sail.
 *   Before the fix nothing under that pixel was registered, so the proximity
 *   fallback looked around and handed the tap to a parrot up to 70 px away.
 *   After the fix the sail answers. The old behaviour was the wrong one and
 *   losing it is the point.
 *
 *   PROXIMITY. The pixel is empty sky between the two. Two registered centres
 *   compete for it, and the sail's origin — the sail head, which sits directly
 *   under the crow's nest — happens to be nearer than the bird. That is a real
 *   regression: a big thing winning a near-miss that a small thing wanted, which
 *   is exactly what `TapOptions.background` exists to prevent.
 *
 * So this reports each target's catchment SPLIT BY HOW IT WAS WON. If the sail's
 * proximity column is zero, the parrot lost only pixels that are literally sail,
 * and the fix stands as written. If it is not, the sail belongs behind the
 * `background` flag and this probe is what says so.
 *
 * `mode` comes from the same `__discoveryMap` call as `fire`, so the two cannot
 * describe different samples.
 */

import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const shippedProximityPx = () => {
  const src = readFileSync(new URL('../../src/utils/interaction/gestureRules.ts', import.meta.url), 'utf8');
  const m = /export const PROXIMITY_PX = (\d+(?:\.\d+)?)/.exec(src);
  if (!m) throw new Error('PROXIMITY_PX not found in gestureRules.ts -- fix this probe, do not guess');
  return Number(m[1]);
};

const PROXIMITY_PX = shippedProximityPx();

/**
 * Grid pitch. 12 matches `r6-map.mjs` and `r6-catch.mjs` so the three tables are
 * directly comparable, and that is the default for a reason.
 *
 * It is overridable because this probe is also used to answer a question a
 * coarse grid cannot answer honestly: "does a tap that lands ON the sail ever
 * get handed to the parrot instead". At 12px that band came back empty at all
 * four viewports, and an empty result on a coarse grid is exactly the result a
 * grid produces when it steps over a thin band. Re-run at `STEP=6` (or 4) to
 * check that the zero is a real zero and not a sampling artefact.
 */
const STEP = Number(process.env.STEP ?? 12);

const VIEWS = [
  ['landscape 1280x720', 1280, 720],
  ['iPad portrait 768x1024', 768, 1024],
  ['iPhone 15 393x852', 393, 852],
  ['extreme 360x900', 360, 900],
];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

console.log('==== ROUND 6 / HOW EACH TARGET WON ITS CATCHMENT\n');
console.log(`  ${STEP}px grid, proximity radius ${PROXIMITY_PX}px (shipped).`);
console.log('  ON TARGET  the ray hit the thing. NEAR MISS  the proximity fallback');
console.log('  handed it over from up to the full radius away.\n');

console.log('======== PIRATE COVE');
for (const [label, w, h] of VIEWS) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto('http://localhost:5199/.probe/render/shot.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 40000 });

  const r = await page.evaluate(
    ([step, radiusPx]) => {
      const m = window.__discoveryMap(step, radiusPx);
      const rows = {};
      for (let k = 0; k < m.fire.length; k++) {
        const idx = m.fire[k];
        if (idx < 0) continue;
        const key = `${m.background[idx] ? 'SCENERY ' : 'PROP    '}${m.labels[idx] || '(unnamed)'}`;
        rows[key] ??= [0, 0, 0];
        rows[key][m.mode[k]]++;
      }
      return { n: m.fire.length, rows };
    },
    [STEP, PROXIMITY_PX],
  );
  await page.close();

  console.log(`\n  ---- ${label}   ${r.n} samples`);
  console.log('       total  on target  near miss  background');
  const sorted = Object.entries(r.rows).sort((a, b) => b[1][0] + b[1][1] + b[1][2] - (a[1][0] + a[1][1] + a[1][2]));
  for (const [key, [ray, prox, bg]] of sorted) {
    console.log(`       ${String(ray + prox + bg).padStart(5)}  ${String(ray).padStart(9)}  ${String(prox).padStart(9)}  ${String(bg).padStart(10)}  ${key}`);
  }
}

console.log('');
await browser.close();
