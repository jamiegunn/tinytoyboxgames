/**
 * ROOMS ROUND 1, GRADING PASS -- IS THE ACKNOWLEDGEMENT ACTUALLY VISIBLE?
 *
 * Run with vite already serving the package:
 *   npx vite --port 5199 --strictPort &
 *   node .probe/render/rooms-ack-visible.mjs
 *
 * WHY THIS IS A SECOND PROBE AND NOT A RERUN OF THE FIRST
 * ------------------------------------------------------
 * `rooms-mute-dead.mjs` established the charge: a missed tap in Playroom, Living
 * Room or Kitchen produces `audio?.playFallback()` and nothing else, at 26.2% to
 * 49.7% of the canvas depending on room and viewport. Its observable is "did a
 * particle burst happen", which is exactly right for that question.
 *
 * It is the wrong bar for grading the fix, and the reason is specific rather than
 * general. EVERY candidate fix emits a burst by construction, so a burst count
 * cannot rank two of them -- it would score them both perfect. And the cheapest
 * candidate available is the one most likely to be wrong: copy
 * `worldSceneFactory.ts`'s miss handler, which places the sparkle at a chosen
 * depth of 12 world units along the tap ray.
 *
 * THE MECHANISM I SUSPECT IN THAT COPY, STATED BEFORE MEASURING IT
 * ---------------------------------------------------------------
 * The 12 is not arbitrary outdoors; its own comment justifies it as "roughly the
 * camera's own orbit radius for these scenes", and it answers taps on SKY, which
 * has no geometry and therefore nothing that can come between the sparkle and the
 * camera. A room breaks both halves of that. Reading the shipped constants:
 *
 *   - all three rooms use `cameraPreset { azimuth: PI, polar: 1.19, distance: 14,
 *     target: [0, 0.5, 0] }`, putting the camera near (0, 5.70, -13.0) in
 *     landscape and looking down about 22 degrees;
 *   - the shell interior is |x| <= 5.4 (Playroom 6.0) with a ceiling slab at
 *     y = 6.2 (Playroom 6.75) and the back wall face at z = +8.28 (Playroom 8.85);
 *   - `SCENE_CAMERA_FOV` is 50, so tan(fov/2) = 0.466 and at 12 units the frustum
 *     half-height is 5.6 and its landscape half-width is 9.95.
 *
 * Two consequences follow arithmetically, not statistically. A top-of-frame ray
 * leaves the camera at about +3 degrees, so at 12 units it is at y = 6.4 -- ABOVE
 * the ceiling slab, with the slab between it and the camera. And a ray toward
 * either horizontal edge is past |x| = 5.4 well before 12 units, so its
 * 12-unit point sits OUTSIDE the side wall, with the wall in between.
 *
 * So I predict the copied fix emits on every missed tap, satisfies
 * `rooms-mute-dead.mjs` completely, and is still invisible over much of the very
 * band the charge is about -- because the unanswered samples were concentrated in
 * the upper third, which is precisely where a 12-unit point clears the ceiling.
 * If that is right, the count-based probe would certify a fix that does not work,
 * and only a geometric observable can catch it.
 *
 * THE OBSERVABLE, THEREFORE
 * -------------------------
 * For every burst the harness records the world point and casts back toward the
 * camera. A burst with opaque mesh geometry in front of it is emitted-but-hidden,
 * and counts against the fix exactly as heavily as no burst at all: on the child's
 * screen the two are the same event.
 *
 * PASS CONDITION, COMMITTED TO IN ADVANCE
 * ---------------------------------------
 * A fix passes when NO-VISIBLE-ANSWER -- unanswered plus emitted-but-hidden --
 * is at or under 1.0% of samples at every one of the five shipping viewports, in
 * all three rooms. 1.0% rather than 0.0% because a sample can land on the seam
 * between two shell panels and the slack should be geometric float error, nothing
 * more; if a fix needs more than that it is not the right fix. Anything above the
 * bar is a FAILED fix and must be published as one, not quietly retuned.
 *
 * AND A SECOND BAR, ADDED AFTER ARM A FAILED AND BEFORE ARM B WAS MEASURED
 * -----------------------------------------------------------------------
 * The bar above tests the burst's ANCHOR -- the point handed to `emit`. That is
 * enough to fail a fix that puts the anchor behind a wall, which is what arm A
 * did. It is not enough to pass one. A fix that lifts the burst off the surface
 * by an epsilon makes the anchor visible while leaving the sparkle itself inside
 * the plaster, and an anchor-only test would call that perfect. So the harness
 * also samples the burst's core -- the origin plus nine points at 0.5 units, a
 * radius derived from `SCENE_SPARKLE`'s own speed and lifetime, not chosen -- and
 * a fix must additionally keep the MEAN CORE VISIBILITY of its missed-tap bursts
 * at or above 0.5 at every viewport in every room. Half a golden burst standing
 * proud of a wall is a visible answer; a tenth of one is not.
 *
 * This bar is stricter than the run that graded arm A, which is the only direction
 * a bar may move between arms. Arm A's published failure stands on the 1.0% bar it
 * was graded against and does not depend on this one.
 *
 * PREMISES, both of which gate the whole report:
 *   - the emit counter must be wired to the engine the scene resolves;
 *   - the occlusion test must return HIDDEN for a point one unit behind the mesh
 *     at the centre of frame and VISIBLE for one a unit in front of it. A detector
 *     that says "visible" to everything would certify a sparkle inside a wall.
 *
 * The Nature control is here for a second reason beyond the first probe's. Nature
 * runs the 12-unit depth in an open scene, so its hidden fraction is the reading
 * that shows a high hidden fraction in the rooms is a fact about ROOMS and not an
 * artefact of the detector.
 */

import { chromium } from 'playwright';

const PAGE = (room) => `http://localhost:5199/.probe/render/room.html?room=${room}`;
const STEP = Number(process.env.STEP ?? 16);

/** The bar this pass grades against, as a fraction of samples. */
const PASS_FRACTION = 0.01;

/** Second bar: mean visible share of a burst's sampled core. See the header. */
const CORE_PASS_MEAN = 0.5;

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
 * Sweeps one scene at one viewport and classifies every missed tap by whether its
 * acknowledgement could be seen.
 *
 * @param scene - Scene id understood by the harness's `?room=` parameter.
 * @param w - Viewport width in CSS px.
 * @param h - Viewport height in CSS px.
 * @returns Sample counts, banding profile, sparkle-depth spread, and premise results.
 */
async function sweep(scene, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(PAGE(scene), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 60000 });

  const out = await page.evaluate((step) => {
    const emitWiring = window.__emitProbe();
    const occ = window.__occlusionProbe();
    const m = window.__missSweep(step);
    const u = window.__underNames(step);
    if (u.cols !== m.cols || u.rows !== m.rows) throw new Error('grids disagree -- cross-tab would be meaningless');
    const n = m.cols * m.rows;
    let fired = 0;
    let seen = 0;
    let hiddenOnly = 0;
    let unanswered = 0;
    const rowBad = new Array(m.rows).fill(0);
    const byName = {};
    const dists = [];
    let coreSeen = 0;
    let coreTotal = 0;
    for (let k = 0; k < n; k++) {
      if (m.fired[k] >= 0) {
        fired++;
        continue;
      }
      // Core visibility is a property of the miss acknowledgement, so it is
      // accumulated over miss samples only -- including the hidden ones, which are
      // exactly the samples a lenient core bar would let through.
      coreSeen += m.coreSeen[k];
      coreTotal += m.coreTotal[k];
      if (m.emits[k] === 0) {
        unanswered++;
        rowBad[Math.floor(k / m.cols)] += 1;
        byName[u.names[k]] = (byName[u.names[k]] ?? 0) + 1;
        continue;
      }
      if (m.ackDist[k] >= 0) dists.push(m.ackDist[k]);
      // Every burst this sample produced was behind geometry, so on screen the
      // sample is indistinguishable from one that emitted nothing.
      if (m.hidden[k] >= m.emits[k]) {
        hiddenOnly++;
        rowBad[Math.floor(k / m.cols)] += 1;
        byName[u.names[k]] = (byName[u.names[k]] ?? 0) + 1;
        continue;
      }
      seen++;
    }
    dists.sort((a, b) => a - b);
    const q = (f) => (dists.length === 0 ? -1 : dists[Math.min(dists.length - 1, Math.floor(f * dists.length))]);
    return {
      n,
      cols: m.cols,
      rows: m.rows,
      fired,
      seen,
      hiddenOnly,
      unanswered,
      rowBad,
      byName,
      blockedBy: m.blockedBy,
      emitWiring,
      occ,
      dMin: q(0),
      dMid: q(0.5),
      dMax: q(0.999),
      core: coreTotal === 0 ? -1 : coreSeen / coreTotal,
    };
  }, STEP);
  await page.close();
  return out;
}

/**
 * Where in the frame the samples with no visible answer sit.
 *
 * @param rowBad - Per-row count of samples with no visible answer, top to bottom.
 * @param rows - Number of grid rows.
 * @returns Vertical extent and upper-third concentration, or null when clean.
 */
function banding(rowBad, rows) {
  const total = rowBad.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const first = rowBad.findIndex((c) => c > 0);
  let last = rows - 1;
  while (last >= 0 && rowBad[last] === 0) last--;
  const upperThird = rowBad.slice(0, Math.ceil(rows / 3)).reduce((a, b) => a + b, 0);
  return { from: first / rows, to: (last + 1) / rows, upper: upperThird / total };
}

const pct = (a, b) => `${((100 * a) / b).toFixed(1)}%`;

console.log('==== GRADING PASS: CAN THE CHILD SEE THE ACKNOWLEDGEMENT, NOT JUST TRIGGER IT?\n');
console.log(`  Real pointer events, every ${STEP} px, through each scene's own createScene.`);
console.log('  NO VISIBLE ANSWER = arbitration fired nothing AND either no burst was emitted');
console.log('  or every burst it emitted was behind opaque mesh geometry from the camera.');
console.log(`  Pass bar committed in advance: <= ${(100 * PASS_FRACTION).toFixed(1)}% at every viewport, in every room.\n`);

const premiseFailures = [];

/**
 * Prints one table row and records any premise failure it exposes.
 *
 * @param scene - Scene id.
 * @param label - Viewport label.
 * @param r - Sweep result.
 */
function row(scene, label, r) {
  const bad = r.unanswered + r.hiddenOnly;
  console.log(
    `  ${(scene + ' ' + label).padEnd(30)} ${String(r.n).padStart(7)} ${String(r.fired).padStart(8)} ${String(r.seen).padStart(7)} ${String(r.hiddenOnly).padStart(8)} ${String(r.unanswered).padStart(7)} ${pct(bad, r.n).padStart(11)}`,
  );
  if (r.emitWiring !== 1) premiseFailures.push(`${scene} ${label}: emit wiring returned ${r.emitWiring}, expected 1`);
  if (!r.occ.beyondIsHidden) premiseFailures.push(`${scene} ${label}: occlusion test called a point BEHIND ${r.occ.via} visible`);
  if (!r.occ.nearerIsVisible) premiseFailures.push(`${scene} ${label}: occlusion test called a point IN FRONT OF ${r.occ.via} hidden`);
}

const HEAD = '  scene / viewport                samples   fired    seen   hidden  no-ack   NO ANSWER';

console.log('  --- CONTROL: Nature, which runs the 12-unit depth in an OPEN scene -----------');
console.log(HEAD);
const controlRows = [];
for (const [label, w, h] of VIEWS) {
  const r = await sweep(CONTROL, w, h);
  controlRows.push({ scene: CONTROL, label, r });
  row(CONTROL, label, r);
}

console.log('\n  --- SUBJECTS: the three rooms ------------------------------------------------');
console.log(HEAD);
const subjectRows = [];
for (const scene of SUBJECTS) {
  for (const [label, w, h] of VIEWS) {
    const r = await sweep(scene, w, h);
    subjectRows.push({ scene, label, r });
    row(scene, label, r);
  }
}

console.log('\n  --- PREMISES -----------------------------------------------------------------');
if (premiseFailures.length > 0) {
  console.log('  PREMISE BROKEN. Nothing above is evidence:');
  for (const f of premiseFailures) console.log(`      ${f}`);
} else {
  console.log(`  Emit counter wired to the scene's own engine at all ${controlRows.length + subjectRows.length} runs.`);
  console.log(`  Occlusion test resolves a point behind ${subjectRows[0].r.occ.via} as hidden and a point`);
  console.log('  in front of it as visible, so it can tell the two apart at all.');
}

console.log('\n  --- WHERE THE SAMPLES WITH NO VISIBLE ANSWER SIT -----------------------------');
console.log('  scene / viewport                 vertical extent of frame     share in upper third');
for (const { scene, label, r } of subjectRows) {
  const b = banding(r.rowBad, r.rows);
  const bad = r.unanswered + r.hiddenOnly;
  const where = b === null ? 'none' : `${(100 * b.from).toFixed(0)}% .. ${(100 * b.to).toFixed(0)}% from the top`;
  const up = b === null ? '-' : pct(b.upper * bad, bad);
  console.log(`  ${(scene + ' ' + label).padEnd(30)} ${where.padEnd(28)} ${up.padStart(8)}`);
}

console.log('\n  --- HOW FAR FROM THE CAMERA THE SPARKLES LAND --------------------------------');
console.log('  A sparkle placed on the surface it answers varies in depth with the surface, so');
console.log('  its apparent size varies too. This is on the record because a wide spread is a');
console.log('  legitimate follow-up defect even when the visibility bar is met.');
console.log('  scene / viewport                 nearest      median     farthest   (world units)');
for (const { scene, label, r } of [...controlRows, ...subjectRows]) {
  if (r.dMin < 0) {
    console.log(`  ${(scene + ' ' + label).padEnd(30)} (no bursts recorded)`);
    continue;
  }
  console.log(`  ${(scene + ' ' + label).padEnd(30)} ${r.dMin.toFixed(2).padStart(8)} ${r.dMid.toFixed(2).padStart(11)} ${r.dMax.toFixed(2).padStart(12)}`);
}

console.log('\n  --- HOW MUCH OF THE BURST ITSELF IS VISIBLE, NOT JUST ITS ANCHOR -------------');
console.log("  Origin plus nine points at 0.5 units along the preset's own emission cone.");
console.log(`  Second bar, committed before this arm was measured: mean >= ${CORE_PASS_MEAN.toFixed(2)}.`);
console.log('  scene / viewport                 mean visible share of burst core');
for (const { scene, label, r } of [...controlRows, ...subjectRows]) {
  const value = r.core < 0 ? '(no bursts)' : r.core.toFixed(3);
  const flag = r.core >= 0 && r.core < CORE_PASS_MEAN ? '   <-- BELOW BAR' : '';
  console.log(`  ${(scene + ' ' + label).padEnd(30)} ${value.padStart(12)}${flag}`);
}

console.log('\n  --- WHICH MESH BLOCKED THE SPARKLE -------------------------------------------');
console.log('  Named because a blame list is how a detector false positive shows up AS one.');
console.log('  A blocker that is obviously see-through means the test is wrong, not the fix.');
for (const scene of [CONTROL, ...SUBJECTS]) {
  const rows = [...controlRows, ...subjectRows].filter((s) => s.scene === scene);
  const agg = {};
  let total = 0;
  for (const { r } of rows) {
    for (const [name, c] of Object.entries(r.blockedBy)) {
      agg[name] = (agg[name] ?? 0) + c;
      total += c;
    }
  }
  const tag = scene === CONTROL ? `${scene} (CONTROL)` : scene;
  if (total === 0) {
    console.log(`\n  ${tag} -- no burst was blocked by anything, at any viewport.`);
    continue;
  }
  const top = Object.entries(agg)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  console.log(`\n  ${tag} -- ${total} blocked bursts across ${rows.length} viewports:`);
  for (const [name, c] of top) console.log(`      ${pct(c, total).padStart(7)}  ${name}`);
}

console.log('\n  --- WHAT WAS UNDER THE FINGER WHEN NO ANSWER ARRIVED -------------------------');
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
  if (total === 0) {
    console.log(`\n  ${scene} -- every missed tap got a visible answer at all ${rows.length} viewports.`);
    continue;
  }
  const top = Object.entries(agg)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  console.log(`\n  ${scene} -- ${total} samples with no visible answer across ${rows.length} viewports:`);
  for (const [name, c] of top) console.log(`      ${pct(c, total).padStart(7)}  ${name}`);
}

console.log('\n  --- VERDICT ------------------------------------------------------------------');
if (premiseFailures.length > 0) {
  console.log('  NO VERDICT: a premise failed above. The instrument has to be fixed first.');
} else {
  const worst = subjectRows.reduce((a, b) => ((b.r.unanswered + b.r.hiddenOnly) / b.r.n > (a.r.unanswered + a.r.hiddenOnly) / a.r.n ? b : a));
  const worstBad = worst.r.unanswered + worst.r.hiddenOnly;
  const worstFrac = worstBad / worst.r.n;
  const controlWorst = controlRows.reduce((a, b) => ((b.r.unanswered + b.r.hiddenOnly) / b.r.n > (a.r.unanswered + a.r.hiddenOnly) / a.r.n ? b : a));
  console.log(`  Worst room viewport: ${worst.scene} ${worst.label} at ${pct(worstBad, worst.r.n)} with no visible answer.`);
  console.log(`  Nature at the same depth constant, open scene: ${pct(controlWorst.r.unanswered + controlWorst.r.hiddenOnly, controlWorst.r.n)} at its worst.`);
  const hiddenShare = subjectRows.reduce((a, s) => a + s.r.hiddenOnly, 0);
  const noAckShare = subjectRows.reduce((a, s) => a + s.r.unanswered, 0);
  console.log(`  Of the room failures, ${hiddenShare} were emitted-but-hidden and ${noAckShare} emitted nothing at all.`);
  const coreWorst = subjectRows.filter((s) => s.r.core >= 0).reduce((a, b) => (b.r.core < a.r.core ? b : a), { r: { core: 1 }, scene: '-', label: '' });
  console.log(`  Thinnest burst core in any room viewport: ${coreWorst.r.core.toFixed(3)} visible (${coreWorst.scene} ${coreWorst.label}).`);
  if (worstFrac <= PASS_FRACTION && coreWorst.r.core >= CORE_PASS_MEAN) {
    console.log(`  AT OR UNDER the ${(100 * PASS_FRACTION).toFixed(1)}% bar at every viewport, and the burst core clears`);
    console.log(`  ${CORE_PASS_MEAN.toFixed(2)} everywhere too. THE FIX PASSES both bars it was graded against.`);
  } else if (worstFrac <= PASS_FRACTION) {
    console.log(`  Anchor visibility clears the ${(100 * PASS_FRACTION).toFixed(1)}% bar, but the burst core falls under`);
    console.log(`  ${CORE_PASS_MEAN.toFixed(2)}. THE FIX FAILS: the answer is being placed just barely proud of the`);
    console.log('  surface, so its anchor reads and the sparkle does not. Publish and iterate.');
  } else {
    console.log(`  ABOVE the ${(100 * PASS_FRACTION).toFixed(1)}% bar. THE FIX FAILS its own evaluation and must be published as failed.`);
    if (hiddenShare > noAckShare) {
      console.log('  The dominant mode is emitted-but-hidden: the acknowledgement is being requested');
      console.log('  and then placed where the room itself covers it. That is a DEPTH defect, not a');
      console.log('  wiring one, and the next iteration has to choose the depth rather than inherit it.');
    }
  }
}

await browser.close();
