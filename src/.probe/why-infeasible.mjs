// SCRATCH PROBE. The shortened kitchen has ZERO feasible poses. Which constraint
// is doing it — the void, the rotation, or the prop coverage?
import { Box3, PerspectiveCamera, Scene, Spherical, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';
const M = await bundleEntry(
  'why-infeasible',
  `
  export { frameSeesPastWalls, orbitPositionsAt } from './src/utils/scene/rotationRange';
  export { getSceneCameraPreset } from './src/scenes/sceneCatalog';
  export { SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
  export { MIN_STAGE_ASPECT, MAX_STAGE_ASPECT } from './src/utils/scene/stageRect';
  export { buildRoomContents as buildKitchenContents } from './src/scenes/world/places/house/subplaces/kitchen/room';
  export { buildRoomContents as buildLivingRoomContents } from './src/scenes/world/places/house/subplaces/living-room/room';
  export * as KITCHEN from './src/scenes/world/places/house/subplaces/kitchen/layout';
  export * as LIVING from './src/scenes/world/places/house/subplaces/living-room/layout';
`,
);
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
const STAGE = [M.MIN_STAGE_ASPECT, 1.33, M.MAX_STAGE_ASPECT];
const CLAMP = 6.0;
const FOVS = [50, 56, 62, 68, 74];
const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, 1, 0.1, 400);
const aim = (p, t, a) => {
  cam.fov = FOV;
  cam.aspect = a;
  cam.position.copy(p);
  cam.lookAt(t);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
};
let FOV = 50;
const c4 = () =>
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([x, y]) => new Vector3(x, y, 1).unproject(cam).sub(cam.position).normalize());
const worst = (pts) => {
  let w = 0;
  const v = new Vector3();
  for (const p of pts) {
    v.copy(p).project(cam);
    const d = v.z > 1 ? Infinity : Math.max(Math.abs(v.x), Math.abs(v.y));
    if (d > w) w = d;
  }
  return w;
};

for (const [id, fn, L] of [
  ['kitchen', M.buildKitchenContents, M.KITCHEN],
  ['living-room', M.buildLivingRoomContents, M.LIVING],
]) {
  const scene = new Scene();
  const tap = [];
  const contents = fn({
    scene,
    canvas: stubCanvas(),
    camera: new PerspectiveCamera(),
    dispatcher: {
      register: (t) => {
        tap.push(t);
        return noop;
      },
      registerWithPoint: (t) => {
        tap.push(t);
        return noop;
      },
      setMissHandler: noop,
      dispose: noop,
    },
    nav: { navigateTo: noop, launchMiniGame: noop, exitMiniGame: noop },
    owl: { flyTo: noop, setSurfaceYAt: noop, land: noop, group: { position: new Vector3() } },
  });
  scene.updateMatrixWorld(true);
  const ground = contents.floorTargets?.[0];
  const pts = [];
  const seen = new Set();
  for (const t of tap) {
    if (t === ground || seen.has(t)) continue;
    seen.add(t);
    const b = new Box3().setFromObject(t);
    if (b.isEmpty()) continue;
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(new Vector3(x, y, z));
  }
  const preset = M.getSceneCameraPreset(id);
  const shell = { wallX: L.LEFT_WALL_X, frontZ: L.BACK_WALL_CENTER_Z - L.ROOM_DEPTH, backZ: L.BACK_WALL_CENTER_Z, ceilingY: L.CEILING_Y, floorY: 0 };
  for (const f of FOVS) {
    FOV = f;

    let cleanRest = 0,
      cleanTurn = 0,
      propsFit = 0,
      total = 0;
    let bestNdc = Infinity;
    let bestPose = null;
    for (let d = 4; d <= 22.1; d += 0.5) {
      for (let polar = 0.98; polar <= 1.361; polar += 0.02) {
        for (let ty = 0; ty <= 2.51; ty += 0.25) {
          for (let tz = shell.frontZ + 1; tz <= shell.backZ - 1.01; tz += 1) {
            total++;
            const pivot = new Vector3(0, ty, tz);
            const orbit = {
              azimuth: preset.azimuth,
              pivot,
              radii: [d],
              polars: [Math.max(0.9, polar - 0.1), polar, Math.min(1.35, polar + 0.1)],
              ceilingClamp: CLAMP,
            };
            const dirty = (r) => {
              for (const pos of M.orbitPositionsAt(r, orbit))
                for (const a of STAGE) {
                  aim(pos, pivot, a);
                  if (M.frameSeesPastWalls(pos, c4(), shell)) return true;
                }
              return false;
            };
            if (dirty(0)) continue;
            cleanRest++;
            if (dirty(0.19)) continue;
            cleanTurn++;
            const rest = pivot.clone().add(new Vector3().setFromSpherical(new Spherical(d, polar, preset.azimuth)));
            if (rest.y > CLAMP) rest.y = CLAMP;
            aim(rest, pivot, M.MIN_STAGE_ASPECT);
            const n = worst(pts);
            if (n < bestNdc) {
              bestNdc = n;
              bestPose = { d, polar, ty, tz, n };
            }
            if (n < bestNdc - 1e-9 || !bestPose) bestPose = { d, polar, ty, tz, n };
            if (n <= 0.95) propsFit++;
          }
        }
      }
    }
    console.log(
      `  ${id} fov ${FOV}: clean ${cleanTurn} | props fit(<=0.95) ${propsFit} | tightest ndc ${bestNdc.toFixed(3)}` +
        (bestPose ? `  best d ${bestPose.d} polar ${bestPose.polar.toFixed(2)} target [0, ${bestPose.ty}, ${bestPose.tz}]` : ''),
    );
  }
  contents?.cleanup?.();
}
