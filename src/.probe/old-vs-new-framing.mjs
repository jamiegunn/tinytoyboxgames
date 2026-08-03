// SCRATCH PROBE. How many props each room framed off the edge before and after.
//
// The receipt behind the "WHAT IT FIXED HERE" comments on each room's
// cameraPreset in sceneCatalog.ts. Run it after changing a room's pose or moving
// a tappable prop; `tests/room/room-opening-framing.test.mjs` will tell you THAT
// something is cropped, and this tells you which.
//
// Eight sibling probes from the same session were deleted rather than kept: they
// swept the pose space against a model that ignored the +/-0.1 rad tilt the
// player can reach, so their numbers were optimistic and reading them later
// would mislead. `.probe/room-pose-final.mjs` is the one that shares the guard's
// model, and it is the one the docs cite.
import { Box3, PerspectiveCamera, Scene, Spherical, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';
const M = await bundleEntry(
  'old-vs-new-framing',
  `
  export { SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
  export { getSceneCameraPreset } from './src/scenes/sceneCatalog';
  export { MIN_STAGE_ASPECT, MAX_STAGE_ASPECT } from './src/utils/scene/stageRect';
  export { buildPlayroomContents } from './src/scenes/world/places/house/subplaces/playroom/room';
  export { buildRoomContents as buildKitchenContents } from './src/scenes/world/places/house/subplaces/kitchen/room';
  export { buildRoomContents as buildLivingRoomContents } from './src/scenes/world/places/house/subplaces/living-room/room';
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
const OLD = { azimuth: Math.PI, polar: 1.19, distance: 14, target: [0, 0.5, 0] };
const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, 1, 0.1, 300);
for (const [id, build] of [
  ['playroom', M.buildPlayroomContents],
  ['kitchen', M.buildKitchenContents],
  ['living-room', M.buildLivingRoomContents],
]) {
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
  const contents = build({
    scene,
    canvas: stubCanvas(),
    camera: new PerspectiveCamera(),
    dispatcher,
    nav: { navigateTo: noop, launchMiniGame: noop, exitMiniGame: noop },
    owl: { flyTo: noop, setSurfaceYAt: noop, land: noop, group: { position: new Vector3() } },
  });
  scene.updateMatrixWorld(true);
  const ground = contents.floorTargets?.[0];
  const props = [];
  const seen = new Set();
  for (const t of tappables) {
    if (t === ground || seen.has(t)) continue;
    seen.add(t);
    const b = new Box3().setFromObject(t);
    if (b.isEmpty()) continue;
    const pts = [];
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(new Vector3(x, y, z));
    props.push({ name: t.name || '(unnamed)', pts });
  }
  const count = (preset, aspect) => {
    const pivot = new Vector3(...preset.target);
    const position = pivot.clone().add(new Vector3().setFromSpherical(new Spherical(preset.distance, preset.polar, preset.azimuth)));
    cam.aspect = aspect;
    cam.position.copy(position);
    cam.lookAt(pivot);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    const v = new Vector3();
    return props
      .filter((p) =>
        p.pts.some((q) => {
          v.copy(q).project(cam);
          return v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1;
        }),
      )
      .map((p) => p.name);
  };
  for (const aspect of [M.MIN_STAGE_ASPECT, M.MAX_STAGE_ASPECT]) {
    const before = count(OLD, aspect);
    const after = count(M.getSceneCameraPreset(id), aspect);
    console.log(
      `${id} @ ${aspect}: ${props.length} props | BEFORE cropped ${before.length} (${before.join(', ') || '-'}) | AFTER cropped ${after.length} (${after.join(', ') || '-'})`,
    );
  }
}
