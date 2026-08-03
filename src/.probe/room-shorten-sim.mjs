// SCRATCH PROBE. "I almost think each of the rooms is long in length... so much
// detail is lost that would be cool to see."
//
// The rooms are twice as deep as they are wide (24x12, 20x10.8) and the depth is
// NOT empty — 22 of 24 one-unit slices of the playroom floor have something
// standing in them. The problem is that depth runs away from the camera, so the
// far half is small and the near floor between props is bare.
//
// This SIMULATES shortening without editing a single layout file: build each
// room for real, then move every prop root toward the back wall by a factor k
// and shrink the shell to match. Shapes are translated, never scaled, so nothing
// is distorted — this is the same set in a shorter room. Then re-solve the pose
// under the real constraints and rasterise the frame.
//
// If the numbers do not move, the source change is not worth making.
import { Box3, PerspectiveCamera, Raycaster, Scene, Spherical, Vector2, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'room-shorten-sim',
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
const KS = [1.0, 0.8, 0.65, 0.5];
const STAGE = [M.MIN_STAGE_ASPECT, 1.33, M.MAX_STAGE_ASPECT];
const TIGHTEST = M.MIN_STAGE_ASPECT;
const CEILING_CLAMP = 6.0;
const MIN_ROT = 0.2;

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
const SHELL_WORDS = ['ceiling', 'floor', 'wall', 'wainscot', 'wallpaper', 'ground'];
const isShell = (name) => SHELL_WORDS.some((w) => (name || '').toLowerCase().includes(w));

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
  return { scene, tappables, ground: contents.floorTargets?.[0], cleanup: () => contents?.cleanup?.() };
}

/** Moves every prop root toward the back wall by k, and shrinks the shell to match. */
function shorten(scene, backZ, k) {
  for (const child of scene.children) {
    if (isShell(child.name)) {
      // The shell is boxes: scale the depth about the back wall.
      child.scale.z *= k;
      child.position.z = backZ - (backZ - child.position.z) * k;
    } else {
      child.position.z = backZ - (backZ - child.position.z) * k;
    }
  }
  scene.updateMatrixWorld(true);
}

const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, 1, 0.1, 400);
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
    area += Math.max(0, Math.min(1, maxX) - Math.max(-1, minX)) * Math.max(0, Math.min(1, maxY) - Math.max(-1, minY));
  }
  return area;
}

function rasterise(scene, position, pivot, aspect, n = 28) {
  aim(position, pivot, aspect);
  const caster = new Raycaster();
  const t = { props: 0, wall: 0, floor: 0, ceiling: 0, nothing: 0 };
  for (let iy = 0; iy < n; iy++)
    for (let ix = 0; ix < n; ix++) {
      caster.setFromCamera(new Vector2((ix / (n - 1)) * 2 - 1, (iy / (n - 1)) * 2 - 1), cam);
      const hit = caster.intersectObjects(scene.children, true)[0];
      if (!hit) {
        t.nothing++;
        continue;
      }
      const nm = (hit.object.name || '').toLowerCase();
      if (nm.includes('ceiling')) t.ceiling++;
      else if (nm.includes('floor') || nm.includes('ground')) t.floor++;
      else if (nm.includes('wall') || nm.includes('wainscot') || nm.includes('wallpaper')) t.wall++;
      else t.props++;
    }
  const tot = n * n;
  return Object.fromEntries(Object.entries(t).map(([a, b]) => [a, b / tot]));
}

const ROOMS = [
  ['playroom', M.buildPlayroomContents, M.PLAYROOM],
  ['kitchen', M.buildKitchenContents, M.KITCHEN],
  ['living-room', M.buildLivingRoomContents, M.LIVING],
].filter(([id]) => !ONLY || id === ONLY);

for (const [sceneId, fn, L] of ROOMS) {
  const preset = M.getSceneCameraPreset(sceneId);
  console.log(`\n=== ${sceneId}  (${(L.LEFT_WALL_X * 2).toFixed(1)} wide x ${L.ROOM_DEPTH} deep)`);
  console.log('  depth   new depth   best pose (d, polar, target)          props   floor   wall   ceiling   turn');
  for (const k of KS) {
    const { scene, tappables, ground, cleanup } = buildRoom(fn);
    if (k !== 1) shorten(scene, L.BACK_WALL_CENTER_Z, k);
    const shell = { wallX: L.LEFT_WALL_X, frontZ: L.BACK_WALL_CENTER_Z - L.ROOM_DEPTH * k, backZ: L.BACK_WALL_CENTER_Z, ceilingY: L.CEILING_Y, floorY: 0 };
    // A sample of every non-shell mesh, for the density proxy.
    const density = [];
    scene.traverse((o) => {
      if (!o.isMesh || o === ground || isShell(o.name)) return;
      const b = new Box3().setFromObject(o);
      if (!b.isEmpty()) density.push(b);
    });
    const step = Math.max(1, Math.floor(density.length / 120));
    const sampled = density.filter((_, i) => i % step === 0);

    const tapPts = [];
    const seen = new Set();
    for (const t of tappables) {
      if (t === ground || seen.has(t)) continue;
      seen.add(t);
      const b = new Box3().setFromObject(t);
      if (b.isEmpty()) continue;
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) tapPts.push(new Vector3(x, y, z));
    }
    const feasible = [];
    for (let d = 6; d <= 22.1; d += 0.5) {
      for (let polar = 0.98; polar <= 1.361; polar += 0.03) {
        for (let ty = 0; ty <= 2.51; ty += 0.25) {
          for (let tz = shell.frontZ; tz <= shell.backZ - 1; tz += 1) {
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
            if (worstNdc(tapPts) > 0.95) continue;
            // Same objective as the real solve — DENSEST, by the cheap proxy —
            // or this compares a shortened room's best pose against the shipped
            // room's worst one and reports the difference as a gain.
            feasible.push({ d, polar, ty, tz, rest, pivot, proxy: proxyDensity(sampled) });
          }
        }
      }
    }
    if (!feasible.length) {
      console.log(`  x${k.toFixed(2)}   ${(L.ROOM_DEPTH * k).toFixed(1).padStart(6)}      no pose satisfies every constraint`);
      cleanup();
      continue;
    }
    feasible.sort((a, b) => b.proxy - a.proxy);
    let best = null;
    let c = null;
    for (const cand of feasible.slice(0, 20)) {
      const comp = rasterise(scene, cand.rest, cand.pivot, TIGHTEST);
      const key = (comp.ceiling <= 0.001 ? 1 : 0) * 10 + comp.props;
      if (!best || key > best.key) {
        best = { ...cand, key };
        c = comp;
      }
    }
    console.log(
      `  x${k.toFixed(2)}   ${(L.ROOM_DEPTH * k).toFixed(1).padStart(6)}      d ${best.d.toFixed(1)} polar ${best.polar.toFixed(2)} target [0, ${best.ty.toFixed(2)}, ${best.tz}]   ` +
        `${(c.props * 100).toFixed(1)}%   ${(c.floor * 100).toFixed(1)}%   ${(c.wall * 100).toFixed(1)}%   ${(c.ceiling * 100).toFixed(1)}%`,
    );
    cleanup();
  }
}
