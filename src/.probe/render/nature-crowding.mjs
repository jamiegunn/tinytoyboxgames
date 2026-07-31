/**
 * ROUND 5, THE CHARGE THAT SURVIVED. THE PULL-BACK DOES NOT MAKE PROPS TOO SMALL
 * TO TAP. IT MAKES THEM TOO CLOSE TOGETHER TO TELL APART.
 *
 * WHY THE PREVIOUS CHARGE DIED
 * ----------------------------
 * Everything before this measured prop footprints against a 44 CSS px touch
 * floor borrowed from Apple's HIG, and found the outdoor scene failing it
 * everywhere. That charge is void. `interaction/gestureRules.ts` defines
 *
 *     PROXIMITY_PX = 70   // small-target proximity fallback
 *
 * and `interactionController` applies it: a tap that hits no mesh still fires
 * the NEAREST registered target within 70 px of the tap point. So a prop that
 * renders 11 px wide is not untappable -- it carries a 70 px catchment, and the
 * codebase solved the small-target problem before this round started. I spent
 * four probes measuring against a floor this code does not use.
 *
 * WHAT THAT SAME CONSTANT IMPLIES INSTEAD
 * ---------------------------------------
 * The fallback resolves to the NEAREST target. That is unambiguous only while
 * neighbouring targets are further apart on screen than the catchment. Once two
 * props project closer than PROXIMITY_PX, the forgiveness that makes each of
 * them reachable also makes them confusable: a child aims at the mushroom, hits
 * bare ground a few px off, and the snail lights up because the snail's centre
 * happened to be nearer. The reward fires, so nothing looks broken -- it is just
 * the wrong prop. soul.md's "a dead tap is a broken promise" has a quieter
 * sibling: a tap that answers as something else.
 *
 * And this failure is caused by exactly the thing the round has been chasing.
 * Dollying the camera back compresses every on-screen distance. The pull-back
 * therefore does not merely shrink props; it drives them through the crowding
 * threshold, and it does so hardest on the narrowest phones.
 *
 * WHAT IS MEASURED
 * ----------------
 * For each viewport, every interactive prop centre is projected to screen px
 * through the real camera, and pairs closer than PROXIMITY_PX are counted. Two
 * radii are compared: the one the pull-back rule produces, and the preset's own
 * authored distance. The threshold is not imported from a style guide -- it is
 * the app's own constant, so the test is against the code's own promise.
 */

import { chromium } from 'playwright';
import { bundleEntry } from '../../tests/framework/_tsload.mjs';

const PAGE_URL = 'http://localhost:5199/.probe/render/nature.html';
// PROXIMITY_PX is IMPORTED, not restated. Round 11 found this one constant
// obtained four different ways across seventeen sites — six hard literals, eight
// hand-rolled regex resolvers, and two real imports — with the correct mechanism
// already present and adopted twice. A regex over the source cannot survive the
// constant becoming an expression; a literal cannot survive anything.
//
// The bundle slug is deliberately shared with the twelve sibling probes that
// need the same constant. bundleEntry emits `.tstest-tmp/entry_<slug>.bundle.mjs`,
// so a shared slug means a shared temp file — safe here only because the entry
// source below is byte-identical everywhere it appears. If you change this
// entry, change it in all of them or give yours a different slug.
const RULES = await bundleEntry('r11_gesture_rules', `export { PROXIMITY_PX } from './src/utils/interaction/gestureRules';`);
const PROXIMITY_PX = RULES.PROXIMITY_PX;

const VIEWS = [
  ['landscape 1280x720', 1280, 720],
  ['iPad portrait 768x1024', 768, 1024],
  ['iPhone SE 375x667', 375, 667],
  ['iPhone 15 393x852', 393, 852],
  ['extreme 360x900', 360, 900],
];

/**
 * WHICH ROOTS COUNT, AND WHY THE FIRST RUN OF THIS PROBE WAS WRONG.
 *
 * `__propCenters` returns every `*_root` in the scene, and the first version of
 * this file fed all of them to the pair counter. That silently included
 * `sky_backdrop_root`, `treeline_root` and `fireflies_root` -- three system
 * roots that all sit at the world origin and so projected to the same pixel,
 * which is where the impossible "worst gap 0.0 px" came from -- plus `fern_root`
 * and `acorn_root`, which live under `props/simple/` and are scenery a child
 * cannot tap at all. Counting scenery as confusable inflated every number.
 *
 * This allowlist is the contents of `factory/props/interactive/`, plus the
 * portals and the owl, which are tappable but staged elsewhere. Nothing is
 * included because it looked crowded; the directory decides.
 */
const INTERACTIVE = ['mushroom_root', 'flower_root', 'leaf_root', 'stone_root', 'snail_root', 'log_root', 'butterfly_root', 'owl_root'];
const IS_PORTAL = (n) => n.startsWith('portal_') && n.endsWith('_root');
const counts = (n) => INTERACTIVE.includes(n) || IS_PORTAL(n);

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(PAGE_URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 40000 });

// Projection is done here rather than in the page so the maths is visible and
// reviewable next to the claim it supports, instead of buried in an evaluate().
const project = (pos, camMatrix, w, h) => {
  const [x, y, z] = pos;
  const m = camMatrix;
  const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
  const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
  const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (cw <= 0) return null;
  return [((cx / cw) * 0.5 + 0.5) * w, (0.5 - (cy / cw) * 0.5) * h];
};

const snapshot = (p, radius) =>
  p.evaluate((r) => {
    window.__setRadius(r);
    const canvas = document.getElementById('c');
    return {
      centers: window.__propCenters(),
      w: canvas.clientWidth,
      h: canvas.clientHeight,
      m: window.__projView(),
    };
  }, radius);

console.log(`==== CROWDING AGAINST THE APP'S OWN PROXIMITY_PX = ${PROXIMITY_PX}\n`);
console.log('  confusable pair = two interactive prop centres projecting closer than');
console.log('  the proximity catchment, so a near-miss tap can resolve to either.\n');
console.log('  viewport                 radius   props on screen   confusable pairs   worst gap');

for (const [vname, w, h] of VIEWS) {
  await page.setViewportSize({ width: w, height: h });
  await page.evaluate(() => window.__redraw());
  await page.waitForTimeout(80);

  for (const [label, radius] of [
    ['pull-back', 10 * Math.max(1, 0.75 / (w / h))],
    ['authored ', 10],
  ]) {
    const s = await snapshot(page, radius);
    const pts = [];
    for (const c of s.centers) {
      if (!counts(c.name)) continue;
      const q = project(c.p, s.m, s.w, s.h);
      if (q && q[0] >= 0 && q[0] <= s.w && q[1] >= 0 && q[1] <= s.h) pts.push([c.name, q]);
    }
    let pairs = 0;
    let worst = Infinity;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i][1][0] - pts[j][1][0], pts[i][1][1] - pts[j][1][1]);
        if (d < worst) worst = d;
        if (d < PROXIMITY_PX) pairs++;
      }
    }
    console.log(
      `  ${vname.padEnd(24)} ${label} ${radius.toFixed(2).padStart(6)}   ${String(pts.length).padStart(9)}   ${String(pairs).padStart(16)}   ${(worst === Infinity ? 0 : worst).toFixed(1).padStart(9)} px`,
    );
  }
  console.log('');
}

await browser.close();
