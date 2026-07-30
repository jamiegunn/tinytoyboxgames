/**
 * ROOMS ROUND 1 -- IS A MISSED TAP IN A ROOM ANSWERED BY SOUND ALONE?
 *
 * Run with vite already serving the package:
 *   npx vite --port 5199 --strictPort &
 *   node .probe/render/rooms-mute-dead.mjs
 *
 * THE SUSPECTED MECHANISM, WRITTEN DOWN BEFORE THE NUMBERS ARRIVE
 * --------------------------------------------------------------
 * (NAMES AS OF ROUND 1. Round 2 renamed `acknowledgeMiss` to `acknowledgeTap`,
 * because `fire` now routes an unanswered HIT through it as well. The mechanism
 * described below is unchanged; only the name is. The paragraph is left in its
 * original words rather than back-edited, because a probe's stated premise is
 * part of its evidence and rewriting it after the fact launders the record.)
 *
 * `interactionController.ts` ends its arbitration with `acknowledgeMiss`, whose
 * own docblock says why it exists:
 *
 *   "Before this existed a fifth to a quarter of the Nature canvas was inert at
 *    every shipping viewport (20.7%-25.9% measured), which soul.md#6 names as the
 *    one thing that breaks the spell."
 *
 * `acknowledgeMiss` has two halves. The visual half runs only `if (missHandler)`,
 * and a miss handler is installed in exactly one place in the repository:
 * `worldSceneFactory.ts`, which builds the immersive toybox scenes. The other
 * factory over the same controller -- `roomSceneFactory.ts`, which builds
 * Playroom, Living Room and Kitchen -- never calls `setMissHandler`. The audio
 * half, `audio?.playFallback()`, runs unconditionally.
 *
 * So the charge is not that the rooms have dead taps in the sense
 * `nature-ack.mjs` measured. They will pass that probe: the fallback sound fires.
 * The charge is that the rooms answer a missed tap through the ONE channel
 * soul.md forbids from being load-bearing:
 *
 *   "Sound is never required for comprehension. A muted experience must be fully
 *    playable and emotionally complete."
 *
 * On a muted tablet -- which is most tablets handed to a three-year-old in a
 * waiting room -- a tap on a room's wall, ceiling, window or wall art produces
 * literally nothing. That is soul.md#6's broken promise, hiding behind a probe
 * that only ever counted sounds.
 *
 * WHAT I EXPECT, so that the measurement is able to refute it
 * ----------------------------------------------------------
 * A room is enclosed. Everything the camera sees that is not floor, rug, or a
 * registered prop is wall, ceiling, wainscoting, window or wall art, and none of
 * those is registered. I therefore predict the unanswered fraction in the rooms
 * is comparable to or larger than the 20.7%-25.9% that justified building the
 * acknowledgement in the first place, concentrated in the upper band of the frame,
 * and worst in portrait, where a tall frame gives the back wall more of the
 * canvas.
 *
 * REFUTATION CONDITIONS, COMMITTED TO IN ADVANCE:
 *   - If the unanswered fraction is under 5% at every shipping viewport, the
 *     charge is a technicality. Abandon it and find a different defect.
 *   - If unanswered samples are scattered rather than banded, then "the child
 *     looks up and the world goes quiet" is the wrong story even if the number is
 *     large, and the write-up must say the number without the story.
 *   - If the Nature control reports unanswered samples too, the instrument is
 *     broken and NOTHING here may be reported.
 *
 * WHY THE CONTROL IS THE MOST IMPORTANT ROW IN THE TABLE
 * -----------------------------------------------------
 * This probe's observable is "did a particle burst happen". A harness whose
 * particle engine is unregistered returns a no-op engine, silently, and would
 * report zero bursts for every scene -- manufacturing this finding whether or not
 * it is real. Round 4's strongest result was a fix that looked safe because the
 * instrument structurally could not see the harm. So Nature is mounted through the
 * same harness, the same hook and the same grid. Nature has the acknowledgement.
 * If the control does not come back clean, the subject rows are noise.
 */

import { chromium } from 'playwright';

const PAGE = (room) => `http://localhost:5199/.probe/render/room.html?room=${room}`;
const STEP = Number(process.env.STEP ?? 16);

const SUBJECTS = ['playroom', 'living-room', 'kitchen'];
const CONTROL = 'nature';

const VIEWS = [
  ['landscape 1280x720', 1280, 720],
  ['tablet 1024x768', 1024, 768],
  ['iPad portrait 768x1024', 768, 1024],
  ['iPhone SE 375x667', 375, 667],
  ['Pixel 8 412x915', 412, 915],
];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

/**
 * Sweeps one scene at one viewport and classifies every sample.
 *
 * @param scene - Scene id understood by the harness's `?room=` parameter.
 * @param w - Viewport width in CSS px.
 * @param h - Viewport height in CSS px.
 * @returns Sample counts, the banding profile, and the scenery cross-tab.
 */
async function sweep(scene, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const consoleWarnings = [];
  page.on('console', (m) => {
    if (m.type() === 'warning' || m.type() === 'error') consoleWarnings.push(m.text());
  });
  await page.goto(PAGE(scene), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 60000 });

  const out = await page.evaluate((step) => {
    const emitWiring = window.__emitProbe();
    const m = window.__missSweep(step);
    const u = window.__underNames(step);
    if (u.cols !== m.cols || u.rows !== m.rows) throw new Error('grids disagree -- cross-tab would be meaningless');
    const n = m.cols * m.rows;
    let fired = 0;
    let missAck = 0;
    let missMute = 0;
    let silent = 0;
    const rowMute = new Array(m.rows).fill(0);
    const byName = {};
    for (let k = 0; k < n; k++) {
      if (m.sounds[k] === 0) silent++;
      if (m.fired[k] >= 0) {
        fired++;
        continue;
      }
      if (m.emits[k] > 0) {
        missAck++;
        continue;
      }
      missMute++;
      rowMute[Math.floor(k / m.cols)] += 1;
      const name = u.names[k];
      byName[name] = (byName[name] ?? 0) + 1;
    }
    return { n, cols: m.cols, rows: m.rows, fired, missAck, missMute, silent, rowMute, byName, emitWiring };
  }, STEP);
  await page.close();
  return { ...out, consoleWarnings };
}

/**
 * Where in the frame the unanswered samples sit, as a fraction of frame height.
 *
 * "Banded" and "scattered" are the two stories the same total can tell, and the
 * refutation conditions commit to only telling the banded one if it is true. This
 * reports the topmost and bottommost row containing an unanswered sample and the
 * share of them falling in the upper third, which is enough to distinguish the
 * two without a picture.
 *
 * @param rowMute - Unanswered-sample count per grid row, top to bottom.
 * @param rows - Number of grid rows.
 * @returns The vertical extent and upper-third concentration, or null when clean.
 */
function banding(rowMute, rows) {
  const total = rowMute.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const first = rowMute.findIndex((c) => c > 0);
  let last = rows - 1;
  while (last >= 0 && rowMute[last] === 0) last--;
  const upperThird = rowMute.slice(0, Math.ceil(rows / 3)).reduce((a, b) => a + b, 0);
  return { from: first / rows, to: (last + 1) / rows, upper: upperThird / total };
}

const pct = (a, b) => `${((100 * a) / b).toFixed(1)}%`;

console.log('==== A MISSED TAP IN A ROOM: IS THERE ANY ANSWER A MUTED CHILD CAN SEE?\n');
console.log(`  Real pointer events, every ${STEP} px, through each scene's own createScene.`);
console.log('  A sample is UNANSWERED when arbitration fired no registered handler AND the');
console.log('  scene emitted no particle burst -- i.e. the only thing that happened was a sound.\n');

console.log('  --- CONTROL: the scene that HAS the miss acknowledgement ---------------------');
console.log('  scene / viewport                samples    handler   miss+seen   UNANSWERED   silent');

const controlRows = [];
for (const [label, w, h] of VIEWS) {
  const r = await sweep(CONTROL, w, h);
  controlRows.push({ label, r });
  console.log(
    `  ${(CONTROL + ' ' + label).padEnd(30)} ${String(r.n).padStart(7)} ${String(r.fired).padStart(10)} ${String(r.missAck).padStart(11)} ${pct(r.missMute, r.n).padStart(12)} ${pct(r.silent, r.n).padStart(8)}`,
  );
  if (r.emitWiring !== 1) console.log(`      !! PREMISE BROKEN: emit wiring check returned ${r.emitWiring}, expected 1`);
}

const controlBad = controlRows.filter(({ r }) => r.missMute > 0);
const wiringBad = controlRows.filter(({ r }) => r.emitWiring !== 1);
console.log('');
if (wiringBad.length > 0) {
  console.log('  INSTRUMENT REJECTED: the harness is not holding the engine the scene resolves.');
  console.log('  No subject row below may be reported. Fix the harness first.');
} else if (controlBad.length > 0) {
  console.log(`  INSTRUMENT REJECTED: the control scene reports unanswered samples at ${controlBad.length}/${VIEWS.length} viewports,`);
  console.log('  and the control is the scene whose acknowledgement is already installed. Either');
  console.log('  the probe cannot see a burst it should see, or Nature has regressed. Either way');
  console.log('  the subject rows below are not evidence. Diagnose before reading them.');
} else {
  console.log('  INSTRUMENT ACCEPTED: the control answers every sample it does not fire a handler');
  console.log('  for, so a particle burst IS visible to this probe when one is emitted.');
}

console.log('\n  --- SUBJECTS: the three rooms ------------------------------------------------');
console.log('  scene / viewport                samples    handler   miss+seen   UNANSWERED   silent');

const subjectRows = [];
for (const scene of SUBJECTS) {
  for (const [label, w, h] of VIEWS) {
    const r = await sweep(scene, w, h);
    subjectRows.push({ scene, label, r });
    console.log(
      `  ${(scene + ' ' + label).padEnd(30)} ${String(r.n).padStart(7)} ${String(r.fired).padStart(10)} ${String(r.missAck).padStart(11)} ${pct(r.missMute, r.n).padStart(12)} ${pct(r.silent, r.n).padStart(8)}`,
    );
  }
}

console.log('\n  --- WHERE THE UNANSWERED SAMPLES SIT ----------------------------------------');
console.log('  scene / viewport                 vertical extent of frame     share in upper third');
for (const { scene, label, r } of subjectRows) {
  const b = banding(r.rowMute, r.rows);
  const where = b === null ? 'none' : `${(100 * b.from).toFixed(0)}% .. ${(100 * b.to).toFixed(0)}% from the top`;
  const up = b === null ? '-' : pct(b.upper * r.missMute, r.missMute);
  console.log(`  ${(scene + ' ' + label).padEnd(30)} ${where.padEnd(28)} ${up.padStart(8)}`);
}

console.log('\n  --- WHAT THE CHILD WAS LOOKING AT WHEN THE TAP DIED -------------------------');
for (const scene of SUBJECTS) {
  const rows = subjectRows.filter((s) => s.scene === scene);
  const agg = {};
  let total = 0;
  for (const { r } of rows) {
    for (const [name, c] of Object.entries(r.byName)) {
      agg[name] = (agg[name] ?? 0) + c;
      total += c;
    }
  }
  const top = Object.entries(agg)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  console.log(`\n  ${scene} -- ${total} unanswered samples across ${rows.length} viewports:`);
  for (const [name, c] of top) console.log(`      ${pct(c, total).padStart(7)}  ${name}`);
}

const worst = subjectRows.reduce((a, b) => (b.r.missMute / b.r.n > a.r.missMute / a.r.n ? b : a));
const best = subjectRows.reduce((a, b) => (b.r.missMute / b.r.n < a.r.missMute / a.r.n ? b : a));
console.log('\n  --- VERDICT ------------------------------------------------------------------');
console.log(`  Unanswered fraction ranges ${pct(best.r.missMute, best.r.n)} (${best.scene} ${best.label})`);
console.log(`  to ${pct(worst.r.missMute, worst.r.n)} (${worst.scene} ${worst.label}).`);
const worstPct = (100 * worst.r.missMute) / worst.r.n;
if (worstPct < 5) {
  console.log('  Under the 5% floor committed to above. THE CHARGE IS REFUTED as a technicality.');
} else {
  console.log('  Above the 5% floor committed to above. The charge stands on magnitude.');
  console.log('  Every one of these samples is a tap that, on a muted device, does nothing at all.');
}
console.log(
  `  Silent-tap fraction is ${pct(
    subjectRows.reduce((a, s) => a + s.r.silent, 0),
    subjectRows.reduce((a, s) => a + s.r.n, 0),
  )} -- which is why a sound-counting probe passes these rooms.`,
);

await browser.close();
