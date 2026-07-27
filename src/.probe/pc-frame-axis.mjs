// WHICH LANDMARK BINDS, AND ON WHICH AXIS?
//
// `pc-frame-budget.mjs` returned a result I did not expect: the frame is
// HEIGHT-limited at all nine aspects, with an identical worst |ndc.y| of 0.911,
// while worst |ndc.x| ranges from 0.177 (landscape) to 0.789 (extreme). Closing
// the camera in is therefore capped at 10.2% -- identically at every aspect --
// and buys landscape only 6% more deck coverage. That kills the camera fix.
//
// Before I publish that, I have to know WHICH landmark sets the 0.911, because
// the whole Round 4 argument turns on it. If it is the mast top, the ship's
// height is the constraint and the layout has vertical room to spare. If it is
// a deck prop at the bottom of frame, the constraint is the near foreground and
// the answer is different.
import { PerspectiveCamera, Spherical, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'pc-frame-axis',
  `export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from './src/utils/cameraPresets';
   export { getSceneCameraPreset } from './src/scenes/sceneCatalog';
   export { HULL_Z_AFT, HULL_Z_FWD, hullHalfWidthAt, MAST } from './src/scenes/immersive-toybox-scenes/pirate-cove/hullPlan';
   export { PIRATE_COVE_ENVIRONMENT } from './src/scenes/immersive-toybox-scenes/pirate-cove/environment';
   export { ANCHOR_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/anchor';
   export { BARREL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/barrels';
   export { CANNON_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/cannon';
   export { PARROT_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/parrot';
   export { ROPE_COIL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/ropeCoils';
   export { SHIP_WHEEL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/shipWheel';
   export { TREASURE_CHEST_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/treasureChest';`,
);
const { MAST, HULL_Z_FWD } = M;
const ASPECTS = [
  ['landscape 1280x720', 1280 / 720],
  ['tablet 1024x768', 1024 / 768],
  ['square 1x1', 1],
  ['iPad portrait 768x1024', 0.75],
  ['viewport 480x854', 480 / 854],
  ['iPhone SE 375x667', 375 / 667],
  ['iPhone 15 393x852', 393 / 852],
  ['Pixel 8 412x915', 412 / 915],
  ['extreme 360x900', 0.4],
];
const RAIL_Y = 2 * 0.55;
const LM = [
  ['stem', new Vector3(0, RAIL_Y, HULL_Z_FWD)],
  ['mast top', new Vector3(0, MAST.height, MAST.z)],
  ["crow's nest", new Vector3(0, MAST.nestRailTopY, MAST.z)],
  ['portal', M.PIRATE_COVE_ENVIRONMENT.portals[0].position.clone()],
  ...[
    ['anchor', M.ANCHOR_STAGING],
    ['barrel', M.BARREL_STAGING],
    ['cannon', M.CANNON_STAGING],
    ['parrot', M.PARROT_STAGING],
    ['ropeCoil', M.ROPE_COIL_STAGING],
    ['shipWheel', M.SHIP_WHEEL_STAGING],
    ['treasureChest', M.TREASURE_CHEST_STAGING],
  ].flatMap(([n, l]) => l.map((p, i) => [`${n}${l.length > 1 ? i : ''}`, p.position.clone()])),
];
const preset = M.getSceneCameraPreset('pirate-cove');
const camAt = (aspect, radius) => {
  const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, aspect, 0.1, 100);
  const t = new Vector3(...preset.target);
  cam.position.copy(t).add(new Vector3().setFromSpherical(new Spherical(radius, preset.polar, preset.azimuth)));
  const cy = preset.constraints?.ceilingY ?? 6.0;
  if (cam.position.y > cy) cam.position.y = cy;
  cam.lookAt(t);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
};

console.log('==== D. WHO SETS THE EDGE, AT THE SHIPPED DISTANCE\n');
console.log('aspect                   top-most landmark        ndc.y   right-most landmark      ndc.x');
for (const [label, aspect] of ASPECTS) {
  const cam = camAt(aspect, M.resolveSceneCameraPose('pirate-cove', aspect).radius);
  let top = null,
    side = null;
  for (const [n, p] of LM) {
    const v = p.clone().project(cam);
    if (!top || Math.abs(v.y) > Math.abs(top[1])) top = [n, v.y];
    if (!side || Math.abs(v.x) > Math.abs(side[1])) side = [n, v.x];
  }
  console.log(`${label.padEnd(24)} ${top[0].padEnd(22)} ${top[1].toFixed(3).padStart(6)}   ${side[0].padEnd(22)} ${side[1].toFixed(3).padStart(6)}`);
}

console.log('\n\n==== E. HOW MUCH OF THE FRAME WIDTH IS SIMPLY UNUSED\n');
console.log('aspect                   landmarks span   unused width   unused height');
for (const [label, aspect] of ASPECTS) {
  const cam = camAt(aspect, M.resolveSceneCameraPose('pirate-cove', aspect).radius);
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (const [, p] of LM) {
    const v = p.clone().project(cam);
    x0 = Math.min(x0, v.x);
    x1 = Math.max(x1, v.x);
    y0 = Math.min(y0, v.y);
    y1 = Math.max(y1, v.y);
  }
  console.log(
    `${label.padEnd(24)} ${(((x1 - x0) / 2) * 100).toFixed(1).padStart(13)}%   ${((1 - (x1 - x0) / 2) * 100).toFixed(1).padStart(11)}%   ${((1 - (y1 - y0) / 2) * 100).toFixed(1).padStart(12)}%`,
  );
}
