/**
 * ROUND 5, FALSIFICATION 6. THE CROWDING COUNT TREATS EVERY PROP AS DISTINCT.
 * MOST OF THEM ARE NOT.
 *
 * WHAT THE PREVIOUS PROBE COUNTED
 * -------------------------------
 * `nature-crowding.mjs` counts a pair as confusable whenever two interactive
 * prop CENTRES project closer than PROXIMITY_PX. That is the right threshold and
 * the wrong population. It counts mushroom #2 against mushroom #3.
 *
 * Read `factory/props/interactive/mushrooms/interaction.ts`: every mushroom
 * registers the SAME handler -- squash-and-stretch bounce, emissive glow pulse,
 * `PARTICLES.sceneSparkle`. Nothing about the response identifies WHICH mushroom
 * was hit. A child who aims at one mushroom and lands on its neighbour gets a
 * mushroom that bounces and sparkles, which is exactly what they asked for. That
 * is not a broken promise; it is not even an error. The same holds within
 * flowers (sway + pollen), leaves (reveal a ladybug), stones (reveal a grub) and
 * butterflies (flutter).
 *
 * So the earlier table's 25 pairs at desktop and 45 at extreme portrait are
 * mostly intra-cluster pairs that a child cannot perceive as wrong, and the
 * charge as written overstates its case by counting them.
 *
 * WHAT THIS COUNTS INSTEAD
 * ------------------------
 * A pair is confusable only if the two props answer DIFFERENTLY. Classes are
 * taken from the interaction modules, one class per handler:
 *
 *   mushroom / flower / leaf / stone / snail / log / butterfly
 *
 * and each PORTAL is its own class, because the four portals do not share a
 * response at all -- `buildGamePortals` wires each to a different `gameId`, so
 * confusing two of them launches the wrong mini-game. That is the most expensive
 * confusion in the scene and the only one that leaves it.
 *
 * The owl is dropped from the population entirely. `wireFloorTap` registers it
 * as the GROUND fallback, so a tap that misses everything already answers as the
 * owl by design; measuring it as a point target that steals taps would be
 * measuring the intended behaviour and calling it a defect.
 *
 * Three numbers per row, so the shape of the problem is visible rather than
 * summarised: all cross-class pairs, the subset that involves a portal, and the
 * subset that is portal-against-portal.
 */

import { chromium } from 'playwright';

const PAGE_URL = 'http://localhost:5199/.probe/render/nature.html';
const PROXIMITY_PX = 70;

const VIEWS = [
  ['landscape 1280x720', 1280, 720],
  ['iPad portrait 768x1024', 768, 1024],
  ['iPhone SE 375x667', 375, 667],
  ['iPhone 15 393x852', 393, 852],
  ['extreme 360x900', 360, 900],
];

const FAMILIES = ['mushroom', 'flower', 'leaf', 'stone', 'snail', 'log', 'butterfly'];

/**
 * The response class of a scene root, or null if a child cannot tap it.
 *
 * Same class == same handler == indistinguishable answer. Portals are keyed by
 * their own name so each is its own class.
 */
const classOf = (name) => {
  if (name.startsWith('portal_') && name.endsWith('_root')) return name;
  const fam = FAMILIES.find((f) => name.startsWith(f));
  return fam ?? null;
};

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(PAGE_URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 40000 });

const project = (pos, m, w, h) => {
  const [x, y, z] = pos;
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
    return { centers: window.__propCenters(), w: canvas.clientWidth, h: canvas.clientHeight, m: window.__projView() };
  }, radius);

const isPortal = (c) => c.startsWith('portal_');

console.log(`==== CROSS-CLASS CROWDING AGAINST PROXIMITY_PX = ${PROXIMITY_PX}\n`);
console.log('  A pair counts only when the two props ANSWER DIFFERENTLY, so a near-miss');
console.log('  produces a response the child did not ask for. Same-family pairs are');
console.log('  excluded: they share one handler and are indistinguishable by design.\n');
console.log('  viewport                 radius   on screen   cross-class   any portal   portal/portal   worst');

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
      const cls = classOf(c.name);
      if (!cls) continue;
      const q = project(c.p, s.m, s.w, s.h);
      if (q && q[0] >= 0 && q[0] <= s.w && q[1] >= 0 && q[1] <= s.h) pts.push([cls, q]);
    }
    let cross = 0;
    let withPortal = 0;
    let portalPortal = 0;
    let worst = Infinity;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        if (pts[i][0] === pts[j][0]) continue;
        const d = Math.hypot(pts[i][1][0] - pts[j][1][0], pts[i][1][1] - pts[j][1][1]);
        if (d < worst) worst = d;
        if (d < PROXIMITY_PX) {
          cross++;
          if (isPortal(pts[i][0]) || isPortal(pts[j][0])) withPortal++;
          if (isPortal(pts[i][0]) && isPortal(pts[j][0])) portalPortal++;
        }
      }
    }
    console.log(
      `  ${vname.padEnd(24)} ${label} ${radius.toFixed(2).padStart(6)}   ${String(pts.length).padStart(9)}   ${String(cross).padStart(11)}   ${String(withPortal).padStart(10)}   ${String(portalPortal).padStart(13)}   ${(worst === Infinity ? 0 : worst).toFixed(1).padStart(6)} px`,
    );
  }
  console.log('');
}

console.log('==== THE PORTAL PAIRS THEMSELVES, AT EVERY SHIPPING VIEWPORT\n');
console.log('  Named, because "3 pairs" does not tell an author which two to move.\n');
for (const [vname, w, h] of VIEWS) {
  await page.setViewportSize({ width: w, height: h });
  await page.evaluate(() => window.__redraw());
  await page.waitForTimeout(80);
  const s = await snapshot(page, 10 * Math.max(1, 0.75 / (w / h)));
  const ports = [];
  for (const c of s.centers) {
    if (!(c.name.startsWith('portal_') && c.name.endsWith('_root'))) continue;
    const q = project(c.p, s.m, s.w, s.h);
    if (q) ports.push([c.name.replace(/^portal_|_root$/g, ''), q]);
  }
  const rows = [];
  for (let i = 0; i < ports.length; i++) {
    for (let j = i + 1; j < ports.length; j++) {
      rows.push([`${ports[i][0]} / ${ports[j][0]}`, Math.hypot(ports[i][1][0] - ports[j][1][0], ports[i][1][1] - ports[j][1][1])]);
    }
  }
  rows.sort((a, b) => a[1] - b[1]);
  console.log(`  ${vname}`);
  for (const [pair, d] of rows) {
    console.log(`    ${pair.padEnd(34)} ${d.toFixed(1).padStart(7)} px  ${d < PROXIMITY_PX ? 'CONFUSABLE' : ''}`);
  }
  console.log('');
}

await browser.close();
