/**
 * HOW MUCH DOES THE TAP HALO SEPARATE FROM THE ROOM BEHIND IT?
 *
 * WHY THIS EXISTS. Three versions of `utils/scene/tapInvitation.ts` were judged
 * by opening a screenshot and deciding whether the halo "read". The first was a
 * near-white cream ring; it looked fine in the Living Room, whose floor and walls
 * are mid-tone wood, and all but vanished in the Playroom, whose floor and walls
 * are pale cream. Nothing about that outcome was predictable from squinting, and
 * nothing about the amber replacement is either: the eye is far more sensitive to
 * LUMINANCE than to hue, and amber over pale cream is a hue change with almost no
 * luminance change. That is a measurable claim, so it gets measured.
 *
 * THE INSTRUMENT IS A DIFFERENTIAL, for the reason `.probe/render/diff.mjs` gives
 * at length: reading contrast off a single frame means guessing which pixels are
 * the ring, and every guess of that kind in this repository has been wrong at
 * least once. Here the frame is rendered with the halos and again with them
 * hidden, and the pixels that moved ARE the halo -- after the depth test, the
 * tone mapper and the sRGB encode, none of which a hand calculation gets right.
 *
 * WHY GSAP IS STEPPED BY HAND. `requestAnimationFrame` does not run in the
 * software renderer this harness is driven under, so the halo's fade-in -- a GSAP
 * delay of `APPEAR_DELAY` seconds -- will never fire on its own however long the
 * probe waits. `__gsapAdvance` is the only clock that moves here. That is also
 * why the probe pins the opacity itself for each candidate rather than trusting
 * the breath to be at its top: a comparison between two colours sampled at two
 * unknown points of a breath is not a comparison.
 *
 * THE BAR IS THE LIVING ROOM, not a number from a paper. The halo demonstrably
 * reads there against bare boards, so whatever separation it achieves there is
 * the working definition of enough, and a candidate is only acceptable if the
 * PALEST room clears it too. Weber contrast is the statistic because it is the
 * one that is dimensionless: a +20 lum step means something different against a
 * dark floor than against a bright one, and the child's eye cares about the
 * ratio.
 *
 * HOW TO RUN IT
 *   npx vite --port 5199 --strictPort &
 *   npm i --no-save playwright
 *   node .probe/render/halo-contrast.mjs
 */

import { chromium } from 'playwright';

const URL_FOR = (room) => `http://localhost:5199/.probe/render/room.html?room=${room}`;

const ROOMS = ['playroom', 'living-room', 'kitchen'];

/**
 * Candidate treatments as `[label, r, g, b, peakOpacity]`.
 *
 * `shipped` is the current source, so every other row is a delta against
 * something that exists rather than against an idea. The rest span the two axes
 * that are actually available -- how far the tint is from the rooms' own warm
 * palette, and how much of it there is -- because those are the only two levers
 * a flat unlit sprite has.
 */
const TREATMENTS = [
  ['shipped amber 0.72', 1.0, 0.76, 0.32, 0.72],
  ['amber louder 0.95', 1.0, 0.76, 0.32, 0.95],
  ['deep orange 0.85', 1.0, 0.6, 0.16, 0.85],
  ['warm white 0.85', 1.0, 0.95, 0.78, 0.85],
  ['cream 0.62 (the one that vanished)', 1.0, 0.96, 0.86, 0.62],
];

/** Two shipping viewports: the phone the app is designed for, and a laptop. */
const VIEWS = [
  ['phone 393x852', 393, 852],
  ['laptop 1440x900', 1440, 900],
];

/** Seconds to step so the show rule has fired and the fade is complete. */
const REACH_VISIBLE = 2.5 + 0.7 + 0.3;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

/**
 * Renders with and without the halos and measures each one's own disc.
 *
 * Sampling is confined to the disc the sprite actually covers, taken from the
 * live sprite through the live camera, so a halo hidden behind a nearer prop
 * reports its true (small) changed count instead of borrowing another halo's
 * pixels.
 */
async function measure(page, tint) {
  return page.evaluate((t) => {
    const probe = window.__haloProbe();
    const halos = probe.list();
    if (halos.length === 0) return { halos: 0 };
    probe.tint(t[1], t[2], t[3], t[4]);

    const canvas = document.getElementById('c');
    const w = canvas.width;
    const h = canvas.height;
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const ctx = off.getContext('2d', { willReadFrequently: true });
    const grab = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(canvas, 0, 0);
      return ctx.getImageData(0, 0, w, h).data;
    };

    // The sprite's own opacity is re-pinned after each toggle because `setVisible`
    // does not touch it and nothing steps GSAP in between, so the two frames
    // differ in exactly one thing.
    probe.setVisible(true);
    window.__redraw();
    const on = grab();
    probe.setVisible(false);
    window.__redraw();
    const offData = grab();
    probe.setVisible(true);

    const dpr = w / canvas.clientWidth;
    const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];

    return {
      halos: halos.length,
      w,
      h,
      rings: halos.map((halo) => {
        const cx = halo.cx * dpr;
        const cy = halo.cy * dpr;
        const r = halo.radius * dpr;
        let changed = 0;
        let bestDelta = 0;
        let bestBg = 0;
        let bestRing = 0;
        let sumAbs = 0;
        let bgSum = 0;
        let bgN = 0;
        const x0 = Math.max(0, Math.floor(cx - r - 2));
        const x1 = Math.min(w - 1, Math.ceil(cx + r + 2));
        const y0 = Math.max(0, Math.floor(cy - r - 2));
        const y1 = Math.min(h - 1, Math.ceil(cy + r + 2));
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const dx = x - cx;
            const dy = y - cy;
            if (dx * dx + dy * dy > (r + 2) * (r + 2)) continue;
            const i = (y * w + x) * 4;
            const la = lum(on, i);
            const lb = lum(offData, i);
            bgSum += lb;
            bgN++;
            const d = Math.abs(on[i] - offData[i]) + Math.abs(on[i + 1] - offData[i + 1]) + Math.abs(on[i + 2] - offData[i + 2]);
            if (d <= 12) continue;
            changed++;
            sumAbs += Math.abs(la - lb);
            if (Math.abs(la - lb) > bestDelta) {
              bestDelta = Math.abs(la - lb);
              bestBg = lb;
              bestRing = la;
            }
          }
        }
        return {
          name: halo.name,
          opacity: halo.opacity,
          radiusPx: halo.radius,
          discPx: bgN,
          changed,
          coverage: bgN ? changed / bgN : 0,
          meanAbsDelta: changed ? sumAbs / changed : 0,
          peakDelta: bestDelta,
          peakBg: bestBg,
          peakRing: bestRing,
          weber: bestBg > 0 ? (bestRing - bestBg) / bestBg : 0,
          bgMean: bgN ? bgSum / bgN : 0,
        };
      }),
    };
  }, tint);
}

const rows = [];
for (const [vlabel, vw, vh] of VIEWS) {
  for (const room of ROOMS) {
    const page = await browser.newPage({ viewport: { width: vw, height: vh } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(URL_FOR(room), { waitUntil: 'load' });
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 40000 });
    await page.evaluate((s) => window.__gsapAdvance(s), REACH_VISIBLE);
    const before = await page.evaluate(() => window.__haloProbe().list());
    console.log(`\n### ${room}  ${vlabel}   halos=${before.length}`);
    if (before.length === 0) {
      console.log('  NO HALOS IN THIS ROOM');
      await page.close();
      continue;
    }
    console.log(
      '  after stepping GSAP ' +
        REACH_VISIBLE +
        's: ' +
        before.map((h) => `${h.name} opacity ${h.opacity.toFixed(3)} visible=${h.visible} r=${h.radius.toFixed(1)}px at (${h.cx.toFixed(0)},${h.cy.toFixed(0)})`).join('; ')
    );
    for (const t of TREATMENTS) {
      const m = await measure(page, t);
      for (const ring of m.rings) {
        rows.push({ room, view: vlabel, treatment: t[0], ...ring });
        console.log(
          `  ${t[0].padEnd(36)} ${ring.name.replace('tapInvitation_', '').padEnd(18)}` +
            ` r${ring.radiusPx.toFixed(0)}px  changed ${String(ring.changed).padStart(5)}/${String(ring.discPx).padStart(5)}` +
            ` (${(ring.coverage * 100).toFixed(0)}%)  bg lum ${ring.peakBg.toFixed(0)} -> ring ${ring.peakRing.toFixed(0)}` +
            `  peak Δ${ring.peakDelta >= 0 ? '+' : ''}${ring.peakDelta.toFixed(1)}  mean Δ${ring.meanAbsDelta.toFixed(1)}  Weber ${(ring.weber * 100).toFixed(1)}%`
        );
      }
    }
    if (errors.length) console.log('  PAGE ERRORS: ' + errors.slice(0, 3).join(' | '));
    await page.close();
  }
}

await browser.close();

console.log('\n\n=== WORST ROOM PER TREATMENT (the bar is whatever the Living Room achieves)');
const byTreatment = new Map();
for (const r of rows) {
  if (!byTreatment.has(r.treatment)) byTreatment.set(r.treatment, []);
  byTreatment.get(r.treatment).push(r);
}
for (const [t, list] of byTreatment) {
  const living = list.filter((r) => r.room === 'living-room');
  const others = list.filter((r) => r.room !== 'living-room');
  const minLiving = Math.min(...living.map((r) => Math.abs(r.weber)));
  const worst = others.reduce((a, b) => (Math.abs(a.weber) < Math.abs(b.weber) ? a : b), others[0]);
  console.log(
    `  ${t.padEnd(36)} living-room floor |Weber| ${(minLiving * 100).toFixed(1)}%   worst elsewhere ${(Math.abs(worst.weber) * 100).toFixed(1)}%` +
      ` (${worst.room}, ${worst.view}, ${worst.name.replace('tapInvitation_', '')})   ${Math.abs(worst.weber) >= minLiving ? 'CLEARS THE BAR' : 'BELOW THE BAR'}`
  );
}
console.log('\nJSON ' + JSON.stringify(rows.map((r) => [r.room, r.view, r.treatment, r.name, +r.weber.toFixed(4), +r.peakDelta.toFixed(1), r.changed])));
process.exit(0);
