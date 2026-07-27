/**
 * ROUND 5, FALSIFICATION 10 AND 11 -- THE ROUND HAS BEEN MEASURING THE WRONG
 * THING SINCE ITERATION 1, AND THE THING IT SHOULD HAVE MEASURED IS WORSE.
 *
 * Every solver in this round (v2 through v5) optimised ONE quantity: the
 * screen-space distance between prop CENTRES, against `PROXIMITY_PX`, on the
 * belief that two targets closer than 70 px are confusable. That belief has two
 * loadbearing assumptions, and reading `interactionController.ts` killed both.
 *
 *   1. `onPointerUp` RAYCASTS FIRST. `pickRegistered` returns on any hit and
 *      `fire()` runs immediately; `pickByProximity` is reached only under the
 *      comment "Missed every mesh". So centre distance never arbitrates a tap
 *      that lands on geometry -- the mesh under the finger wins, always, which
 *      is the correct answer. Pairwise centre separation is not the rule.
 *   2. What IS registered is not what the round assumed. `createTapInteraction`
 *      registers a single MESH -- `mushroom.tapTarget` is the cap, not the
 *      mushroom; `flower.tapTarget` is the 0.12-unit centre, not the flower.
 *      And `wireFloorTap` registers THE GROUND: one 28 x 32 plane, tappable,
 *      that flies the owl to the tapped point.
 *
 * That last one is the whole round in one line. The ground is a registered
 * target spanning the entire forest floor, so a tap aimed at a mushroom and
 * landing one finger-width off does not "miss every mesh" -- it HITS THE
 * GROUND. `pickRegistered` returns the floor, `fire()` runs, the owl flies, and
 * the proximity fallback that exists precisely to forgive that tap is never
 * consulted. The small-target forgiveness rule that `gestureRules.ts` documents
 * as a core child-UX guarantee is, in this scene, unreachable except on sky.
 *
 * So this probe stops measuring distances between centres and measures the only
 * thing that decides whether a child gets what they reached for:
 *
 *   FOR EVERY REGISTERED TARGET, AT EVERY SHIPPING VIEWPORT, HOW MUCH OF THE
 *   SCREEN ACTUALLY FIRES IT -- and what fires instead.
 *
 * HOW
 * ---
 * `__dispatchMap` in the harness re-runs `onPointerUp`'s decision at a grid of
 * screen samples, using the registry taken out of the live controller (see the
 * comment on `captureRegistry`) and the same two steps in the same order. Two
 * grids come back: `hit` (whose mesh is under this pixel) and `fire` (what a tap
 * here would trigger). Everything below is arithmetic on those two grids -- no
 * model of the scene, no assumed radii, no assumed registry.
 *
 * THE AIM MODEL, AND WHY IT IS THE APP'S OWN
 * ------------------------------------------
 * "Did the child get it" needs a claim about how far off a child's tap lands.
 * Rather than invent one, this uses the number the codebase already commits to:
 * `PROXIMITY_PX = 70` is the app's written belief that a tap within 70 px of a
 * small target's projection was MEANT for it. A second column at 24 px models a
 * much steadier hand (a fingertip contact patch is about 38 CSS px across) so
 * that no conclusion here depends on the generous figure.
 */

import { chromium } from 'playwright';

const PAGE_URL = 'http://localhost:5199/.probe/render/nature.html';
const PROXIMITY_PX = 70;
const STEADY_PX = 24;
const STEP = Number(process.env.STEP ?? 3);

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

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(PAGE_URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 40000 });

/**
 * Per-group analysis of one dispatch map.
 *
 * A group counts as environment-scale when every entry in it carries the
 * controller's `background` flag, read off the scene graph rather than guessed
 * from the label. Those rows are reported apart from the props, because the
 * question "how often does reaching for a thing get the thing" is not asked of
 * the ground.
 *
 * @param m - The map returned by `__dispatchMap`.
 * @returns Rows keyed by group, plus canvas-wide totals.
 */
function analyse(m) {
  const G = m.labels.length;
  const bgGroup = new Array(G).fill(true);
  const anyGroup = new Array(G).fill(false);
  m.group.forEach((g, n) => {
    anyGroup[g] = true;
    if (!m.background[n]) bgGroup[g] = false;
  });
  const isFloor = (g) => anyGroup[g] && bgGroup[g];
  const sil = new Array(G).fill(0);
  const catchment = new Array(G).fill(0);
  const silX = new Array(G).fill(0);
  const silY = new Array(G).fill(0);
  let missed = 0;
  let dead = 0;
  for (let j = 0; j < m.rows; j++) {
    for (let i = 0; i < m.cols; i++) {
      const k = j * m.cols + i;
      const x = i * m.step + m.step / 2;
      const y = j * m.step + m.step / 2;
      const h = m.hit[k];
      const f = m.fire[k];
      if (h < 0) missed++;
      if (f < 0) dead++;
      if (h >= 0) {
        const g = m.group[h];
        sil[g]++;
        silX[g] += x;
        silY[g] += y;
      }
      if (f >= 0) catchment[m.group[f]]++;
    }
  }
  const area = m.step * m.step;
  /** Fraction of a disc of radius r about (ax, ay) that fires group g. */
  const reach = (g, ax, ay, r) => {
    let inDisc = 0;
    let won = 0;
    const i0 = Math.max(0, Math.floor((ax - r) / m.step));
    const i1 = Math.min(m.cols - 1, Math.ceil((ax + r) / m.step));
    const j0 = Math.max(0, Math.floor((ay - r) / m.step));
    const j1 = Math.min(m.rows - 1, Math.ceil((ay + r) / m.step));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const x = i * m.step + m.step / 2;
        const y = j * m.step + m.step / 2;
        if (Math.hypot(x - ax, y - ay) > r) continue;
        inDisc++;
        const f = m.fire[j * m.cols + i];
        if (f >= 0 && m.group[f] === g) won++;
      }
    return inDisc === 0 ? null : won / inDisc;
  };
  const rows = m.labels.map((label, g) => {
    const aim = sil[g] > 0 ? { x: silX[g] / sil[g], y: silY[g] / sil[g] } : m.rootCentres[g];
    return {
      label,
      floor: isFloor(g),
      silPx: sil[g] * area,
      catchPx: catchment[g] * area,
      aim,
      p70: aim ? reach(g, aim.x, aim.y, PROXIMITY_PX) : null,
      p24: aim ? reach(g, aim.x, aim.y, STEADY_PX) : null,
    };
  });
  return { rows, missedPct: (100 * missed) / (m.cols * m.rows), deadPct: (100 * dead) / (m.cols * m.rows), total: m.cols * m.rows * area };
}

console.log('==== WHAT ACTUALLY FIRES WHEN A CHILD REACHES FOR A PROP\n');
console.log(`  Sampled every ${STEP} px. "silhouette" is the registered mesh's own pixels --`);
console.log('  the only place a tap is resolved by the raycast. "catchment" is every pixel');
console.log('  that fires the prop by any path. p(hit) is the fraction of a tap-error disc');
console.log('  centred on the prop that fires the prop rather than something else.\n');

const perView = [];
for (const [label, w, h] of VIEWS) {
  await page.setViewportSize({ width: w, height: h });
  await page.evaluate(() => window.__redraw());
  await page.waitForTimeout(60);
  const m = await page.evaluate(([step, r]) => window.__dispatchMap(step, r), [STEP, PROXIMITY_PX]);
  const a = analyse(m);
  perView.push([label, a]);

  const props = a.rows.filter((r) => !r.floor);
  const floors = a.rows.filter((r) => r.floor);
  console.log(`  ---- ${label} ----`);
  console.log(`  registered groups: ${a.rows.length}   canvas ${w}x${h}`);
  console.log(`  taps that miss EVERY registered mesh (i.e. reach the proximity fallback): ${a.missedPct.toFixed(2)}%`);
  console.log(`  taps that fire nothing at all: ${a.deadPct.toFixed(2)}%`);
  for (const f of floors) console.log(`  background surface ${f.label}: catchment ${((100 * f.catchPx) / a.total).toFixed(1)}% of the canvas`);
  console.log('');
  console.log('    prop                silhouette   equiv-d   catchment   p(hit)@70   p(hit)@24');
  for (const r of props.sort((x, y) => (x.p24 ?? -1) - (y.p24 ?? -1))) {
    const d = 2 * Math.sqrt(r.silPx / Math.PI);
    console.log(
      `    ${r.label.padEnd(20)} ${r.silPx.toFixed(0).padStart(7)} px^2 ${d.toFixed(1).padStart(7)} px ${r.catchPx.toFixed(0).padStart(8)} px^2 ${
        r.p70 === null ? '     --' : (100 * r.p70).toFixed(1).padStart(8) + '%'
      } ${r.p24 === null ? '     --' : (100 * r.p24).toFixed(1).padStart(8) + '%'}`,
    );
  }
  console.log('');
}

console.log('==== SUMMARY: HOW OFTEN DOES REACHING FOR A THING GET THE THING?\n');
console.log('  viewport                 props   invisible   p(hit)@24 below 50%   median p@24   worst');
for (const [label, a] of perView) {
  const props = a.rows.filter((r) => !r.floor);
  const invisible = props.filter((r) => r.silPx === 0).length;
  const ps = props.map((r) => r.p24 ?? 0).sort((x, y) => x - y);
  const median = ps[Math.floor(ps.length / 2)];
  const bad = ps.filter((p) => p < 0.5).length;
  console.log(
    `  ${label.padEnd(24)} ${String(props.length).padStart(5)} ${String(invisible).padStart(11)} ${String(bad).padStart(20)} ${(100 * median).toFixed(1).padStart(12)}% ${(100 * ps[0]).toFixed(1).padStart(7)}%`,
  );
}

await browser.close();
