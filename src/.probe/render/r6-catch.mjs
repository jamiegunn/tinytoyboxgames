/**
 * EVERY TARGET'S CATCHMENT, IN RAW SAMPLES, WITH NOTHING TRUNCATED.
 *
 * `r6-map.mjs` prints the top eight targets and folds the rest into a "... N
 * more" line. That is the right shape for reading a scene at a glance and the
 * wrong shape for the one question a fix has to answer: DID ANY EXISTING PROP
 * LOSE GROUND. A prop that drops out of the top eight, or that loses four
 * samples out of ninety, is invisible in that view, and "no prop got worse" is
 * precisely the claim Round 6's acceptance criteria make the fix defend.
 *
 * So this prints the full table, in SAMPLE COUNTS rather than percentages,
 * because the comparison is run twice against the same grid and integers
 * subtract cleanly where rounded percentages do not: 4.8% -> 4.6% could be five
 * samples or it could be one sample and a rounding boundary, and the difference
 * decides whether a regression is real.
 *
 * Diff it against itself across a change:
 *
 *   git stash push -- src/scenes/.../pirate-cove
 *   node .probe/render/r6-catch.mjs > /tmp/before.txt
 *   git stash pop
 *   node .probe/render/r6-catch.mjs > /tmp/after.txt
 *   diff /tmp/before.txt /tmp/after.txt
 *
 * The grid, the proximity radius and the viewports are identical to
 * `r6-map.mjs`, so the two are directly comparable and the totals agree.
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
const STEP = 12;

const SCENES = [['PIRATE COVE', 'http://localhost:5199/.probe/render/shot.html', '__discoveryMap']];

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

console.log('==== ROUND 6 / FULL CATCHMENT TABLE, IN SAMPLES\n');
console.log(`  ${STEP}px grid, proximity radius ${PROXIMITY_PX}px (shipped).\n`);

for (const [scene, url, hook] of SCENES) {
  console.log(`======== ${scene}`);
  for (const [label, w, h] of VIEWS) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 40000 });

    const r = await page.evaluate(
      ([step, radiusPx, hookName]) => {
        const m = window[hookName](step, radiusPx);
        const counts = {};
        let nothing = 0;
        for (let k = 0; k < m.fire.length; k++) {
          const idx = m.fire[k];
          if (idx < 0) {
            nothing++;
            continue;
          }
          const key = `${m.background[idx] ? 'SCENERY ' : 'PROP    '}${m.labels[idx] || '(unnamed)'}`;
          counts[key] = (counts[key] ?? 0) + 1;
        }
        return { n: m.fire.length, nothing, counts };
      },
      [STEP, PROXIMITY_PX, hook],
    );
    await page.close();

    console.log(`\n  ---- ${label}   ${r.n} samples`);
    const rows = Object.entries(r.counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    for (const [key, n] of rows) {
      console.log(`       ${String(n).padStart(6)}  ${((n / r.n) * 100).toFixed(2).padStart(6)}%  ${key}`);
    }
    console.log(`       ${String(r.nothing).padStart(6)}  ${((r.nothing / r.n) * 100).toFixed(2).padStart(6)}%  NOTHING`);
  }
}

console.log('');
await browser.close();
