/**
 * ROUND 6, CHARGE 1 IN PIXELS: WHAT DOES A CHILD ACTUALLY SEE?
 *
 * `frame-census.mjs` projects each registered target's bounding sphere and asks
 * whether it lands in the viewport. It reported Nature at 31-40 of 40 targets
 * FRAMED at every shipping viewport and Pirate Cove at 5 of 5 everywhere, which
 * -- if believed -- retires this round's opening charge before it is written.
 *
 * It must not be believed on its own. A projection knows nothing about
 * OCCLUSION. A mushroom standing behind the treeline projects into the frame at
 * a healthy 40px and contributes not one pixel to the image. Round 5 left behind
 * a claim that 27 of 44 Nature props show zero silhouette at 360x900, which is
 * flatly incompatible with the census, and exactly one of the two can be right.
 *
 * This settles it by rendering. For each viewport: read the frame, hide ONE
 * registered prop, read it again, and count the pixels that changed. That count
 * is the prop's silhouette -- what it contributes to the image after every
 * occluder, every material and every fog fade has had its say. A prop that
 * changes zero pixels is not visible, whatever its geometry says.
 *
 * WHY ONE PROP AT A TIME AND NOT ALL-ON VS ALL-OFF. Hiding everything at once
 * gives the union of the silhouettes, which cannot be attributed to props and
 * cannot distinguish "twelve props each showing a sliver" from "one prop showing
 * a lot". Round 4 retracted a whole solver built on exactly that conflation.
 *
 * BAND OCCUPANCY, the second observable. The union mask is accumulated and
 * reported as a profile down the frame in twentieths. This is what answers "the
 * bottom third of the portrait frame is empty grass" -- a claim made twice in
 * this review without ever being measured. A band holding no prop pixels is a
 * band where a child's tap can only produce the acknowledgement Round 5 added,
 * never a discovery.
 *
 * METHOD NOTE. Pixels are read in-page through a 2D canvas, the same way
 * `.probe/render/diff.mjs` has done since Round 4, and with that probe's own
 * `sum of channel deltas > 12` threshold rather than a new one -- a round that
 * changes the instrument and the subject at once can attribute nothing.
 *
 * WHAT THIS DOES NOT PROVE. A changed pixel is not a LEGIBLE pixel: a prop whose
 * silhouette is 30 scattered pixels behind a leaf scores 30 and reads as
 * nothing. Silhouette is an upper bound on legibility too -- but a far tighter
 * one than projection, and unlike projection it can return zero, which is the
 * value the charge turns on.
 *
 * The scene is never tapped and no handler runs, so nothing moves between the
 * two reads of a pair except the prop being toggled.
 */

import { chromium } from 'playwright';

const SCENES = [
  ['NATURE', 'http://localhost:5199/.probe/render/nature.html'],
  ['PIRATE COVE', 'http://localhost:5199/.probe/render/shot.html'],
];

const VIEWS = [
  ['landscape 1280x720', 1280, 720],
  ['iPad portrait 768x1024', 768, 1024],
  ['iPhone 15 393x852', 393, 852],
  ['extreme 360x900', 360, 900],
];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

console.log('==== ROUND 6 / CHARGE 1 IN PIXELS: SILHOUETTE, NOT PROJECTION\n');
console.log('  Each registered target is hidden alone and the frame re-read.');
console.log("  The pixels that change are that prop's contribution to the image.");
console.log('  DARK = a target whose silhouette is exactly zero pixels.\n');

for (const [scene, url] of SCENES) {
  console.log(`\n---- ${scene}\n`);

  for (const [label, w, h] of VIEWS) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 40000 });

    const r = await page.evaluate(() => {
      const canvas = document.getElementById('c');
      const cw = canvas.width;
      const ch = canvas.height;
      const off = document.createElement('canvas');
      off.width = cw;
      off.height = ch;
      const ctx = off.getContext('2d', { willReadFrequently: true });
      const grab = () => {
        ctx.clearRect(0, 0, cw, ch);
        ctx.drawImage(canvas, 0, 0);
        return ctx.getImageData(0, 0, cw, ch).data;
      };

      const names = window.__propBounds().map((b) => b.name);
      window.__redraw();
      const base = grab();
      const union = new Uint8Array(cw * ch);
      const sizes = [];

      for (const name of names) {
        const hits = window.__setVisible(name, false);
        const offData = grab();
        window.__setVisible(name, true);
        if (hits === 0) {
          sizes.push([name, -1]);
          continue;
        }
        let count = 0;
        for (let i = 0; i < cw * ch; i++) {
          const o = i * 4;
          const d = Math.abs(base[o] - offData[o]) + Math.abs(base[o + 1] - offData[o + 1]) + Math.abs(base[o + 2] - offData[o + 2]);
          if (d > 12) {
            count++;
            union[i] = 1;
          }
        }
        sizes.push([name, count]);
      }

      const BANDS = 20;
      const rows = [];
      for (let b = 0; b < BANDS; b++) {
        const y0 = Math.floor((b * ch) / BANDS);
        const y1 = Math.floor(((b + 1) * ch) / BANDS);
        let n = 0;
        for (let y = y0; y < y1; y++) for (let x = 0; x < cw; x++) if (union[y * cw + x]) n++;
        rows.push((n / ((y1 - y0) * cw)) * 100);
      }
      let covered = 0;
      for (let i = 0; i < union.length; i++) covered += union[i];
      return { sizes, rows, covered, cw, ch };
    });
    await page.close();

    const dark = r.sizes.filter(([, c]) => c === 0);
    const missing = r.sizes.filter(([, c]) => c === -1);
    const tiny = r.sizes.filter(([, c]) => c > 0 && c < 200);
    const sorted = r.sizes
      .filter(([, c]) => c >= 0)
      .map(([, c]) => c)
      .sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;

    console.log(`  ${label}   (canvas ${r.cw}x${r.ch})`);
    console.log(
      `    targets ${r.sizes.length}   DARK ${dark.length}   under-200px ${tiny.length}   median silhouette ${median}px^2   union ${((r.covered / (r.cw * r.ch)) * 100).toFixed(1)}% of frame`,
    );
    if (missing.length) console.log(`    NOT FOUND BY NAME (probe bug, not a finding): ${missing.map(([n]) => n).join(', ')}`);
    if (dark.length) console.log(`    dark: ${dark.map(([n]) => n).join(', ')}`);
    if (tiny.length) console.log(`    under 200px^2: ${tiny.map(([n, c]) => `${n}=${c}`).join(', ')}`);

    const bar = r.rows.map((p) => (p === 0 ? '.' : p < 1 ? '_' : p < 5 ? '-' : p < 15 ? '=' : '#')).join('');
    console.log(`    top->bottom occupancy  ${bar}   (. none  _ <1%  - <5%  = <15%  # >=15%)`);
    let deadTop = 0;
    while (deadTop < r.rows.length && r.rows[deadTop] === 0) deadTop++;
    let deadBottom = 0;
    while (deadBottom < r.rows.length && r.rows[r.rows.length - 1 - deadBottom] === 0) deadBottom++;
    console.log(
      `    empty band at top: ${((deadTop / 20) * 100).toFixed(0)}% of frame height   empty band at bottom: ${((deadBottom / 20) * 100).toFixed(0)}%`,
    );
    console.log('');
  }
}

await browser.close();
