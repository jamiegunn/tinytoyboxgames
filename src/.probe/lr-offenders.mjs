// SCRATCH PROBE. At the tightest clean pose the shortened living room allows,
// which props are still outside the frame, and by how much?
import { Box3, PerspectiveCamera, Scene, Spherical, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';
const M = await bundleEntry(
  'lr-offenders',
  `
  export { frameSeesPastWalls, orbitPositionsAt } from './src/utils/scene/rotationRange';
  export { getSceneCameraPreset } from './src/scenes/sceneCatalog';
  export { SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
  export { MIN_STAGE_ASPECT, MAX_STAGE_ASPECT } from './src/utils/scene/stageRect';
  export { buildRoomContents as buildLivingRoomContents } from './src/scenes/world/places/house/subplaces/living-room/room';
  export { buildRoomContents as buildKitchenContents } from './src/scenes/world/places/house/subplaces/kitchen/room';
  export * as LIVING from './src/scenes/world/places/house/subplaces/living-room/layout';
  export * as KITCHEN from './src/scenes/world/places/house/subplaces/kitchen/layout';
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
const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, 1, 0.1, 400);
const aim = (p, t, a) => {
  cam.aspect = a;
  cam.position.copy(p);
  cam.lookAt(t);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
};
const c4 = () =>
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
    props.push({ name: t.name || '?', pts, box: b });
  }
  const all = props.flatMap((p) => p.pts);
  const preset = M.getSceneCameraPreset(id);
  const shell = { wallX: L.LEFT_WALL_X, frontZ: L.BACK_WALL_CENTER_Z - L.ROOM_DEPTH, backZ: L.BACK_WALL_CENTER_Z, ceilingY: L.CEILING_Y, floorY: 0 };
  let best = null;
  for (let d = 4; d <= 22.1; d += 0.5)
    for (let polar = 0.98; polar <= 1.361; polar += 0.02)
      for (let ty = 0; ty <= 2.51; ty += 0.25)
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
                if (M.frameSeesPastWalls(pos, c4(), shell)) return true;
              }
            return false;
          };
          if (dirty(0) || dirty(0.19)) continue;
          const rest = pivot.clone().add(new Vector3().setFromSpherical(new Spherical(d, polar, preset.azimuth)));
          if (rest.y > 6.0) rest.y = 6.0;
          aim(rest, pivot, M.MIN_STAGE_ASPECT);
          const n = ndcOf(all);
          if (!best || n < best.n) best = { n, d, polar, ty, tz, rest, pivot };
        }
  aim(best.rest, best.pivot, M.MIN_STAGE_ASPECT);
  const over = props
    .map((p) => ({ name: p.name, n: ndcOf(p.pts), x: p.box.getCenter(new Vector3()).x.toFixed(2) }))
    .filter((p) => p.n > 1)
    .sort((a, b) => b.n - a.n);
  console.log(
    `\n${id}: best clean pose d ${best.d} polar ${best.polar.toFixed(2)} target [0, ${best.ty}, ${best.tz.toFixed(1)}] -> worst ndc ${best.n.toFixed(3)}`,
  );
  console.log(`  props outside the frame: ${over.length ? over.map((p) => `${p.name} ${p.n.toFixed(2)} (x ${p.x})`).join(', ') : 'none'}`);
  contents?.cleanup?.();
}
