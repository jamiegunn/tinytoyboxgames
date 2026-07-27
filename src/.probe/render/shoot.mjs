/**
 * Round 4, the visual check.
 *
 * Three geometric proxies for "does a clipped prop read" disagreed with each
 * other: the area metric condemned the ship's own rails (44.4% of the aspect
 * range in-band, worse than the fix), `spanFill` condemned the fix (worst 3.4%
 * against the rail's 98.1%), and the absolute-size metric said the fix's residue
 * is four times larger on screen than any forbidden prop. A proxy that is never
 * checked against the thing it proxies is not evidence. So: render the REAL
 * scene through the REAL renderer at the REAL shipping viewports and look.
 *
 * Shots go to `.probe/render/out/`. Nothing here is part of the build.
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const PAGE_URL = 'http://localhost:5199/.probe/render/shot.html';
const OUT = new global.URL('./out/', import.meta.url).pathname;

/** The nine shipping viewports, plus the three aspects the probes flagged worst. */
const SHOTS = [
  ['01-landscape-1280x720', 1280, 720],
  ['02-tablet-1024x768', 1024, 768],
  ['03-square-900x900', 900, 900],
  ['04-ipad-portrait-768x1024', 768, 1024],
  ['05-viewport-480x854', 480, 854],
  ['06-iphone-se-375x667', 375, 667],
  ['07-iphone15-393x852', 393, 852],
  ['08-pixel8-412x915', 412, 915],
  ['09-extreme-360x900', 360, 900],
  // Worst-case aspects found by `.probe/pc-stowage-sliver.mjs` / `pc-smudge-size.mjs`.
  ['10-worst-spanfill-a0.562', 506, 900],
  ['11-worst-smudge-a0.979', 881, 900],
  ['12-worst-smudge-a1.155', 1040, 900],
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

const failures = [];
for (const [name, w, h] of SHOTS) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(PAGE_URL, { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 20000 });
  } catch {
    failures.push(`${name}: never became ready. ${errors.join(' | ')}`);
    await page.close();
    continue;
  }
  // One more draw after layout has settled, then let the GPU flush.
  await page.evaluate(() => window.__redraw?.());
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}${name}.png` });
  if (errors.length) failures.push(`${name}: ${errors.slice(0, 3).join(' | ')}`);
  await page.close();
  console.log(`shot ${name}  ${w}x${h}  aspect ${(w / h).toFixed(3)}`);
}

await browser.close();
if (failures.length) {
  console.log('\nPAGE PROBLEMS');
  for (const f of failures) console.log('  ' + f);
}
