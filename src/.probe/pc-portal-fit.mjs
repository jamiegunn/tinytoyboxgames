// Pirate Cove portal framing probe. The ground-coverage suite reported the single
// cannonball-splash portal 0.05 NDC off an iPad portrait frame, but `assert.ok`
// aborts on the first failing aspect, so that number is the BEST of the failures,
// not the worst. This prints every aspect, plus how much of the deck the camera
// can actually see at each one, so the fix is solved rather than nudged.
import { PerspectiveCamera, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const { resolveSceneCameraPose, SCENE_CAMERA_FOV, getSceneCameraPreset } = await bundleEntry(
  'pc-portal-fit',
  `export { resolveSceneCameraPose, SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
   export { getSceneCameraPreset } from './src/scenes/sceneCatalog';`,
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

const poseFor = (aspect) => {
  const pose = resolveSceneCameraPose('pirate-cove', aspect);
  const cam = new PerspectiveCamera(SCENE_CAMERA_FOV, aspect, 0.1, 100);
  cam.position.copy(pose.position);
  cam.lookAt(pose.target);
  cam.updateMatrixWorld(true);
  return { pose, cam };
};

console.log('preset:', JSON.stringify(getSceneCameraPreset('pirate-cove')));
console.log('\n# per-aspect: radius, and the widest |x| at the target plane that still projects inside the frame');
for (const [label, aspect] of ASPECTS) {
  const { pose, cam } = poseFor(aspect);
  // Binary-search the largest |x| at z=1.0, y=0.3 that stays inside NDC.
  let lo = 0;
  let hi = 12;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const ndc = new Vector3(mid, 0.3, 1.0).project(cam);
    if (Math.max(Math.abs(ndc.x) - 1, Math.abs(ndc.y) - 1) <= 0) lo = mid;
    else hi = mid;
  }
  const cur = new Vector3(4.0, 0.3, 1.0).project(cam);
  const over = Math.max(Math.abs(cur.x) - 1, Math.abs(cur.y) - 1);
  console.log(
    `  ${label.padEnd(22)} a=${aspect.toFixed(4)} r=${pose.radius.toFixed(2)} camY=${pose.position.y.toFixed(2)}  ` +
      `max|x|@z=1 -> ${lo.toFixed(2)}   current x=4.0 over=${over > 0 ? '+' + over.toFixed(3) : over.toFixed(3)}`,
  );
}
process.exit(0);
