// SCRATCH PROBE. The vertical-mass histogram put 53.7% of the kitchen's prop
// volume in a single half-metre band AT THE CEILING, in a mesh with no name.
// A mesh that large classified as "props" would flatter every composition number
// this room has. What is it?
import { Box3, PerspectiveCamera, Scene, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';
const M = await bundleEntry(
  'kitchen-unnamed',
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
  const rows = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const b = new Box3().setFromObject(o);
    if (b.isEmpty()) return;
    const size = b.getSize(new Vector3());
    rows.push({ name: o.name || '(UNNAMED)', parent: o.parent?.name || '(unnamed parent)', vol: size.x * size.y * size.z, size, min: b.min, max: b.max });
  });
  rows.sort((a, b) => b.vol - a.vol);
  console.log(`\n=== ${id}: largest meshes by bounding volume`);
  for (const r of rows.slice(0, 8)) {
    console.log(
      `  ${r.vol.toFixed(0).padStart(6)}  ${r.name.padEnd(34)} parent ${r.parent.padEnd(24)} ${r.size.x.toFixed(1)}x${r.size.y.toFixed(1)}x${r.size.z.toFixed(1)}  y ${r.min.y.toFixed(2)}..${r.max.y.toFixed(2)}`,
    );
  }
  const unnamed = rows.filter((r) => r.name === '(UNNAMED)');
  console.log(`  ${unnamed.length} unnamed meshes; largest ${unnamed[0] ? `${unnamed[0].vol.toFixed(0)} (parent ${unnamed[0].parent})` : '-'}`);
  contents?.cleanup?.();
}
