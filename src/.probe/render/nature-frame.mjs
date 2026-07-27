/**
 * ROUND 5, THE POPULATION BEHIND THE COUNTS.
 *
 * `nature-classes.mjs` reports "10 props on screen at the authored radius, 24
 * with the pull-back". A count cannot be acted on: it does not say WHICH
 * fourteen props the pull-back is dragging into frame, and therefore does not
 * say whether switching the rule off would lose something a child needs or
 * something the scene is better without.
 *
 * This prints the membership. Every interactive root, at both radii, at every
 * shipping viewport, marked in-frame or out. Portals are called out separately
 * because they are the only props whose loss is unrecoverable -- a child who
 * cannot see the star-catcher portal cannot reach star-catcher at all, whereas a
 * child who cannot see the third mushroom has four others.
 */

import { chromium } from 'playwright';

const PAGE_URL = 'http://localhost:5199/.probe/render/nature.html';

const VIEWS = [
  ['landscape 1280x720', 1280, 720],
  ['iPad portrait 768x1024', 768, 1024],
  ['iPhone SE 375x667', 375, 667],
  ['iPhone 15 393x852', 393, 852],
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

const inFrame = (q, w, h) => q && q[0] >= 0 && q[0] <= w && q[1] >= 0 && q[1] <= h;

for (const [vname, w, h] of VIEWS) {
  await page.setViewportSize({ width: w, height: h });
  await page.evaluate(() => window.__redraw());
  await page.waitForTimeout(80);
  const pull = 10 * Math.max(1, 0.75 / (w / h));
  const a = await snapshot(page, pull);
  const b = await snapshot(page, 10);
  const names = a.centers.filter((c) => tappable(c.name)).map((c) => c.name);

  const lost = [];
  const kept = [];
  for (const n of names) {
    const ca = a.centers.find((c) => c.name === n);
    const cb = b.centers.find((c) => c.name === n);
    const ina = inFrame(project(ca.p, a.m, a.w, a.h), a.w, a.h);
    const inb = inFrame(project(cb.p, b.m, b.w, b.h), b.w, b.h);
    if (ina && !inb) lost.push(n);
    else if (inb) kept.push(n);
  }
  console.log(`\n  ${vname}   pull-back radius ${pull.toFixed(2)}`);
  console.log(`    in frame at BOTH radii (${kept.length}): ${kept.map((n) => n.replace(/_root$/, '')).join(', ') || 'none'}`);
  console.log(`    LOST if the pull-back is removed (${lost.length}): ${lost.map((n) => n.replace(/_root$/, '')).join(', ') || 'none'}`);
  const lostPortals = lost.filter((n) => n.startsWith('portal_'));
  console.log(`    of which portals: ${lostPortals.length ? lostPortals.join(', ') : 'NONE — every portal survives'}`);
}

await browser.close();
