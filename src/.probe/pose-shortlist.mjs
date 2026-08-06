// SCRATCH PROBE. The exhaustive one-pose solve found 5248 playroom poses clean
// at every aspect from 0.40 to 2.60, which is the answer to the question that
// mattered — a single held pose IS enough, no per-aspect schedule needed. Which
// of the 5248 is prettiest is not worth an hour of raycasting, and the argmax of
// a hand-built objective is not the same thing as "looks good" anyway.
//
// So this checks a handful of named candidates properly and prints what each
// costs, and the choice between them is made by looking at renders.
import { Box3, PerspectiveCamera, Raycaster, Scene, Spherical, Vector2, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'pose-shortlist',
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

const CANDIDATES = {
  playroom: [
    { tag: 'A rendered', polar: 0.88, d: 11.0, ty: 1.0, tz: -4.0 },
    { tag: 'B close   ', polar: 1.08, d: 5.0, ty: 3.25, tz: -7.0 },
    { tag: 'C closer  ', polar: 1.1, d: 4.5, ty: 3.5, tz: -9.0 },
    { tag: 'D mid     ', polar: 1.14, d: 5.0, ty: 2.0, tz: -6.0 },
  ],
  kitchen: [
    { tag: 'A rendered', polar: 1.08, d: 7.0, ty: 3.0, tz: -4.6 },
    { tag: 'B flat    ', polar: 0.86, d: 9.5, ty: 2.5, tz: -3.6 },
    { tag: 'C close   ', polar: 1.02, d: 6.0, ty: 3.5, tz: -5.6 },
    { tag: 'D forward ', polar: 0.94, d: 7.0, ty: 1.75, tz: -0.6 },
  ],
  'living-room': [
    { tag: 'A rendered', polar: 0.92, d: 5.0, ty: 3.5, tz: -4.6 },
    { tag: 'B back    ', polar: 0.9, d: 5.5, ty: 3.25, tz: -3.6 },
    { tag: 'C forward ', polar: 0.92, d: 6.5, ty: 2.75, tz: -1.6 },
    { tag: 'D low     ', polar: 1.08, d: 7.0, ty: 1.25, tz: 0.4 },
  ],
};

const ASPECTS = [0.4, 0.46, 0.56, 0.7, 0.85, 1.0, 1.2, 1.4, 1.78, 2.2, 2.6];
const CLAMP = 6.0;
const AZ = Math.PI;
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
const poseAt = (r, pivot, d, polar) => {
  const p = pivot.clone().add(new Vector3().setFromSpherical(new Spherical(d, polar, AZ + r)));
  if (p.y > CLAMP) p.y = CLAMP;
  return p;
};

function rasterise(scene, pos, pivot, aspect, n = 22) {
  aim(pos, pivot, aspect);
  const caster = new Raycaster();
  const t = { props: 0, wall: 0, floor: 0, ceiling: 0, nothing: 0 };
  for (let iy = 0; iy < n; iy++)
    for (let ix = 0; ix < n; ix++) {
      caster.setFromCamera(new Vector2((ix / (n - 1)) * 2 - 1, (iy / (n - 1)) * 2 - 1), cam);
      const h = caster.intersectObjects(scene.children, true)[0];
      if (!h) {
        t.nothing++;
        continue;
      }
      let nd = h.object;
      while (nd && !nd.name) nd = nd.parent;
      const nm = (nd?.name || '').toLowerCase();
      if (nm.includes('ceiling')) t.ceiling++;
      else if (nm.includes('floor') || nm.includes('ground')) t.floor++;
      else if (nm.includes('wall') || nm.includes('wainscot') || nm.includes('wallpaper')) t.wall++;
      else t.props++;
    }
  const tot = n * n;
  return Object.fromEntries(Object.entries(t).map(([a, b]) => [a, b / tot]));
}

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
  const shell = { wallX: L.LEFT_WALL_X, frontZ: L.BACK_WALL_CENTER_Z - L.ROOM_DEPTH, backZ: L.BACK_WALL_CENTER_Z, ceilingY: L.CEILING_Y, floorY: 0 };

  console.log(`\n======== ${id}   exits: ${exitProps.map((p) => p.name).join(', ')}`);
  for (const c of CANDIDATES[id]) {
    const pivot = new Vector3(0, c.ty, c.tz);
    const orbit = { azimuth: AZ, pivot, radii: [c.d], polars: [Math.max(0.75, c.polar - 0.1), c.polar, Math.min(1.5, c.polar + 0.1)], ceilingClamp: CLAMP };
    const dirtyAt = (r, aspect) => {
      for (const pos of M.orbitPositionsAt(r, orbit)) {
        aim(pos, pivot, aspect);
        if (M.frameSeesPastWalls(pos, corners(), shell)) return true;
      }
      return false;
    };
    const rest = poseAt(0, pivot, c.d, c.polar);
    const rows = [];
    for (const aspect of ASPECTS) {
      aim(rest, pivot, aspect);
      const ceilAtRest = seesCeiling(rest, shell);
      const voidAtRest = dirtyAt(0, aspect);
      let lo = 0,
        hi = 1.2;
      for (let i = 0; i < 13; i++) {
        const mid = (lo + hi) / 2;
        if (dirtyAt(mid, aspect)) hi = mid;
        else lo = mid;
      }
      const safe = lo;
      let need = 0,
        missing = [];
      for (const ex of exitProps) {
        let b = Infinity;
        for (let r = -safe; r <= safe + 1e-9; r += Math.max(safe / 40, 5e-4)) {
          const p = poseAt(r, pivot, c.d, c.polar);
          aim(p, pivot, aspect);
          if (seesCeiling(p, shell)) continue;
          if (ndcOf(ex.pts) <= 0.97) b = Math.min(b, Math.abs(r));
        }
        if (!Number.isFinite(b)) missing.push(ex.name);
        else need = Math.max(need, b);
      }
      rows.push({ aspect, ceilAtRest, voidAtRest, safe, need, missing });
    }
    const bad = rows.filter((r) => r.ceilAtRest || r.voidAtRest || r.missing.length || r.need > r.safe * 0.7);
    const a = rasterise(scene, rest, pivot, 0.46),
      b = rasterise(scene, rest, pivot, 1.6);
    console.log(
      `\n  ${c.tag}  polar ${c.polar} distance ${c.d} target [0, ${c.ty}, ${c.tz}]   ${bad.length ? 'FAILS at ' + bad.map((r) => r.aspect.toFixed(2)).join(',') : 'CLEAN at every aspect'}`,
    );
    console.log(
      `     0.46 frame  ${(a.props * 100).toFixed(0)}% props  ${(a.floor * 100).toFixed(0)}% floor  ${(a.wall * 100).toFixed(0)}% wall  ${(a.ceiling * 100).toFixed(1)}% ceiling  ${(a.nothing * 100).toFixed(1)}% void`,
    );
    console.log(
      `     1.60 frame  ${(b.props * 100).toFixed(0)}% props  ${(b.floor * 100).toFixed(0)}% floor  ${(b.wall * 100).toFixed(0)}% wall  ${(b.ceiling * 100).toFixed(1)}% ceiling  ${(b.nothing * 100).toFixed(1)}% void`,
    );
    console.log('     aspect  safe turn  needed  ' + (bad.length ? 'why' : ''));
    for (const r of rows)
      console.log(
        `      ${r.aspect.toFixed(2)}    ±${((r.safe * 180) / Math.PI).toFixed(1)}°`.padEnd(22) +
          `±${((r.need * 180) / Math.PI).toFixed(1)}°`.padStart(7) +
          (r.ceilAtRest ? '  ceiling' : '') +
          (r.voidAtRest ? '  void' : '') +
          (r.missing.length ? '  unreachable: ' + r.missing.join(',') : '') +
          (!r.missing.length && r.need > r.safe * 0.7 ? '  no margin' : ''),
      );
  }
  contents?.cleanup?.();
}
process.exit(0);
