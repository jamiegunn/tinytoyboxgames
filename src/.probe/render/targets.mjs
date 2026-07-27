/**
 * RETRACTED IN PART BY FALSIFICATION 4 -- THE 44 px FLOOR IS THE WRONG CONSTANT.
 *
 * The CSS-pixel measurements below are real and still worth having. The bar they
 * are compared against is not: 44 px comes from Apple's HIG, and this codebase
 * does not use it. `gestureRules.ts` commits to `PROXIMITY_PX = 70`, and the
 * controller fires the nearest registered target within that radius, so a prop
 * rendering 11 px wide is not unreachable. Read the sizes; ignore the verdicts.
 * See docs/ai-guidance/reviews/round-5-tap-arbitration.md.
 */
/**
 * ROUND 5, THE MEASUREMENT THAT DECIDED IT: HOW BIG IS A TAP TARGET, IN THE
 * UNITS A THUMB IS MEASURED IN?
 *
 * Everything this round has produced so far is in the wrong units. "Radius
 * 19.511 against 12.000" is a world-space number; "|ndc.x| 0.94" is a clip-space
 * number; "32.97% of the frame is ship" is a share. None of them is a thumb.
 *
 * vision.md asks for exactly one thing here, twice: "large touch-friendly
 * interactive zones" and "avoid small precision targets". Apple's HIG puts the
 * floor at 44 CSS px square, Material at 48 dp. That is a number, it is in the
 * right units, and it is falsifiable, so this probe measures it.
 *
 * HOW: render the real frame, hide one tappable prop, render again, and take the
 * bounding box of the pixels that changed. That box IS the prop's footprint on
 * glass -- not a projected hull, not an AABB, the actual lit silhouette behind
 * the actual depth buffer, converted to CSS px by the canvas's own scale factor.
 *
 * Two sizes are reported because they disagree in an informative way:
 *   box min   the shorter side of the bounding box. A ship's wheel is a disc, so
 *             its box is honest. A cannon is a long tube, so its box overstates
 *             how much of it a thumb can land on.
 *   sqrt(px)  the side of a square with the same painted area. Immune to
 *             elongation, but it understates a genuinely wide target.
 * A prop only counts as comfortably tappable if BOTH clear the floor.
 *
 * Every viewport is measured twice: at the radius the app ships (Pirate Cove
 * pins maxDistance to distance, so this is always 12) and at the radius the
 * pull-back rule asks for and does not get. That is the A/B this round exists
 * to settle.
 *
 * Preamble is the same as `diff.mjs` -- vite on 5199, playwright --no-save.
 */

import { chromium } from 'playwright';

const PAGE_URL = 'http://localhost:5199/.probe/render/shot.html';

/** Apple HIG 44 CSS px; Material 48 dp. Take the friendlier of the two as the floor. */
const FLOOR = 44;

/**
 * Every viewport the app ships into, widest first, with the radius the pull-back
 * rule asks for at that aspect (12 * max(1, 0.75 / aspect)).
 */
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
].map(([n, w, h]) => [n, w, h, 12 * Math.max(1, 0.75 / (w / h))]);

/**
 * The tappable props, as the substrings that name their whole subtree.
 * `wheel_` alone would also catch `cannon_wheel_0`, so the ship's wheel is
 * addressed by its two real roots instead.
 */
const TAPPABLES = [
  ['cannon', ['cannon_']],
  ['ship wheel', ['wheel_rotation_group', 'wheel_post']],
  ['treasure chest', ['chest_']],
];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(PAGE_URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 30000 });

/**
 * Footprint of one prop on glass, in CSS px, at a given camera radius.
 * Returns null when nothing of the prop reaches the frame at all -- which is
 * itself a result, and a worse one than "too small".
 */
const footprint = (p, keys, radius) =>
  p.evaluate(
    async ([keys, radius]) => {
      const canvas = document.getElementById('c');
      const w = canvas.width;
      const h = canvas.height;
      // Drawing-buffer px -> CSS px. The renderer may be running at a pixel
      // ratio above 1, and a thumb does not care about device pixels.
      const toCss = canvas.clientWidth / w;
      const off = document.createElement('canvas');
      off.width = w;
      off.height = h;
      const ctx = off.getContext('2d', { willReadFrequently: true });
      const grab = () => {
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(canvas, 0, 0);
        return ctx.getImageData(0, 0, w, h).data;
      };

      window.__setRadius(radius);
      const on = grab();
      let hits = 0;
      for (const k of keys) hits += window.__setVisible(k, false);
      window.__setRadius(radius);
      const offData = grab();
      for (const k of keys) window.__setVisible(k, true);
      window.__setRadius(radius);
      if (hits === 0) return { hits: 0 };

      let changed = 0;
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const d = Math.abs(on[i] - offData[i]) + Math.abs(on[i + 1] - offData[i + 1]) + Math.abs(on[i + 2] - offData[i + 2]);
          if (d > 12) {
            changed++;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      if (changed === 0) return { hits, changed: 0 };
      return {
        hits,
        changed,
        boxW: (x1 - x0 + 1) * toCss,
        boxH: (y1 - y0 + 1) * toCss,
        side: Math.sqrt(changed) * toCss,
      };
    },
    [keys, radius],
  );

const fmt = (r) => {
  if (!r.hits) return 'NO SUCH GROUP';
  if (!r.changed) return 'NOT IN FRAME AT ALL';
  const min = Math.min(r.boxW, r.boxH);
  const bad = min < FLOOR || r.side < FLOOR;
  return `${r.boxW.toFixed(0).padStart(4)} x ${r.boxH.toFixed(0).padStart(4)}  box min ${min.toFixed(0).padStart(4)}  sqrt ${r.side.toFixed(0).padStart(4)}  ${bad ? 'UNDER 44' : 'ok'}`;
};

console.log(`==== TAP TARGET FOOTPRINT IN CSS PX. floor ${FLOOR} (Apple HIG 44, Material 48)\n`);

for (const [prop, keys] of TAPPABLES) {
  console.log(`\n---- ${prop}`);
  console.log('  viewport                  radius    box w x h    smaller side   equal-area side');
  for (const [vname, w, h, ruled] of VIEWS) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => window.__redraw());
    await page.waitForTimeout(40);
    const shipped = await footprint(page, keys, null);
    const withRule = await footprint(page, keys, ruled);
    console.log(`  ${vname.padEnd(24)} shipped 12.0   ${fmt(shipped)}`);
    if (Math.abs(ruled - 12) > 1e-6) {
      console.log(`  ${''.padEnd(24)} ruled ${ruled.toFixed(1).padStart(5)}   ${fmt(withRule)}`);
    }
  }
}

await browser.close();
