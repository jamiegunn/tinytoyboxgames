// SCRATCH PROBE. Two mechanical fixes for "so much detail is lost" were tried
// and both were refuted by measurement:
//
//   longer lens   FOV 50 -> 32 moved the playroom's backmost prop from 17.9% of
//                 frame height to 15.6%. Worse, and it cost ±31.9° of turn to
//                 ±13.4°. (.probe/lens-and-ceiling.mjs)
//   shorter room  depth x0.65 moved prop share of the frame 30.1% -> 29.7%.
//                 Bare floor fell 46.4% -> 36.9%, but the space went to WALL and
//                 CEILING, not to things. (.probe/room-shorten-sim.mjs)
//
// So the difference between the kitchen and the other two is not the lens and
// not the proportions. This measures the remaining candidate: where the props
// actually ARE, vertically. A camera looks at the middle of a room; a room whose
// contents are all below knee height has nothing in the middle of its frame.
import { Box3, PerspectiveCamera, Scene, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'room-vertical-mass',
  `
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
const SHELL = ['ceiling', 'floor', 'wall', 'wainscot', 'wallpaper', 'ground'];

for (const [id, fn, L] of [
  ['playroom', M.buildPlayroomContents, M.PLAYROOM],
  ['kitchen', M.buildKitchenContents, M.KITCHEN],
  ['living-room', M.buildLivingRoomContents, M.LIVING],
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
  const ground = contents.floorTargets?.[0];

  // Occupied volume per half-metre band of height, and the tallest thing standing.
  const bands = new Array(Math.ceil(L.CEILING_Y * 2)).fill(0);
  let tallest = { h: 0, name: '-' };
  let count = 0;
  scene.traverse((o) => {
    if (!o.isMesh || o === ground) return;
    const lower = (o.name || '').toLowerCase();
    if (SHELL.some((w) => lower.includes(w))) return;
    const b = new Box3().setFromObject(o);
    if (b.isEmpty()) return;
    count += 1;
    if (b.max.y > tallest.h) tallest = { h: b.max.y, name: o.name || '?' };
    const footprint = (b.max.x - b.min.x) * (b.max.z - b.min.z);
    for (let i = 0; i < bands.length; i++) {
      const lo = i * 0.5;
      const overlap = Math.max(0, Math.min(b.max.y, lo + 0.5) - Math.max(b.min.y, lo));
      bands[i] += footprint * overlap;
    }
  });
  const total = bands.reduce((a, b) => a + b, 0);
  console.log(`\n${id}  (${count} prop meshes, ceiling ${L.CEILING_Y}, tallest prop ${tallest.h.toFixed(2)} — ${tallest.name})`);
  const bar = (v) => '#'.repeat(Math.round((v / total) * 60));
  for (let i = bands.length - 1; i >= 0; i--) {
    if (bands[i] / total < 0.002 && i > 0 && bands.slice(0, i).every((v) => v / total < 0.002)) continue;
    console.log(`  ${(i * 0.5).toFixed(1)}-${(i * 0.5 + 0.5).toFixed(1)}m  ${((bands[i] / total) * 100).toFixed(1).padStart(5)}%  ${bar(bands[i])}`);
  }
  const above1 = bands.slice(2).reduce((a, b) => a + b, 0) / total;
  const above2 = bands.slice(4).reduce((a, b) => a + b, 0) / total;
  console.log(`  -> ${(above1 * 100).toFixed(1)}% of prop volume is above 1.0m, ${(above2 * 100).toFixed(1)}% above 2.0m`);
  contents?.cleanup?.();
}
