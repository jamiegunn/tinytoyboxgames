/**
 * THE PROOF IN SECTION 2 STANDS. THE CONCLUSION DRAWN FROM IT DID NOT.
 *
 * That on-screen scale depends only on viewport height and distance, never on
 * aspect, is correct and was validated against 28 rendered rows. What this round
 * then inferred from it -- that small on-screen props are therefore untappable
 * against a 44 px floor -- is void; see the header of `.probe/render/targets.mjs`
 * and docs/ai-guidance/reviews/round-5-tap-arbitration.md.
 */
/**
 * ROUND 5, THE PROOF AND THE TEST OF THE PROOF.
 *
 * THE CLAIM
 * ---------
 * `distanceMultiplierForAspect` conditions the camera distance on ASPECT RATIO.
 * The quantity vision.md actually constrains -- "large touch-friendly
 * interactive zones", "avoid small precision targets" -- is a prop's footprint
 * on glass in CSS px. Those two things are not related. On-screen scale for a
 * perspective camera with a fixed VERTICAL fov is
 *
 *     px per world unit = viewportHeightPx / (2 * distanceToProp * tan(fov/2))
 *
 * Aspect does not appear. Widen or narrow the viewport at a fixed height and
 * every prop stays exactly the same size; you see more or less to the sides.
 * So the rule steers distance using a variable that has no bearing on target
 * size -- and it steers it the wrong way, because the narrow viewports it pushes
 * the camera away from are also the SHORT ones, where targets are smallest to
 * begin with.
 *
 * TESTING THE PROOF INSTEAD OF ASSERTING IT
 * -----------------------------------------
 * Section 1 below checks that formula against pixels that were actually rendered
 * by `.probe/render/targets.mjs` through the real renderer. If the algebra is
 * wrong, the predicted and measured columns diverge and this probe says so. That
 * is the whole point: a closed-form proxy earns the right to be used on the rest
 * of the catalog only by first reproducing measured pixels.
 *
 * Section 2 then uses it where rendering every scene would be prohibitive: does
 * the live pull-back drive tap targets under the 44 CSS px floor in the four
 * scenes that have it switched on, or is Pirate Cove's dead pull-back hiding a
 * problem the rest of the catalog is already shipping?
 */

import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'pc-target-scale',
  `
  export { SCENE_CATALOG, getSceneCameraPreset } from './src/scenes/sceneCatalog';
  export { SCENE_CAMERA_FOV, resolveSceneCameraPose, distanceMultiplierForAspect } from './src/utils/cameraPresets';
`,
);

const FLOOR = 44;
const TAN_HALF_FOV = Math.tan((M.SCENE_CAMERA_FOV * Math.PI) / 360);

/** px per world unit at a given prop distance and viewport height. Aspect-free. */
const pxPerWorldUnit = (viewportHeightPx, distanceToProp) => viewportHeightPx / (2 * distanceToProp * TAN_HALF_FOV);

console.log('==== 1. DOES THE FORMULA REPRODUCE RENDERED PIXELS?\n');
console.log('  Measured columns are the "box min" side from .probe/render/targets.mjs,');
console.log('  produced by hiding the prop and diffing real frames. Predicted assumes a');
console.log('  single fixed world size per prop and only the formula above.\n');

/**
 * Rendered ground truth, transcribed from `.probe/render/targets.mjs` output.
 * Each row: viewport height px, camera radius, measured box-min in CSS px.
 * Pirate Cove's target sits at y 1.5 and these props sit near the deck a few
 * units forward of it, so the camera-to-prop distance is not the radius; it is
 * solved for, once, from the landscape row, and then held FIXED across every
 * other row. If the formula is right, one constant explains all of them.
 */
const MEASURED = {
  cannon: [
    [720, 12, 46],
    [768, 12, 49],
    [900, 12, 57],
    [1024, 12, 65],
    [854, 12, 54],
    [667, 12, 43],
    [852, 12, 55],
    [915, 12, 58],
    [900, 12, 57],
    [854, 16.008, 42],
    [667, 16.008, 33],
    [852, 19.511, 35],
    [915, 19.996, 37],
    [900, 22.5, 33],
  ],
  chest: [
    [720, 12, 69],
    [768, 12, 74],
    [900, 12, 86],
    [1024, 12, 98],
    [854, 12, 82],
    [667, 12, 64],
    [852, 12, 81],
    [915, 12, 88],
    [900, 12, 86],
    [854, 16.008, 61],
    [667, 16.008, 48],
    [852, 19.511, 50],
    [915, 19.996, 52],
    [900, 22.5, 46],
  ],
};

let worstErr = 0;
for (const [prop, rows] of Object.entries(MEASURED)) {
  // Calibrate ONE number -- the prop's world size divided by its depth offset --
  // from the first row only, then predict every other row with it untouched.
  const [h0, r0, m0] = rows[0];
  const k = m0 / pxPerWorldUnit(h0, r0);
  console.log(`  ${prop}: one constant (world size / depth factor) = ${k.toFixed(4)}, calibrated on row 1 alone`);
  console.log('    viewport h   radius   measured   predicted   error');
  for (const [h, r, measured] of rows) {
    const predicted = k * pxPerWorldUnit(h, r);
    const err = Math.abs(predicted - measured) / measured;
    if (err > worstErr) worstErr = err;
    console.log(
      `    ${String(h).padStart(10)}   ${r.toFixed(3).padStart(6)}   ${String(measured).padStart(8)}   ${predicted.toFixed(1).padStart(9)}   ${(err * 100).toFixed(1).padStart(5)}%`,
    );
  }
  console.log('');
}
console.log(`  worst error across ${Object.values(MEASURED).flat().length} rendered rows: ${(worstErr * 100).toFixed(1)}%`);
console.log(
  worstErr < 0.08
    ? '  VERDICT: the formula reproduces rendered pixels. It may be used below.\n'
    : '  VERDICT: the formula does NOT reproduce rendered pixels. Do not trust section 2.\n',
);

console.log('==== 2. AND THE ASPECT-INDEPENDENCE CLAIM ITSELF\n');
console.log('  Same camera radius, same viewport HEIGHT, different widths. If target');
console.log('  size depended on aspect at all, these would differ.\n');
console.log('  viewport        aspect    px per world unit at d=12');
for (const [w, h] of [
  [1600, 900],
  [1200, 900],
  [900, 900],
  [500, 900],
  [360, 900],
]) {
  console.log(`  ${String(w).padStart(4)} x ${h}     ${(w / h).toFixed(3)}    ${pxPerWorldUnit(h, 12).toFixed(6)}`);
}

console.log('\n==== 3. WHAT THE LIVE PULL-BACK DOES TO TAP TARGETS, CATALOG-WIDE\n');
console.log('  Using the cannon constant as a stand-in for "a small tappable prop": it');
console.log('  is the smallest tappable thing measured this round, so it is the one the');
console.log(`  ${FLOOR} px floor bites first. Radii come from the REAL resolveSceneCameraPose.\n`);

const K_SMALL = MEASURED.cannon[0][2] / pxPerWorldUnit(MEASURED.cannon[0][0], MEASURED.cannon[0][1]);

const PHONES = [
  ['iPhone SE 375x667', 375, 667],
  ['iPhone 15 393x852', 393, 852],
  ['Pixel 8 412x915', 412, 915],
  ['extreme 360x900', 360, 900],
];

console.log('  scene                       phone                 radius   small-prop px   verdict');
for (const id of Object.keys(M.SCENE_CATALOG)) {
  let preset;
  try {
    preset = M.getSceneCameraPreset(id);
  } catch {
    continue;
  }
  // Scale the stand-in prop to each scene's own working distance, so a scene
  // staged at distance 14 is not judged by a prop sized for distance 12.
  const kScene = K_SMALL * (preset.distance / 12);
  for (const [label, w, h] of PHONES) {
    const r = M.resolveSceneCameraPose(id, w / h).radius;
    const px = kScene * pxPerWorldUnit(h, r);
    console.log(`  ${id.padEnd(27)} ${label.padEnd(20)} ${r.toFixed(2).padStart(7)}   ${px.toFixed(0).padStart(13)}   ${px < FLOOR ? 'UNDER 44' : 'ok'}`);
  }
}

console.log('\n==== 4. THE SAME SCENES WITH THE PULL-BACK SWITCHED OFF\n');
console.log('  Identical stand-in prop, identical viewports, camera left at the presets');
console.log('  own authored distance instead of being dollied back.\n');
console.log('  scene                       phone                 radius   small-prop px   verdict');
for (const id of Object.keys(M.SCENE_CATALOG)) {
  let preset;
  try {
    preset = M.getSceneCameraPreset(id);
  } catch {
    continue;
  }
  const kScene = K_SMALL * (preset.distance / 12);
  for (const [label, , h] of PHONES) {
    const r = preset.distance;
    const px = kScene * pxPerWorldUnit(h, r);
    console.log(`  ${id.padEnd(27)} ${label.padEnd(20)} ${r.toFixed(2).padStart(7)}   ${px.toFixed(0).padStart(13)}   ${px < FLOOR ? 'UNDER 44' : 'ok'}`);
  }
}
