// SCRATCH PROBE. Among every clean pose the shortened rooms allow, which ones
// show NO ceiling, and how much of the exits do they keep in frame?
//
// The ceiling test is analytic rather than rasterised so it can run over the
// whole grid: cast the two top frustum corners and ask whether either reaches
// the ceiling plane before it reaches the back wall. That is the same question
// the raster asks, one ray instead of a thousand.
import { Box3, PerspectiveCamera, Scene, Spherical, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';
const M = await bundleEntry(
  'no-ceiling-solve',
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
const MIN_ROT = 0.19;
const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, 1, 0.1, 400);
const aim = (p, t, a) => {
  cam.aspect = a;
  cam.position.copy(p);
  cam.lookAt(t);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
};
const corners = () =>
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([x, y]) => new Vector3(x, y, 1).unproject(cam).sub(cam.position).normalize());
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
/** Does either top corner reach the ceiling plane before the back wall? */
const seesCeiling = (pos, shell) => {
  const dirs = corners();
  for (const d of [dirs[2], dirs[3]]) {
    if (d.y <= 0) continue;
    const tCeil = (shell.ceilingY - pos.y) / d.y;
    const tBack = d.z > 1e-6 ? (shell.backZ - pos.z) / d.z : Infinity;
    if (tCeil > 0 && tCeil < tBack) return true;
  }
  return false;
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
  const props = [];
  const seen = new Set();
  for (const t of tap) {
    if (t === ground || seen.has(t)) continue;
    seen.add(t);
    const b = new Box3().setFromObject(t);
    if (b.isEmpty()) continue;
    const pts = [];
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(new Vector3(x, y, z));
    props.push({ name: t.name || '?', pts });
  }
  const isExit = (n) => n.startsWith('toybox_') || n.includes('_doorway');
  const exits = props.filter((p) => isExit(p.name)).flatMap((p) => p.pts);
  const all = props.flatMap((p) => p.pts);
  const preset = M.getSceneCameraPreset(id);
  const shell = { wallX: L.LEFT_WALL_X, frontZ: L.BACK_WALL_CENTER_Z - L.ROOM_DEPTH, backZ: L.BACK_WALL_CENTER_Z, ceilingY: L.CEILING_Y, floorY: 0 };
  let clean = 0,
    noCeil = 0;
  let best = null;
  for (let d = 4; d <= 22.1; d += 0.5)
    for (let polar = 0.98; polar <= 1.401; polar += 0.02)
      for (let ty = 0; ty <= 3.01; ty += 0.25)
        for (let tz = shell.frontZ + 1; tz <= shell.backZ - 1.01; tz += 1) {
          const pivot = new Vector3(0, ty, tz);
          const orbit = {
            azimuth: preset.azimuth,
            pivot,
            radii: [d],
            polars: [Math.max(0.9, polar - 0.1), polar, Math.min(1.35, polar + 0.1)],
            ceilingClamp: 6.0,
          };
          const dirty = (r) => {
            for (const pos of M.orbitPositionsAt(r, orbit))
              for (const a of STAGE) {
                aim(pos, pivot, a);
                if (M.frameSeesPastWalls(pos, corners(), shell)) return true;
              }
            return false;
          };
          if (dirty(0) || dirty(MIN_ROT)) continue;
          clean++;
          const rest = pivot.clone().add(new Vector3().setFromSpherical(new Spherical(d, polar, preset.azimuth)));
          if (rest.y > 6.0) rest.y = 6.0;
          let ceilAnywhere = false;
          for (const a of STAGE) {
            aim(rest, pivot, a);
            if (seesCeiling(rest, shell)) {
              ceilAnywhere = true;
              break;
            }
          }
          if (ceilAnywhere) continue;
          noCeil++;
          aim(rest, pivot, M.MIN_STAGE_ASPECT);
          const e = ndcOf(exits);
          const a = ndcOf(all);
          if (!best || e < best.e) best = { e, a, d, polar, ty, tz, rest };
        }
  console.log(`\n${id}: ${clean} clean poses, ${noCeil} of them show no ceiling`);
  console.log(
    best
      ? `  best exits-in-frame: exits ${best.e.toFixed(3)} all ${best.a.toFixed(3)}  d ${best.d} polar ${best.polar.toFixed(2)} target [0, ${best.ty}, ${best.tz.toFixed(1)}]  cam y ${best.rest.y.toFixed(2)} z ${best.rest.z.toFixed(2)}`
      : '  none',
  );
  contents?.cleanup?.();
}
