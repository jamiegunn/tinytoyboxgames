/**
 * ROUND 6, CHARGE 1: DOES THE FRAME STILL HOLD A SCENE ON A PHONE?
 *
 * vision.md is unusually specific for a vision document. Under "Required layout
 * behavior" it asks for four things, and two of them are testable claims rather
 * than aspirations:
 *
 *   "Must support both portrait and landscape orientations"
 *   "Must keep UI legible and scene composition intentional at all breakpoints"
 *
 * "Intentional at all breakpoints" is the one this probe is pointed at. A scene
 * whose composition was chosen in landscape and merely SURVIVES portrait is not
 * intentional there; it is landscape with the sides cut off. The question is
 * whether that is what the two named scenes actually do.
 *
 * WHAT IS COUNTED, AND WHY NOT SOMETHING SIMPLER. The population is the LIVE TAP
 * REGISTRY -- the objects the controller would actually raycast -- pulled out of
 * both harnesses by the same method, with background-flagged scenery excluded.
 * Three cheaper populations were considered and rejected:
 *
 *   - `*_root` nodes. Nature has 44 of them and Pirate Cove has TWO, because the
 *     two scenes build props through different factories. A census on that
 *     convention would have reported the ship as an empty deck.
 *   - Everything with geometry. Then a scene scores well for having a big hull.
 *   - Draw calls, triangle counts, any render statistic. None of them answer
 *     "is there something here for a child to find".
 *
 * WHAT "IN FRAME" MEANS HERE. A target's world bounding sphere is projected and
 * three separate facts are reported, because they fail independently and the
 * fixes differ:
 *
 *   FRAMED   the projected centre lies inside the viewport. Fails when the
 *            camera is too tight -- a framing defect.
 *   VISIBLE  any part of the projected disc overlaps the viewport, so a sliver
 *            may be showing. A prop can be VISIBLE but not FRAMED, and a child
 *            can still see and aim at it, which is why the two are not merged.
 *   READABLE the projected diameter is at least READABLE_PX.
 *
 * RETRACTION, AND IT IS THIS PROBE'S OWN. The first version of this file set
 * READABLE_PX to 24 and defended it in this comment as "the proximity radius the
 * tap controller itself uses", pointedly contrasting that with Round 5's
 * retraction of a probe for borrowing Apple's 44 px. The sentence was false. The
 * controller's radius is `PROXIMITY_PX` in `gestureRules.ts` and it is 70; the
 * string "24" does not occur anywhere under `src/utils/interaction`. The number
 * was invented and then dressed in the language of the very discipline it broke,
 * which is worse than the error it was congratulating itself for avoiding.
 *
 * READABLE_PX is now 70, taken from the shipped constant, and it is imported
 * from source rather than typed in, so the next person to change PROXIMITY_PX
 * changes this probe with it. Note what that costs: the threshold triples, so
 * every READABLE figure this probe printed before is void, and the corrected
 * numbers are much harsher. That is the correct direction for a retraction to
 * move -- an error that had been flattering the scenes.
 *
 * READABLE is still only a legibility PROXY and a generous one. What it now
 * means precisely is "big enough that the child did not need the app's
 * small-target forgiveness to hit it".
 *
 * THE A/B. Each scene is measured twice per viewport: at the radius the app
 * actually adopts, and at the radius the portrait pull-back rule would ask for
 * if nothing clamped it (`preset.distance * distanceMultiplierForAspect`). For
 * Nature those are the same number, because its catalog entry deliberately omits
 * `maxDistance`. For Pirate Cove they are not, because its entry sets
 * `maxDistance: 12` against a `distance: 12`, which makes the multiplier a
 * no-op at every aspect. The A/B is the whole point: it separates "portrait is
 * hard" from "portrait relief is switched off in this scene".
 *
 * WHAT THIS PROBE DOES NOT PROVE. A bounding sphere overestimates a thin prop
 * and a projected disc is not a silhouette, so READABLE is an upper bound on
 * legibility, not a measurement of it. It is used only to compare a scene
 * against ITSELF at two radii, where the bias is identical on both sides and
 * cancels. Any claim about absolute legibility needs pixels, and pixels are what
 * `frame-bands.mjs` goes and gets.
 */

import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const PULLBACK_REFERENCE_ASPECT = 0.75;

/**
 * The shipped proximity radius, READ OUT OF SOURCE rather than copied here, so
 * this probe cannot drift from the app the way its first version did.
 *
 * @returns the numeric value of `PROXIMITY_PX` as declared in `gestureRules.ts`.
 */
const shippedProximityPx = () => {
  const src = readFileSync(new URL('../../src/utils/interaction/gestureRules.ts', import.meta.url), 'utf8');
  const m = /export const PROXIMITY_PX = (\d+(?:\.\d+)?)/.exec(src);
  if (!m) throw new Error('PROXIMITY_PX not found in gestureRules.ts -- fix this probe, do not guess');
  return Number(m[1]);
};

const READABLE_PX = shippedProximityPx();

const SCENES = [
  ['NATURE', 'http://localhost:5199/.probe/render/nature.html', 10, null],
  ['PIRATE COVE', 'http://localhost:5199/.probe/render/shot.html', 12, 12],
];

const VIEWS = [
  ['landscape 1280x720', 1280, 720],
  ['tablet 1024x768', 1024, 768],
  ['square 900x900', 900, 900],
  ['iPad portrait 768x1024', 768, 1024],
  ['viewport 480x854', 480, 854],
  ['iPhone SE 375x667', 375, 667],
  ['iPhone 15 393x852', 393, 852],
  ['Pixel 8 412x915', 412, 915],
  ['extreme 360x900', 360, 900],
];

const multiplier = (aspect) => Math.max(1, PULLBACK_REFERENCE_ASPECT / aspect);

/** Projects a world point through a column-major projection*view matrix. */
const project = (p, m, w, h) => {
  const [x, y, z] = p;
  const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
  const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
  const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (cw <= 0) return null; // behind the camera
  return { x: ((cx / cw + 1) / 2) * w, y: ((1 - cy / cw) / 2) * h, depth: cw };
};

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

console.log('==== ROUND 6 / CHARGE 1: IS THE COMPOSITION INTENTIONAL AT EVERY BREAKPOINT?\n');
console.log('  Population: the live tap registry, background scenery excluded.');
console.log(`  FRAMED = projected centre inside the viewport. VISIBLE = any overlap.`);
console.log(`  READABLE = projected diameter >= ${READABLE_PX}px, the controller's own proximity radius.`);
console.log('  "asks for" = the radius the pull-back rule wants; "adopts" = what the app uses.\n');

for (const [scene, url, authored, cappedAt] of SCENES) {
  console.log(`\n---- ${scene}  (authored distance ${authored}${cappedAt !== null ? `, maxDistance ${cappedAt}` : ', no maxDistance'})\n`);
  console.log('  viewport                  asks  adopts   n   FRAMED  VISIBLE  READABLE   median dia');

  for (const [label, w, h] of VIEWS) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 40000 });

    const asks = authored * multiplier(w / h);

    const measure = async (radius) =>
      page.evaluate(
        ([r, vw, vh]) => {
          const adopted = window.__setRadius(r);
          return { adopted, m: window.__projView(), bounds: window.__propBounds(), vw, vh };
        },
        [radius, w, h],
      );

    const score = (res) => {
      let framed = 0;
      let visible = 0;
      let readable = 0;
      const dias = [];
      for (const b of res.bounds) {
        const c = project(b.c, res.m, w, h);
        if (!c) continue;
        // On-screen radius from the projection of a point one world-radius to
        // the camera's right would need the camera basis; the sphere is
        // isotropic, so the vertical FOV relation is exact and needs no basis:
        // px = worldRadius / depth * (h / 2) / tan(fov/2).
        const px = ((b.r / c.depth) * (h / 2)) / Math.tan((50 * Math.PI) / 180 / 2);
        const inFrame = c.x >= 0 && c.x <= w && c.y >= 0 && c.y <= h;
        const overlaps = c.x + px >= 0 && c.x - px <= w && c.y + px >= 0 && c.y - px <= h;
        if (inFrame) framed++;
        if (overlaps) visible++;
        if (overlaps && 2 * px >= READABLE_PX) readable++;
        if (overlaps) dias.push(2 * px);
      }
      dias.sort((a, b) => a - b);
      const median = dias.length ? dias[Math.floor(dias.length / 2)] : 0;
      return { framed, visible, readable, median, n: res.bounds.length };
    };

    const shipped = score(await measure(null));
    const pulled = score(await measure(asks));
    const adopted = (await measure(null)).adopted;
    await page.close();

    const same = Math.abs(asks - adopted) < 0.05;
    console.log(
      `  ${label.padEnd(23)} ${asks.toFixed(1).padStart(5)} ${adopted.toFixed(1).padStart(7)} ${String(shipped.n).padStart(3)}` +
        `   ${String(shipped.framed).padStart(2)}/${shipped.n}` +
        `    ${String(shipped.visible).padStart(2)}/${shipped.n}` +
        `      ${String(shipped.readable).padStart(2)}/${shipped.n}` +
        `    ${shipped.median.toFixed(0).padStart(5)}px` +
        (same
          ? ''
          : `   [pull-back would give ${pulled.framed}/${pulled.n} framed, ${pulled.readable}/${pulled.n} readable, median ${pulled.median.toFixed(0)}px]`),
    );
  }
}

console.log('');
await browser.close();
