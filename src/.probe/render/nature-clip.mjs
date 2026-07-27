/**
 * ROUND 5, THE COUNTER-TEST. BEFORE REMOVING THE PULL-BACK, MEASURE WHAT IT IS
 * BUYING.
 *
 * The rest of this round has built a one-sided case: the pull-back drives every
 * tappable prop under the 44 CSS px touch floor, and both scenes look worse for
 * it. A one-sided case is not a decision. The rule exists for a reason -- a
 * narrower viewport shows less world WIDTH at a fixed vertical fov, so content
 * staged out to the sides falls off the edge -- and if switching it off pushes
 * tappable props out of frame, the fix has traded a small target for no target,
 * which soul.md calls a broken promise and is strictly worse.
 *
 * So this measures both sides of that trade in the same units, on the same
 * frames, through the same renderer:
 *
 *   size    the prop's footprint on glass, in CSS px, against the 44 floor.
 *   reach   whether the prop's painted pixels touch the frame edge, which is
 *           the rendered form of "part of it is off-screen". A prop whose
 *           silhouette runs into the boundary is being cut; a prop with no
 *           painted pixels at all has left entirely.
 *
 * A fix is only allowed to claim it works if it improves SIZE without
 * regressing REACH. Both columns are printed for every prop and every shipping
 * viewport so the trade is visible rather than argued.
 */

import { chromium } from 'playwright';

const PAGE_URL = 'http://localhost:5199/.probe/render/nature.html';
const FLOOR = 44;

const VIEWS = [
  ['landscape 1280x720', 1280, 720],
  ['iPad portrait 768x1024', 768, 1024],
  ['iPhone SE 375x667', 375, 667],
  ['iPhone 15 393x852', 393, 852],
  ['extreme 360x900', 360, 900],
];

/**
 * Nature's tappable props, by the substring naming their subtree. Taken from
 * `factory/props/interactive/`, which is the directory that defines what a
 * child can tap -- not from a hand-picked list of the ones I expect to fail.
 */
const TAPPABLES = ['mushroom', 'flower', 'butterfly', 'leaf', 'stone', 'snail', 'log'];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(PAGE_URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 40000 });

const probe = (p, key, radius) =>
  p.evaluate(
    ([key, radius]) => {
      const canvas = document.getElementById('c');
      const w = canvas.width;
      const h = canvas.height;
      const toCss = canvas.clientWidth / w;
      const off = document.createElement('canvas');
      off.width = w;
      off.height = h;
      const ctx = off.getContext('2d', { willReadFrequently: true });
      const grab = () => {
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(canvas, 0, 0);
        return ctx.getImageData(0, 0, w, h).data;
      };
      window.__setRadius(radius);
      const on = grab();
      const hits = window.__setVisible(key, false);
      window.__setRadius(radius);
      const offData = grab();
      window.__setVisible(key, true);
      window.__setRadius(radius);
      if (hits === 0) return { hits: 0 };
      let changed = 0;
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      let edge = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const d = Math.abs(on[i] - offData[i]) + Math.abs(on[i + 1] - offData[i + 1]) + Math.abs(on[i + 2] - offData[i + 2]);
          if (d > 12) {
            changed++;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
            if (x <= 1 || x >= w - 2 || y <= 1 || y >= h - 2) edge++;
          }
        }
      }
      if (changed === 0) return { hits, changed: 0 };
      return {
        hits,
        changed,
        boxMin: Math.min(x1 - x0 + 1, y1 - y0 + 1) * toCss,
        side: Math.sqrt(changed) * toCss,
        edge,
      };
    },
    [key, radius],
  );

const cell = (r) => {
  if (!r.hits) return '   (no such prop)      ';
  if (!r.changed) return '   GONE FROM FRAME     ';
  const small = Math.min(r.boxMin, r.side) < FLOOR;
  const cut = r.edge > 0;
  return `${r.boxMin.toFixed(0).padStart(4)} / ${r.side.toFixed(0).padStart(4)} px  ${small ? 'SMALL' : '     '} ${cut ? 'CUT' : '   '}`;
};

console.log('==== NATURE: THE TRADE THE PULL-BACK MAKES, PER TAPPABLE PROP\n');
console.log('  Each cell is  box-min / equal-area side  in CSS px, then two flags:');
console.log(`  SMALL = under the ${FLOOR} px touch floor. CUT = painted pixels touch the frame edge.\n`);
console.log('  A fix must remove SMALL without introducing CUT.\n');

for (const [vname, w, h] of VIEWS) {
  await page.setViewportSize({ width: w, height: h });
  await page.evaluate(() => window.__redraw());
  await page.waitForTimeout(80);
  // The radius the app actually reaches when OPENED in this shape, not one
  // carried over from the previous viewport -- `resize` does not re-apply the
  // pull-back, so reading it after a resize would measure the resize bug
  // instead of the rule.
  const shipped = 10 * Math.max(1, 0.75 / (w / h));
  console.log(`\n  ${vname}   pull-back radius ${shipped.toFixed(2)}  vs authored 10.00`);
  console.log('    prop         with pull-back (ships)        without pull-back');
  for (const key of TAPPABLES) {
    const a = await probe(page, key, shipped);
    const b = await probe(page, key, 10);
    console.log(`    ${key.padEnd(11)}  ${cell(a)}   ${cell(b)}`);
  }
}

await browser.close();
