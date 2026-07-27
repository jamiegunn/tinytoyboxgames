/**
 * THE DEAD BAND, NAMED.
 *
 * `r6-map.mjs` reports that a full-width horizontal band of Pirate Cove comes
 * back 100% NOTHING at every shipping viewport. That is an outcome, and an
 * outcome cannot be a charge on its own: dead sky is a non-problem and dead
 * ship is the whole argument. Until now the difference was established by
 * looking at a screenshot with guide lines drawn on it, which is an argument
 * from the reviewer's own eyes and exactly the kind of thing this review has
 * had to retract three times.
 *
 * This cross-tabs the two hooks at the same sample grid. `__discoveryMap` says
 * what a tap does; `__underNames` says what is standing there. The join is by
 * sample index, so every NOTHING sample is attributed to the named object the
 * child is actually looking at, and the counts are exhaustive -- an unnamed or
 * empty sample is reported as `(nothing rendered)` rather than dropped, so the
 * column sums to the NOTHING total from the map and cannot hide a gap.
 *
 * BOTH SCENES, because the charge is comparative. Nature's dead samples should
 * attribute overwhelmingly to sky and cloud; if they do not, the comparison the
 * round is built on is wrong and this probe is where that shows up.
 *
 * NAMES ARE GROUPED BY TRAILING INDEX ONLY, not by first word. The first version
 * grouped on the first underscore segment, which folded `ship_ocean`,
 * `ship_mainsail`, `ship_mast` and `ship_shroud_port_-2` into one 40.5% row
 * called `ship`. Every one of those is a different object with a different
 * argument attached to it -- the sea being inert is a design choice, the sail
 * being inert is the charge -- and a grouping that hides the difference would
 * have let the round overstate its case by an order of magnitude. Only a
 * trailing `_<n>` is stripped, so `railing_post_port_side_15` joins its
 * fourteen siblings and nothing else merges.
 *
 * THE MODEL IS ADMISSIBLE ONLY BECAUSE pc-agree.mjs SAID SO. Run that first; it
 * exits non-zero on any class disagreement between the model and real taps.
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

const SCENES = [
  ['NATURE', 'http://localhost:5199/.probe/render/nature.html', '__dispatchMap'],
  ['PIRATE COVE', 'http://localhost:5199/.probe/render/shot.html', '__discoveryMap'],
];

const VIEWS = [
  ['landscape 1280x720', 1280, 720],
  ['iPhone 15 393x852', 393, 852],
];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

console.log('==== ROUND 6 / THE DEAD SAMPLES, ATTRIBUTED TO WHAT IS STANDING THERE\n');
console.log(`  ${STEP}px grid, proximity radius ${PROXIMITY_PX}px (shipped).`);
console.log('  A NOTHING sample means no registered target fired. Round 5 gives it a');
console.log('  sparkle and a sound, so it is answered -- it is just never a discovery.\n');

for (const [scene, url, hook] of SCENES) {
  console.log(`\n======== ${scene}`);
  for (const [label, w, h] of VIEWS) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 40000 });

    const r = await page.evaluate(
      ([step, radiusPx, hookName]) => {
        const m = window[hookName](step, radiusPx);
        const u = window.__underNames(step);
        if (m.cols !== u.cols || m.rows !== u.rows) throw new Error('grid mismatch between outcome and under-pixel maps');
        const token = (n) => n.replace(/_root$/, '').replace(/_-?[0-9]+$/, '');
        const all = {};
        const dead = {};
        const deadRows = {};
        let nothing = 0;
        for (let k = 0; k < m.fire.length; k++) {
          const t = u.names[k] ? token(u.names[k]) : '(no geometry -- sky)';
          all[t] = (all[t] ?? 0) + 1;
          if (m.fire[k] < 0) {
            nothing++;
            dead[t] = (dead[t] ?? 0) + 1;
            const band = Math.floor((Math.floor(k / m.cols) / m.rows) * 10);
            deadRows[t] = deadRows[t] ?? new Array(10).fill(0);
            deadRows[t][band]++;
          }
        }
        return { n: m.fire.length, nothing, all, dead, deadRows, cols: m.cols, rows: m.rows };
      },
      [STEP, PROXIMITY_PX, hook],
    );
    await page.close();

    const pct = (v) => `${((v / r.n) * 100).toFixed(1)}%`;
    console.log(`\n  ---- ${label}   NOTHING ${pct(r.nothing)} of ${r.n} samples`);
    console.log('       of frame  of dead   what is under the dead samples        by tenth (top->bottom)');
    const sorted = Object.entries(r.dead).sort((a, b) => b[1] - a[1]);
    let shown = 0;
    for (const [t, n] of sorted.slice(0, 12)) {
      const shareOfDead = `${((n / r.nothing) * 100).toFixed(1)}%`;
      const prof = r.deadRows[t].map((v) => (v === 0 ? '  .' : String(Math.round((v / r.deadRows[t].reduce((s, x) => s + x, 0)) * 100)).padStart(3))).join('');
      console.log(`       ${pct(n).padStart(7)}  ${shareOfDead.padStart(7)}   ${t.padEnd(34)} ${prof}`);
      shown += n;
    }
    if (sorted.length > 12)
      console.log(
        `       ${pct(r.nothing - shown).padStart(7)}  ${(((r.nothing - shown) / r.nothing) * 100).toFixed(1).padStart(6)}%   ... ${sorted.length - 12} more`,
      );
  }
}

console.log('');
await browser.close();
