/**
 * WHY THE RAIL SCORES 98% AND EVERY STAGING OF MY RUN SCORES ~50%.
 *
 * A vertical frame edge cutting a DIAGONAL BAND leaves a triangular wedge, and a
 * triangle is half the parallelogram over the same span -- so ~50% is the
 * geometric signature of a band nibbled at its TIP. The rail escapes it for one
 * reason: part of the rail is ALWAYS inside the frame, even at aspect 0.40, so
 * the edge always cuts the rail MID-RUN, never at its tip.
 *
 * If that is the mechanism, then the rule is not "be elongated" but "be anchored
 * inside the narrowest frame and run outward from there". This probe tests it.
 */
import { PerspectiveCamera, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';
const M = await bundleEntry(
  'pc-anchor-inside',
  `
  export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from './src/utils/cameraPresets';
  export { hullHalfWidthAt, HULL_Z_AFT, HULL_Z_FWD } from './src/scenes/immersive-toybox-scenes/pirate-cove/hullPlan';
`,
);
const cameraFor = (a) => {
  const pose = M.resolveSceneCameraPose('pirate-cove', a);
  const c = new PerspectiveCamera(M.SCENE_CAMERA_FOV, a, 0.1, 100);
  c.position.copy(pose.position);
  c.lookAt(pose.target);
  c.updateMatrixWorld(true);
  c.updateProjectionMatrix();
  return c;
};
// widest |x| at deck level still inside the frame, at the NARROWEST shipping aspect
const NARROW = 0.4;
const cam = cameraFor(NARROW);
const inFront = (p) => -p.clone().applyMatrix4(cam.matrixWorldInverse).z > 0;
const edgeAt = (z) => {
  let lo = 0,
    hi = 30;
  for (let k = 0; k < 60; k++) {
    const m = (lo + hi) / 2;
    const p = new Vector3(m, 0, z);
    if (!inFront(p)) {
      hi = m;
      continue;
    }
    const v = p.clone().project(cam);
    if (Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1) lo = m;
    else hi = m;
  }
  return lo;
};
console.log('==== At the NARROWEST shipping aspect (0.400), where does the deck-level frame edge sit,');
console.log('     and where does a rail-hugging run at inset 0.5 sit?\n');
console.log('     z     hull halfwidth   run |x| (inset 0.5)   frame edge |x|   run inside frame?');
for (let z = -9; z <= 11; z += 1) {
  const half = M.hullHalfWidthAt(z);
  if (half === null) continue;
  const runX = half - 0.5;
  const e = edgeAt(z);
  console.log(
    `  ${String(z).padStart(4)}      ${half.toFixed(2).padStart(6)}            ${runX.toFixed(2).padStart(6)}            ${e.toFixed(2).padStart(6)}        ${runX <= e ? 'YES' : 'no'}`,
  );
}
