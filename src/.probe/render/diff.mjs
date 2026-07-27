/**
 * Round 4, the differential render.
 *
 * HOW TO RUN IT (it needs two things this repo does not install)
 * -------------------------------------------------------------
 * Playwright is deliberately NOT a dependency: it is a ~150 MB browser download
 * in service of a probe, and `package.json` should not grow for that. So:
 *
 *   npx vite --port 5199 --strictPort &          # the harness page is served
 *   npm i --no-save playwright                   # note --no-save
 *   node .probe/render/diff.mjs
 *
 * The Chromium path in this file points at the preinstalled browser in the dev
 * container (`/opt/pw-browsers/chromium-1194/...`); elsewhere, drop the
 * `executablePath` and let Playwright find its own. Swiftshader is forced so it
 * renders identically with no GPU.
 *
 * WHY THIS EXISTS
 * ---------------
 * Three geometric proxies were built to answer one question -- "does a prop that
 * the frame edge cuts still READ as that prop?" -- and they gave three different
 * answers:
 *
 *   area fraction  condemned the ship's own side rails (44.4% of the aspect
 *                  range in-band) worse than the prop under test.
 *   spanFill       condemned the prop under test (worst 3.4%) far below the
 *                  rails (98.1%), and below the forbidden barrel's own mean.
 *   absolute size  said the prop's residue is 3.6-4.8% of the frame, four times
 *                  larger than any forbidden prop, i.e. the opposite ranking.
 *
 * All three are silhouette models. None of them has ever been checked against a
 * rendered pixel. So this stops modelling and measures: render the real frame
 * with the prop visible and again with it hidden, and count the pixels that
 * actually change. That is not a proxy for "is it on screen" -- it IS "is it on
 * screen", through the real renderer, at the real viewport, behind the real
 * depth buffer and the real sail.
 *
 * The controls are the same two the silhouette work used, so the numbers are
 * comparable: the ship's own side rails (accepted by everyone) and a barrel
 * staged out in the same place as the prop (forbidden by the rule).
 */

import { chromium } from 'playwright';

const PAGE_URL = 'http://localhost:5199/.probe/render/shot.html';

/** Every shipping viewport, plus the aspects the silhouette probes called worst. */
const VIEWS = [
  ['landscape 1280x720', 1280, 720],
  ['tablet 1024x768', 1024, 768],
  ['square 900x900', 900, 900],
  ['worst-smudge a1.155', 1040, 900],
  ['worst-smudge a0.979', 881, 900],
  ['iPad portrait 768x1024', 768, 1024],
  ['viewport 480x854', 480, 854],
  ['iPhone SE 375x667', 375, 667],
  ['iPhone 15 393x852', 393, 852],
  ['Pixel 8 412x915', 412, 915],
  ['extreme 360x900', 360, 900],
];

/** Named groups to toggle. `rail_stowage` is the fix; the rails are the precedent. */
const SUBJECTS = [
  ['rail_stowage', 'FIX: spare spars along both rails'],
  ['_starboard_side', 'ACCEPTED PRECEDENT: the ship own starboard rail'],
  ['ctrl_barrel', 'FORBIDDEN CONTROL: a barrel at the run centroid (3.6, -3.5)'],
];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

/**
 * Renders the frame twice and reports what changed, in pixels.
 *
 * `changed` is the count of pixels whose colour moved by more than a just-noticeable
 * amount; `frac` is that count over the whole frame; `box` is the changed region's
 * bounding box in frame fractions; `runs` counts how many separate horizontal
 * stretches of change there are on the median changed row -- a prop reads as one
 * object, dust reads as many.
 */
async function differential(page, name) {
  return page.evaluate((groupName) => {
    const canvas = document.getElementById('c');
    const w = canvas.width;
    const h = canvas.height;
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const ctx = off.getContext('2d', { willReadFrequently: true });
    const setVisible = window.__setVisible;

    const grab = (on) => {
      const hits = setVisible(groupName, on);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(canvas, 0, 0);
      return { data: ctx.getImageData(0, 0, w, h).data, hits };
    };

    const a = grab(true);
    const b = grab(false);
    setVisible(groupName, true);
    if (a.hits === 0) return { hits: 0 };

    let changed = 0;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    const rowCount = new Int32Array(h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const d = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
        if (d > 12) {
          changed++;
          rowCount[y]++;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (changed === 0) return { hits: a.hits, changed: 0 };

    // The median changed row, and how many separate stretches of change it holds.
    const rows = [];
    for (let y = 0; y < h; y++) if (rowCount[y] > 0) rows.push(y);
    const my = rows[Math.floor(rows.length / 2)];
    let runs = 0;
    let prev = false;
    for (let x = 0; x < w; x++) {
      const i = (my * w + x) * 4;
      const d = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
      const now = d > 12;
      if (now && !prev) runs++;
      prev = now;
    }

    return {
      hits: a.hits,
      changed,
      frac: changed / (w * h),
      box: { x0: x0 / w, x1: x1 / w, y0: y0 / h, y1: y1 / h },
      spanW: (x1 - x0 + 1) / w,
      spanH: (y1 - y0 + 1) / h,
      runs,
      w,
      h,
    };
  }, name);
}

const pct = (v) => (v * 100).toFixed(2) + '%';

// One page, resized. The camera handle takes a resize exactly as `SceneFrame`
// gives it one, so rebuilding the scene per viewport would only be slower, not
// more faithful.
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(PAGE_URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 30000 });

const table = new Map(SUBJECTS.map(([g]) => [g, []]));
for (const [vname, w, h] of VIEWS) {
  await page.setViewportSize({ width: w, height: h });
  await page.evaluate(() => window.__redraw?.());
  for (const [group] of SUBJECTS) {
    table.get(group).push([vname, w, h, await differential(page, group)]);
  }
}
await browser.close();

for (const [group, label] of SUBJECTS) {
  console.log(`\n==== ${label}   [${group}]`);
  console.log('  viewport                aspect   changed px   of frame   box w x h          runs');
  for (const [vname, w, h, r] of table.get(group)) {
    const head = `  ${vname.padEnd(22)} ${(w / h).toFixed(3)}`;
    if (!r.hits) console.log(`${head}   NO SUCH GROUP IN SCENE`);
    else if (!r.changed) console.log(`${head}            0     0.00%   -- nothing of it reaches the frame`);
    else
      console.log(
        `${head}   ${String(r.changed).padStart(10)}   ${pct(r.frac).padStart(7)}   ` + `${pct(r.spanW).padStart(7)} x ${pct(r.spanH).padStart(7)}   ${r.runs}`,
      );
  }
}
