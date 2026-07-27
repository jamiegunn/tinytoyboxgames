/**
 * ROUND 5, the rendered comparison: what portrait looks like with the pull-back
 * clamped away (what ships) against what it would look like if Pirate Cove let
 * the rule run, the way every other scene in the catalog does.
 *
 * Run it the same way as `diff.mjs` -- see that file's header for the vite +
 * playwright preamble.
 *
 * Output: `.probe/render/out/pullback-<device>-{shipped,ruled}.png`, plus the
 * share of the frame that is SHIP rather than sea and sky, measured by counting
 * pixels that change when the whole ship is hidden.
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const PAGE_URL = 'http://localhost:5199/.probe/render/shot.html';
const OUT = new global.URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

// device, w, h, radius the pull-back rule asks for at that aspect
// (12 * max(1, 0.75 / aspect)), against the shipped pin of 12.
const CASES = [
  ['iphone15', 393, 852, 19.511],
  ['pixel8', 412, 915, 19.996],
  ['iphone-se', 375, 667, 16.008],
  ['extreme', 360, 900, 22.5],
  ['ipad-portrait', 768, 1024, 12.0],
];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
await page.goto(PAGE_URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 30000 });

/**
 * Share of the frame painted by everything under the scene root, measured by
 * hiding the ship and diffing -- the same differential the Round 4 decision
 * rested on, so the two rounds are measured the same way.
 */
const shipShare = async (p, radius) =>
  p.evaluate(async (r) => {
    const canvas = document.getElementById('c');
    const grab = () => {
      const c = document.createElement('canvas');
      c.width = canvas.width;
      c.height = canvas.height;
      c.getContext('2d').drawImage(canvas, 0, 0);
      return c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    };
    window.__setRadius(r);
    const on = grab();
    // Hide the hull, rig and every prop; what is left is sea and sky.
    const hidden = [];
    for (const name of ['hull', 'mast', 'sail', 'rail', 'deck', 'cannon', 'wheel', 'chest', 'barrel', 'rope', 'anchor', 'parrot', 'spar', 'stowage']) {
      window.__setVisible(name, false);
      hidden.push(name);
    }
    window.__setRadius(r);
    const off = grab();
    for (const name of hidden) window.__setVisible(name, true);
    window.__setRadius(r);
    let changed = 0;
    for (let i = 0; i < on.length; i += 4) {
      const d = Math.abs(on[i] - off[i]) + Math.abs(on[i + 1] - off[i + 1]) + Math.abs(on[i + 2] - off[i + 2]);
      if (d > 12) changed++;
    }
    return { frac: changed / (on.length / 4), w: canvas.width, h: canvas.height };
  }, radius);

console.log('==== SHIP AS A SHARE OF THE FRAME: shipped pin vs the pull-back rule\n');
console.log('  device          aspect   shipped r=12   with rule        rule radius');

for (const [name, w, h, ruled] of CASES) {
  await page.setViewportSize({ width: w, height: h });
  await page.evaluate(() => window.__redraw());
  await page.waitForTimeout(60);

  const shipped = await shipShare(page, null);
  await page.evaluate(() => window.__setRadius(null));
  await page.screenshot({ path: `${OUT}pullback-${name}-shipped.png` });

  const withRule = await shipShare(page, ruled);
  await page.evaluate((r) => window.__setRadius(r), ruled);
  await page.screenshot({ path: `${OUT}pullback-${name}-ruled.png` });

  console.log(
    `  ${name.padEnd(14)} ${(w / h).toFixed(3)}   ${(shipped.frac * 100).toFixed(2).padStart(9)}%   ${(withRule.frac * 100).toFixed(2).padStart(9)}%   ${ruled.toFixed(2).padStart(9)}`,
  );
}

await browser.close();
