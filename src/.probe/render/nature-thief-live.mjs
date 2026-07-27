/**
 * ROUND 5, FALSIFICATION 7 SHARPENED, THROUGH THE REAL GEOMETRY.
 *
 * `.probe/nature-offscreen-thief.mjs` showed that props whose CENTRES fall
 * outside the frame still enter `pickByProximity` and still win taps near the
 * canvas edge. That is true but not yet damning, because a prop whose centre is
 * 5 px past the left edge may have most of its mesh on screen -- and a tap that
 * lands on visible geometry is resolved by the RAYCAST, which is correct. The
 * proximity fallback only runs when the tap hits nothing.
 *
 * So the charge only bites where BOTH hold:
 *
 *   1. the prop's whole bounding sphere projects outside the canvas -- there is
 *      nothing on screen for the child to have been aiming at; and
 *   2. its centre is within PROXIMITY_PX of some point ON the canvas -- so it
 *      can still win the nearest-target contest for a tap the child does make.
 *
 * Such a prop is a hazard with no affordance: it takes taps aimed at whatever IS
 * visible near that edge, and answers with an animation off-screen. Under the
 * no-dead-tap rule the child hears a sound and sees nothing move.
 *
 * The bounding spheres come from the live scene graph (`__propBounds`), not from
 * an assumed per-family radius.
 */

import { chromium } from 'playwright';

const PAGE_URL = 'http://localhost:5199/.probe/render/nature.html';
const PROXIMITY_PX = 70;

const VIEWS = [
  ['landscape 1280x720', 1280, 720],
  ['iPad portrait 768x1024', 768, 1024],
  ['iPhone SE 375x667', 375, 667],
  ['iPhone 15 393x852', 393, 852],
  ['Pixel 8 412x915', 412, 915],
  ['extreme 360x900', 360, 900],
];

const FAMILIES = ['mushroom', 'flower', 'leaf', 'stone', 'snail', 'log', 'butterfly'];
const tappable = (n) => (n.startsWith('portal_') && n.endsWith('_root')) || FAMILIES.some((f) => n.startsWith(f));

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
  return { x: ((cx / cw) * 0.5 + 0.5) * w, y: (0.5 - (cy / cw) * 0.5) * h, w: cw };
};

console.log(`==== PROPS WITH NO PIXELS ON SCREEN THAT CAN STILL ANSWER A TAP\n`);
console.log("  screen radius is the bounding sphere projected at the prop's own depth.");
console.log('  A prop is listed only when its entire sphere is off-canvas.\n');
console.log('  viewport                 prop        centre px       screen r   overhang   within 70?');

let thieves = 0;
for (const [label, w, h] of VIEWS) {
  await page.setViewportSize({ width: w, height: h });
  await page.evaluate(() => window.__redraw());
  await page.waitForTimeout(80);
  const radius = 10 * Math.max(1, 0.75 / (w / h));
  const s = await page.evaluate((r) => {
    window.__setRadius(r);
    const canvas = document.getElementById('c');
    return { bounds: window.__propBounds(), m: window.__projView(), w: canvas.clientWidth, h: canvas.clientHeight };
  }, radius);

  const rows = [];
  for (const b of s.bounds) {
    if (!tappable(b.name)) continue;
    const c = project(b.c, s.m, s.w, s.h);
    if (!c) continue;
    // Project a point one radius to the camera's right at the same depth by
    // measuring the sphere's screen extent along x through a second projection.
    const edge = project([b.c[0] + b.r, b.c[1], b.c[2]], s.m, s.w, s.h);
    const edge2 = project([b.c[0], b.c[1] + b.r, b.c[2]], s.m, s.w, s.h);
    const rpx = Math.max(edge ? Math.hypot(edge.x - c.x, edge.y - c.y) : 0, edge2 ? Math.hypot(edge2.x - c.x, edge2.y - c.y) : 0);
    const dx = c.x < 0 ? -c.x : c.x > s.w ? c.x - s.w : 0;
    const dy = c.y < 0 ? -c.y : c.y > s.h ? c.y - s.h : 0;
    const overhang = Math.hypot(dx, dy);
    if (overhang <= rpx) continue; // some geometry is on screen: the raycast can serve it
    rows.push([b.name.replace(/_root$/, ''), c, rpx, overhang]);
  }
  rows.sort((a, b) => a[3] - b[3]);
  if (rows.length === 0) console.log(`  ${label.padEnd(24)} (nothing fully off-canvas)`);
  for (const [name, c, rpx, over] of rows) {
    const within = over < PROXIMITY_PX;
    if (within) thieves++;
    console.log(
      `  ${label.padEnd(24)} ${name.padEnd(11)} ${c.x.toFixed(0).padStart(6)},${c.y.toFixed(0).padStart(5)}   ${rpx.toFixed(1).padStart(7)}   ${over.toFixed(1).padStart(7)} px   ${within ? 'YES — takes taps it cannot show' : 'no'}`,
    );
  }
  console.log('');
}

console.log(
  thieves
    ? `  VERDICT: ${thieves} prop/viewport cases where a prop with zero pixels on screen sits inside the tap catchment.`
    : '  VERDICT: every prop inside the catchment has geometry on screen.',
);

await browser.close();
