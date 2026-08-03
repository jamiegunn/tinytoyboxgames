// SCRATCH PROBE, definitive. The opening pose for each room under letterboxing.
//
// THE MODEL IS THE GUARD'S MODEL, and the first version of this was not. It
// swept only the preset's own tilt, while `createSceneCamera` lets the player
// tilt +/-0.1 rad either side of it and clamps camera height to 6.0 rather than
// to the room's own ceiling. Solved against the narrower envelope, every room
// came back with poses that tests/room/rotation-range.test.mjs then rejected.
// So this calls `orbitPositionsAt` — the same function the guard calls — instead
// of building poses of its own.
//
// CONSTRAINTS, at every aspect the letterbox can produce:
//   - no corner of the frame leaves the set, at every reachable tilt and at both
//     ends of the rotation clamp;
//   - every tappable prop's bounding box inside the frame at the TIGHTEST stage
//     aspect, with 5% of the frame kept as margin.
// OBJECTIVE: the props as LARGE as possible.
import { Box3, PerspectiveCamera, Scene, Spherical, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'room-pose-final',
  `
  export { frameSeesPastWalls, orbitPositionsAt } from './src/utils/scene/rotationRange';
  export { getSceneCameraPreset } from './src/scenes/sceneCatalog';
  export { SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
  export { MIN_STAGE_ASPECT, MAX_STAGE_ASPECT, stageAspectFor } from './src/utils/scene/stageRect';
  export { buildPlayroomContents } from './src/scenes/world/places/house/subplaces/playroom/room';
  export { buildRoomContents as buildKitchenContents } from './src/scenes/world/places/house/subplaces/kitchen/room';
  export { buildRoomContents as buildLivingRoomContents } from './src/scenes/world/places/house/subplaces/living-room/room';
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
// Band overridable from argv so the module header's claims about WHY the band
// is 1.0-1.4 can be re-measured rather than remembered.
const FLOOR = Number(process.argv[2] ?? M.MIN_STAGE_ASPECT);
const CEIL = Number(process.argv[3] ?? M.MAX_STAGE_ASPECT);
const STAGE = [...new Set(VIEWPORTS.map(([w, h]) => Math.min(CEIL, Math.max(FLOOR, w / h))))].sort((a, b) => a - b);
const TIGHTEST = Math.min(...STAGE);
const MARGIN = 0.95;
/** The camera height clamp `createSceneCamera` applies when no preset overrides it. */
const CEILING_CLAMP = 6.0;

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
function buildRoom(build) {
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
  const contents = build({
    scene,
    canvas: stubCanvas(),
    camera: new PerspectiveCamera(),
    dispatcher,
    nav: { navigateTo: noop, launchMiniGame: noop, exitMiniGame: noop },
    owl: { flyTo: noop, setSurfaceYAt: noop, land: noop, group: { position: new Vector3() } },
  });
  scene.updateMatrixWorld(true);
  return { tappables, ground: contents.floorTargets?.[0] };
}

const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, 1, 0.1, 300);
const setCam = (position, pivot, aspect) => {
  cam.aspect = aspect;
  cam.position.copy(position);
  cam.lookAt(pivot);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
};
const cornerDirs = () =>
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([nx, ny]) => new Vector3(nx, ny, 1).unproject(cam).sub(cam.position).normalize());
const ndcOf = (pts) => {
  let w = 0;
  const v = new Vector3();
  for (const p of pts) {
    v.copy(p).project(cam);
    const d = v.z > 1 ? Infinity : Math.max(Math.abs(v.x), Math.abs(v.y));
    if (d > w) w = d;
  }
  return w;
};

console.log(`stage aspects: ${STAGE.map((a) => a.toFixed(2)).join(', ')}   tightest ${TIGHTEST.toFixed(2)}\n`);

for (const [sceneId, build, L] of [
  ['playroom', M.buildPlayroomContents, M.PLAYROOM],
  ['kitchen', M.buildKitchenContents, M.KITCHEN],
  ['living-room', M.buildLivingRoomContents, M.LIVING],
]) {
  const { tappables, ground } = buildRoom(build);
  const props = [];
  const seen = new Set();
  for (const t of tappables) {
    if (t === ground || seen.has(t)) continue;
    seen.add(t);
    const b = new Box3().setFromObject(t);
    if (b.isEmpty()) continue;
    const pts = [];
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(new Vector3(x, y, z));
    props.push({ name: t.name || '(unnamed)', pts });
  }
  const allPts = props.flatMap((p) => p.pts);
  const preset = M.getSceneCameraPreset(sceneId);
  const shell = { wallX: L.LEFT_WALL_X, frontZ: L.BACK_WALL_CENTER_Z - L.ROOM_DEPTH, backZ: L.BACK_WALL_CENTER_Z, ceilingY: L.CEILING_Y, floorY: 0 };

  const feasible = [];
  for (let m = 0.5; m <= 1.81; m += 0.04) {
    for (let polar = 1.0; polar <= 1.351; polar += 0.02) {
      for (let ty = 0; ty <= 2.51; ty += 0.25) {
        for (let tz = -3; tz <= 3.01; tz += 1) {
          const pivot = new Vector3(preset.target[0], ty, tz);
          const radius = preset.distance * m;
          // The player's whole reachable tilt, exactly as createSceneCamera allows it.
          const orbit = {
            azimuth: preset.azimuth,
            pivot,
            radii: [radius],
            polars: [Math.max(0.9, polar - 0.1), polar, Math.min(1.35, polar + 0.1)],
            ceilingClamp: CEILING_CLAMP,
          };
          const dirtyAt = (range) => {
            for (const position of M.orbitPositionsAt(range, orbit)) {
              for (const aspect of STAGE) {
                setCam(position, pivot, aspect);
                if (M.frameSeesPastWalls(position, cornerDirs(), shell)) return true;
              }
            }
            return false;
          };
          if (dirtyAt(0)) continue;
          const rest = pivot.clone().add(new Vector3().setFromSpherical(new Spherical(radius, polar, preset.azimuth)));
          if (rest.y > CEILING_CLAMP) rest.y = CEILING_CLAMP;
          setCam(rest, pivot, TIGHTEST);
          const ndc = ndcOf(allPts);
          if (ndc > MARGIN) continue;
          let lo = 0,
            hi = 0.6;
          for (let i = 0; i < 12; i++) {
            const mid = (lo + hi) / 2;
            if (dirtyAt(mid)) hi = mid;
            else lo = mid;
          }
          feasible.push({ m, polar, ty, tz, ndc, radius, y: rest.y, z: rest.z, rot: lo });
        }
      }
    }
  }
  console.log(`${sceneId} (${props.length} tappables): ${feasible.length} feasible poses`);
  if (!feasible.length) {
    console.log('  NONE\n');
    continue;
  }
  console.log(`  largest turn any feasible pose allows: ±${((Math.max(...feasible.map((f) => f.rot)) * 180) / Math.PI).toFixed(1)}°`);
  for (const rotTarget of [0.25, 0.2, 0.16, 0.12, 0.08, 0.04]) {
    const pool = feasible.filter((f) => f.rot >= rotTarget);
    if (!pool.length) {
      console.log(`  ±${((rotTarget * 180) / Math.PI).toFixed(1)}°   none`);
      continue;
    }
    const b = pool.reduce((a, c) => (c.ndc > a.ndc ? c : a));
    console.log(
      `  ±${((rotTarget * 180) / Math.PI).toFixed(1)}°   distance ${b.radius.toFixed(2)} polar ${b.polar.toFixed(2)} target [0, ${b.ty.toFixed(2)}, ${b.tz.toFixed(1)}]  cam y ${b.y.toFixed(2)} z ${b.z.toFixed(2)}   props fill ${(b.ndc * 100).toFixed(0)}%   its own max turn ±${((b.rot * 180) / Math.PI).toFixed(1)}°`,
    );
  }
  console.log('');
}
