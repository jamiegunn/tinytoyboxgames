// How much of the pirate ship is actually on screen?
//
// The ground-coverage suite reported ONE portal 0.05 NDC off an iPad. That was
// the mildest of several failures -- `assert.ok` aborts at the first. This audits
// every staged prop against the real camera pose at every aspect, so the charge
// is a count rather than an impression.
import { PerspectiveCamera, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'pc-prop-visibility',
  `export { resolveSceneCameraPose, SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
   export { ANCHOR_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/anchor';
   export { BARREL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/barrels';
   export { CANNON_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/cannon';
   export { PARROT_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/parrot';
   export { ROPE_COIL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/ropeCoils';
   export { SHIP_WHEEL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/shipWheel';
   export { TREASURE_CHEST_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/treasureChest';
   export { PIRATE_COVE_ENVIRONMENT } from './src/scenes/immersive-toybox-scenes/pirate-cove/environment';`,
);

const { resolveSceneCameraPose, SCENE_CAMERA_FOV, PIRATE_COVE_ENVIRONMENT } = M;

// Sample height per prop family: roughly the middle of the silhouette, so a
// prop counted "on screen" really has its body on screen and not just its base.
const PROPS = [
  ...M.ANCHOR_STAGING.map((s, i) => [`anchor${i}`, s.position, 0.6, false]),
  ...M.BARREL_STAGING.map((s, i) => [`barrel${i}`, s.position, 0.35, false]),
  ...M.CANNON_STAGING.map((s, i) => [`cannon${i}`, s.position, 0.4, true]),
  ...M.PARROT_STAGING.map((s, i) => [`parrot${i}`, s.position, 0.2, true]),
  ...M.ROPE_COIL_STAGING.map((s, i) => [`rope${i}`, s.position, 0.1, false]),
  ...M.SHIP_WHEEL_STAGING.map((s, i) => [`wheel${i}`, s.position, 0.9, true]),
  ...M.TREASURE_CHEST_STAGING.map((s, i) => [`chest${i}`, s.position, 0.3, true]),
  ...PIRATE_COVE_ENVIRONMENT.portals.map((p) => [`PORTAL:${p.gameId}`, p.position, 0.3, true]),
];

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

for (const [label, aspect] of ASPECTS) {
  const pose = resolveSceneCameraPose('pirate-cove', aspect);
  const cam = new PerspectiveCamera(SCENE_CAMERA_FOV, aspect, 0.1, 100);
  cam.position.copy(pose.position);
  cam.lookAt(pose.target);
  cam.updateMatrixWorld(true);

  const off = [];
  let interactiveOff = 0;
  let interactiveTotal = 0;
  for (const [name, p, dy, interactive] of PROPS) {
    if (interactive) interactiveTotal++;
    const ndc = new Vector3(p.x, p.y + dy, p.z).project(cam);
    const over = Math.max(Math.abs(ndc.x) - 1, Math.abs(ndc.y) - 1);
    if (over > 0) {
      off.push(`${name}+${over.toFixed(2)}`);
      if (interactive) interactiveOff++;
    }
  }
  console.log(
    `${label.padEnd(22)} a=${aspect.toFixed(3)}  offscreen ${String(off.length).padStart(2)}/${PROPS.length}  ` +
      `tappable offscreen ${interactiveOff}/${interactiveTotal}   ${off.join(' ') || '-'}`,
  );
}
process.exit(0);
