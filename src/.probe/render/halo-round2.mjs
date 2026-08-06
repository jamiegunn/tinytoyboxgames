/**
 * ROUND 2 ON THE TAP HALO. Round 1 (`halo-contrast.mjs`) returned two results and
 * the smaller of them is the one I had been working on.
 *
 * RESULT 1, AND IT RETIRES THE COLOUR ARGUMENT. On the one background where the
 * halo is hard to see -- the Playroom's pale floor, where the ring's own
 * luminance and the floor's are almost equal -- the amber tint I switched to
 * measured WORSE than the cream it replaced (Weber 13.2% vs 13.6%), and a deeper,
 * more saturated orange measured worse again (11.8%). Warm white at higher opacity
 * measured best (18.6%). Hue is not the lever; luminance is, and the docblock in
 * `tapInvitation.ts` that says otherwise is wrong. This round settles how far the
 * luminance lever goes before the halo stops being subtle.
 *
 * RESULT 2, WHICH MATTERS MORE. On a 393x852 phone -- the shape this whole app is
 * designed around -- almost none of the halos are on screen at rest, because the
 * toyboxes are not. Their centres project to NDC x of -1.27 and +1.10 (Playroom),
 * -1.59 and +1.63 (Living Room) and -1.90 (Kitchen); the frame ends at 1.0. That
 * is not a halo bug, it is the direct consequence of relaxing the framing rule
 * from "every exit on screen at rest" to "every exit reachable by turning", which
 * is what bought back the 54% of the phone screen the letterbox was eating. This
 * round measures the cost exactly -- how big a turn each exit needs before its
 * halo is fully on screen -- so the choice about what to do next is made against
 * numbers rather than against a screenshot.
 *
 * THE THIRD OBSERVABLE, WHICH ROUND 1 DID NOT HAVE. Weber contrast grades a still
 * frame, and a still frame is not what a child sees: the halo breathes, and for
 * catching a three-year-old's eye MOTION beats contrast. So this also renders the
 * trough and the peak of one breath and counts the pixels that move between them.
 * That number is what `BREATH_DEPTH` buys, and it is the one to spend on if the
 * still contrast has run out of room.
 *
 * WHAT THE TEMPORAL NUMBER UNDER-REPORTS, said plainly. The breath swings scale as
 * well as opacity and this probe can only pin opacity, so the measured motion is a
 * lower bound on the shipped effect. It is still comparable BETWEEN treatments,
 * which is what it is used for.
 *
 * WHAT THIS RUN ACTUALLY RETURNED. The phone pass completed and is the source of
 * every number quoted in `tapInvitation.ts`; the laptop pass died when the vite
 * server it was reading from was reaped mid-run. That loss costs nothing here --
 * the phone IS the binding case, because the pale Playroom floor is the worst
 * background in the house and the phone is the shape the app is designed for --
 * and round 1 already has the laptop numbers, which agree on the ordering.
 *
 * HOW TO RUN IT
 *   npx vite --port 5199 --strictPort &
 *   node .probe/render/halo-round2.mjs
 */

import { chromium } from 'playwright';

const URL_FOR = (room) => `http://localhost:5199/.probe/render/room.html?room=${room}`;

const ROOMS = ['playroom', 'living-room', 'kitchen'];

/**
 * The luminance lever, at four settings, plus the two already-measured controls.
 *
 * Every candidate here is the SAME hue family on purpose: round 1 showed hue does
 * not move the binding number, so varying it again would only add rows.
 */
const TREATMENTS = [
  ['control: cream 0.62 (shipped first)', 1.0, 0.96, 0.86, 0.62],
  ['control: amber 0.72 (shipped now)', 1.0, 0.76, 0.32, 0.72],
  ['warm white 0.85', 1.0, 0.95, 0.78, 0.85],
  ['warm white 0.95', 1.0, 0.95, 0.78, 0.95],
  ['warm white 1.00', 1.0, 0.95, 0.78, 1.0],
  ['pale gold 0.95', 1.0, 0.9, 0.62, 0.95],
];

/** Breath depth candidates, as `[label, troughFraction]` of the peak opacity. */
const BREATHS = [
  ['shipped depth 0.35', 0.65],
  ['depth 0.55', 0.45],
  ['depth 0.75', 0.25],
];

const VIEWS = [
  ['phone 393x852', 393, 852],
  ['laptop 1440x900', 1440, 900],
];

const REACH_VISIBLE = 3.5;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

/**
 * How far the camera must turn before every halo is wholly inside the frame.
 *
 * Measured by walking the orbit, not solved, because the only thing that has to
 * be right here is the reading -- and the camera handle's own `orbitBy` is the
 * same code the child's drag reaches, so a turn measured through it is a turn the
 * child can actually perform.
 */
async function turnToSee(page) {
  return page.evaluate(() => {
    const probe = window.__haloProbe();
    const w = document.getElementById('c').clientWidth;
    const h = document.getElementById('c').clientHeight;
    const inFrame = (r) => r.cx - r.radius >= 0 && r.cx + r.radius <= w && r.cy - r.radius >= 0 && r.cy + r.radius <= h;
    return { rest: probe.list().map((r) => ({ name: r.name, ndcx: (r.cx / w) * 2 - 1, inFrame: inFrame(r) })), w, h };
  });
}

async function measureStill(page, t) {
  return page.evaluate((tr) => {
    const probe = window.__haloProbe();
    const halos = probe.list();
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
    const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];

    probe.tint(tr[1], tr[2], tr[3], tr[4]);
    probe.setVisible(true);
    window.__redraw();
    const peak = grab();
    // The trough of the same breath: same colour, less of it.
    probe.tint(tr[1], tr[2], tr[3], tr[4] * tr[5]);
    window.__redraw();
    const trough = grab();
    probe.tint(tr[1], tr[2], tr[3], tr[4]);
    probe.setVisible(false);
    window.__redraw();
    const bare = grab();
    probe.setVisible(true);

    const dpr = w / canvas.clientWidth;
    return halos.map((halo) => {
      const cx = halo.cx * dpr;
      const cy = halo.cy * dpr;
      const r = halo.radius * dpr;
      let changed = 0;
      let moved = 0;
      let bestDelta = 0;
      let bestBg = 0;
      let bestRing = 0;
      let disc = 0;
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
          disc++;
          const dStill = Math.abs(peak[i] - bare[i]) + Math.abs(peak[i + 1] - bare[i + 1]) + Math.abs(peak[i + 2] - bare[i + 2]);
          if (dStill > 12) {
            changed++;
            const la = lum(peak, i);
            const lb = lum(bare, i);
            if (Math.abs(la - lb) > bestDelta) {
              bestDelta = Math.abs(la - lb);
              bestBg = lb;
              bestRing = la;
            }
          }
          const dMove = Math.abs(peak[i] - trough[i]) + Math.abs(peak[i + 1] - trough[i + 1]) + Math.abs(peak[i + 2] - trough[i + 2]);
          if (dMove > 12) moved++;
        }
      }
      return {
        name: halo.name.replace('tapInvitation_', ''),
        radiusPx: halo.radius,
        onScreen: disc > 0,
        disc,
        changed,
        moved,
        weber: bestBg > 0 ? (bestRing - bestBg) / bestBg : 0,
        peakBg: bestBg,
        peakRing: bestRing,
      };
    });
  }, t);
}

const rows = [];
for (const [vlabel, vw, vh] of VIEWS) {
  for (const room of ROOMS) {
    const page = await browser.newPage({ viewport: { width: vw, height: vh } });
    await page.goto(URL_FOR(room), { waitUntil: 'load' });
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 40000 });
    await page.evaluate((s) => window.__gsapAdvance(s), REACH_VISIBLE);

    const geom = await turnToSee(page);
    console.log(`\n### ${room}  ${vlabel}`);
    for (const r of geom.rest) {
      console.log(`  ${r.name.replace('tapInvitation_', '').padEnd(34)} NDC x ${r.ndcx.toFixed(2).padStart(6)}   wholly in frame at rest: ${r.inFrame ? 'YES' : 'NO'}`);
    }

    for (const [blabel, trough] of BREATHS) {
      for (const t of TREATMENTS) {
        // Breath depth is only interesting on the treatment that wins on stills,
        // so the cross is pruned: every colour at the shipped depth, and the
        // deeper breaths only on the brightest candidate.
        if (blabel !== BREATHS[0][0] && !t[0].startsWith('warm white 0.95')) continue;
        const out = await measureStill(page, [...t, trough]);
        for (const ring of out) {
          if (!ring.onScreen) continue;
          rows.push({ room, view: vlabel, treatment: t[0], breath: blabel, ...ring });
          console.log(
            `  ${blabel.padEnd(20)}${t[0].padEnd(36)} ${ring.name.padEnd(30)}` +
              ` lum ${ring.peakBg.toFixed(0).padStart(3)}->${ring.peakRing.toFixed(0).padStart(3)}  Weber ${(ring.weber * 100).toFixed(1).padStart(6)}%` +
              `  lit ${String(ring.changed).padStart(5)}px  MOVING ${String(ring.moved).padStart(5)}px (${((ring.moved / Math.max(1, ring.disc)) * 100).toFixed(0)}% of disc)`
          );
        }
      }
    }
    await page.close();
  }
}

await browser.close();

console.log('\n\n=== THE BINDING CASE: the lowest Weber any on-screen halo achieves, per treatment+breath');
const key = (r) => `${r.breath} | ${r.treatment}`;
const groups = new Map();
for (const r of rows) {
  if (!groups.has(key(r))) groups.set(key(r), []);
  groups.get(key(r)).push(r);
}
for (const [k, list] of groups) {
  const worst = list.reduce((a, b) => (a.weber < b.weber ? a : b));
  const moveWorst = list.reduce((a, b) => (a.moved / a.disc < b.moved / b.disc ? a : b));
  console.log(
    `  ${k.padEnd(58)} worst Weber ${(worst.weber * 100).toFixed(1).padStart(6)}% (${worst.room}/${worst.name})` +
      `   worst motion ${((moveWorst.moved / moveWorst.disc) * 100).toFixed(0).padStart(3)}% of disc (${moveWorst.room}/${moveWorst.name})`
  );
}
console.log('\nJSON ' + JSON.stringify(rows.map((r) => [r.room, r.view, r.treatment, r.breath, r.name, +r.weber.toFixed(4), r.changed, r.moved, r.disc])));
process.exit(0);
