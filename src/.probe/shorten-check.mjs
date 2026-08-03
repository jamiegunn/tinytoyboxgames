// SCRATCH PROBE. After compressing depth by 25%, does anything now collide,
// stick out of the room, or float where it used to sit on something?
//
// Positions were scaled and sizes were not, so props that were 3 units apart are
// now 2.25 apart. That is the whole point — and it is also exactly how a rescale
// pushes a chair through a table.
import { Box3, PerspectiveCamera, Scene, Vector3 } from 'three';
import { bundleEntry } from '../tests/framework/_tsload.mjs';
const M = await bundleEntry(
  'shorten-check',
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
for (const [id, fn, L] of [
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
  const frontZ = L.BACK_WALL_CENTER_Z - L.ROOM_DEPTH;
  const backZ = L.BACK_WALL_FACE_Z;
  const roots = scene.children
    .filter((o) => o.name && !SHELL.some((w) => o.name.toLowerCase().includes(w)))
    .map((o) => ({ name: o.name, box: new Box3().setFromObject(o) }))
    .filter((r) => !r.box.isEmpty());
  console.log(`\n=== ${id}  room z ${frontZ.toFixed(1)}..${backZ.toFixed(2)}, x ±${L.LEFT_WALL_FACE_X.toFixed(2)}  (${roots.length} prop roots)`);
  const outside = roots.filter(
    (r) =>
      r.box.min.z < frontZ - 0.01 ||
      r.box.max.z > backZ + 0.01 ||
      Math.abs(r.box.min.x) > L.LEFT_WALL_FACE_X + 0.01 ||
      Math.abs(r.box.max.x) > L.LEFT_WALL_FACE_X + 0.01,
  );
  console.log(
    `  out of bounds: ${outside.length ? outside.map((r) => `${r.name} z ${r.box.min.z.toFixed(2)}..${r.box.max.z.toFixed(2)} x ${r.box.min.x.toFixed(2)}..${r.box.max.x.toFixed(2)}`).join('; ') : 'none'}`,
  );
  const hits = [];
  for (let i = 0; i < roots.length; i++) {
    for (let j = i + 1; j < roots.length; j++) {
      const a = roots[i].box,
        b = roots[j].box;
      const ox = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x);
      const oy = Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y);
      const oz = Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z);
      if (ox > 0.05 && oy > 0.05 && oz > 0.05) hits.push(`${roots[i].name} x ${roots[j].name} (overlap ${ox.toFixed(2)}x${oy.toFixed(2)}x${oz.toFixed(2)})`);
    }
  }
  console.log(`  intersecting pairs: ${hits.length ? hits.join('; ') : 'none'}`);
  contents?.cleanup?.();
}
