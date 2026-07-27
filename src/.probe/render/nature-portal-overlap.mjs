/**
 * ROUND 5, FALSIFICATION 8 -- AGAINST MY OWN FIX.
 *
 * The restage was solved against ONE criterion: the distance between two
 * portals' registered tap targets in screen pixels, held above the app's own
 * `PROXIMITY_PX` catchment. That criterion is necessary and it is now met (72.7
 * px worst pair, live). The `after` renders say it is nowhere near sufficient.
 *
 * A portal is a disc of world radius 0.7 (`gamePortal.ts`: pedestal cylinder,
 * diameter 1.4). The solved inner pair sits at x = +-0.6, i.e. 1.2 units apart --
 * LESS than the 1.4 units their two pedestals occupy. The discs interpenetrate.
 * Every adjacent pair does. Screen-centre distance cannot see this, because it
 * measures centres and the props have width.
 *
 * Why that matters, and why it is not merely cosmetic:
 *
 *   - A child aims at what they can SEE. Two discs fused into one silhouette
 *     offer no visible boundary to aim either side of, so the separation the
 *     pixel measurement proves is separation the child cannot use.
 *   - In the overlap band the tap is decided by the RAYCAST -- whichever
 *     triangle happens to be nearer the camera -- so the outcome there is a
 *     draw-order accident, not an intent. This is the tier-1 unrecoverable
 *     confusion (wrong mini-game) reintroduced by the fix that was supposed to
 *     remove it.
 *   - `vision.md` asks for "soft cinematic framing rather than a flat game
 *     board". Four interpenetrating discs in a row across the near foreground is
 *     the flat game board, drawn from life.
 *
 * So this measures what the centre metric cannot: the horizontal screen GAP
 * between adjacent pedestal silhouettes. The disc is horizontal and the camera
 * sits ~21 degrees above it, so its projection is an ellipse squashed vertically;
 * the portals are separated mainly across the screen, so the horizontal
 * semi-axis is the extent that decides whether grass is visible between them.
 * It is measured by projecting the disc's own rim points along the camera's
 * screen-right axis, not by scaling a radius by depth.
 *
 *   gap = |xA - xB| - (halfWidthA + halfWidthB)
 *
 * gap < 0 means the silhouettes merge. Reported for both the shipped layout and
 * whatever is currently in `environment.ts`, via git, so the fix is scored
 * against the thing it replaced rather than against nothing.
 */

import { chromium } from 'playwright';

const PAGE_URL = 'http://localhost:5199/.probe/render/nature.html';
const PEDESTAL_R = 0.7;
const PEDESTAL_Y = 0.06;

const VIEWS = [
  ['landscape 1280x720', 1280, 720],
  ['iPad portrait 768x1024', 768, 1024],
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

const project = (p, m, w, h) => {
  const [x, y, z] = p;
  const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
  const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
  const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (cw <= 0) return null;
  return { x: ((cx / cw) * 0.5 + 0.5) * w, y: (0.5 - (cy / cw) * 0.5) * h };
};

const RIM = 24;
/** The pedestal is a short cylinder, so its outline is the two end discs. */
const rimPoints = (cx, cz) => {
  const pts = [];
  for (let i = 0; i < RIM; i++) {
    const a = (i / RIM) * Math.PI * 2;
    const x = cx + PEDESTAL_R * Math.cos(a);
    const z = cz + PEDESTAL_R * Math.sin(a);
    pts.push([x, 0, z], [x, PEDESTAL_Y * 2, z]);
  }
  return pts;
};

console.log(`==== PORTAL SILHOUETTES: DO ANY OF THEM MERGE ON SCREEN?\n`);
console.log(`  pedestal: cylinder of diameter 1.4, height 0.12 (gamePortal.ts)`);
console.log(`  Each disc's outline is projected point by point, and the pair is measured`);
console.log(`  along the screen axis joining their centres -- the separating axis. A first`);
console.log(`  version took horizontal half-widths only, which is the right axis for a row`);
console.log(`  and the wrong one for two portals stacked by depth, where the merge is`);
console.log(`  vertical. Every pair is measured, not just screen-adjacent ones.\n`);
console.log(`  gap < 0  =>  the two discs are one silhouette; no grass between them.\n`);

let worst = { gap: Infinity };

for (const [label, w, h] of VIEWS) {
  await page.setViewportSize({ width: w, height: h });
  await page.evaluate(() => window.__redraw());
  await page.waitForTimeout(120);

  // Measured at the PULL-BACK radius, the way `nature-classes.mjs` and
  // `nature-shots.mjs` do, because that is the camera the app adopts on mount
  // for this aspect. Reading the page's own post-`resize()` camera instead gave
  // radius 10 everywhere and inflated every silhouette by more than half --
  // which is charge 1 (`resize()` never re-applies the pull-back) showing up as
  // a measurement error in a probe about something else.
  const { m, right, centres } = await page.evaluate(
    (r) => {
      window.__setRadius(r);
      return {
        m: window.__projView(),
        right: window.__cameraRight(),
        centres: window.__propCenters().filter((p) => p.name.startsWith('portal_')),
      };
    },
    10 * Math.max(1, 0.75 / (w / h)),
  );

  void right;

  const rows = centres.map(({ name, p }) => ({
    name: name.replace(/^portal_|_root$/g, ''),
    c: project([p[0], PEDESTAL_Y, p[2]], m, w, h),
    rim: rimPoints(p[0], p[2]).map((q) => project(q, m, w, h)),
  }));

  const pairs = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      const dx = b.c.x - a.c.x;
      const dy = b.c.y - a.c.y;
      const len = Math.hypot(dx, dy);
      const ux = dx / len;
      const uy = dy / len;
      const proj = (pt) => pt.x * ux + pt.y * uy;
      const aHi = Math.max(...a.rim.map(proj));
      const bLo = Math.min(...b.rim.map(proj));
      const gap = bLo - aHi;
      pairs.push({ name: `${a.name} / ${b.name}`, sep: len, gap });
    }
  }
  pairs.sort((x, y) => x.gap - y.gap);

  console.log(`  ${label}`);
  for (const p of pairs) {
    if (p.gap < worst.gap) worst = { gap: p.gap, label, pair: p.name };
    console.log(`    ${p.name.padEnd(30)} centres ${p.sep.toFixed(1).padStart(6)} px   gap ${p.gap.toFixed(1).padStart(7)} px  ${p.gap < 0 ? 'MERGED' : 'ok'}`);
  }
  console.log('');
}

console.log(`  WORST adjacent gap: ${worst.gap.toFixed(1)} px  (${worst.pair} @ ${worst.label})`);
console.log(
  worst.gap < 0
    ? `  VERDICT: the portals fuse. Centre separation was proved; usable separation was not.`
    : `  VERDICT: every adjacent pair shows daylight between it at every viewport.`,
);

await browser.close();
