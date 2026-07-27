/**
 * Is the monotonicity half of test 5 falsifiable at all?
 *
 * THE SUSPICION. `visiblePixels` is `area(clipRect(hull, halfW, halfH))` where
 * the hull is in PIXELS and `halfW = aspect * CANVAS_H / 2`. Pixel geometry is
 * aspect-invariant (measured worst deviation 2.27e-13 px between aspect 0.400
 * and 1.778), so the hull is the SAME polygon at every aspect and only `halfW`
 * moves. Clipping a fixed polygon to a rectangle that only ever grows wider
 * cannot yield less area. So painted pixels are non-increasing as aspect falls
 * FOR ANY STAGING WHATSOEVER — the assertion is a theorem about the projection,
 * not a claim about where the spars are.
 *
 * If that is right, no staging can turn test 5's monotonicity clause red, and
 * calling it a check on the fix would be a lie. This brute-forces the claim over
 * random stagings, including absurd ones, to try to find a counterexample.
 */

import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';
import { visiblePixels } from '../tests/framework/_project.mjs';

const M = await bundleEntry(
  'pc-monotone-tautology',
  `
  export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from './src/utils/cameraPresets';
  export { createPirateCoveMaterials } from './src/scenes/immersive-toybox-scenes/pirate-cove/materials';
  export { createRailStowage } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/railStowage/create';
  export { createBarrel } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/barrels/create';
`,
);

const ASPECTS = [1280 / 720, 1024 / 768, 1, 768 / 1024, 375 / 667, 480 / 854, 393 / 852, 412 / 915, 0.4].sort((a, b) => b - a);
const materials = M.createPirateCoveMaterials();
const cameraFor = (aspect) => {
  const pose = M.resolveSceneCameraPose('pirate-cove', aspect);
  const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, aspect, 0.1, 100);
  cam.position.copy(pose.position);
  cam.lookAt(pose.target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
};
const CAMS = ASPECTS.map(cameraFor);

const vertsOf = (make) => {
  const root = make(new Scene());
  root.updateMatrixWorld(true);
  const out = [];
  const v = new Vector3();
  root.traverse((o) => {
    const pos = o.geometry?.attributes?.position;
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) out.push(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).clone());
  });
  return out;
};

// Deterministic LCG so a counterexample can be reproduced.
let seed = 20260718;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const pick = (lo, hi) => lo + rnd() * (hi - lo);

let violations = 0;
let tested = 0;
let worstRise = 0;
for (let trial = 0; trial < 400; trial++) {
  const zA = pick(-7.5, 1.5);
  const zF = zA + pick(0.2, 8);
  const run = { side: rnd() < 0.5 ? -1 : 1, zAft: zA, zFwd: Math.min(zF, 3.5), inset: pick(-1.5, 4.5) };
  let verts;
  try {
    verts = vertsOf((s) => M.createRailStowage(s, run, { materials }));
  } catch {
    continue;
  }
  if (!verts.length) continue;
  tested++;
  const px = CAMS.map((cam, i) => visiblePixels(cam, verts, ASPECTS[i]));
  for (let i = 1; i < px.length; i++) {
    if (px[i] > px[i - 1] + 1e-6) {
      violations++;
      worstRise = Math.max(worstRise, px[i] - px[i - 1]);
      if (violations <= 3) console.log('  COUNTEREXAMPLE', JSON.stringify(run), px.map((n) => n.toFixed(0)).join(' '));
      break;
    }
  }
}

console.log(`\n  random stagings tested   ${tested}`);
console.log(`  monotonicity violations  ${violations}${violations ? ` (worst rise ${worstRise.toFixed(1)} px)` : ''}`);

// And the same question for a COMPACT prop, in case elongation is doing the work.
let cViolations = 0;
for (let trial = 0; trial < 200; trial++) {
  const verts = vertsOf((s) =>
    M.createBarrel(s, { position: new Vector3(pick(-9, 9), 0, pick(-7, 3)), rotY: pick(0, 6.28), scale: pick(0.4, 2.5) }, { materials }),
  );
  const px = CAMS.map((cam, i) => visiblePixels(cam, verts, ASPECTS[i]));
  for (let i = 1; i < px.length; i++)
    if (px[i] > px[i - 1] + 1e-6) {
      cViolations++;
      break;
    }
}
console.log(`  compact-prop violations  ${cViolations} of 200`);
