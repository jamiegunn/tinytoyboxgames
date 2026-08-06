// SCRATCH PROBE. narrow-binding.mjs proved the letterbox has exactly one cause:
// the void filter and the ceiling filter are aspect-INDEPENDENT (identical
// survivor counts at every aspect, because the vertical field is what escapes
// the shell and vertical FOV does not move with aspect). The only thing that
// degrades on a phone is "every exit inside the frame at rest", and it degrades
// as exactly 1/aspect — best exits NDC for the playroom is 0.70 at aspect 1.00,
// 0.98 at 0.70, 1.71 at 0.40. It is a purely HORIZONTAL failure: the exits run
// off the sides.
//
// So the letterbox is not a fact about rooms. It is the price of one rule:
// everything must be on screen without moving. This asks whether the cheaper
// rule works — everything must be REACHABLE. Rotation is nearly free at a narrow
// aspect for the same reason the exits do not fit: a horizontally narrow frame
// can swing much further before its corner passes the end of a side wall.
import { Box3, PerspectiveCamera, Scene, Spherical, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'reach-by-turning',
  `
  export { frameSeesPastWalls, orbitPositionsAt } from './src/utils/scene/rotationRange';
  export { getSceneCameraPreset } from './src/scenes/sceneCatalog';
  export { SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
  export { buildPlayroomContents } from './src/scenes/world/places/house/subplaces/playroom/room';
  export { buildRoomContents as buildKitchenContents } from './src/scenes/world/places/house/subplaces/kitchen/room';
  export { buildRoomContents as buildLivingRoomContents } from './src/scenes/world/places/house/subplaces/living-room/room';
  export * as PLAYROOM from './src/scenes/world/places/house/subplaces/playroom/layout';
  export * as KITCHEN from './src/scenes/world/places/house/subplaces/kitchen/layout';
  export * as LIVING from './src/scenes/world/places/house/subplaces/living-room/layout';
`,
);

const ASPECTS = [0.4, 0.46, 0.56, 0.7, 0.85, 1.0, 1.2, 1.4, 1.78, 2.37];
const CLAMP = 6.0;
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
const seesCeiling = (pos, shell) => {
  const d4 = corners();
  for (const d of [d4[2], d4[3]]) {
    if (d.y <= 0) continue;
    const tC = (shell.ceilingY - pos.y) / d.y;
    const tB = d.z > 1e-6 ? (shell.backZ - pos.z) / d.z : Infinity;
    if (tC > 0 && tC < tB) return true;
  }
  return false;
};

// Where the camera sits after turning by `r` about the pivot, matching the
// runtime's orbit: azimuth offset, polar unchanged, height clamped.
const poseAt = (r, pivot, d, polar, azimuth) => {
  const p = pivot.clone().add(new Vector3().setFromSpherical(new Spherical(d, polar, azimuth + r)));
  if (p.y > CLAMP) p.y = CLAMP;
  return p;
};

for (const [id, fn, L] of [
  ['playroom', M.buildPlayroomContents, M.PLAYROOM],
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
  const exitProps = props.filter((p) => p.name.startsWith('toybox_') || p.name.includes('_doorway'));
  const preset = M.getSceneCameraPreset(id);
  const shell = { wallX: L.LEFT_WALL_X, frontZ: L.BACK_WALL_CENTER_Z - L.ROOM_DEPTH, backZ: L.BACK_WALL_CENTER_Z, ceilingY: L.CEILING_Y, floorY: 0 };

  console.log(`\n=== ${id}`);
  console.log('  aspect  safe turn   turn needed to reach every exit   verdict   pose');
  for (const aspect of ASPECTS) {
    let best = null;
    for (let d = 4; d <= 20.1; d += 0.5)
      for (let polar = 0.8; polar <= 1.501; polar += 0.02)
        for (let ty = 0; ty <= 3.51; ty += 0.25)
          for (let tz = shell.frontZ + 1; tz <= shell.backZ - 1.01; tz += 1) {
            const pivot = new Vector3(0, ty, tz);
            const orbit = {
              azimuth: preset.azimuth,
              pivot,
              radii: [d],
              polars: [Math.max(0.75, polar - 0.1), polar, Math.min(1.5, polar + 0.1)],
              ceilingClamp: CLAMP,
            };
            const dirty = (r) => {
              for (const pos of M.orbitPositionsAt(r, orbit)) {
                aim(pos, pivot, aspect);
                if (M.frameSeesPastWalls(pos, corners(), shell)) return true;
              }
              return false;
            };
            if (dirty(0)) continue;
            const rest = poseAt(0, pivot, d, polar, preset.azimuth);
            aim(rest, pivot, aspect);
            if (seesCeiling(rest, shell)) continue;
            // Largest turn that keeps the frame on the set, both ways.
            let lo = 0,
              hi = 0.9;
            for (let i = 0; i < 12; i++) {
              const mid = (lo + hi) / 2;
              if (dirty(mid)) hi = mid;
              else lo = mid;
            }
            const safe = lo;
            // Smallest turn that brings each exit fully inside the frame.
            let worst = 0,
              unreachable = false;
            for (const ex of exitProps) {
              let needed = Infinity;
              for (let r = -safe; r <= safe + 1e-9; r += Math.max(safe / 24, 1e-3)) {
                const p = poseAt(r, pivot, d, polar, preset.azimuth);
                aim(p, pivot, aspect);
                if (seesCeiling(p, shell)) continue;
                if (ndcOf(ex.pts) <= 0.97) {
                  needed = Math.min(needed, Math.abs(r));
                }
              }
              if (!Number.isFinite(needed)) {
                unreachable = true;
                break;
              }
              worst = Math.max(worst, needed);
            }
            if (unreachable) continue;
            const score = -worst;
            if (!best || score > best.score) best = { d, polar, ty, tz, safe, worst, score };
          }
    if (!best) {
      console.log(`  ${aspect.toFixed(2)}    none — no pose reaches every exit within its own safe turn`);
      continue;
    }
    console.log(
      `  ${aspect.toFixed(2)}    ±${((best.safe * 180) / Math.PI).toFixed(1)}°`.padEnd(22) +
        `±${((best.worst * 180) / Math.PI).toFixed(1)}°`.padStart(8) +
        `   ${best.worst <= best.safe ? 'REACHABLE' : 'no'}   d ${best.d.toFixed(1)} polar ${best.polar.toFixed(2)} target [0, ${best.ty.toFixed(2)}, ${best.tz.toFixed(1)}]`,
    );
  }
  contents?.cleanup?.();
}
process.exit(0);
