// SCRATCH PROBE. The chosen poses are fixed; this measures, on a fine aspect
// grid, the two numbers the shipped turn budget has to sit between at every
// aspect: what the worst room NEEDS to bring its exits within reach, and what
// the worst room can SAFELY turn before a frame corner leaves the set.
//
// The budget is a pinned table interpolated between samples, so the grid has to
// be fine enough that interpolation cannot step over a dip — the Kitchen's safe
// turn falls off a cliff somewhere between aspect 1.6 and 2.0 and a coarse table
// would walk straight past it.
import { Box3, PerspectiveCamera, Scene, Spherical, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'turn-schedule',
  `
  export { frameSeesPastWalls, orbitPositionsAt } from './src/utils/scene/rotationRange';
  export { SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
  export { buildPlayroomContents } from './src/scenes/world/places/house/subplaces/playroom/room';
  export { buildRoomContents as buildKitchenContents } from './src/scenes/world/places/house/subplaces/kitchen/room';
  export { buildRoomContents as buildLivingRoomContents } from './src/scenes/world/places/house/subplaces/living-room/room';
  export * as PLAYROOM from './src/scenes/world/places/house/subplaces/playroom/layout';
  export * as KITCHEN from './src/scenes/world/places/house/subplaces/kitchen/layout';
  export * as LIVING from './src/scenes/world/places/house/subplaces/living-room/layout';
`,
);

const POSE = {
  playroom: { polar: 0.9, d: 5.0, ty: 3.75, tz: -8.0 },
  kitchen: { polar: 0.86, d: 5.0, ty: 3.75, tz: -4.6 },
  'living-room': { polar: 0.84, d: 5.0, ty: 3.75, tz: -4.6 },
};
const CLAMP = 6.0;
const AZ = Math.PI;
const CENTRE_LIMIT = 0.85;
const AREA_LIMIT = 0.6;
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
const poseAt = (r, pivot, d, polar) => {
  const p = pivot.clone().add(new Vector3().setFromSpherical(new Spherical(d, polar, AZ + r)));
  if (p.y > CLAMP) p.y = CLAMP;
  return p;
};
const v = new Vector3();
function tappable(pts) {
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (const p of pts) {
    v.copy(p).project(cam);
    if (v.z > 1) return false;
    x0 = Math.min(x0, v.x);
    x1 = Math.max(x1, v.x);
    y0 = Math.min(y0, v.y);
    y1 = Math.max(y1, v.y);
  }
  const cx = (x0 + x1) / 2,
    cy = (y0 + y1) / 2;
  if (Math.abs(cx) > CENTRE_LIMIT || Math.abs(cy) > CENTRE_LIMIT) return false;
  const full = (x1 - x0) * (y1 - y0);
  if (full <= 1e-9) return true;
  return (Math.max(0, Math.min(x1, 1) - Math.max(x0, -1)) * Math.max(0, Math.min(y1, 1) - Math.max(y0, -1))) / full >= AREA_LIMIT;
}

const ASPECTS = [];
for (let a = 0.4; a <= 2.601; a += 0.02) ASPECTS.push(+a.toFixed(2));

const TABLE = {};
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
  const sn = new Set();
  for (const t of tap) {
    if (t === ground || sn.has(t)) continue;
    sn.add(t);
    const b = new Box3().setFromObject(t);
    if (b.isEmpty()) continue;
    const pts = [];
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(new Vector3(x, y, z));
    props.push({ name: t.name || '?', pts });
  }
  const exits = props.filter((p) => p.name.startsWith('toybox_') || p.name.includes('_doorway'));
  const shell = { wallX: L.LEFT_WALL_X, frontZ: L.BACK_WALL_CENTER_Z - L.ROOM_DEPTH, backZ: L.BACK_WALL_CENTER_Z, ceilingY: L.CEILING_Y, floorY: 0 };
  const c = POSE[id];
  const pivot = new Vector3(0, c.ty, c.tz);
  const orbit = { azimuth: AZ, pivot, radii: [c.d], polars: [Math.max(0.75, c.polar - 0.1), c.polar, Math.min(1.5, c.polar + 0.1)], ceilingClamp: CLAMP };
  const dirtyAt = (r, aspect) => {
    for (const pos of M.orbitPositionsAt(r, orbit)) {
      aim(pos, pivot, aspect);
      if (M.frameSeesPastWalls(pos, corners(), shell)) return true;
    }
    return false;
  };
  TABLE[id] = {};
  for (const aspect of ASPECTS) {
    let lo = 0,
      hi = 1.4;
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      if (dirtyAt(mid, aspect)) hi = mid;
      else lo = mid;
    }
    const safe = lo;
    let need = 0,
      miss = false;
    for (const ex of exits) {
      let b = Infinity;
      for (let r = -safe; r <= safe + 1e-9; r += Math.max(safe / 48, 5e-4)) {
        const p = poseAt(r, pivot, c.d, c.polar);
        aim(p, pivot, aspect);
        if (seesCeiling(p, shell)) continue;
        if (tappable(ex.pts)) b = Math.min(b, Math.abs(r));
      }
      if (!Number.isFinite(b)) {
        miss = true;
        break;
      }
      need = Math.max(need, b);
    }
    TABLE[id][aspect] = { safe, need, miss };
  }
  contents?.cleanup?.();
}

console.log('aspect   need(playroom/kitchen/living)      worst need   least safe   headroom');
const rows = [];
for (const aspect of ASPECTS) {
  const cells = Object.keys(TABLE).map((id) => TABLE[id][aspect]);
  if (cells.some((c) => c.miss)) {
    console.log(
      `  ${aspect.toFixed(2)}   UNREACHABLE in ${Object.keys(TABLE)
        .filter((id) => TABLE[id][aspect].miss)
        .join(',')}`,
    );
    continue;
  }
  const need = Math.max(...cells.map((c) => c.need));
  const safe = Math.min(...cells.map((c) => c.safe));
  rows.push({ aspect, need, safe });
  console.log(
    `  ${aspect.toFixed(2)}   ` +
      cells
        .map((c) => `${((c.need * 180) / Math.PI).toFixed(1)}`)
        .join(' / ')
        .padEnd(24) +
      `±${((need * 180) / Math.PI).toFixed(1)}°`.padStart(9) +
      `±${((safe * 180) / Math.PI).toFixed(1)}°`.padStart(12) +
      `   ${safe > need ? (safe / need).toFixed(2) + 'x' : 'NONE'}`,
  );
}
const bad = rows.filter((r) => r.safe <= r.need);
console.log(`\n${bad.length} aspects with no feasible budget` + (bad.length ? ': ' + bad.map((r) => r.aspect).join(', ') : ''));
console.log('\nJSON ' + JSON.stringify(rows.map((r) => [r.aspect, +r.need.toFixed(4), +r.safe.toFixed(4)])));
process.exit(0);
