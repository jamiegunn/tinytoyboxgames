// SCRATCH PROBE. Two complaints, measured.
//   1. "the ceiling in the playroom is much too in your face — kitchen is ideal
//      because there is no ceiling"  -> how much of each frame IS ceiling?
//   2. "each of the rooms is long in length, so much detail is lost"
//      -> how much of each room's depth actually has anything in it?
import { Box3, PerspectiveCamera, Raycaster, Scene, Vector2, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'room-depth-and-ceiling',
  `
  export { getSceneCameraPreset } from './src/scenes/sceneCatalog';
  export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from './src/utils/cameraPresets';
  export { MIN_STAGE_ASPECT, MAX_STAGE_ASPECT } from './src/utils/scene/stageRect';
  export { buildPlayroomContents } from './src/scenes/world/places/house/subplaces/playroom/room';
  export { buildRoomContents as buildKitchenContents } from './src/scenes/world/places/house/subplaces/kitchen/room';
  export { buildRoomContents as buildLivingRoomContents } from './src/scenes/world/places/house/subplaces/living-room/room';
  export * as PLAYROOM from './src/scenes/world/places/house/subplaces/playroom/layout';
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

function build(fn) {
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
  return { scene, tappables, ground: contents.floorTargets?.[0], contents };
}

const ROOMS = [
  ['playroom', M.buildPlayroomContents, M.PLAYROOM],
  ['kitchen', M.buildKitchenContents, M.KITCHEN],
  ['living-room', M.buildLivingRoomContents, M.LIVING],
];

for (const [sceneId, fn, L] of ROOMS) {
  const { scene, tappables, ground, contents } = build(fn);
  const frontZ = L.BACK_WALL_CENTER_Z - L.ROOM_DEPTH;
  const backZ = L.BACK_WALL_CENTER_Z;

  // --- depth utilisation: 1-unit slices of the floor, is anything standing in it?
  const shell = new Set(['ceiling', 'floor', 'wall', 'wainscot', 'wallpaper', 'ground']);
  const occupied = new Array(Math.ceil(L.ROOM_DEPTH)).fill(0);
  let propCount = 0;
  const zs = [];
  scene.traverse((o) => {
    if (!o.isMesh || o === ground) return;
    const lower = (o.name || '').toLowerCase();
    if ([...shell].some((w) => lower.includes(w))) return;
    const b = new Box3().setFromObject(o);
    if (b.isEmpty()) return;
    propCount++;
    zs.push([b.min.z, b.max.z]);
    for (let i = 0; i < occupied.length; i++) {
      const lo = frontZ + i;
      if (b.max.z >= lo && b.min.z <= lo + 1) occupied[i]++;
    }
  });
  const usedSlices = occupied.filter((n) => n > 0).length;
  const minZ = Math.min(...zs.map((z) => z[0]));
  const maxZ = Math.max(...zs.map((z) => z[1]));

  // --- how much of the opening frame is ceiling?
  const pose = M.resolveSceneCameraPose(sceneId, M.MIN_STAGE_ASPECT);
  const results = {};
  for (const [label, aspect] of [
    ['square 1.00', M.MIN_STAGE_ASPECT],
    ['wide 1.40', M.MAX_STAGE_ASPECT],
  ]) {
    const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, aspect, 0.1, 300);
    const p = M.resolveSceneCameraPose(sceneId, aspect);
    cam.position.copy(p.position);
    cam.lookAt(p.target);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    const caster = new Raycaster();
    const tally = {};
    const N = 40;
    for (let iy = 0; iy < N; iy++) {
      for (let ix = 0; ix < N; ix++) {
        caster.setFromCamera(new Vector2((ix / (N - 1)) * 2 - 1, (iy / (N - 1)) * 2 - 1), cam);
        const hit = caster.intersectObjects(scene.children, true)[0];
        let key = 'NOTHING';
        if (hit) {
          const n = (hit.object.name || '').toLowerCase();
          key = n.includes('ceiling')
            ? 'ceiling'
            : n.includes('floor')
              ? 'floor'
              : n.includes('wall') || n.includes('wainscot') || n.includes('wallpaper')
                ? 'wall'
                : 'props';
        }
        tally[key] = (tally[key] ?? 0) + 1;
      }
    }
    results[label] = Object.fromEntries(Object.entries(tally).map(([k, v]) => [k, `${((v / (N * N)) * 100).toFixed(1)}%`]));
  }

  console.log(`\n=== ${sceneId}`);
  console.log(
    `  room  ${(L.LEFT_WALL_X * 2).toFixed(1)} wide x ${L.ROOM_DEPTH} deep x ${L.CEILING_Y} tall   (depth is ${(L.ROOM_DEPTH / (L.LEFT_WALL_X * 2)).toFixed(1)}x the width)`,
  );
  console.log(
    `  camera y ${pose.position.y.toFixed(2)} z ${pose.position.z.toFixed(2)}, looking at y ${pose.target.y.toFixed(2)} z ${pose.target.z.toFixed(2)}`,
  );
  console.log(`  ${propCount} prop meshes, spanning z ${minZ.toFixed(1)}..${maxZ.toFixed(1)} of the room's ${frontZ}..${backZ}`);
  console.log(`  depth used: ${usedSlices}/${occupied.length} one-unit slices have anything in them`);
  console.log(
    `  empty slices, front to back: ${
      occupied
        .map((n, i) => (n === 0 ? `${(frontZ + i).toFixed(0)}` : null))
        .filter(Boolean)
        .join(' ') || 'none'
    }`,
  );
  for (const [label, tally] of Object.entries(results)) console.log(`  frame at ${label}: ${JSON.stringify(tally)}`);
  contents?.cleanup?.();
}
