// SCRATCH PROBE. The Kitchen's opening frame is 60% bare floor on a phone. That
// is a number about the SCREEN; to fix it I need the same fact about the ROOM —
// which patch of floor those rays actually land on, so set dressing goes where
// the emptiness is rather than where it looks like it might be.
//
// Casts a ray through every cell of the frame, keeps the ones that hit the floor
// with nothing in front, and reports the world footprint they cover.
import { PerspectiveCamera, Raycaster, Scene, Vector2, Vector3 } from 'three';
import gsap from 'gsap';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry('kitchen-bare', `
  export { resolveSceneCameraPose, SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
  export { buildRoomContents as buildKitchenContents } from './src/scenes/world/places/house/subplaces/kitchen/room';
  export * as KITCHEN from './src/scenes/world/places/house/subplaces/kitchen/layout';
`);

const noop = () => {};
const stubCanvas = () => ({ width: 1280, height: 720, clientWidth: 1280, clientHeight: 720, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }), addEventListener: noop, removeEventListener: noop, style: {} });
const scene = new Scene();
const contents = M.buildKitchenContents({ scene, canvas: stubCanvas(), camera: new PerspectiveCamera(), dispatcher: { register: () => noop, registerWithPoint: () => noop, setMissHandler: noop, dispose: noop }, nav: { navigateTo: noop, launchMiniGame: noop, exitMiniGame: noop }, owl: { flyTo: noop, setSurfaceYAt: noop, land: noop, group: { position: new Vector3() } } });
scene.updateMatrixWorld(true);

const L = M.KITCHEN;
console.log(`room x [${-L.LEFT_WALL_X}, ${L.LEFT_WALL_X}]  z [${L.BACK_WALL_CENTER_Z - L.ROOM_DEPTH}, ${L.BACK_WALL_CENTER_Z}]`);

for (const [label, aspect] of [['phone portrait', 0.46], ['laptop', 1.6]]) {
  const pose = M.resolveSceneCameraPose('kitchen', aspect);
  const camera = new PerspectiveCamera(M.SCENE_CAMERA_FOV, aspect, 0.1, 400);
  camera.position.copy(pose.position);
  camera.lookAt(pose.target);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  const caster = new Raycaster();
  const n = 48;
  const bare = [];
  let props = 0, total = 0;
  // Bare-floor hits bucketed by where they land, 1x1 world cells.
  const cells = new Map();
  for (let iy = 0; iy < n; iy++) {
    for (let ix = 0; ix < n; ix++) {
      caster.setFromCamera(new Vector2((ix / (n - 1)) * 2 - 1, (iy / (n - 1)) * 2 - 1), camera);
      const hit = caster.intersectObjects(scene.children, true)[0];
      total++;
      if (!hit) continue;
      let node = hit.object;
      while (node && !node.name) node = node.parent;
      const name = (node?.name || '').toLowerCase();
      const isFloor = name.includes('floor') || name.includes('ground');
      if (!isFloor) { if (!name.includes('wall') && !name.includes('ceiling') && !name.includes('wainscot')) props++; continue; }
      bare.push({ x: hit.point.x, z: hit.point.z, frameY: iy / (n - 1) });
      const key = `${Math.floor(hit.point.x)},${Math.floor(hit.point.z)}`;
      cells.set(key, (cells.get(key) ?? 0) + 1);
    }
  }
  console.log(`\n=== ${label} (aspect ${aspect})   camera at (${pose.position.x.toFixed(1)}, ${pose.position.y.toFixed(1)}, ${pose.position.z.toFixed(1)})`);
  console.log(`  ${((bare.length / total) * 100).toFixed(1)}% of the frame is bare floor, ${((props / total) * 100).toFixed(1)}% props`);
  if (!bare.length) continue;
  const xs = bare.map((b) => b.x), zs = bare.map((b) => b.z);
  console.log(`  it lands on x [${Math.min(...xs).toFixed(1)}, ${Math.max(...xs).toFixed(1)}]  z [${Math.min(...zs).toFixed(1)}, ${Math.max(...zs).toFixed(1)}]`);
  // The bottom third of the frame is what reads as "empty foreground".
  const low = bare.filter((b) => b.frameY < 0.34);
  if (low.length) {
    const lz = low.map((b) => b.z), lx = low.map((b) => b.x);
    console.log(`  bottom third of frame: ${low.length} rays, landing on x [${Math.min(...lx).toFixed(1)}, ${Math.max(...lx).toFixed(1)}]  z [${Math.min(...lz).toFixed(1)}, ${Math.max(...lz).toFixed(1)}]`);
  }
  // Heaviest 1x1 cells: where dressing buys the most frame.
  const ranked = [...cells.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
  console.log('  emptiest floor cells (x,z -> rays):');
  console.log('   ' + ranked.map(([k, v]) => `(${k}) ${v}`).join('  '));
}
contents?.cleanup?.();
gsap.ticker.sleep();
process.exit(0);
