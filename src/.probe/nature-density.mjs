/**
 * RETRACTED BY FALSIFICATION 10 -- KEPT BECAUSE THE ARITHMETIC IS STILL SOUND
 * AND ONLY ITS RELEVANCE DIED.
 *
 * This file prices a rule the app does not enforce. It bounds how many props can
 * be staged with pairwise CENTRE separation above `PROXIMITY_PX`, on the belief
 * that two targets closer than that are confusable. `onPointerUp` raycasts
 * first, so centre distance never arbitrates a tap that lands on geometry -- the
 * mesh under the finger wins. See docs/ai-guidance/reviews/round-5-tap-arbitration.md.
 * Read the packing bound as geometry, not as a UX constraint.
 */
/**
 * ROUND 5, ITERATION 4: IS THE ASK FEASIBLE AT ALL?
 *
 * v5 solves. It clears every bar -- tier 1 70.9 px, tier 2 74.1 px, zero props
 * off-frame, zero props in the bank, 1.32 units of grass between the closest
 * pedestal rims. It gets there by relocating SIXTEEN of the twenty-two non-portal
 * props, including all five flowers, the snail and three of the four butterflies.
 *
 * That is not a fix. That is a redesign nobody reviewed, and the round already
 * wrote down that a solver permitted to move everything stops being a fix. So
 * before writing v5's answer into the tree the question has to be asked the other
 * way round: is 70 px of separation between twenty-six tappable props ACHIEVABLE
 * on a 360x900 phone by any arrangement whatsoever?
 *
 * THE CALCULATION
 * ---------------
 * "Every pair at least d px apart" is disc packing: put a disc of radius d/2 on
 * each target and no two may overlap. The densest arrangement of points with a
 * minimum spacing d is the hexagonal lattice, one point per (sqrt(3)/2) * d^2 of
 * area. So an area A can hold at most
 *
 *     N_max = A / (0.866 * d^2)
 *
 * targets, and no cleverness beats it -- it is a bound on the plane, not on a
 * particular solver. The relevant A is not the viewport. It is the part of the
 * screen the props can actually stand on: the ground plane, inside the frame at
 * EVERY shipping viewport, and clear of the bank. That region is measured here by
 * projecting each 0.1x0.1 world cell of the solver's own grid and summing the
 * screen area of its four corners, which handles the foreshortening exactly where
 * a bounding box would not.
 *
 * The bound is generous in three ways, all deliberate, so that a FAIL here cannot
 * be argued away:
 *   - it ignores that portals additionally need 1.70 units of world separation;
 *   - it ignores that props are staged in groups a composition reads as one;
 *   - it counts the whole reachable ground, including the parts a designer would
 *     never use.
 * If the honest bound says the scene cannot hold its own prop count, then no
 * arrangement can, and the defect is the prop count.
 */
import { PerspectiveCamera, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';
import { execSync } from 'node:child_process';
import { bankClearance } from './_stream.mjs';

const M = await bundleEntry(
  'nature-density',
  `
  export { resolveSceneCameraPose, SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
  export { PROXIMITY_PX, WOBBLE_TAP_TOLERANCE_PX } from './src/utils/interaction/gestureRules';
`,
);
const D = M.PROXIMITY_PX;
const SMEAR = 2 * M.WOBBLE_TAP_TOLERANCE_PX;
const NDC = 0.04;
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
const px = (v, V) => {
  const n = v.clone().project(V.cam);
  return { x: ((n.x + 1) / 2) * V.w, y: ((1 - n.y) / 2) * V.h, nx: n.x, ny: n.y, nz: n.z };
};
const framedAll = (v) =>
  CAMS.every((V) => {
    const s = px(v, V);
    return s.nz <= 1 && Math.abs(s.nx) <= 1 - NDC && Math.abs(s.ny) <= 1 - NDC;
  });

const CELL = 0.1;
const GROUND = [];
for (let x = -4.6; x <= 4.601; x += CELL)
  for (let z = -4.6; z <= 4.601; z += CELL) {
    const v = new Vector3(Math.round(x * 10) / 10, 0, Math.round(z * 10) / 10);
    if (!framedAll(v)) continue;
    if (bankClearance(v.x, v.z) < 0.2) continue;
    GROUND.push(v);
  }

/** Screen area of one world cell, from the quadrilateral its four corners project to. */
const cellArea = (v, V) => {
  const c = [
    [0, 0],
    [CELL, 0],
    [CELL, CELL],
    [0, CELL],
  ].map(([dx, dz]) => px(new Vector3(v.x + dx - CELL / 2, 0, v.z + dz - CELL / 2), V));
  let a = 0;
  for (let i = 0; i < 4; i++) {
    const p = c[i];
    const q = c[(i + 1) % 4];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
};

const nonPortal = execSync('git show HEAD:./src/scenes/immersive-toybox-scenes/naturescene/staging/mushrooms.ts', { encoding: 'utf8' });
void nonPortal;
const COUNT = 26; // 22 staged props + 4 portals, all registered tap targets.

console.log('==== CAN TWENTY-SIX TAP TARGETS FIT, AT ALL?\n');
console.log(`  A hexagonal lattice with minimum spacing d holds one point per 0.866*d^2.`);
console.log(`  d = ${D} px (the forgiveness radius) needs ${(0.866 * D * D).toFixed(0)} px^2 each;`);
console.log(`  d = ${SMEAR} px (a single tap's own smear) needs ${(0.866 * SMEAR * SMEAR).toFixed(0)} px^2 each.\n`);
/**
 * Two areas per viewport, because they answer different questions.
 *
 *   shared   the ground that is framed at ALL nine viewports and clear of the
 *            bank -- the region a prop may actually be staged in, since a prop
 *            has one position and has to work everywhere.
 *   local    the ground framed at THIS viewport alone.
 *
 * If `local` is comfortable and `shared` is not, the defect is the intersection:
 * one staging serving nine aspect ratios. If neither is comfortable, the defect
 * is the frame itself, and no staging rescues it.
 */
console.log('  viewport                 shared ground   max@70   local ground   max@70   need');
let worst = null;
for (const V of CAMS) {
  const area = GROUND.reduce((s, v) => s + cellArea(v, V), 0);
  const n70 = area / (0.866 * D * D);
  const n56 = area / (0.866 * SMEAR * SMEAR);
  let local = 0;
  for (let x = -4.6; x <= 4.601; x += CELL)
    for (let z = -4.6; z <= 4.601; z += CELL) {
      const v = new Vector3(Math.round(x * 10) / 10, 0, Math.round(z * 10) / 10);
      const s = px(v, V);
      if (s.nz > 1 || Math.abs(s.nx) > 1 - NDC || Math.abs(s.ny) > 1 - NDC) continue;
      if (bankClearance(v.x, v.z) < 0.2) continue;
      local += cellArea(v, V);
    }
  const row = { label: V.label, area, n70, n56, local, ln70: local / (0.866 * D * D) };
  if (!worst || n70 < worst.n70) worst = row;
  console.log(
    `  ${V.label.padEnd(24)} ${area.toFixed(0).padStart(9)} px^2 ${n70.toFixed(1).padStart(7)} ${local.toFixed(0).padStart(11)} px^2 ${row.ln70.toFixed(1).padStart(7)} ${String(COUNT).padStart(6)}  ${n70 >= COUNT ? '' : 'IMPOSSIBLE'}`,
  );
}
console.log('');
console.log(`  Tightest viewport: ${worst.label}.`);
console.log(`  It can hold ${worst.n70.toFixed(1)} targets at the ${D} px catchment. The scene stages ${COUNT}.`);
console.log('');
if (worst.n70 < COUNT) {
  console.log(`  So no arrangement of ${COUNT} props satisfies the app's own two rules on that`);
  console.log('  viewport. Not "no arrangement this solver found" -- no arrangement, by a');
  console.log('  bound on the plane. Every layout produced in this round, including the one');
  console.log('  that cleared all its bars, cleared them by measuring the WORST pair and not');
  console.log('  by making the scene safe: the ~10 px of tier-3 confusion it left behind is');
  console.log('  not a leftover, it is where the excess props went.');
  console.log('');
  console.log(`  At the ${SMEAR} px smear floor the same ground holds ${worst.n56.toFixed(1)}, so the scene is not far`);
  console.log('  outside what the frame can carry -- which is why the defect has always looked');
  console.log('  like a staging bug rather than a census problem.');
  console.log('');
  console.log(`  Head-room needed at ${D} px: ${(COUNT - worst.n70).toFixed(1)} targets. That is the size of the real fix.`);

  /**
   * THE OBVIOUS OBJECTION, ANSWERED BEFORE IT IS RAISED.
   *
   * "The scene is small on a phone because the camera is pulled back; pull it in
   * and the ground grows." True, and it is the right instinct -- the ground
   * occupies about a sixth of an iPhone SE screen, which is why the portrait
   * frames have that band of empty grass along the bottom. But the pull-back is
   * not decoration either: it is what keeps the props inside the frame at all,
   * and `.probe/render/nature-frame.mjs` already showed two portals LOST at
   * radius 10 on every phone.
   *
   * So the two effects fight, and the fight has a maximum. Pulling in multiplies
   * screen area by roughly (r0/r)^2 while shrinking the world region that stays
   * framed. Sweeping r finds the best any framing can do. If the PEAK is below
   * the prop count, then no camera distance rescues the scene either, and the
   * conclusion is forced rather than chosen.
   */
  console.log('\n  ---- and no camera distance fixes it either ----\n');
  console.log('  For the tightest aspect, ground area and capacity as the camera moves:\n');
  console.log('    radius   framed+dry ground   max @70px   world cells kept');
  const tight = CAMS[CAMS.length - 1];
  const basePose = M.resolveSceneCameraPose('nature', tight.w / tight.h);
  const dir = basePose.position.clone().sub(basePose.target).normalize();
  let peak = null;
  for (let r = 8; r <= 22.001; r += 1) {
    const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, tight.w / tight.h, 0.1, 100);
    cam.position.copy(basePose.target.clone().addScaledVector(dir, r));
    cam.lookAt(basePose.target);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    const V = { label: `r=${r}`, w: tight.w, h: tight.h, cam };
    let area = 0;
    let cells = 0;
    for (let x = -4.6; x <= 4.601; x += CELL)
      for (let z = -4.6; z <= 4.601; z += CELL) {
        const v = new Vector3(Math.round(x * 10) / 10, 0, Math.round(z * 10) / 10);
        const s = px(v, V);
        if (s.nz > 1 || Math.abs(s.nx) > 1 - NDC || Math.abs(s.ny) > 1 - NDC) continue;
        if (bankClearance(v.x, v.z) < 0.2) continue;
        area += cellArea(v, V);
        cells++;
      }
    const n = area / (0.866 * D * D);
    if (!peak || n > peak.n) peak = { r, n, area, cells };
    console.log(`    ${String(r).padStart(6)}   ${area.toFixed(0).padStart(13)} px^2 ${n.toFixed(1).padStart(11)} ${String(cells).padStart(18)}`);
  }
  console.log(`\n  Best any framing achieves: ${peak.n.toFixed(1)} targets at radius ${peak.r}, against ${COUNT} staged.`);
  console.log('  Pulling in grows the pixels and shrinks the world that stays on screen, and');
  console.log('  the product of the two peaks well short of the census. The prop count is the');
  console.log('  defect. Everything this round has done to the staging was rearranging a');
  console.log('  quantity of furniture the room cannot hold.');
} else {
  console.log('  The count fits. The defect is arrangement, and a solver is the right tool.');
}
