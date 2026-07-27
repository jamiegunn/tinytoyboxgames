// Ground-coverage probe. For a table of realistic viewport aspects, resolve the
// scene camera pose and report where the bottom edge of the frame lands on the
// ground plane, against the scene's authored ground rectangle.
//
// Run: node .probe/ground-reach.mjs
import { PerspectiveCamera } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const { resolveSceneCameraPose, bottomEdgeGroundReach, SCENE_CAMERA_FOV, NATURE_ENVIRONMENT, PIRATE_COVE_ENVIRONMENT } = await bundleEntry(
  'ground-reach',
  `
  export { resolveSceneCameraPose, bottomEdgeGroundReach, SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
  export { NATURE_ENVIRONMENT } from './src/scenes/immersive-toybox-scenes/naturescene/environment';
  export { PIRATE_COVE_ENVIRONMENT } from './src/scenes/immersive-toybox-scenes/pirate-cove/environment';
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

function report(sceneId, ground) {
  const halfW = ground.width / 2;
  const halfD = ground.depth / 2;
  console.log(`\n### ${sceneId}  ground ${ground.width} x ${ground.depth}  (|x|<=${halfW}, |z|<=${halfD})`);
  for (const [label, aspect] of ASPECTS) {
    const pose = resolveSceneCameraPose(sceneId, aspect);
    const cam = new PerspectiveCamera(SCENE_CAMERA_FOV, aspect, 0.1, 100);
    cam.position.copy(pose.position);
    cam.lookAt(pose.target);
    const hits = bottomEdgeGroundReach(cam);
    const parts = hits.map((h) => (h ? `(${h.x.toFixed(2)},${h.z.toFixed(2)})` : 'UNBOUNDED'));
    const bad = hits.some((h) => !h || Math.abs(h.x) > halfW + 1e-6 || Math.abs(h.z) > halfD + 1e-6);
    const worstZ = Math.max(...hits.map((h) => (h ? Math.abs(h.z) : Infinity)));
    const worstX = Math.max(...hits.map((h) => (h ? Math.abs(h.x) : Infinity)));
    console.log(
      `  ${bad ? 'FAIL' : 'ok  '} ${label.padEnd(22)} a=${aspect.toFixed(4)} r=${pose.radius.toFixed(2)} camY=${pose.position.y.toFixed(2)} ` +
        `L${parts[0]} C${parts[1]} R${parts[2]}  worst |x|=${worstX.toFixed(2)} |z|=${worstZ.toFixed(2)}`,
    );
  }
}

report('nature', NATURE_ENVIRONMENT.ground);
report('pirate-cove', { width: PIRATE_COVE_ENVIRONMENT.ground?.width ?? 0, depth: PIRATE_COVE_ENVIRONMENT.ground?.depth ?? 0 });
process.exit(0);
