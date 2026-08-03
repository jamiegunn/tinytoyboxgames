// SCRATCH PROBE. Which meshes ship without a name, and where they come from.
import { Box3, PerspectiveCamera, Scene, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';
const M = await bundleEntry(
  'unnamed-meshes',
  `
  export { buildRoomContents as buildKitchenContents } from './src/scenes/world/places/house/subplaces/kitchen/room';
  export { buildPlayroomContents } from './src/scenes/world/places/house/subplaces/playroom/room';
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
for (const [id, fn] of [
  ['kitchen', M.buildKitchenContents],
  ['playroom', M.buildPlayroomContents],
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
  const groups = new Map();
  scene.traverse((o) => {
    if (!o.isMesh || o.name) return;
    const b = new Box3().setFromObject(o);
    const s = b.getSize(new Vector3());
    const key = `${o.parent?.name || '(root)'}  ${s.x.toFixed(1)}x${s.y.toFixed(1)}x${s.z.toFixed(1)}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  });
  console.log(`\n${id}: ${[...groups.values()].reduce((a, b) => a + b, 0)} unnamed meshes`);
  for (const [k, n] of [...groups.entries()].sort((a, b) => b[1] - a[1])) console.log(`  x${n}  ${k}`);
  contents?.cleanup?.();
}
