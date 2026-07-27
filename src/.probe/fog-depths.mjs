// What does the fog actually touch?
//
// three.js applies fog on VIEW-SPACE DEPTH (`vFogDepth = -mvPosition.z`), not on
// distance from the world origin. The first draft of the sky/fog contract
// asserted `fog.near >= hypot(groundWidth/2, groundDepth/2)` — a world-origin
// half-diagonal — which is a category error: it compares a camera-relative
// quantity against a world-relative one. This probe measures the real thing
// before any assertion is written.
//
// For every scene, at every shipping aspect, at the opening pose and across the
// reachable camera envelope, it reports the view depth of:
//   - each portal (the only affordance a pre-reading child has)
//   - the corners of the playable surface
//   - nature's treeline rows (the thing that is SUPPOSED to haze)
// and the fog fraction each receives under the current near/far.

import { PerspectiveCamera, Spherical, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const {
  resolveSceneCameraPose,
  sceneCameraMaxDistance,
  getSceneCameraPreset,
  SCENE_CAMERA_FOV,
  NATURE_ENVIRONMENT,
  NATURE_SKY_FOG,
  PIRATE_COVE_ENVIRONMENT,
  PIRATE_COVE_SKY_FOG,
  TREELINE_BACK_ROWS,
  TREELINE_SIDE_COLUMNS,
} = await bundleEntry(
  'fog-depths',
  `
  export { resolveSceneCameraPose, sceneCameraMaxDistance, SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
  export { getSceneCameraPreset } from './src/scenes/sceneCatalog';
  export { NATURE_ENVIRONMENT, NATURE_SKY_FOG } from './src/scenes/immersive-toybox-scenes/naturescene/environment';
  export { PIRATE_COVE_ENVIRONMENT, PIRATE_COVE_SKY_FOG } from './src/scenes/immersive-toybox-scenes/pirate-cove/environment';
  export { TREELINE_BACK_ROWS, TREELINE_SIDE_COLUMNS } from './src/scenes/immersive-toybox-scenes/naturescene/factory/scaffold/treeline';
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

const camAt = (position, target, aspect) => {
  const cam = new PerspectiveCamera(SCENE_CAMERA_FOV, aspect, 0.1, 100);
  cam.position.copy(position);
  cam.lookAt(target);
  cam.updateMatrixWorld(true);
  return cam;
};

// -mvPosition.z, exactly what the fog chunk feeds the fog factor.
const viewDepth = (cam, worldPoint) => -worldPoint.clone().applyMatrix4(cam.matrixWorldInverse).z;

const fogFraction = (depth, { near, far }) => Math.min(1, Math.max(0, (depth - near) / (far - near)));

const envelopePoses = (sceneId, aspect) => {
  const preset = getSceneCameraPreset(sceneId);
  const c = preset.constraints ?? {};
  const panRangeX = c.panRangeX ?? 3.5;
  const minPolar = c.minPolar ?? Math.max(0.9, preset.polar - 0.1);
  const maxPolar = c.maxPolar ?? Math.min(1.35, preset.polar + 0.1);
  const maxTargetY = c.maxTargetY ?? 2.0;
  const maxAz = c.maxAzimuthRange ?? 0.25;
  const ceilingY = c.ceilingY ?? 6.0;
  const minDistance = c.minDistance ?? preset.distance * 0.2;
  const maxDistance = sceneCameraMaxDistance(sceneId, aspect);
  const out = [];
  for (const dist of [minDistance, preset.distance, maxDistance]) {
    for (const polar of [minPolar, preset.polar, maxPolar]) {
      for (const tx of [-panRangeX, 0, panRangeX]) {
        for (const ty of [0, maxTargetY]) {
          for (const az of [preset.azimuth - maxAz, preset.azimuth, preset.azimuth + maxAz]) {
            const target = new Vector3(tx, ty, preset.target[2]);
            const position = target.clone().add(new Vector3().setFromSpherical(new Spherical(dist, polar, az)));
            if (position.y > ceilingY) position.y = ceilingY;
            out.push({ position, target });
          }
        }
      }
    }
  }
  return out;
};

const report = (sceneId, env, skyFog, extraPoints) => {
  const hw = env.ground.width / 2;
  const hd = env.ground.depth / 2;
  const corners = [
    ['play near-left', new Vector3(-hw, 0, -hd)],
    ['play near-right', new Vector3(hw, 0, -hd)],
    ['play far-left', new Vector3(-hw, 0, hd)],
    ['play far-right', new Vector3(hw, 0, hd)],
    ['play centre', new Vector3(0, 0, 0)],
  ];
  const portals = env.portals.map((p) => [`portal ${p.gameId}`, new Vector3(p.position.x, 0.3, p.position.z)]);
  const points = [...portals, ...corners, ...extraPoints];

  console.log(`\n=== ${sceneId}  fog near=${skyFog.fog.near} far=${skyFog.fog.far}  ground ${env.ground.width}x${env.ground.depth} ===`);
  console.log('point                        openMinD  openMaxD   envMinD   envMaxD  openMaxFog  envMaxFog');

  for (const [label, pt] of points) {
    let openMin = Infinity;
    let openMax = -Infinity;
    let envMin = Infinity;
    let envMax = -Infinity;
    for (const [, aspect] of ASPECTS) {
      const pose = resolveSceneCameraPose(sceneId, aspect);
      const d = viewDepth(camAt(pose.position, pose.target, aspect), pt);
      openMin = Math.min(openMin, d);
      openMax = Math.max(openMax, d);
      for (const p of envelopePoses(sceneId, aspect)) {
        const de = viewDepth(camAt(p.position, p.target, aspect), pt);
        envMin = Math.min(envMin, de);
        envMax = Math.max(envMax, de);
      }
    }
    console.log(
      `${label.padEnd(28)}${openMin.toFixed(2).padStart(8)}${openMax.toFixed(2).padStart(10)}${envMin.toFixed(2).padStart(10)}${envMax.toFixed(2).padStart(10)}` +
        `${fogFraction(openMax, skyFog.fog).toFixed(3).padStart(12)}${fogFraction(envMax, skyFog.fog).toFixed(3).padStart(11)}`,
    );
  }
};

report('nature', NATURE_ENVIRONMENT, NATURE_SKY_FOG, [
  ...TREELINE_BACK_ROWS.map((r, i) => [`treeline row ${i} z=${r.z}`, new Vector3(0, r.height / 2, r.z)]),
  ...TREELINE_SIDE_COLUMNS.map((c, i) => [`treeline side ${i} x=${c.x}`, new Vector3(c.x, c.height / 2, 0)]),
  ['skydome back', new Vector3(0, 0, NATURE_SKY_FOG.sky.radius)],
]);

report('pirate-cove', PIRATE_COVE_ENVIRONMENT, PIRATE_COVE_SKY_FOG, [
  ['sea at half dome radius', new Vector3(0, -0.6, PIRATE_COVE_SKY_FOG.sky.radius / 2)],
  ['sea at dome radius', new Vector3(0, -0.6, PIRATE_COVE_SKY_FOG.sky.radius)],
  ['skydome back', new Vector3(0, 0, PIRATE_COVE_SKY_FOG.sky.radius)],
]);

// The ladder assertions need the MINIMUM fog fraction at the opening pose, not
// just the maximum — "partially hazed at every aspect" is the property, and a
// point that is saturated at one aspect and untouched at another is not a ladder.
// The ladder is a PER-ASPECT property: at one and the same pose the far backdrop
// must be hazier than the near one. Comparing the min of one against the max of
// the other across aspects would be comparing two different frames.
const ladder = (sceneId, skyFog, nearPt, farPt) => {
  console.log(`\n--- ${sceneId} backdrop ladder (opening pose) ---`);
  let worstDelta = Infinity;
  let worstNear = Infinity;
  let worstFar = Infinity;
  for (const [label, aspect] of ASPECTS) {
    const pose = resolveSceneCameraPose(sceneId, aspect);
    const cam = camAt(pose.position, pose.target, aspect);
    const fn = fogFraction(viewDepth(cam, nearPt), skyFog.fog);
    const ff = fogFraction(viewDepth(cam, farPt), skyFog.fog);
    console.log(`${label.padEnd(24)}near ${fn.toFixed(3)}   far ${ff.toFixed(3)}   delta ${(ff - fn).toFixed(3)}`);
    worstDelta = Math.min(worstDelta, ff - fn);
    worstNear = Math.min(worstNear, fn);
    worstFar = Math.min(worstFar, ff);
  }
  console.log(`worst: near ${worstNear.toFixed(3)}  far ${worstFar.toFixed(3)}  delta ${worstDelta.toFixed(3)}`);
};

const lastRow = TREELINE_BACK_ROWS[TREELINE_BACK_ROWS.length - 1];
ladder('nature', NATURE_SKY_FOG, new Vector3(0, TREELINE_BACK_ROWS[0].height / 2, TREELINE_BACK_ROWS[0].z), new Vector3(0, lastRow.height / 2, lastRow.z));
ladder('pirate-cove', PIRATE_COVE_SKY_FOG, new Vector3(0, -0.6, PIRATE_COVE_SKY_FOG.sky.radius / 2), new Vector3(0, -0.6, PIRATE_COVE_SKY_FOG.sky.radius));
