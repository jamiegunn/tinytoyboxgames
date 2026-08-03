// SCRATCH PROBE. Each room's rotation limit under its CURRENT catalog pose, at
// every stage aspect. The one number SHARED_ROTATION_RANGE has to sit inside.
import { PerspectiveCamera, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';
const M = await bundleEntry(
  'room-turn-limits',
  `
  export { largestSafeRotation, SHARED_ROTATION_RANGE } from './src/utils/scene/rotationRange';
  export { getSceneCameraPreset } from './src/scenes/sceneCatalog';
  export { SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
  export { MIN_STAGE_ASPECT, MAX_STAGE_ASPECT, stageAspectFor } from './src/utils/scene/stageRect';
  export * as PLAYROOM from './src/scenes/world/places/house/subplaces/playroom/layout';
  export * as KITCHEN from './src/scenes/world/places/house/subplaces/kitchen/layout';
  export * as LIVING from './src/scenes/world/places/house/subplaces/living-room/layout';
`,
);
const VIEWPORTS = [
  [1280, 720],
  [1024, 768],
  [800, 800],
  [768, 1024],
  [480, 854],
  [375, 667],
  [393, 852],
  [412, 915],
  [400, 1000],
];
const ASPECTS = [...new Set(VIEWPORTS.map(([w, h]) => M.stageAspectFor(w, h)))].sort((a, b) => a - b);
const cornersFor = (aspect) => (position, pivot) => {
  const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, aspect, 0.1, 300);
  cam.position.copy(position);
  cam.lookAt(pivot);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([nx, ny]) => new Vector3(nx, ny, 1).unproject(cam).sub(position).normalize());
};
const DEG = 180 / Math.PI;
let tightest = { limit: Infinity };
for (const [sceneId, L] of [
  ['playroom', M.PLAYROOM],
  ['kitchen', M.KITCHEN],
  ['living-room', M.LIVING],
]) {
  const preset = M.getSceneCameraPreset(sceneId);
  const c = preset.constraints ?? {};
  const shell = { wallX: L.LEFT_WALL_X, frontZ: L.BACK_WALL_CENTER_Z - L.ROOM_DEPTH, backZ: L.BACK_WALL_CENTER_Z, ceilingY: L.CEILING_Y, floorY: 0 };
  const row = [];
  for (const aspect of ASPECTS) {
    const orbit = {
      azimuth: preset.azimuth,
      pivot: new Vector3(...preset.target),
      radii: [preset.distance],
      polars: [c.minPolar ?? Math.max(0.9, preset.polar - 0.1), preset.polar, c.maxPolar ?? Math.min(1.35, preset.polar + 0.1)],
      ceilingClamp: c.ceilingY ?? 6.0,
    };
    const limit = M.largestSafeRotation(shell, orbit, cornersFor(aspect));
    row.push(`${aspect.toFixed(2)}:±${(limit * DEG).toFixed(1)}°`);
    if (limit < tightest.limit) tightest = { sceneId, aspect, limit };
  }
  console.log(`  ${sceneId.padEnd(12)} ${row.join('  ')}`);
}
console.log(
  `\n  tightest: ${tightest.sceneId} at aspect ${tightest.aspect.toFixed(2)}, ±${(tightest.limit * DEG).toFixed(1)}° (${tightest.limit.toFixed(4)} rad)`,
);
console.log(`  shipping: ±${(M.SHARED_ROTATION_RANGE * DEG).toFixed(1)}°  ->  margin ${((1 - M.SHARED_ROTATION_RANGE / tightest.limit) * 100).toFixed(1)}%`);
for (const cand of [0.18, 0.17, 0.16, 0.15])
  console.log(`  if ${cand}: ±${(cand * DEG).toFixed(1)}°, margin ${((1 - cand / tightest.limit) * 100).toFixed(1)}%`);
