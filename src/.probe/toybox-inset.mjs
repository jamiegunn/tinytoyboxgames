// SCRATCH PROBE. The Living Room's two toyboxes have now been the binding
// constraint THREE times: they set the stage aspect floor, they cap rotation,
// and in the shortened room they are the only props that will not fit in frame.
// Each time the note said "move them inboard is set dressing, not code". How far
// inboard, and what does each step buy?
//
// Simulated by translating the built roots in x, so no source is touched until
// the number is chosen.
import { Box3, PerspectiveCamera, Scene, Spherical, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';
const M = await bundleEntry(
  'toybox-inset',
  `
  export { frameSeesPastWalls, orbitPositionsAt } from './src/utils/scene/rotationRange';
  export { getSceneCameraPreset } from './src/scenes/sceneCatalog';
  export { SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
  export { MIN_STAGE_ASPECT, MAX_STAGE_ASPECT } from './src/utils/scene/stageRect';
  export { buildRoomContents as buildLivingRoomContents } from './src/scenes/world/places/house/subplaces/living-room/room';
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
const L = M.LIVING;
const shell = { wallX: L.LEFT_WALL_X, frontZ: L.BACK_WALL_CENTER_Z - L.ROOM_DEPTH, backZ: L.BACK_WALL_CENTER_Z, ceilingY: L.CEILING_Y, floorY: 0 };
const preset = M.getSceneCameraPreset('living-room');
console.log('  inset   toybox x   worst prop ndc   max turn at that pose   new collisions');
for (const inset of [0, 0.3, 0.6, 0.9, 1.2]) {
  const scene = new Scene();
  const tap = [];
  const contents = M.buildLivingRoomContents({
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
  for (const o of scene.children) if (o.name?.startsWith('toybox_')) o.position.x -= Math.sign(o.position.x) * inset;
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
  const all = props.flatMap((p) => p.pts);
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
          if (dirty(0)) continue;
          const rest = pivot.clone().add(new Vector3().setFromSpherical(new Spherical(d, polar, preset.azimuth)));
          if (rest.y > 6.0) rest.y = 6.0;
          aim(rest, pivot, M.MIN_STAGE_ASPECT);
          const n = ndcOf(all);
          if (n > 0.95) continue;
          let lo = 0,
            hi = 0.6;
          for (let i = 0; i < 12; i++) {
            const mid = (lo + hi) / 2;
            if (dirty(mid)) hi = mid;
            else lo = mid;
          }
          if (!best || lo > best.rot) best = { n, rot: lo, d, polar, ty, tz };
        }
  // collisions introduced by the move
  const roots = scene.children
    .filter((o) => o.name && !/ceiling|floor|wall|wainscot|baseboard/i.test(o.name))
    .map((o) => ({ name: o.name, b: new Box3().setFromObject(o) }))
    .filter((r) => !r.b.isEmpty());
  const hits = [];
  for (let i = 0; i < roots.length; i++)
    for (let j = i + 1; j < roots.length; j++) {
      const a = roots[i].b,
        b = roots[j].b;
      const ox = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x);
      const oy = Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y);
      const oz = Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z);
      if (ox > 0.05 && oy > 0.05 && oz > 0.05 && (roots[i].name.startsWith('toybox_') || roots[j].name.startsWith('toybox_')))
        hits.push(`${roots[i].name}x${roots[j].name}`);
    }
  console.log(
    `  ${inset.toFixed(1)}     ${(3.6 - inset).toFixed(1)}        ${best ? best.n.toFixed(3) : '  none  '}          ${best ? `±${((best.rot * 180) / Math.PI).toFixed(1)}° at d ${best.d} polar ${best.polar.toFixed(2)} target [0, ${best.ty}, ${best.tz.toFixed(1)}]` : '-'}   ${hits.length ? hits.join(' ') : 'none'}`,
  );
  contents?.cleanup?.();
}
