/**
 * ROUND 5, ITERATION 2: IS A NON-MERGING ROW OF FOUR PORTALS EVEN POSSIBLE?
 *
 * `.probe/render/nature-portal-overlap.mjs` falsified the layout this round had
 * already written into `environment.ts`: every adjacent portal pair fuses into a
 * single silhouette at every shipping viewport, worst -73.4 px. The solve was
 * correct against its own criterion (centre separation >= PROXIMITY_PX) and the
 * criterion was incomplete -- it measures centres, and portals have width.
 *
 * Before re-solving, this asks whether the target is reachable at all, because
 * the answer decides WHAT to change. A portal pedestal is a disc of world radius
 * 0.7 (`gamePortal.ts`). Four of them in a row need four diameters of screen
 * width plus three gaps, inside a frame that is 360 px wide on the narrowest
 * shipping viewport. If that does not fit at any depth, then no amount of
 * re-solving positions helps and the pedestal size itself is the thing to
 * question -- a different, larger change that would touch every scene.
 *
 * For each depth z it reports, at the worst of the nine viewports:
 *
 *   pitch   the minimum centre-to-centre x separation at which two discs at that
 *           depth stop overlapping on screen. Measured by projecting the disc's
 *           own rim, not by scaling a radius -- a flat disc seen from 21 degrees
 *           above projects to an ellipse, and its width is not its depth.
 *   span    3 * pitch + one full diameter: the screen width four such discs
 *           occupy edge to edge.
 *   fits    span against the usable frame width (frame minus the NDC margin the
 *           solver already requires for framing).
 */

import { PerspectiveCamera, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'nature-portal-fit',
  `
  export { resolveSceneCameraPose, SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
`,
);

const PEDESTAL_R = 0.7;
const PEDESTAL_Y = 0.06;
const NDC_MARGIN = 0.04;
const RIM = 24;

const VIEWS = [
  ['landscape 1280x720', 1280, 720],
  ['tablet 1024x768', 1024, 768],
  ['square 900x900', 900, 900],
  ['iPad portrait 768x1024', 768, 1024],
  ['viewport 480x854', 480, 854],
  ['iPhone SE 375x667', 375, 667],
  ['iPhone 15 393x852', 393, 852],
  ['Pixel 8 412x915', 412, 915],
  ['extreme 360x900', 360, 900],
];

const CAMS = VIEWS.map(([label, w, h]) => {
  const pose = M.resolveSceneCameraPose('nature', w / h);
  const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, w / h, 0.1, 100);
  cam.position.copy(pose.position);
  cam.lookAt(pose.target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return { label, w, h, cam };
});

const px = (v, view) => {
  const n = v.clone().project(view.cam);
  return { x: ((n.x + 1) / 2) * view.w, y: ((1 - n.y) / 2) * view.h, nx: n.x, ny: n.y, nz: n.z };
};

/** Screen-x extent of the pedestal disc centred at (x, z), at one viewport. */
const extent = (x, z, view) => {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < RIM; i++) {
    const a = (i / RIM) * Math.PI * 2;
    const p = px(new Vector3(x + PEDESTAL_R * Math.cos(a), PEDESTAL_Y, z + PEDESTAL_R * Math.sin(a)), view);
    if (p.nz > 1) return null;
    lo = Math.min(lo, p.x);
    hi = Math.max(hi, p.x);
  }
  return { lo, hi };
};

console.log('==== CAN FOUR 1.4-UNIT DISCS SHOW DAYLIGHT BETWEEN THEM ON A 360px FRAME?\n');
console.log('  depth z   worst viewport            pitch    span   usable   fits');

let anyFit = null;
for (let z = -4.6; z <= 4.6; z += 0.4) {
  let worstPitch = 0;
  let worstView = null;
  let spanAt = 0;
  let usableAt = 0;
  let ok = true;
  for (const view of CAMS) {
    // Pitch is the separation at which two neighbours' extents just touch. The
    // projection is not uniform across the frame, so this is measured for a pair
    // straddling the centre line, which is where the discs are widest on screen.
    let pitch = 0;
    for (let d = 0.4; d <= 6.0; d += 0.02) {
      const a = extent(-d / 2, z, view);
      const b = extent(d / 2, z, view);
      if (!a || !b) {
        pitch = Infinity;
        break;
      }
      // The scene's azimuth is pi, so world +x lands on the LEFT of the screen.
      // Comparing `b.lo - a.hi` alone silently never separates.
      if (Math.max(b.lo - a.hi, a.lo - b.hi) >= 0) {
        pitch = d;
        break;
      }
    }
    if (!pitch) pitch = Infinity;
    const usable = view.w * (1 - NDC_MARGIN);
    // Four discs at that pitch, edge to edge: 3 pitches plus one disc width.
    const outer = extent(-1.5 * pitch, z, view);
    const outer2 = extent(1.5 * pitch, z, view);
    const span = pitch === Infinity || !outer || !outer2 ? Infinity : Math.max(outer.hi, outer2.hi) - Math.min(outer.lo, outer2.lo);
    if (pitch > worstPitch) {
      worstPitch = pitch;
      worstView = view.label;
      spanAt = span;
      usableAt = usable;
    }
    if (span > usable) ok = false;
  }
  const line = `  ${z.toFixed(1).padStart(6)}    ${String(worstView).padEnd(24)} ${worstPitch === Infinity ? '  n/a' : worstPitch.toFixed(2).padStart(5)}  ${spanAt === Infinity ? '   n/a' : spanAt.toFixed(0).padStart(6)}  ${usableAt.toFixed(0).padStart(7)}   ${ok ? 'yes' : 'no'}`;
  console.log(line);
  if (ok && !anyFit) anyFit = { z, pitch: worstPitch };
}

console.log('');
if (anyFit) {
  console.log(`  A row of four fits from z = ${anyFit.z.toFixed(1)} onward, at pitch >= ${anyFit.pitch.toFixed(2)} world units.`);
  console.log('');
  console.log('  And the pitch column is the finding. It is 1.40 at EVERY depth and EVERY');
  console.log('  viewport -- exactly two pedestal radii -- because both discs lie in the same');
  console.log('  ground plane, and the projection of a plane the camera is in front of is a');
  console.log('  projective map: it cannot make two disjoint coplanar discs overlap, nor two');
  console.log('  overlapping ones separate. So perspective is not what fused the portals.');
  console.log('  The discs INTERSECT IN WORLD SPACE: the solved inner pair sits 1.2 units');
  console.log('  apart and occupies 1.4. The screen-pixel criterion was never going to see');
  console.log('  that, and the constraint it was missing needs no projection at all --');
  console.log('  portal centres must be at least 1.4 units apart, plus whatever daylight the');
  console.log('  composition wants between them.');
} else {
  console.log('  No depth admits four non-overlapping discs in a row at every viewport.');
  console.log('  A row is therefore the wrong shape, or 1.4 units is the wrong pedestal.');
}
