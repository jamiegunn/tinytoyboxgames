// What does the bottom edge of the frame actually land on, per scene?
//
// The ground-coverage suite asserted pirate-cove's bottom edge against a 16x14
// rectangle at y = 0 -- the DECK. That is the wrong plane: the scene's opaque
// floor is a 400x400 ocean at y = -0.6, and a ray that misses the deck is
// looking at water, which is what a ship looks like. The assertion passed only
// because `maxDistance: 10` kept the camera close enough that it never mattered.
//
// This probe reports, for both scenes and all nine aspects, where the three
// bottom-edge rays land on (a) the declared floor plane and (b) y = 0, so the
// replacement contract can be written against measured numbers.

import { PerspectiveCamera, Spherical, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const m = await bundleEntry(
  'floor-descriptors',
  `
  export { resolveSceneCameraPose, bottomEdgeGroundReach, sceneCameraMaxDistance, SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
  export { getSceneCameraPreset } from './src/scenes/sceneCatalog';
  export { NATURE_ENVIRONMENT } from './src/scenes/immersive-toybox-scenes/naturescene/environment';
  export { PIRATE_COVE_ENVIRONMENT } from './src/scenes/immersive-toybox-scenes/pirate-cove/environment';
  export { OCEAN_Y, OCEAN_HALF_EXTENT } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/scaffold/sea';
`,
);

const {
  resolveSceneCameraPose,
  bottomEdgeGroundReach,
  sceneCameraMaxDistance,
  SCENE_CAMERA_FOV,
  getSceneCameraPreset,
  NATURE_ENVIRONMENT,
  PIRATE_COVE_ENVIRONMENT,
  OCEAN_Y,
  OCEAN_HALF_EXTENT,
} = m;

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

const camAt = (position, target, aspect) => {
  const cam = new PerspectiveCamera(SCENE_CAMERA_FOV, aspect, 0.1, 100);
  cam.position.copy(position);
  cam.lookAt(target);
  cam.updateMatrixWorld(true);
  return cam;
};

const SCENES = [
  ['nature', NATURE_ENVIRONMENT, 0],
  ['pirate-cove', PIRATE_COVE_ENVIRONMENT, OCEAN_Y],
];

for (const [sceneId, env, planeY] of SCENES) {
  console.log(`\n=== ${sceneId} (floor plane y=${planeY}, declared ground ${env.ground.width}x${env.ground.depth}) ===`);
  console.log('aspect'.padEnd(24), 'maxDist', ' bl(x,z)'.padEnd(20), ' bc(x,z)'.padEnd(20), ' br(x,z)');
  for (const [label, aspect] of ASPECTS) {
    const pose = resolveSceneCameraPose(sceneId, aspect);
    const cam = camAt(pose.position, pose.target, aspect);
    const hits = bottomEdgeGroundReach(cam, planeY);
    const fmt = (h) => (h ? `(${h.x.toFixed(2)}, ${h.z.toFixed(2)})`.padEnd(20) : 'null'.padEnd(20));
    console.log(label.padEnd(24), sceneCameraMaxDistance(sceneId, aspect).toFixed(2).padStart(7), fmt(hits[0]), fmt(hits[1]), fmt(hits[2]));
  }
}

// Envelope sweep: how far does the bottom edge reach on the floor plane, worst
// case, over every camera the player can drag to?
console.log('\n=== envelope worst-case reach on the declared floor plane ===');
for (const [sceneId, env, planeY] of SCENES) {
  const preset = getSceneCameraPreset(sceneId);
  const c = preset.constraints ?? {};
  const panRangeX = c.panRangeX ?? 3.5;
  const minPolar = c.minPolar ?? Math.max(0.9, preset.polar - 0.1);
  const maxPolar = c.maxPolar ?? Math.min(1.35, preset.polar + 0.1);
  const maxTargetY = c.maxTargetY ?? 2.0;
  const maxAz = c.maxAzimuthRange ?? 0.25;
  const ceilingY = c.ceilingY ?? 6.0;
  let worstX = 0;
  let worstZ = 0;
  let nulls = 0;
  let deckMissAtOpening = 0;
  for (const [, aspect] of ASPECTS) {
    const maxDistance = sceneCameraMaxDistance(sceneId, aspect);
    for (const polar of [minPolar, preset.polar, maxPolar]) {
      for (const tx of [-panRangeX, 0, panRangeX]) {
        for (const ty of [0, maxTargetY]) {
          for (const az of [preset.azimuth - maxAz, preset.azimuth, preset.azimuth + maxAz]) {
            const target = new Vector3(tx, ty, preset.target[2]);
            const position = target.clone().add(new Vector3().setFromSpherical(new Spherical(maxDistance, polar, az)));
            if (position.y > ceilingY) position.y = ceilingY;
            for (const hit of bottomEdgeGroundReach(camAt(position, target, aspect), planeY)) {
              if (!hit) {
                nulls++;
                continue;
              }
              worstX = Math.max(worstX, Math.abs(hit.x));
              worstZ = Math.max(worstZ, Math.abs(hit.z));
            }
          }
        }
      }
    }
  }
  // Does the bottom-CENTRE ray land on the playable surface (y = 0 rect) at the
  // opening pose? That is the non-vacuous question for a ship on an ocean.
  const halfW = env.ground.width / 2;
  const halfD = env.ground.depth / 2;
  const centreLandings = [];
  for (const [label, aspect] of ASPECTS) {
    const pose = resolveSceneCameraPose(sceneId, aspect);
    const hit = bottomEdgeGroundReach(camAt(pose.position, pose.target, aspect), 0)[1];
    if (!hit || Math.abs(hit.x) > halfW || Math.abs(hit.z) > halfD) deckMissAtOpening++;
    centreLandings.push(`${label}: ${hit ? `(${hit.x.toFixed(2)}, ${hit.z.toFixed(2)})` : 'null'}`);
  }
  console.log(
    `${sceneId}: worst |x|=${worstX.toFixed(2)} |z|=${worstZ.toFixed(2)} nulls=${nulls}  (floor half-extent ${sceneId === 'pirate-cove' ? OCEAN_HALF_EXTENT : halfW}x${sceneId === 'pirate-cove' ? OCEAN_HALF_EXTENT : halfD})`,
  );
  console.log(`  bottom-centre ray on the y=0 playable rect ${halfW}x${halfD}: ${ASPECTS.length - deckMissAtOpening}/${ASPECTS.length} aspects`);
  for (const l of centreLandings) console.log('   ', l);
}
