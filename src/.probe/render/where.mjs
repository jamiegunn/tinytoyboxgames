/**
 * Writes, for a few viewports, the frame with the rail stowage and the frame
 * without it, so the difference can be located and looked at rather than
 * summarised. Output: `.probe/render/out/where-<name>-{on,off}.png`.
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const PAGE_URL = 'http://localhost:5199/.probe/render/shot.html';
const OUT = new global.URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const VIEWS = [
  ['landscape', 1280, 720],
  ['ipad-portrait', 768, 1024],
  ['viewport480', 480, 854],
];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(PAGE_URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 30000 });

for (const [name, w, h] of VIEWS) {
  await page.setViewportSize({ width: w, height: h });
  for (const on of [true, false]) {
    await page.evaluate((v) => window.__setVisible('rail_stowage', v), on);
    await page.waitForTimeout(80);
    await page.screenshot({ path: `${OUT}where-${name}-${on ? 'on' : 'off'}.png` });
  }
  console.log(`${name} ${w}x${h}`);
}
await browser.close();
