// SCRATCH PROBE. "The ceiling is too in your face" and "the rooms are long, so
// much detail is lost" — can one change answer both?
//
// The rooms are twice as deep as they are wide, and every prop is in use across
// that depth (22/24 slices in the playroom, 20/20 in the other two). So the far
// half is not empty, it is FAR: from a 50-degree lens at the front of a 24-unit
// room, a toy at the back wall is three times further away than one at the front
// and reads a third the size.
//
// A longer lens is the standard answer to that and costs one constant. Narrow
// the FOV and move the camera back by the same tangent ratio: the framing at the
// target's depth is unchanged, but the fall-off with distance is much weaker, so
// things at the back read bigger. This sweeps FOV against the two things that
// have to survive it — every tappable still in frame, and no corner off the set
// — and measures what each lens does to the props at the back of the room.
import { Box3, PerspectiveCamera, Scene, Spherical, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'lens-and-ceiling',
  `
  export { frameSeesPastWalls, orbitPositionsAt, SHARED_ROTATION_RANGE } from './src/utils/scene/rotationRange';
  export { getSceneCameraPreset } from './src/scenes/sceneCatalog';
  export { MIN_STAGE_ASPECT, MAX_STAGE_ASPECT } from './src/utils/scene/stageRect';
  export { buildPlayroomContents } from './src/scenes/world/places/house/subplaces/playroom/room';
  export { buildRoomContents as buildKitchenContents } from './src/scenes/world/places/house/subplaces/kitchen/room';
  export { buildRoomContents as buildLivingRoomContents } from './src/scenes/world/places/house/subplaces/living-room/room';
  export * as PLAYROOM from './src/scenes/world/places/house/subplaces/playroom/layout';
  export * as KITCHEN from './src/scenes/world/places/house/subplaces/kitchen/layout';
  export * as LIVING from './src/scenes/world/places/house/subplaces/living-room/layout';
`,
);

const STAGE = [M.MIN_STAGE_ASPECT, 1.33, M.MAX_STAGE_ASPECT];
const TIGHTEST = M.MIN_STAGE_ASPECT;
const CEILING_CLAMP = 6.0;
const FOVS = [50, 44, 38, 32, 26];

const noop = () => {};
const stubCanvas = () => ({
  width: 1280,
  height: 720,
  clientWidth: 1280,
  clientHeight: 720,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
  addEventListener: noop,
  removeEventListener: noop,
  style: {},
});

function buildRoom(fn) {
  const scene = new Scene();
  const tappables = [];
  const dispatcher = {
    register: (t) => {
      tappables.push(t);
      return noop;
    },
    registerWithPoint: (t) => {
      tappables.push(t);
      return noop;
    },
    setMissHandler: noop,
    dispose: noop,
  };
  const contents = fn({
    scene,
    canvas: stubCanvas(),
    camera: new PerspectiveCamera(),
    dispatcher,
    nav: { navigateTo: noop, launchMiniGame: noop, exitMiniGame: noop },
    owl: { flyTo: noop, setSurfaceYAt: noop, land: noop, group: { position: new Vector3() } },
  });
  scene.updateMatrixWorld(true);
  const ground = contents.floorTargets?.[0];
  const props = [];
  const seen = new Set();
  for (const t of tappables) {
    if (t === ground || seen.has(t)) continue;
    seen.add(t);
    const b = new Box3().setFromObject(t);
    if (b.isEmpty()) continue;
    const corners = [];
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) corners.push(new Vector3(x, y, z));
    props.push({ name: t.name || '?', corners, z: b.getCenter(new Vector3()).z });
  }
  contents?.cleanup?.();
  return props;
}

let cam = new PerspectiveCamera(50, 1, 0.1, 400);
const aim = (position, pivot, aspect, fov) => {
  cam.fov = fov;
  cam.aspect = aspect;
  cam.position.copy(position);
  cam.lookAt(pivot);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
};
const corners4 = () =>
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([nx, ny]) => new Vector3(nx, ny, 1).unproject(cam).sub(cam.position).normalize());
const ndcSpan = (pts) => {
  let minX = 1e9,
    maxX = -1e9,
    minY = 1e9,
    maxY = -1e9,
    behind = false;
  const v = new Vector3();
  for (const p of pts) {
    v.copy(p).project(cam);
    if (v.z > 1) behind = true;
    minX = Math.min(minX, v.x);
    maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y);
    maxY = Math.max(maxY, v.y);
  }
  return { worst: behind ? Infinity : Math.max(Math.abs(minX), Math.abs(maxX), Math.abs(minY), Math.abs(maxY)), height: (maxY - minY) / 2 };
};

for (const [sceneId, fn, L] of [
  ['playroom', M.buildPlayroomContents, M.PLAYROOM],
  ['kitchen', M.buildKitchenContents, M.KITCHEN],
  ['living-room', M.buildLivingRoomContents, M.LIVING],
]) {
  const props = buildRoom(fn);
  const preset = M.getSceneCameraPreset(sceneId);
  const shell = { wallX: L.LEFT_WALL_X, frontZ: L.BACK_WALL_CENTER_Z - L.ROOM_DEPTH, backZ: L.BACK_WALL_CENTER_Z, ceilingY: L.CEILING_Y, floorY: 0 };
  const backmost = props.reduce((a, b) => (b.z > a.z ? b : a));
  console.log(`\n=== ${sceneId}   backmost tappable: ${backmost.name} at z ${backmost.z.toFixed(1)}`);
  console.log('  fov   distance  polar  target        props fill   backmost prop height   ceiling in frame   max turn');

  for (const fov of FOVS) {
    let best = null;
    for (let d = 6; d <= 34.1; d += 0.5) {
      for (let polar = 1.0; polar <= 1.401; polar += 0.02) {
        for (let ty = 0; ty <= 2.51; ty += 0.25) {
          for (let tz = -4; tz <= 4.01; tz += 1) {
            const pivot = new Vector3(0, ty, tz);
            const orbit = {
              azimuth: preset.azimuth,
              pivot,
              radii: [d],
              polars: [Math.max(0.9, polar - 0.1), polar, Math.min(1.35, polar + 0.1)],
              ceilingClamp: CEILING_CLAMP,
            };
            const dirty = (range) => {
              for (const position of M.orbitPositionsAt(range, orbit)) {
                for (const aspect of STAGE) {
                  aim(position, pivot, aspect, fov);
                  if (M.frameSeesPastWalls(position, corners4(), shell)) return true;
                }
              }
              return false;
            };
            if (dirty(0)) continue;
            const rest = pivot.clone().add(new Vector3().setFromSpherical(new Spherical(d, polar, preset.azimuth)));
            if (rest.y > CEILING_CLAMP) rest.y = CEILING_CLAMP;
            aim(rest, pivot, TIGHTEST, fov);
            // NO CEILING IN FRAME. The kitchen reads best of the three and the
            // measured difference is exactly this: 0% ceiling against 14.6% in
            // the playroom. So it becomes a constraint rather than an outcome —
            // the top edge of the frame must stay below the ceiling plane.
            const topRay = corners4()[2];
            const ceilingInFrame = topRay.y > 0 && rest.y + topRay.y * ((shell.backZ - rest.z) / Math.max(1e-6, topRay.z)) >= shell.ceilingY;
            const fill = ndcSpan(props.flatMap((p) => p.corners));
            if (fill.worst > 0.95) continue;
            let lo = 0,
              hi = 0.6;
            for (let i = 0; i < 10; i++) {
              const mid = (lo + hi) / 2;
              if (dirty(mid)) hi = mid;
              else lo = mid;
            }
            if (lo < 0.18) continue;
            const back = ndcSpan(backmost.corners).height;
            const score = back;
            if (!best || (!ceilingInFrame && best.ceiling) || (ceilingInFrame === best.ceiling && score > best.score)) {
              best = { d, polar, ty, tz, fill: fill.worst, back, ceiling: ceilingInFrame, rot: lo, score };
            }
          }
        }
      }
    }
    console.log(
      best
        ? `  ${String(fov).padEnd(5)} ${best.d.toFixed(1).padStart(7)}  ${best.polar.toFixed(2)}   [0, ${best.ty.toFixed(2)}, ${best.tz}]   ${(best.fill * 100).toFixed(0)}%        ${(best.back * 200).toFixed(1)}% of frame      ${best.ceiling ? 'YES' : 'no'}               ±${((best.rot * 180) / Math.PI).toFixed(1)}°`
        : `  ${String(fov).padEnd(5)} no pose satisfies every constraint`,
    );
  }
}
