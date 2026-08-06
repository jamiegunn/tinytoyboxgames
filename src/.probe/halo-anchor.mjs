// SCRATCH PROBE. The Kitchen's halo renders visibly higher above its toybox than
// the Living Room's two do, and high enough to read as belonging to the counter
// behind it rather than to the chest below it -- the "unattached blob" failure
// `tapInvitation.ts` warns about in DIAMETER_RATIO.
//
// The halo is placed from `Box3.setFromObject(target).max.y`, so if the bbox top
// is not the lid the child sees, the gap is measured from the wrong thing. This
// reports, per destination toybox in all three rooms, where the bbox top is and
// which descendant put it there.
import { Box3, PerspectiveCamera, Scene, Vector3 } from 'three';
import gsap from 'gsap';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'haloAnchor',
  [
    `export { buildPlayroomContents } from '@scenes/world/places/house/subplaces/playroom/room';`,
    `export { buildRoomContents as buildKitchen } from '@scenes/world/places/house/subplaces/kitchen/room';`,
    `export { buildRoomContents as buildLiving } from '@scenes/world/places/house/subplaces/living-room/room';`,
    `export { setSceneIdleAnimator } from '@app/utils/idle/registry';`,
    `export { createDisposalScope } from '@app/utils/disposal';`,
  ].join('\n'),
);

const noop = () => {};
const stubCanvas = () => ({ width: 1280, height: 720, clientWidth: 1280, clientHeight: 720, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }), addEventListener: noop, removeEventListener: noop, style: {} });

for (const [id, build] of [
  ['playroom', M.buildPlayroomContents],
  ['living-room', M.buildLiving],
  ['kitchen', M.buildKitchen],
]) {
  const scene = new Scene();
  M.setSceneIdleAnimator(scene, M.createDisposalScope());
  build({
    scene,
    canvas: stubCanvas(),
    camera: new PerspectiveCamera(),
    dispatcher: { register: () => noop, registerWithPoint: () => noop, setMissHandler: noop, dispose: noop },
    nav: { navigateTo: noop, launchMiniGame: noop, exitMiniGame: noop },
    owl: { flyTo: noop, setSurfaceYAt: noop, land: noop, group: { position: new Vector3() } },
  });
  scene.updateMatrixWorld(true);

  console.log(`\n=== ${id}`);
  for (const root of scene.children) {
    if (!root.name.startsWith('toybox_')) continue;
    const box = new Box3().setFromObject(root);
    const size = box.getSize(new Vector3());
    // Which descendant reaches highest, and what its own share of the height is.
    let tallest = null;
    let tallestY = -Infinity;
    root.traverse((o) => {
      if (!o.isMesh) return;
      const b = new Box3().setFromObject(o);
      if (b.max.y > tallestY) {
        tallestY = b.max.y;
        tallest = o;
      }
    });
    // The bulk: the highest y at or below which 90% of the mesh volume sits, by
    // counting meshes rather than volume -- enough to tell a lid from a spike.
    const tops = [];
    root.traverse((o) => {
      if (o.isMesh) tops.push(new Box3().setFromObject(o).max.y);
    });
    tops.sort((a, b) => a - b);
    const p90 = tops[Math.floor(tops.length * 0.9)];
    const median = tops[Math.floor(tops.length / 2)];
    console.log(
      `  ${root.name.padEnd(36)} bbox y [${box.min.y.toFixed(2)}, ${box.max.y.toFixed(2)}]  footprint ${size.x.toFixed(2)} x ${size.z.toFixed(2)}` +
        `   meshes ${tops.length}, median top ${median.toFixed(2)}, p90 top ${p90.toFixed(2)}`,
    );
    console.log(`      highest mesh: ${tallest?.name || '(unnamed)'} at y ${tallestY.toFixed(2)}   ${tallestY - p90 > 0.15 ? '<<< A SPIKE: the bbox top is not the lid' : 'top is the bulk'}`);
  }
}
gsap.ticker.sleep();
process.exit(0);
