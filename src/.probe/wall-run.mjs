// SCRATCH PROBE. Where every prop actually sits along z, so the shortened rooms
// can be re-spaced from measurements rather than from the comments that describe
// the old ones.
import { Box3, PerspectiveCamera, Scene, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';
const M = await bundleEntry(
  'wall-run',
  `
  export { buildRoomContents as buildKitchenContents } from './src/scenes/world/places/house/subplaces/kitchen/room';
  export { buildRoomContents as buildLivingRoomContents } from './src/scenes/world/places/house/subplaces/living-room/room';
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
const SHELL = ['ceiling', 'floor', 'wall', 'wainscot', 'wallpaper', 'ground', 'baseboard'];
const WANT = process.argv[2];
for (const [id, fn, L] of [
  ['kitchen', M.buildKitchenContents, M.KITCHEN],
  ['living-room', M.buildLivingRoomContents, M.LIVING],
]) {
  if (WANT && id !== WANT) continue;
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
  console.log(`\n=== ${id}  room z ${(L.BACK_WALL_CENTER_Z - L.ROOM_DEPTH).toFixed(2)} .. ${L.BACK_WALL_FACE_Z.toFixed(2)}`);
  const rows = scene.children
    .filter((o) => o.name && !SHELL.some((w) => o.name.toLowerCase().includes(w)))
    .map((o) => ({ name: o.name, b: new Box3().setFromObject(o) }))
    .filter((r) => !r.b.isEmpty())
    .sort((a, b) => a.b.min.z - b.b.min.z);
  for (const r of rows) {
    const side = r.b.min.x > 2 ? 'LEFT wall' : r.b.max.x < -2 ? 'RIGHT wall' : r.b.min.z > 6 ? 'BACK wall' : 'middle';
    console.log(
      `  ${r.name.padEnd(34)} z ${r.b.min.z.toFixed(2).padStart(7)}..${r.b.max.z.toFixed(2).padStart(6)}  x ${r.b.min.x.toFixed(2).padStart(6)}..${r.b.max.x.toFixed(2).padStart(6)}  y ${r.b.max.y.toFixed(2).padStart(5)}   ${side}`,
    );
  }
  contents?.cleanup?.();
}
