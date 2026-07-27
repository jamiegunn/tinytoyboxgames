// Is the centreline huddle a CHOICE or a CONSTRAINT?
//
// Every prop on the deck sits within |x| 2.1 on a hull whose half-beam is 5.
// Before calling that a defect I have to rule out the innocent explanation: the
// staging solve required every box corner IN FRAME at all nine aspects, and the
// narrowest aspect (0.4) has a very small horizontal FOV. If that constraint
// alone pins everything to |x| < ~2.1, the placements are optimal and the charge
// belongs to the constraint instead.
//
// So: at each station down the hull, how far outboard CAN a prop stand and still
// be fully on deck and fully in frame at all nine aspects? Compare that headroom
// with where the props actually are.
import { Box3, PerspectiveCamera, Scene, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'pc-beam-headroom',
  `export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from './src/utils/cameraPresets';
   export { HULL_PLAN, HULL_Z_AFT, HULL_Z_FWD, hullHalfWidthAt } from './src/scenes/immersive-toybox-scenes/pirate-cove/hullPlan';
   export { createPirateCoveMaterials } from './src/scenes/immersive-toybox-scenes/pirate-cove/materials';
   export { createBarrel } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/barrels/create';
   export { createCannon } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/cannon/create';`,
);
const { hullHalfWidthAt, HULL_Z_AFT, HULL_Z_FWD } = M;

const ASPECTS = [
  ['landscape 1280x720', 1280 / 720],
  ['tablet 1024x768', 1024 / 768],
  ['square 1x1', 1],
  ['iPad portrait 768x1024', 768 / 1024],
  ['viewport 480x854', 480 / 854],
  ['iPhone SE 375x667', 375 / 667],
  ['iPhone 15 393x852', 393 / 852],
  ['Pixel 8 412x915', 412 / 915],
  ['extreme 360x900', 0.4],
];
const cams = ASPECTS.map(([label, aspect]) => {
  const pose = M.resolveSceneCameraPose('pirate-cove', aspect);
  const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, aspect, 0.1, 100);
  cam.position.copy(pose.position);
  cam.lookAt(pose.target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return { label, cam };
});

const materials = M.createPirateCoveMaterials();
// Measure with a real barrel: the commonest deck prop, and the one there are
// four of. Its half-extents are what decide how close to a rail it can stand.
const probeScene = new Scene();
const barrel = M.createBarrel(probeScene, { position: new Vector3(0, 0, 0), rotY: 0, scale: 1 }, { materials });
barrel.updateMatrixWorld(true);
const bb = new Box3().setFromObject(barrel);
const half = { x: (bb.max.x - bb.min.x) / 2, z: (bb.max.z - bb.min.z) / 2 };
console.log(`probe prop: barrel, half-extent x ${half.x.toFixed(3)}, z ${half.z.toFixed(3)}, top y ${bb.max.y.toFixed(3)}\n`);

const RAIL_INSET = 0.15; // railing plank thickness, same allowance the stage solve used

const inFront = (cam, p) => -p.clone().applyMatrix4(cam.matrixWorldInverse).z > 0;
const cornersInFrame = (cam, box) => {
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        const p = new Vector3(x, y, z);
        if (!inFront(cam, p)) return false;
        p.project(cam);
        if (p.x < -1 || p.x > 1 || p.y < -1 || p.y > 1) return false;
      }
  return true;
};

// Widest |x| a barrel can occupy at station z, under each rule separately.
const deckLimit = (z) => {
  // Both the fore and aft face of the footprint must be inside the hull, and the
  // hull narrows going forward, so the binding station is the forward face.
  const hwF = hullHalfWidthAt(z + half.z),
    hwA = hullHalfWidthAt(z - half.z);
  if (hwF === null || hwA === null) return null;
  return Math.min(hwF, hwA) - RAIL_INSET - half.x;
};
const frameLimit = (z) => {
  let lo = 0,
    hi = 6;
  const ok = (x) => {
    const box = new Box3(new Vector3(x - half.x, bb.min.y, z - half.z), new Vector3(x + half.x, bb.max.y, z + half.z));
    return cams.every(({ cam }) => cornersInFrame(cam, box));
  };
  if (!ok(0)) return null;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
};

console.log('station z   deck allows |x| up to   frame allows |x| up to   BINDING   headroom');
const STATIONS = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8];
const rows = [];
for (const z of STATIONS) {
  const d = deckLimit(z),
    f = frameLimit(z);
  if (d === null || d <= 0) {
    console.log(`${String(z).padStart(6)}      (no room on deck)`);
    continue;
  }
  const binding = f === null ? 'FRAME (nothing fits)' : f < d ? 'frame' : 'deck';
  const lim = f === null ? 0 : Math.min(d, f);
  rows.push({ z, d, f, lim });
  console.log(
    `${String(z).padStart(6)}   ${d.toFixed(2).padStart(18)}   ${(f === null ? '-' : f.toFixed(2)).padStart(20)}   ${binding.padEnd(9)} ${lim.toFixed(2)}`,
  );
}

console.log('\nWhat the props actually do, against the limit at their own station:');
const ACTUAL = [
  ['ropeCoil0', -1.9, 2.2],
  ['treasureChest', -1.6, 0.3],
  ['anchor', -0.6, 7.2],
  ['shipWheel', 0.0, -5.0],
  ['barrel2', 0.8, 5.6],
  ['barrel3', 1.0, 2.5],
  ['ropeCoil1', 1.2, -3.2],
  ['barrel0', 1.4, 4.5],
  ['barrel1', 1.6, 3.5],
  ['cannon', 2.1, 1.9],
];
console.log('prop             |x|    limit at that z   using   unused outboard room');
let unusedTotal = 0;
for (const [name, x, z] of ACTUAL) {
  const d = deckLimit(z),
    f = frameLimit(z);
  if (d === null) continue;
  const lim = f === null ? d : Math.min(d, f);
  const unused = lim - Math.abs(x);
  unusedTotal += Math.max(0, unused);
  console.log(
    `${name.padEnd(15)} ${Math.abs(x).toFixed(2).padStart(5)}   ${lim.toFixed(2).padStart(14)}   ${((Math.abs(x) / lim) * 100).toFixed(0).padStart(4)}%   ${unused.toFixed(2).padStart(6)} units`,
  );
}
console.log(`\nmean unused outboard room per prop: ${(unusedTotal / ACTUAL.length).toFixed(2)} units`);
