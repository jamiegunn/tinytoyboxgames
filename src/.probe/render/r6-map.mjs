/**
 * WHERE THE DISCOVERIES ARE, AND WHERE THE CONSOLATION PRIZE IS.
 *
 * `pc-agree.mjs` established that the modelled classification and real taps
 * through the shipped controller agree on 32,644 samples across both scenes, on
 * class AND on exact fired-object identity. That licence is what this probe
 * spends: it re-uses the model to get a whole frame classified cheaply, and
 * reports it three ways.
 *
 *   THE MAP        every sample as PROP (#), SCENERY (-) or NOTHING (.), drawn
 *                  at the frame's own aspect. A reviewer can see the shape of
 *                  the problem instead of taking a percentage on trust.
 *   THE SHARE      what fraction of the frame each registered target catches.
 *                  A scene whose PROP share is one prop is not the same scene as
 *                  one whose PROP share is spread over ten, and the headline
 *                  percentage cannot tell them apart.
 *   THE NOTHING    the bounding box and vertical profile of the dead region, so
 *                  "the sky is inert" and "the margins are inert" can be told
 *                  apart -- they need different fixes.
 *
 * WHY THE PROP/SCENERY SPLIT IS NOT THE HEADLINE, AND ANSWERED/DISTINCT ARE.
 * The glyphs come from `TapOptions.background`, and that flag answers exactly
 * one question: does this target yield the proximity contest to smaller ones.
 * It says nothing about whether the target has its own reaction. Round 6 shipped
 * two targets that are background AND distinct -- the sea, which splashes where
 * the finger lands, and the sail, which snaps -- and a probe that reads them as
 * '-' would report a scene that got four new reactions as a scene that got
 * MORE SCENERY. The charge is about a frame full of interchangeable answers, so
 * the two numbers that carry it are:
 *
 *   ANSWERED   share of the frame where SOMETHING specific fires, prop or
 *              background. Its complement is the sparkle -- the same answer
 *              everywhere -- which is the actual defect soul.md#109 names.
 *   DISTINCT   how many separate targets each catch at least 1% of the frame.
 *              Twelve targets sharing a frame is a scene worth exploring; one
 *              target catching 60% of it is `interactionController.ts:70`
 *              happening again. This is the number that stops ANSWERED from
 *              being gamed by registering one enormous surface.
 *
 * Read them together. Neither is sufficient alone, and that is the point.
 *
 * WHY NOTHING IS NOT THE SAME AS A DEAD TAP. Round 5 gave every miss a sparkle
 * and a sound, so a NOTHING sample is answered; soul.md#6 is satisfied. NOTHING
 * here means the child got the SAME answer they would get anywhere else on that
 * 70% of the frame. #117's success story is a child finding a mushroom, then a
 * butterfly, then a stream, then a log. Four discoveries. A sparkle is not one.
 *
 * WHY BOTH SCENES. The charge is comparative and must be. soul.md#109 -- "five
 * perfect tap reactions are worth more than fifty mediocre ones" -- forbids
 * charging Pirate Cove for having five targets, so the only defensible charge is
 * about how the frame is COVERED, and coverage is only meaningful against a
 * scene in the same app that does it differently.
 */

import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

/**
 * The shipped proximity radius, read out of source rather than typed in.
 *
 * @returns the numeric value of `PROXIMITY_PX` as declared in `gestureRules.ts`.
 */
const shippedProximityPx = () => {
  const src = readFileSync(new URL('../../src/utils/interaction/gestureRules.ts', import.meta.url), 'utf8');
  const m = /export const PROXIMITY_PX = (\d+(?:\.\d+)?)/.exec(src);
  if (!m) throw new Error('PROXIMITY_PX not found in gestureRules.ts -- fix this probe, do not guess');
  return Number(m[1]);
};

const PROXIMITY_PX = shippedProximityPx();
const STEP = 12;

const SCENES = [
  ['NATURE', 'http://localhost:5199/.probe/render/nature.html', '__dispatchMap'],
  ['PIRATE COVE', 'http://localhost:5199/.probe/render/shot.html', '__discoveryMap'],
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

console.log('==== ROUND 6 / THE MAP: DISCOVERY, SCENERY, OR THE SAME SPARKLE AGAIN\n');
console.log(`  ${STEP}px sample grid, proximity radius ${PROXIMITY_PX}px (shipped).`);
console.log('  #  PROP     a registered non-background target fires -- a discovery.');
console.log('  -  SCENERY  a background surface fires: real, correct, identical everywhere.');
console.log('  .  NOTHING  the miss sparkle. Answered, per soul.md#6. Never a discovery.\n');

for (const [scene, url, hook] of SCENES) {
  console.log(`\n======== ${scene}\n`);
  for (const [label, w, h] of VIEWS) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 40000 });

    const r = await page.evaluate(
      ([step, radiusPx, hookName]) => {
        const m = window[hookName](step, radiusPx);
        const share = {};
        let prop = 0;
        let scenery = 0;
        let nothing = 0;
        let minX = 1e9;
        let maxX = -1e9;
        let minY = 1e9;
        let maxY = -1e9;
        const rowNothing = new Array(m.rows).fill(0);
        for (let k = 0; k < m.fire.length; k++) {
          const i = m.fire[k];
          const col = k % m.cols;
          const row = Math.floor(k / m.cols);
          if (i < 0) {
            nothing++;
            rowNothing[row]++;
            if (col < minX) minX = col;
            if (col > maxX) maxX = col;
            if (row < minY) minY = row;
            if (row > maxY) maxY = row;
          } else if (m.background[i]) {
            scenery++;
            share[`(scenery) ${m.entryLabels[i]}`] = (share[`(scenery) ${m.entryLabels[i]}`] ?? 0) + 1;
          } else {
            prop++;
            share[m.entryLabels[i]] = (share[m.entryLabels[i]] ?? 0) + 1;
          }
        }
        const glyph = (i) => (i < 0 ? '.' : m.background[i] ? '-' : '#');
        const rowsOut = [];
        for (let row = 0; row < m.rows; row++) {
          let s = '';
          for (let col = 0; col < m.cols; col++) s += glyph(m.fire[row * m.cols + col]);
          rowsOut.push(s);
        }
        return { cols: m.cols, rows: m.rows, n: m.fire.length, prop, scenery, nothing, share, rowsOut, rowNothing, box: { minX, maxX, minY, maxY } };
      },
      [STEP, PROXIMITY_PX, hook],
    );
    await page.close();

    const pct = (v) => `${((v / r.n) * 100).toFixed(1)}%`;

    // A target counts as DISTINCT at >=1% of the frame. Below that it is a
    // target a child would have to hunt for, and counting it would let a scene
    // claim breadth it does not have.
    const DISTINCT_MIN_SHARE = 0.01;
    const distinct = Object.values(r.share).filter((n) => n / r.n >= DISTINCT_MIN_SHARE).length;
    const biggest = Math.max(0, ...Object.values(r.share));

    console.log(`  ---- ${label}   (${r.cols}x${r.rows} = ${r.n} samples)`);
    console.log(`       ANSWERED ${pct(r.prop + r.scenery)}   DISTINCT ${distinct} targets >=1%   largest single ${pct(biggest)}`);
    console.log(`       PROP ${pct(r.prop)}   SCENERY ${pct(r.scenery)}   NOTHING ${pct(r.nothing)}`);

    // Vertically compress to ~24 printed rows and horizontally to <=100 cols so
    // the shape survives in a terminal; the majority glyph in each cell wins.
    const OUT_ROWS = Math.min(r.rows, 24);
    const OUT_COLS = Math.min(r.cols, 96);
    const lines = [];
    for (let oy = 0; oy < OUT_ROWS; oy++) {
      let s = '';
      for (let ox = 0; ox < OUT_COLS; ox++) {
        const y0 = Math.floor((oy * r.rows) / OUT_ROWS);
        const y1 = Math.max(y0 + 1, Math.floor(((oy + 1) * r.rows) / OUT_ROWS));
        const x0 = Math.floor((ox * r.cols) / OUT_COLS);
        const x1 = Math.max(x0 + 1, Math.floor(((ox + 1) * r.cols) / OUT_COLS));
        const c = { '#': 0, '-': 0, '.': 0 };
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) c[r.rowsOut[y][x]]++;
        // A discovery anywhere in the cell is the thing worth seeing, so '#'
        // wins ties -- this map must not hide props, only dead space.
        s += c['#'] > 0 && c['#'] * 3 >= c['-'] + c['.'] ? '#' : c['-'] >= c['.'] ? '-' : '.';
      }
      lines.push(s);
    }
    for (const l of lines) console.log(`       |${l}|`);

    const top = Object.entries(r.share).sort((a, b) => b[1] - a[1]);
    console.log(`       catchment share (of frame):`);
    for (const [name, n] of top.slice(0, 8)) console.log(`         ${pct(n).padStart(6)}  ${name}`);
    if (top.length > 8) console.log(`         ${pct(top.slice(8).reduce((s, [, n]) => s + n, 0)).padStart(6)}  ... ${top.length - 8} more targets`);

    const bandRows = 10;
    const prof = [];
    for (let b = 0; b < bandRows; b++) {
      const y0 = Math.floor((b * r.rows) / bandRows);
      const y1 = Math.floor(((b + 1) * r.rows) / bandRows);
      let n = 0;
      for (let y = y0; y < y1; y++) n += r.rowNothing[y];
      prof.push(Math.round((n / ((y1 - y0) * r.cols)) * 100));
    }
    console.log(`       NOTHING by tenth, top->bottom:  ${prof.map((p) => String(p).padStart(3)).join('')}  %`);
    console.log('');
  }
}

await browser.close();
