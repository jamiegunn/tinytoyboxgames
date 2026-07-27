// Where must Pirate Cove's fog start now that the ship is 24 units long?
//
// The shipped `fog.near` was 20, justified in `environment.ts` by this claim:
// "the camera is pinned at radius 10 by `maxDistance`, and the furthest point of
// the hull from it is the stern rail at ~17.6 units, ~19 with the pan and zoom
// envelope applied". Every number in that sentence describes the old hull and
// the old preset. The hull is now 24 long with a stem at z = +12 and the eye
// stands at z = -11.39, so the ship's own bow is further from the camera than
// the fog's start. Left alone, the commit that fixes "the ship does not read as
// a ship" would ship a hazed bow.
//
// This probe does not choose a number by eye either. It measures, over the SAME
// camera envelope and the SAME nine aspects that
// `tests/room/scene-sky-fog-contract.test.mjs` uses, four quantities that
// together pin `near` and `far` between hard walls:
//
//   1. the deepest view-space depth any part of the SHIP reaches   -> near floor
//   2. the shallowest depth the near backdrop band reaches         -> near ceiling
//   3. the props a child taps (portals, play centre)               -> near floor
//   4. the skydome radius                                          -> far ceiling
//
// Nothing here re-derives the camera: poses come from the app's own
// `resolveSceneCameraPose` and from a copy of the contract suite's
// `envelopePoses`, which is reproduced rather than imported because it lives
// inside the test file.
import { PerspectiveCamera, Spherical, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'pc-fog-solve',
  `export { resolveSceneCameraPose, sceneCameraMaxDistance, SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
   export { getSceneCameraPreset } from './src/scenes/sceneCatalog';
   export { PIRATE_COVE_ENVIRONMENT, PIRATE_COVE_SKY_FOG } from './src/scenes/immersive-toybox-scenes/pirate-cove/environment';
   export { OCEAN_Y } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/scaffold/sea';
   export { HULL_OUTLINE, HULL_Z_FWD, HULL_Z_AFT, MAST } from './src/scenes/immersive-toybox-scenes/pirate-cove/hullPlan';`,
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
  const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, aspect, 0.1, 100);
  cam.position.copy(position);
  cam.lookAt(target);
  cam.updateMatrixWorld(true);
  return cam;
};

// `-mvPosition.z` — exactly the quantity three.js's fog chunk feeds the fog
// factor. Copied from the contract suite so the two cannot disagree.
const viewDepth = (cam, worldPoint) => -worldPoint.clone().applyMatrix4(cam.matrixWorldInverse).z;
const fogFraction = (depth, fog) => Math.min(1, Math.max(0, (depth - fog.near) / (fog.far - fog.near)));

// Reproduced from tests/room/scene-sky-fog-contract.test.mjs.
const envelopePoses = (sceneId, aspect) => {
  const preset = M.getSceneCameraPreset(sceneId);
  const c = preset.constraints ?? {};
  const panRangeX = c.panRangeX ?? 3.5;
  const minPolar = c.minPolar ?? Math.max(0.9, preset.polar - 0.1);
  const maxPolar = c.maxPolar ?? Math.min(1.35, preset.polar + 0.1);
  const maxTargetY = c.maxTargetY ?? 2.0;
  const maxAz = c.maxAzimuthRange ?? 0.25;
  const ceilingY = c.ceilingY ?? 6.0;
  const minDistance = c.minDistance ?? preset.distance * 0.2;
  const maxDistance = M.sceneCameraMaxDistance(sceneId, aspect);
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

// ------------------------------------------------------------------ the ship
//
// Every point of the ship a viewer can see, taken from the plan rather than
// hand-copied: the five hull outline corners at deck level and at rail height,
// plus the masthead and the yardarm tips. `near` must clear the deepest of them
// or the fix hazes its own subject.
const SHIP = [];
for (const [x, z] of M.HULL_OUTLINE) {
  SHIP.push([`hull (${x}, ${z}) deck`, new Vector3(x, 0, z)]);
  SHIP.push([`hull (${x}, ${z}) rail`, new Vector3(x, 1.0, z)]);
}
SHIP.push(['masthead', new Vector3(0, M.MAST.height, M.MAST.z)]);
SHIP.push(["crow's nest", new Vector3(0, M.MAST.nestY, M.MAST.z)]);
SHIP.push(['yardarm tip stbd', new Vector3(M.MAST.yardSpan / 2, M.MAST.yardY, M.MAST.z)]);
SHIP.push(['yardarm tip port', new Vector3(-M.MAST.yardSpan / 2, M.MAST.yardY, M.MAST.z)]);

// -------------------------------------------------------------- the touchables
const TOUCHABLE = [
  ...M.PIRATE_COVE_ENVIRONMENT.portals.map((p) => [`portal '${p.gameId}'`, new Vector3(p.position.x, 0.3, p.position.z)]),
  ['the centre of the play area', new Vector3(0, 0, 0)],
];

// ---------------------------------------------------------------- the backdrop
const R = M.PIRATE_COVE_SKY_FOG.sky.radius;
const BACKDROP_NEAR = new Vector3(0, M.OCEAN_Y, R / 2);
const BACKDROP_FAR = new Vector3(0, M.OCEAN_Y, R);

// ---------------------------------------------------------------- measurement
const worstOver = (points, poseFilter) => {
  let deepest = { depth: -Infinity };
  let shallowest = { depth: Infinity };
  for (const [label, aspect] of ASPECTS) {
    const poses = poseFilter === 'opening' ? [M.resolveSceneCameraPose('pirate-cove', aspect)] : envelopePoses('pirate-cove', aspect);
    for (const pose of poses) {
      const cam = camAt(pose.position, pose.target, aspect);
      for (const [name, point] of points) {
        const d = viewDepth(cam, point);
        if (d > deepest.depth) deepest = { depth: d, name, label };
        if (d < shallowest.depth) shallowest = { depth: d, name, label };
      }
    }
  }
  return { deepest, shallowest };
};

console.log('==== VIEW-SPACE DEPTH WALLS  (three.js fogs on -mvPosition.z)\n');

const ship = worstOver(SHIP, 'envelope');
console.log(`  SHIP, deepest point anywhere in the camera envelope`);
console.log(`    ${ship.deepest.depth.toFixed(2)} units — ${ship.deepest.name} at ${ship.deepest.label}`);
console.log(`    => fog.near must be at or beyond this, or the ship fogs itself.\n`);

const touch = worstOver(TOUCHABLE, 'envelope');
console.log(`  TOUCHABLES, deepest point anywhere in the camera envelope`);
console.log(`    ${touch.deepest.depth.toFixed(2)} units — ${touch.deepest.name} at ${touch.deepest.label}`);
console.log(`    => contract ceiling is 25% fogged; this is far inside the ship's wall, so it does not bind.\n`);

const bnear = worstOver([['near backdrop', BACKDROP_NEAR]], 'opening');
const bfar = worstOver([['far backdrop', BACKDROP_FAR]], 'opening');
console.log(`  BACKDROP at the opening pose, across nine aspects`);
console.log(`    near band (sea at z ${R / 2}):  depth ${bnear.shallowest.depth.toFixed(2)} .. ${bnear.deepest.depth.toFixed(2)}`);
console.log(`    far  band (sea at z ${R}):  depth ${bfar.shallowest.depth.toFixed(2)} .. ${bfar.deepest.depth.toFixed(2)}`);
console.log(`    => near band must be >10% fogged, far band >60%, and far - near > 15 points.`);
console.log(`    => fog.far <= sky radius ${R}.\n`);

// ------------------------------------------------------------------ candidates
//
// Scored against every assertion the contract suite makes, plus the ship rule
// the suite does not yet make (it is added in tests/room/pirate-cove-hull.test.mjs).
const CANDIDATES = [
  [20, 55], // what ships today
  [24, 55],
  [25, 55],
  [26, 55],
  [25, 50],
  [25, 60],
  [28, 55],
  [30, 55],
  [36, 55],
];

console.log('==== CANDIDATES\n');
console.log('   near   far    ship worst   touch worst   bnear    bfar     delta   verdict');
for (const [near, far] of CANDIDATES) {
  const fog = { near, far };
  let shipWorst = 0;
  let shipWho = '';
  for (const [label, aspect] of ASPECTS) {
    for (const pose of envelopePoses('pirate-cove', aspect)) {
      const cam = camAt(pose.position, pose.target, aspect);
      for (const [name, point] of SHIP) {
        const f = fogFraction(viewDepth(cam, point), fog);
        if (f > shipWorst) {
          shipWorst = f;
          shipWho = `${name} @ ${label}`;
        }
      }
    }
  }
  let touchWorst = 0;
  for (const [, aspect] of ASPECTS) {
    for (const pose of envelopePoses('pirate-cove', aspect)) {
      const cam = camAt(pose.position, pose.target, aspect);
      for (const [, point] of TOUCHABLE) touchWorst = Math.max(touchWorst, fogFraction(viewDepth(cam, point), fog));
    }
  }
  let minNear = 1;
  let minFar = 1;
  let minDelta = 1;
  for (const [, aspect] of ASPECTS) {
    const pose = M.resolveSceneCameraPose('pirate-cove', aspect);
    const cam = camAt(pose.position, pose.target, aspect);
    const fN = fogFraction(viewDepth(cam, BACKDROP_NEAR), fog);
    const fF = fogFraction(viewDepth(cam, BACKDROP_FAR), fog);
    minNear = Math.min(minNear, fN);
    minFar = Math.min(minFar, fF);
    minDelta = Math.min(minDelta, fF - fN);
  }
  const fails = [];
  if (shipWorst > 0.001) fails.push(`ship ${(shipWorst * 100).toFixed(1)}% (${shipWho})`);
  if (touchWorst > 0.25) fails.push('touchable > 25%');
  if (minNear <= 0.1) fails.push('near backdrop <= 10%');
  if (minFar <= 0.6) fails.push('far backdrop <= 60%');
  if (minDelta <= 0.15) fails.push('delta <= 15pts');
  if (far > R) fails.push('far > sky radius');
  console.log(
    `   ${String(near).padStart(4)}  ${String(far).padStart(4)}    ` +
      `${(shipWorst * 100).toFixed(1).padStart(9)}%   ${(touchWorst * 100).toFixed(1).padStart(10)}%   ` +
      `${(minNear * 100).toFixed(1).padStart(5)}%  ${(minFar * 100).toFixed(1).padStart(5)}%  ${(minDelta * 100).toFixed(1).padStart(5)}pt   ` +
      `${fails.length ? `FAIL: ${fails.join('; ')}` : 'PASS'}`,
  );
}
