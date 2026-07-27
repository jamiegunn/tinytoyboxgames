/**
 * The numbers `tests/room/pirate-cove-composition.test.mjs` asserts on, printed
 * once so the thresholds in that file are quoted from a measurement instead of
 * guessed and then tuned until green.
 *
 * Controls, as everywhere else in this round: the ship's own side rail (accepted
 * by everyone) and a barrel standing at the stowage run's own centroid (the exact
 * prop the outboard rule forbids, in the exact place).
 */

import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';
import { worldFootprintPoints, convexHull2D, minAreaRect, hullsOverlap } from '../tests/framework/_footprint.mjs';
import { frameFraction, visiblePixels } from '../tests/framework/_project.mjs';

const M = await bundleEntry(
  'pc-round4-verify',
  `
  export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from './src/utils/cameraPresets';
  export { createPirateCoveMaterials } from './src/scenes/immersive-toybox-scenes/pirate-cove/materials';
  export { HULL_Z_AFT, HULL_Z_FWD, hullHalfWidthAt, HULL_RAIL_RUNS } from './src/scenes/immersive-toybox-scenes/pirate-cove/hullPlan';
  export { ANCHOR_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/anchor';
  export { BARREL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/barrels';
  export { CANNON_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/cannon';
  export { ROPE_COIL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/ropeCoils';
  export { SHIP_WHEEL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/shipWheel';
  export { TREASURE_CHEST_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/treasureChest';
  export { RAIL_STOWAGE_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/railStowage';
  export { createBarrel } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/barrels/create';
  export { createRopeCoil } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/ropeCoils/create';
  export { createAnchor } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/anchor/create';
  export { createRailStowage } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/railStowage/create';
  export { createCannon } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/cannon/create';
  export { createShipWheel } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/shipWheel/create';
  export { createTreasureChest } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/treasureChest/create';
`,
);

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

const materials = M.createPirateCoveMaterials();
const opts = { materials };
const built = (make) => {
  const root = make(new Scene());
  root.updateMatrixWorld(true);
  const { pts } = worldFootprintPoints(root);
  const verts = [];
  const v = new Vector3();
  root.traverse((o) => {
    const pos = o.geometry?.attributes?.position;
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) verts.push(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).clone());
  });
  return { hull: convexHull2D(pts), verts };
};

const stow = M.RAIL_STOWAGE_STAGING.map((run) => built((s) => M.createRailStowage(s, run, opts)));
const ctrlBarrel = built((s) => M.createBarrel(s, { position: new Vector3(3.6, 0, -3.5), rotY: 0, scale: 1 }, opts));

const existing = [
  ...M.ANCHOR_STAGING.map((p) => ['anchor', (s) => M.createAnchor(s, p, opts)]),
  ...M.BARREL_STAGING.map((p) => ['barrel', (s) => M.createBarrel(s, p, opts)]),
  ...M.ROPE_COIL_STAGING.map((p) => ['ropeCoil', (s) => M.createRopeCoil(s, p, opts)]),
  ...M.CANNON_STAGING.map((p) => ['cannon', (s) => M.createCannon(s, p, opts).root]),
  ...M.SHIP_WHEEL_STAGING.map((p) => ['shipWheel', (s) => M.createShipWheel(s, p, opts).root]),
  ...M.TREASURE_CHEST_STAGING.map((p) => ['treasureChest', (s) => M.createTreasureChest(s, p, opts).root]),
].map(([kind, make], i) => ({ name: `${kind}${i}`, ...built(make) }));

const cameraFor = (aspect) => {
  const pose = M.resolveSceneCameraPose('pirate-cove', aspect);
  const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, aspect, 0.1, 100);
  cam.position.copy(pose.position);
  cam.lookAt(pose.target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
};

console.log('==== 1. ELONGATION (the rule: only self-similar runs may stand outboard)');
for (const [label, o] of [
  ['stowage run port', stow[0]],
  ['stowage run starboard', stow[1]],
  ['FORBIDDEN barrel', ctrlBarrel],
]) {
  const r = minAreaRect(o.hull);
  console.log(`  ${label.padEnd(24)} ${r.length.toFixed(2)} x ${r.width.toFixed(2)}  = ${(r.length / r.width).toFixed(1)} : 1`);
}

console.log('\n==== 2. ON DECK (every hull vertex inside the hull half-width at its own z)');
for (const [i, o] of stow.entries()) {
  let worst = Infinity;
  for (const [x, z] of o.hull) {
    const half = M.hullHalfWidthAt(z);
    worst = Math.min(worst, half === null ? -Infinity : half - Math.abs(x));
  }
  console.log(`  stowage ${i}: tightest clearance to the rail line ${worst.toFixed(3)}`);
}

console.log('\n==== 3. CLEAR (separating axis against every existing prop)');
let clashes = 0;
for (const [i, o] of stow.entries())
  for (const e of existing)
    if (hullsOverlap(o.hull, e.hull)) {
      console.log(`  stowage ${i} CLASHES with ${e.name}`);
      clashes++;
    }
console.log(`  ${clashes} clashes`);

console.log('\n==== 4. FRAME FRACTION painted, widest to narrowest');
console.log('  aspect                    stowage %  barrel %   stowage px  barrel px');
for (const [label, aspect] of ASPECTS) {
  const cam = cameraFor(aspect);
  const s = stow.reduce((t, o) => t + frameFraction(cam, o.verts, aspect), 0);
  const b = frameFraction(cam, ctrlBarrel.verts, aspect);
  const sp = stow.reduce((t, o) => t + visiblePixels(cam, o.verts, aspect), 0);
  const bp = visiblePixels(cam, ctrlBarrel.verts, aspect);
  console.log(
    `  ${label.padEnd(24)} ${(s * 100).toFixed(3).padStart(7)}%  ${(b * 100).toFixed(3).padStart(6)}%  ${sp.toFixed(0).padStart(10)}  ${bp.toFixed(0).padStart(9)}`,
  );
}
