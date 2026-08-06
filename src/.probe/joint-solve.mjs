// SCRATCH PROBE. The final solve. Everything the earlier probes established:
//
//  * narrow-binding.mjs   the void limit and the ceiling limit do NOT move with
//                         aspect (identical survivor counts at 0.40 and 1.00),
//                         because the vertical field is fixed. Only "the exits
//                         are on screen" moves, and it moves as exactly 1/aspect.
//                         So the letterbox was never about rooms; it was the
//                         price of requiring every exit on screen AT REST.
//  * reach-by-turning.mjs replacing "on screen" with "reachable by turning"
//                         admits poses at every aspect from 0.40 to 2.60.
//  * pose-shortlist.mjs   one held pose per room suffices — no per-aspect
//                         schedule, which would lurch when a phone is rotated.
//
// Two corrections in this one. The reach rule is what tapping actually needs —
// the prop's centre well inside the frame and most of its area on screen — not
// its whole bounding box inside 0.97 NDC, which is a framing rule borrowed from
// a different question and costs ~15 degrees of pointless turn. And the three
// rooms are solved jointly, because the turn budget is shared: it must exceed
// what the worst room NEEDS and stay under what the worst room can SAFELY do, at
// every aspect.
import { Box3, PerspectiveCamera, Raycaster, Scene, Spherical, Vector2, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'joint-solve',
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

const ASPECTS = [0.4, 0.5, 0.62, 0.78, 1.0, 1.3, 1.7, 2.2, 2.6];
const CLAMP = 6.0;
const AZ = Math.PI;
const CENTRE_LIMIT = 0.85; // the prop's middle this far inside the frame
const AREA_LIMIT = 0.6; // and this much of it actually on screen
const MARGIN = 0.75; // reached with a quarter of the safe turn to spare
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

// Can a child see this prop and put a finger on it?
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
  if (full <= 1e-9) return Math.abs(cx) <= CENTRE_LIMIT && Math.abs(cy) <= CENTRE_LIMIT;
  const vis = Math.max(0, Math.min(x1, 1) - Math.max(x0, -1)) * Math.max(0, Math.min(y1, 1) - Math.max(y0, -1));
  return vis / full >= AREA_LIMIT;
}

const ROOMS = [
  ['playroom', M.buildPlayroomContents, M.PLAYROOM],
  ['kitchen', M.buildKitchenContents, M.KITCHEN],
  ['living-room', M.buildLivingRoomContents, M.LIVING],
];
const CHOSEN = {};
const SHORTLIST = {};
for (const [id, fn, L] of ROOMS) {
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

  const clean = [];
  for (let d = 5.0; d <= 13.1; d += 0.5)
    for (let polar = 0.84; polar <= 1.361; polar += 0.02)
      for (let ty = 0.75; ty <= 3.76; ty += 0.25)
        for (let tz = shell.frontZ + 0.5; tz <= shell.backZ - 0.5; tz += 0.5) {
          const pivot = new Vector3(0, ty, tz);
          const orbit = { azimuth: AZ, pivot, radii: [d], polars: [Math.max(0.75, polar - 0.1), polar, Math.min(1.5, polar + 0.1)], ceilingClamp: CLAMP };
          const dirtyAt = (r, aspect) => {
            for (const pos of M.orbitPositionsAt(r, orbit)) {
              aim(pos, pivot, aspect);
              if (M.frameSeesPastWalls(pos, corners(), shell)) return true;
            }
            return false;
          };
          if (dirtyAt(0, 2.6) || dirtyAt(0, 0.4)) continue;
          const rest = poseAt(0, pivot, d, polar);
          aim(rest, pivot, 2.6);
          if (seesCeiling(rest, shell)) continue;
          aim(rest, pivot, 0.4);
          if (seesCeiling(rest, shell)) continue;
          let ok = true;
          const rows = [];
          for (const aspect of ASPECTS) {
            let lo = 0,
              hi = 1.2;
            for (let i = 0; i < 12; i++) {
              const mid = (lo + hi) / 2;
              if (dirtyAt(mid, aspect)) hi = mid;
              else lo = mid;
            }
            const safe = lo;
            if (safe <= 0) {
              ok = false;
              break;
            }
            let need = 0;
            for (const ex of exitProps) {
              let b = Infinity;
              for (let r = -safe; r <= safe + 1e-9; r += Math.max(safe / 32, 5e-4)) {
                const p = poseAt(r, pivot, d, polar);
                aim(p, pivot, aspect);
                if (seesCeiling(p, shell)) continue;
                if (tappable(ex.pts)) b = Math.min(b, Math.abs(r));
              }
              if (!Number.isFinite(b)) {
                ok = false;
                break;
              }
              need = Math.max(need, b);
            }
            if (!ok || need > safe * MARGIN) {
              ok = false;
              break;
            }
            rows.push({ aspect, safe, need });
          }
          if (ok) clean.push({ d, polar, ty, tz, rows, rest, pivot, maxNeed: Math.max(...rows.map((r) => r.need)) });
        }
  console.log(`\n=== ${id}: ${clean.length} poses clean at every aspect in [0.40, 2.60]`);
  if (!clean.length) {
    contents?.cleanup?.();
    continue;
  }

  const heur = (pos, pivot, aspect) => {
    aim(pos, pivot, aspect);
    let a = 0;
    for (const p of props) {
      let x0 = Infinity,
        x1 = -Infinity,
        y0 = Infinity,
        y1 = -Infinity,
        ok = false;
      for (const q of p.pts) {
        v.copy(q).project(cam);
        if (v.z > 1) continue;
        ok = true;
        x0 = Math.min(x0, v.x);
        x1 = Math.max(x1, v.x);
        y0 = Math.min(y0, v.y);
        y1 = Math.max(y1, v.y);
      }
      if (!ok) continue;
      a += Math.max(0, Math.min(x1, 1) - Math.max(x0, -1)) * Math.max(0, Math.min(y1, 1) - Math.max(y0, -1));
    }
    return a;
  };
  // Prefer a rich frame, but not at the price of a long hunt for the way out.
  for (const c of clean) c.key = heur(c.rest, c.pivot, 0.46) + heur(c.rest, c.pivot, 1.6) - 2.2 * c.maxNeed;
  clean.sort((p, q) => q.key - p.key);

  function rasterise(pos, pivot, aspect, n = 22) {
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
  SHORTLIST[id] = [];
  for (const c of clean.slice(0, 60)) {
    const a = rasterise(c.rest, c.pivot, 0.46),
      b = rasterise(c.rest, c.pivot, 1.6);
    if (a.ceiling > 0.004 || b.ceiling > 0.004 || a.nothing > 0.004 || b.nothing > 0.004) continue;
    SHORTLIST[id].push({ ...c, a, b, rich: (a.props + b.props) / 2 });
  }
  console.log(`  ${SHORTLIST[id].length} survive rasterisation`);
  contents?.cleanup?.();
}

// THE COMBINATION, NOT THREE INDEPENDENT PICKS. The turn budget is shared, so a
// pose is only admissible in company: the richest playroom frame needs a 21.5
// degree turn at aspect 0.50 and the richest kitchen frame can only take 20.1,
// and each is fine alone. Search the shortlists together and require the worst
// NEED to clear the least SAFE by a margin at every aspect.
const ids = Object.keys(SHORTLIST);
const JOINT_MARGIN = 1.15;
let bestCombo = null;
for (const p of SHORTLIST[ids[0]])
  for (const k of SHORTLIST[ids[1]])
    for (const l of SHORTLIST[ids[2]]) {
      const trio = [p, k, l];
      let ok = true;
      let tightest = Infinity;
      for (let i = 0; i < ASPECTS.length; i++) {
        const need = Math.max(...trio.map((t) => t.rows[i].need));
        const safe = Math.min(...trio.map((t) => t.rows[i].safe));
        if (safe < need * JOINT_MARGIN || safe <= 0) {
          ok = false;
          break;
        }
        tightest = Math.min(tightest, need > 0 ? safe / need : Infinity);
      }
      if (!ok) continue;
      const rich = trio.reduce((sum, t) => sum + t.rich, 0);
      if (!bestCombo || rich > bestCombo.rich) bestCombo = { trio, rich, tightest };
    }
if (!bestCombo) {
  console.log('\nNO FEASIBLE COMBINATION');
  process.exit(0);
}
console.log(`\n===== THE COMBINATION (tightest interval ${bestCombo.tightest.toFixed(2)}x) =====`);
ids.forEach((id, i) => {
  const t = bestCombo.trio[i];
  CHOSEN[id] = {
    polar: +t.polar.toFixed(2),
    distance: t.d,
    target: [0, +t.ty.toFixed(2), +t.tz.toFixed(2)],
    rows: t.rows.map((r) => ({ aspect: r.aspect, safe: +r.safe.toFixed(4), need: +r.need.toFixed(4) })),
    props046: +t.a.props.toFixed(3),
    props160: +t.b.props.toFixed(3),
  };
  console.log(
    `  ${id.padEnd(12)} polar ${t.polar.toFixed(2)} distance ${t.d.toFixed(1)} target [0, ${t.ty.toFixed(2)}, ${t.tz.toFixed(1)}]   0.46: ${(t.a.props * 100).toFixed(0)}%p ${(t.a.floor * 100).toFixed(0)}%f   1.60: ${(t.b.props * 100).toFixed(0)}%p ${(t.b.floor * 100).toFixed(0)}%f`,
  );
});
console.log('\n\n===== THE SHARED TURN BUDGET =====');
console.log('aspect   worst room NEEDS   worst room can SAFELY do   a budget between them');
for (let i = 0; i < ASPECTS.length; i++) {
  const need = Math.max(...Object.values(CHOSEN).map((c) => c.rows[i].need));
  const safe = Math.min(...Object.values(CHOSEN).map((c) => c.rows[i].safe));
  const mid = (need + safe) / 2;
  console.log(
    `  ${ASPECTS[i].toFixed(2)}      ±${((need * 180) / Math.PI).toFixed(1)}°`.padEnd(26) +
      `±${((safe * 180) / Math.PI).toFixed(1)}°`.padEnd(27) +
      (need <= safe ? `±${((mid * 180) / Math.PI).toFixed(1)}°  (${mid.toFixed(3)} rad)` : 'IMPOSSIBLE'),
  );
}
console.log('\nJSON ' + JSON.stringify(CHOSEN, null, 1));
process.exit(0);
