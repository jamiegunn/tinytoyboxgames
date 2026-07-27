/**
 * ROUND 5, LOOKING AT IT.
 *
 * Every claim in this round so far is a number. "Four identical rings evenly
 * spaced at one depth is a flat game board" is not a number -- it is a claim
 * about what the scene LOOKS like, and it has been argued entirely from world
 * coordinates. That is the same species of mistake as measuring a camera the app
 * never adopts: reasoning about a rendered thing without rendering it.
 *
 * So this shoots the scene at three viewports and writes PNGs to be looked at.
 * Run it before a staging change and after.
 */

import { chromium } from 'playwright';

const PAGE_URL = 'http://localhost:5199/.probe/render/nature.html';
const tag = process.argv[2] ?? 'shot';
const VIEWS = [
  ['landscape', 1280, 720],
  ['iphone-se', 375, 667],
  ['extreme', 360, 900],
];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(PAGE_URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 40000 });

for (const [name, w, h] of VIEWS) {
  await page.setViewportSize({ width: w, height: h });
  await page.evaluate(() => window.__redraw());
  await page.waitForTimeout(250);
  await page.evaluate((r) => window.__setRadius(r), 10 * Math.max(1, 0.75 / (w / h)));
  await page.waitForTimeout(150);
  const path = `.probe/out/${tag}-${name}.png`;
  await page.locator('#c').screenshot({ path });
  console.log(`  wrote ${path}`);
}
await browser.close();
