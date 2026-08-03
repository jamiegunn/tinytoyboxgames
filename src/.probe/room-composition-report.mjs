// SCRATCH PROBE. The composition of each room's opening frame at every stage
// aspect — the numbers `EXPECTED_COMPOSITION` in
// tests/room/room-opening-framing.test.mjs is pinned from.
import { PerspectiveCamera, Raycaster, Scene, Vector2, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';
const M = await bundleEntry(
  'room-composition-report',
  `
  export { getSceneCameraPreset } from './src/scenes/sceneCatalog';
  export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from './src/utils/cameraPresets';
  export { stageAspectFor } from './src/utils/scene/stageRect';
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
const VIEWPORTS = [
  [1280, 720],
  [1024, 768],
  [800, 800],
  [768, 1024],
  [480, 854],
  [375, 667],
  [393, 852],
  [412, 915],
  [400, 1000],
];
const ASPECTS = [...new Set(VIEWPORTS.map(([w, h]) => M.stageAspectFor(w, h)))].sort((a, b) => a - b);
for (const [id, fn] of [
  ['playroom', M.buildPlayroomContents],
  ['kitchen', M.buildKitchenContents],
  ['living-room', M.buildLivingRoomContents],
]) {
  const scene = new Scene();
  const contents = fn({
    scene,
    canvas: stubCanvas(),
    camera: new PerspectiveCamera(),
    dispatcher: { register: () => noop, registerWithPoint: () => noop, setMissHandler: noop, dispose: noop },
    nav: { navigateTo: noop, launchMiniGame: noop, exitMiniGame: noop },
    owl: { flyTo: noop, setSurfaceYAt: noop, land: noop, group: { position: new Vector3() } },
  });
  scene.updateMatrixWorld(true);
  console.log(`\n${id}`);
  let minProps = 1;
  let maxCeil = 0;
  for (const aspect of ASPECTS) {
    const pose = M.resolveSceneCameraPose(id, aspect);
    const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, aspect, 0.1, 400);
    cam.position.copy(pose.position);
    cam.lookAt(pose.target);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    const caster = new Raycaster();
    const t = { props: 0, wall: 0, floor: 0, ceiling: 0, nothing: 0 };
    const n = 32;
    for (let iy = 0; iy < n; iy++)
      for (let ix = 0; ix < n; ix++) {
        caster.setFromCamera(new Vector2((ix / (n - 1)) * 2 - 1, (iy / (n - 1)) * 2 - 1), cam);
        const hit = caster.intersectObjects(scene.children, true)[0];
        if (!hit) {
          t.nothing++;
          continue;
        }
        let node = hit.object;
        while (node && !node.name) node = node.parent;
        const nm = (node?.name || '').toLowerCase();
        if (nm.includes('ceiling')) t.ceiling++;
        else if (nm.includes('floor') || nm.includes('ground')) t.floor++;
        else if (nm.includes('wall') || nm.includes('wainscot') || nm.includes('wallpaper')) t.wall++;
        else t.props++;
      }
    const tot = n * n;
    minProps = Math.min(minProps, t.props / tot);
    maxCeil = Math.max(maxCeil, t.ceiling / tot);
    console.log(
      `  aspect ${aspect.toFixed(2)}: props ${((t.props / tot) * 100).toFixed(1)}%  wall ${((t.wall / tot) * 100).toFixed(1)}%  floor ${((t.floor / tot) * 100).toFixed(1)}%  ceiling ${((t.ceiling / tot) * 100).toFixed(1)}%  void ${((t.nothing / tot) * 100).toFixed(1)}%`,
    );
  }
  console.log(`  -> minProps ${(minProps * 100).toFixed(1)}%   maxCeiling ${(maxCeil * 100).toFixed(1)}%`);
  contents?.cleanup?.();
}

process.exit(0);
