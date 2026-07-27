/**
 * THE CHECK `__discoveryMap` PROMISED, RUN BEFORE ANY OF ITS NUMBERS ARE QUOTED.
 *
 * `__discoveryMap` re-implements the controller's four arbitration rules so a
 * whole frame can be classified in one pass. Re-implementation is exactly the
 * mistake this review has now paid for three times -- Round 4's geometric
 * proxies, Round 5's two retracted probes, and this round's own invented 24 px
 * "controller constant" -- so the hook's doc block commits it to a standard: the
 * model may only be quoted while a real-tap sweep at the same samples agrees
 * with it everywhere.
 *
 * This is that sweep. `__tapClasses` dispatches a genuine pointerdown/pointerup
 * pair at every sample onto the real canvas and records which registered object
 * the shipped `onPointerUp` actually fired. Nothing is modelled: the raycast,
 * the ancestor walk, the background split, the proximity contest and the
 * ordering between them are all the app's own code.
 *
 * TWO COMPARISONS, NOT ONE, because they can fail separately:
 *
 *   CLASS  PROP / SCENERY / NOTHING. This is what the round's charge is stated
 *          in, so this is the one that gates quoting a number.
 *   OBJECT which specific target fired. Strictly stronger. A class-agreeing,
 *          object-disagreeing sample means the model picks a different prop than
 *          the app does -- harmless to the headline figure, and still a defect,
 *          so it is reported rather than hidden behind the weaker test.
 *
 * THE RADIUS IS NOT A PARAMETER TO CHOOSE. `__discoveryMap` takes one, and it is
 * given `PROXIMITY_PX` read out of `gestureRules.ts` at run time. Passing
 * anything else would make the two sides measure different apps and the
 * agreement would prove nothing. `setProximityRadiusPx` is never called anywhere
 * in `src`, so 70 is what every scene ships.
 *
 * FAILURE IS THE POINT. If any viewport reports a class disagreement this exits
 * non-zero and the round may not use `__discoveryMap` output at all.
 */

import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

/**
 * The shipped proximity radius, read out of source so the two sides of the
 * comparison cannot drift apart.
 *
 * @returns the numeric value of `PROXIMITY_PX` as declared in `gestureRules.ts`.
 */
const shippedProximityPx = () => {
  const src = readFileSync(new URL('../../src/utils/interaction/gestureRules.ts', import.meta.url), 'utf8');
  const m = /export const PROXIMITY_PX = (\d+(?:\.\d+)?)/.exec(src);
  if (!m) throw new Error('PROXIMITY_PX not found in gestureRules.ts -- fix this probe, do not guess');
  return Number(m[1]);
};

const PROXIMITY_PX = shippedProximityPx();
const STEP = 12;

/**
 * Both scenes, because the charge is comparative. Nature's model hook predates
 * this round and is called `__dispatchMap`; Pirate Cove's is `__discoveryMap`.
 * The names differ, the arbitration inside them is the same code, and both are
 * held to the same real-tap sweep here.
 */
const SCENES = [
  ['NATURE', 'http://localhost:5199/.probe/render/nature.html', '__dispatchMap'],
  ['PIRATE COVE', 'http://localhost:5199/.probe/render/shot.html', '__discoveryMap'],
];

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

console.log('==== ROUND 6 / AGREEMENT: MODEL vs REAL TAPS THROUGH THE SHIPPED CONTROLLER\n');
console.log(`  proximity radius ${PROXIMITY_PX}px, read from gestureRules.ts`);
console.log(`  sample grid: every ${STEP}px in both axes, same samples on both sides\n`);

let failures = 0;

for (const [scene, url, hook] of SCENES) {
  console.log(`---- ${scene}\n`);
  for (const [label, w, h] of VIEWS) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 40000 });

    const r = await page.evaluate(
      ([step, radiusPx, hookName]) => {
        const model = window[hookName](step, radiusPx);
        const real = window.__tapClasses(step);
        if (model.cols !== real.cols || model.rows !== real.rows) {
          throw new Error(`grid mismatch: model ${model.cols}x${model.rows}, real ${real.cols}x${real.rows}`);
        }
        const cls = (i, bg) => (i < 0 ? 'NOTHING' : bg[i] ? 'SCENERY' : 'PROP');
        let classDisagree = 0;
        let objectDisagree = 0;
        const examples = [];
        const tally = { model: {}, real: {} };
        for (let k = 0; k < model.fire.length; k++) {
          const cm = cls(model.fire[k], model.background);
          const cr = cls(real.fire[k], model.background);
          tally.model[cm] = (tally.model[cm] ?? 0) + 1;
          tally.real[cr] = (tally.real[cr] ?? 0) + 1;
          if (cm !== cr) {
            classDisagree++;
            if (examples.length < 6) {
              examples.push({
                x: (k % model.cols) * step + step / 2,
                y: Math.floor(k / model.cols) * step + step / 2,
                model: `${cm} ${model.fire[k] < 0 ? '-' : model.labels[model.fire[k]]}`,
                real: `${cr} ${real.fire[k] < 0 ? '-' : model.labels[real.fire[k]]}`,
              });
            }
          } else if (model.fire[k] !== real.fire[k]) {
            objectDisagree++;
          }
        }
        return { n: model.fire.length, classDisagree, objectDisagree, examples, tally, labels: model.labels, cols: model.cols, rows: model.rows };
      },
      [STEP, PROXIMITY_PX, hook],
    );
    await page.close();

    const pct = (v) => `${((v / r.n) * 100).toFixed(1)}%`;
    const line = (t) => ['PROP', 'SCENERY', 'NOTHING'].map((k) => `${k} ${pct(t[k] ?? 0)}`).join('   ');
    console.log(`  ${label}   (${r.cols}x${r.rows} = ${r.n} samples)`);
    console.log(`    model : ${line(r.tally.model)}`);
    console.log(`    real  : ${line(r.tally.real)}`);
    console.log(`    class disagreements   ${r.classDisagree}   (${pct(r.classDisagree)})`);
    console.log(`    object disagreements  ${r.objectDisagree}   (${pct(r.objectDisagree)})  [same class, different target]`);
    for (const e of r.examples) console.log(`      at ${e.x},${e.y}  model=${e.model}  real=${e.real}`);
    if (pageErrors.length) console.log(`    PAGE ERRORS: ${pageErrors.slice(0, 3).join(' | ')}`);
    if (r.classDisagree > 0 || pageErrors.length) failures++;
    console.log('');
  }
}

await browser.close();

if (failures > 0) {
  console.log(`FAILED at ${failures} viewport(s). __discoveryMap output may NOT be quoted.`);
  process.exit(1);
}
console.log('AGREED at every viewport. __discoveryMap output is admissible.');
