// SCRATCH PROBE. Which prop roots actually moved under the 25% depth rescale,
// and which did not.
//
// The rescale was applied to layout.ts, which is where world positions are
// SUPPOSED to live. Anything whose z is a literal inside a decor file stayed
// where it was while the room shrank around it — and the only reason that is
// visible at all is that two floor toys ended up inside a toybox.
//
// Run against the shortened tree; `--baseline <dir>` prints the pre-change
// positions from a scratch copy so the two can be compared.
import { Box3, PerspectiveCamera, Scene, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';
const M = await bundleEntry(
  'scale-audit',
  `
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
const out = {};
for (const [id, fn] of [
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
  out[id] = {};
  for (const o of scene.children) {
    if (!o.name) continue;
    const b = new Box3().setFromObject(o);
    if (b.isEmpty()) continue;
    out[id][o.name] = Number(b.getCenter(new Vector3()).z.toFixed(3));
  }
  contents?.cleanup?.();
}
console.log(JSON.stringify(out));
