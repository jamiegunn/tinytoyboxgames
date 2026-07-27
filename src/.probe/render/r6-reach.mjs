/**
 * HOW FAR AWAY IS THE THING I AM ABOUT TO MAKE ANSWER.
 *
 * Round 6's fix registers Pirate Cove's sea. A tap on water has to produce
 * something the child can SEE, and the sea is a 400 x 400 plane: the same
 * splash authored in world units is a fat ring at the rail and a sub-pixel
 * speck at the horizon. Choosing that world size by taste is exactly how this
 * review invented a "24 px controller constant" in Round 5, so it is measured.
 *
 * WHAT IT REPORTS, per named object and per viewport:
 *
 *   the distance percentiles of the samples standing on it, and
 *   the ANGULAR SIZE, in CSS px, that one world unit subtends at each of them.
 *
 * The second column is the one that decides the fix. `pxPerUnit = h / (2 * d *
 * tan(vfov/2))` is the perspective projection with nothing added: a sphere of
 * radius r at distance d covers `2 * r * pxPerUnit` px vertically. Read the
 * other way -- which is how it is used -- it says how many world units a
 * reaction must span to clear a chosen pixel size at a chosen depth.
 *
 * THE THRESHOLD IS THE APP'S OWN. `PROXIMITY_PX` in `gestureRules.ts` is the
 * radius within which the controller will hand a near-miss to a small target;
 * it is the only number in this codebase that asserts "this many pixels is a
 * thing a child can be expected to aim at and see". It is read from source, not
 * typed in, and this probe throws if it cannot find it.
 *
 * FOV AND HEIGHT COME FROM THE LIVE CAMERA, not from the scene's authored
 * preset. The preset is what the scene asks for; `cameraHandle.resize` is free
 * to change it per viewport, and a probe that reads the request rather than the
 * result measures a camera the app never adopts -- the exact defect that voided
 * Round 5's silhouette census.
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
const STEP = 8;

/** Objects worth a row. Everything else is folded into the tail count. */
const OF_INTEREST = ['ship_ocean', 'ship_mainsail', 'ship_sailBand', 'ship_mast', 'stream', '(Mesh)'];

const SCENES = [
  ['PIRATE COVE', 'http://localhost:5199/.probe/render/shot.html'],
  ['NATURE', 'http://localhost:5199/.probe/render/nature.html'],
];

const VIEWS = [
  ['landscape 1280x720', 1280, 720],
  ['iPhone 15 393x852', 393, 852],
];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

console.log('==== ROUND 6 / DEPTH OF THE SURFACES THE FIX HAS TO MAKE ANSWER\n');
console.log(`  ${STEP}px grid. px/unit is CSS px subtended by ONE world unit at that depth.`);
console.log(`  A reaction must span PROXIMITY_PX (${PROXIMITY_PX}) px to match the smallest`);
console.log('  thing this app already claims a child can aim at.\n');

for (const [scene, url] of SCENES) {
  console.log(`\n======== ${scene}`);
  for (const [label, w, h] of VIEWS) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 40000 });

    const r = await page.evaluate(
      ([step, wanted]) => {
        const u = window.__underNames(step);
        const lens = window.__camLens();
        const byName = {};
        for (let k = 0; k < u.names.length; k++) {
          const n = u.names[k];
          if (!n || u.dists[k] < 0) continue;
          const key = wanted.find((t) => n.includes(t));
          if (!key) continue;
          (byName[key] ??= []).push(u.dists[k]);
        }
        return { byName, n: u.names.length, lens };
      },
      [STEP, OF_INTEREST],
    );
    await page.close();

    const { vfov, f } = r.lens;

    console.log(`\n  ---- ${label}   vfov ${((vfov * 180) / Math.PI).toFixed(1)} deg`);
    console.log('       samples   d10    d50    d90     px/unit @d10  @d50  @d90   units for 70px @d50');
    for (const key of OF_INTEREST) {
      const ds = r.byName[key];
      if (!ds || ds.length === 0) continue;
      ds.sort((a, b) => a - b);
      const q = (p) => ds[Math.min(ds.length - 1, Math.floor(ds.length * p))];
      // f is 1 / tan(vfov / 2), straight off the live projection matrix; NDC
      // spans -1..1 over h px, hence the h/2.
      const pxPerUnit = (d) => (h / 2) * (f / d);
      const [d10, d50, d90] = [q(0.1), q(0.5), q(0.9)];
      const need = PROXIMITY_PX / pxPerUnit(d50);
      console.log(
        `       ${String(ds.length).padStart(7)}  ${d10.toFixed(1).padStart(5)}  ${d50.toFixed(1).padStart(5)}  ${d90.toFixed(1).padStart(5)}     ` +
          `${pxPerUnit(d10).toFixed(1).padStart(8)}  ${pxPerUnit(d50).toFixed(1).padStart(4)}  ${pxPerUnit(d90).toFixed(1).padStart(4)}   ${need.toFixed(2).padStart(10)}  ${key}`,
      );
    }
  }
}

console.log('');
await browser.close();
