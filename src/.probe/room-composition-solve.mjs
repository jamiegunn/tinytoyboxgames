// SCRATCH PROBE, definitive re-frame. What actually makes a room read well.
//
// THE LONGER LENS IS REFUTED. `.probe/lens-and-ceiling.mjs` swept FOV 50 -> 26
// and the backmost prop in the playroom went from 17.9% of frame height to
// 15.6% — it got SLIGHTLY WORSE, because holding "every tappable in frame"
// pushes the camera back in step with the narrower lens and gives back exactly
// what the lens gained. It also costs rotation (±31.9° -> ±13.4°). One constant,
// no benefit; the idea is dead and this is the receipt.
//
// WHAT THE DIFFERENCE ACTUALLY IS. Rasterising the opening frame of each room:
//
//     kitchen       74.1% props   25.9% wall    0% floor    0% ceiling
//     playroom      34.5% props   25.0% wall   25.9% floor  14.6% ceiling
//     living-room   18.2% props   30.0% wall   46.8% floor   5.0% ceiling
//
// The kitchen is the one that reads well and it is the one with no ceiling and
// no bare floor. Note that its BACKMOST tappable is 3.4% of frame height — the
// smallest of the three — so "detail lost at the back" is not the variable.
// Density is. So: solve for prop share of the frame, with no ceiling allowed.
//
// Two stages, because rasterising is far too slow to run over the whole grid:
// the cheap constraints reduce ~40k poses to a feasible set, and the best few
// hundred by a bounding-box proxy are then rasterised for real.
import { Box3, PerspectiveCamera, Raycaster, Scene, Spherical, Vector2, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'room-composition-solve',
  `
  export { frameSeesPastWalls, orbitPositionsAt } from './src/utils/scene/rotationRange';
  export { getSceneCameraPreset } from './src/scenes/sceneCatalog';
  export { SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
  export { MIN_STAGE_ASPECT, MAX_STAGE_ASPECT } from './src/utils/scene/stageRect';
  export { buildPlayroomContents } from './src/scenes/world/places/house/subplaces/playroom/room';
  export { buildRoomContents as buildKitchenContents } from './src/scenes/world/places/house/subplaces/kitchen/room';
  export { buildRoomContents as buildLivingRoomContents } from './src/scenes/world/places/house/subplaces/living-room/room';
  export * as PLAYROOM from './src/scenes/world/places/house/subplaces/playroom/layout';
  export * as KITCHEN from './src/scenes/world/places/house/subplaces/kitchen/layout';
  export * as LIVING from './src/scenes/world/places/house/subplaces/living-room/layout';
`,
);

const ONLY = process.argv[2];
const STAGE = [M.MIN_STAGE_ASPECT, 1.33, M.MAX_STAGE_ASPECT];
const TIGHTEST = M.MIN_STAGE_ASPECT;
const CEILING_CLAMP = 6.0;
const MIN_ROT = 0.19;
const MARGIN = 0.97;
const FOV = M.SCENE_CAMERA_FOV;

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
  const corners = (b) => {
    const out = [];
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) out.push(new Vector3(x, y, z));
    return out;
  };
  const tap = [];
  const seen = new Set();
  for (const t of tappables) {
    if (t === ground || seen.has(t)) continue;
    seen.add(t);
    const b = new Box3().setFromObject(t);
    if (!b.isEmpty()) tap.push({ name: t.name || '?', corners: corners(b) });
  }
  // A sample of every non-shell mesh, for the cheap density proxy.
  const shellWords = ['ceiling', 'floor', 'wall', 'wainscot', 'wallpaper', 'ground'];
  const density = [];
  scene.traverse((o) => {
    if (!o.isMesh || o === ground) return;
    const lower = (o.name || '').toLowerCase();
    if (shellWords.some((w) => lower.includes(w))) return;
    const b = new Box3().setFromObject(o);
    if (!b.isEmpty()) density.push(b);
  });
  const step = Math.max(1, Math.floor(density.length / 120));
  return { scene, tap, density: density.filter((_, i) => i % step === 0), cleanup: () => contents?.cleanup?.() };
}

const cam = new PerspectiveCamera(FOV, 1, 0.1, 400);
const aim = (position, pivot, aspect) => {
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
const worstNdc = (pts) => {
  let w = 0;
  const v = new Vector3();
  for (const p of pts) {
    v.copy(p).project(cam);
    const d = v.z > 1 ? Infinity : Math.max(Math.abs(v.x), Math.abs(v.y));
    if (d > w) w = d;
  }
  return w;
};

/** Cheap density proxy: summed clipped NDC area of the sampled prop boxes. */
function proxyDensity(boxes) {
  let area = 0;
  const v = new Vector3();
  for (const b of boxes) {
    let minX = 1e9,
      maxX = -1e9,
      minY = 1e9,
      maxY = -1e9,
      behind = false;
    for (const x of [b.min.x, b.max.x])
      for (const y of [b.min.y, b.max.y])
        for (const z of [b.min.z, b.max.z]) {
          v.set(x, y, z).project(cam);
          if (v.z > 1) {
            behind = true;
            break;
          }
          minX = Math.min(minX, v.x);
          maxX = Math.max(maxX, v.x);
          minY = Math.min(minY, v.y);
          maxY = Math.max(maxY, v.y);
        }
    if (behind) continue;
    const w = Math.max(0, Math.min(1, maxX) - Math.max(-1, minX));
    const h = Math.max(0, Math.min(1, maxY) - Math.max(-1, minY));
    area += w * h;
  }
  return area;
}

/** The real thing: what each pixel of the opening frame lands on. */
function rasterise(scene, position, pivot, aspect, n = 32) {
  aim(position, pivot, aspect);
  const caster = new Raycaster();
  const tally = { props: 0, wall: 0, floor: 0, ceiling: 0, nothing: 0 };
  for (let iy = 0; iy < n; iy++) {
    for (let ix = 0; ix < n; ix++) {
      caster.setFromCamera(new Vector2((ix / (n - 1)) * 2 - 1, (iy / (n - 1)) * 2 - 1), cam);
      const hit = caster.intersectObjects(scene.children, true)[0];
      if (!hit) {
        tally.nothing++;
        continue;
      }
      const name = (hit.object.name || '').toLowerCase();
      if (name.includes('ceiling')) tally.ceiling++;
      else if (name.includes('floor') || name.includes('ground')) tally.floor++;
      else if (name.includes('wall') || name.includes('wainscot') || name.includes('wallpaper')) tally.wall++;
      else tally.props++;
    }
  }
  const total = n * n;
  return Object.fromEntries(Object.entries(tally).map(([k, v]) => [k, v / total]));
}

const ROOMS = [
  ['playroom', M.buildPlayroomContents, M.PLAYROOM],
  ['kitchen', M.buildKitchenContents, M.KITCHEN],
  ['living-room', M.buildLivingRoomContents, M.LIVING],
].filter(([id]) => !ONLY || id === ONLY);

for (const [sceneId, fn, L] of ROOMS) {
  const { scene, tap, density, cleanup } = buildRoom(fn);
  const preset = M.getSceneCameraPreset(sceneId);
  const shell = { wallX: L.LEFT_WALL_X, frontZ: L.BACK_WALL_CENTER_Z - L.ROOM_DEPTH, backZ: L.BACK_WALL_CENTER_Z, ceilingY: L.CEILING_Y, floorY: 0 };
  // THE EXITS MUST BE IN FRAME. Everything else is reported, not required.
  //
  // The old rule — every tappable fully in frame — was mine, not a requirement,
  // and in a room shortened by 25% it is unsatisfiable without showing ceiling:
  // the camera cannot back off past the front wall, so the frame has to be wide,
  // and a wide frame in a 6.2-high room is a frame with ceiling in it. A door or
  // a toybox off the edge is a child who cannot leave the room. A saucepan off
  // the edge is a saucepan they find by turning.
  const isExit = (name) => name.startsWith('toybox_') || name.includes('_doorway');
  const exits = tap.filter((p) => isExit(p.name)).flatMap((p) => p.corners);
  const allTap = tap.flatMap((p) => p.corners);

  const feasible = [];
  for (let d = 4; d <= 22.1; d += 0.5) {
    for (let polar = 0.98; polar <= 1.361; polar += 0.02) {
      for (let ty = 0; ty <= 2.51; ty += 0.25) {
        for (let tz = shell.frontZ + 1; tz <= shell.backZ - 1.01; tz += 1) {
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
                aim(position, pivot, aspect);
                if (M.frameSeesPastWalls(position, corners4(), shell)) return true;
              }
            }
            return false;
          };
          if (dirty(0) || dirty(MIN_ROT)) continue;
          const rest = pivot.clone().add(new Vector3().setFromSpherical(new Spherical(d, polar, preset.azimuth)));
          if (rest.y > CEILING_CLAMP) rest.y = CEILING_CLAMP;
          aim(rest, pivot, TIGHTEST);
          if (worstNdc(exits) > MARGIN) continue;
          feasible.push({ d, polar, ty, tz, rest, pivot, proxy: proxyDensity(density) });
        }
      }
    }
  }
  feasible.sort((a, b) => b.proxy - a.proxy);
  const shortlist = feasible.slice(0, 40);
  let best = null;
  for (const c of shortlist) {
    const comp = rasterise(scene, c.rest, c.pivot, TIGHTEST);
    aim(c.rest, c.pivot, TIGHTEST);
    c.cropped = tap.filter((t) => worstNdc(t.corners) > 1).map((t) => t.name);
    c.allNdc = worstNdc(allTap);
    // No ceiling at all, then the most props.
    const key = (comp.ceiling <= 0.001 ? 1 : 0) * 10 + comp.props;
    if (!best || key > best.key) best = { ...c, comp, key };
  }
  const current = rasterise(
    scene,
    ...(() => {
      const p = new Vector3(...preset.target);
      const r = p.clone().add(new Vector3().setFromSpherical(new Spherical(preset.distance, preset.polar, preset.azimuth)));
      if (r.y > CEILING_CLAMP) r.y = CEILING_CLAMP;
      return [r, p];
    })(),
    TIGHTEST,
  );
  const pct = (o) =>
    Object.entries(o)
      .filter(([, v]) => v > 0.001)
      .map(([k, v]) => `${k} ${(v * 100).toFixed(1)}%`)
      .join('  ');
  console.log(`\n=== ${sceneId}   ${feasible.length} feasible poses`);
  console.log(`  shipping now: d ${preset.distance} polar ${preset.polar} target [${preset.target}]`);
  console.log(`                ${pct(current)}`);
  if (!best) {
    console.log('  no candidate');
    cleanup();
    continue;
  }
  console.log(
    `  best:         d ${best.d} polar ${best.polar.toFixed(2)} target [0, ${best.ty.toFixed(2)}, ${best.tz}]   cam y ${best.rest.y.toFixed(2)} z ${best.rest.z.toFixed(2)}`,
  );
  console.log(`                ${pct(best.comp)}`);
  console.log(`                every tappable within ${best.allNdc.toFixed(2)} NDC; cropped: ${best.cropped.length ? best.cropped.join(', ') : 'none'}`);
  cleanup();
}
