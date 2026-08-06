// SCRATCH PROBE. At the narrowest shipping aspect (0.40) the Living Room cannot
// open toward a toybox in the direction the other aspects use: the smallest turn
// that shows a halo puts 46.6% of the frame on bare boards against a 46.0% bound,
// missing by about six rays out of 1024.
//
// The alternative was to let the schedule flip sign at that one aspect and open
// the room the other way, which the wider search does find -- but a table
// interpolated in aspect would then pass through zero somewhere around 0.416 and
// devices in that band would open facing nothing at all. The guard's own failure
// message says what to do instead: "this room needs something on its floor, not a
// different camera."
//
// So: which floor. This casts a ray through every cell of THAT frame, keeps the
// ones landing on bare boards, and reports where in the room they land.
import { PerspectiveCamera, Raycaster, Scene, Spherical, Vector2, Vector3 } from 'three';
import gsap from 'gsap';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'lrTurnedBare',
  [
    `export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from '@app/utils/cameraPresets';`,
    `export { getSceneCameraPreset } from '@app/scenes/sceneCatalog';`,
    `export { buildRoomContents as buildLiving } from '@scenes/world/places/house/subplaces/living-room/room';`,
    `export * as LIVING from '@scenes/world/places/house/subplaces/living-room/layout';`,
    `export { setSceneIdleAnimator } from '@app/utils/idle/registry';`,
    `export { createDisposalScope } from '@app/utils/disposal';`,
  ].join('\n'),
);

const noop = () => {};
const stubCanvas = () => ({ width: 1280, height: 720, clientWidth: 1280, clientHeight: 720, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }), addEventListener: noop, removeEventListener: noop, style: {} });
const scene = new Scene();
M.setSceneIdleAnimator(scene, M.createDisposalScope());
M.buildLiving({
  scene,
  canvas: stubCanvas(),
  camera: new PerspectiveCamera(),
  dispatcher: { register: () => noop, registerWithPoint: () => noop, setMissHandler: noop, dispose: noop },
  nav: { navigateTo: noop, launchMiniGame: noop, exitMiniGame: noop },
  owl: { flyTo: noop, setSurfaceYAt: noop, land: noop, group: { position: new Vector3() } },
});
scene.updateMatrixWorld(true);

const L = M.LIVING;
console.log(`room x [${-L.LEFT_WALL_X}, ${L.LEFT_WALL_X}]  z [${L.BACK_WALL_CENTER_Z - L.ROOM_DEPTH}, ${L.BACK_WALL_CENTER_Z}]`);

const preset = M.getSceneCameraPreset('living-room');
const target = new Vector3(...preset.target);
const radius = M.resolveSceneCameraPose('living-room', 0.4).radius;

for (const [label, aspect, turnDeg] of [
  ['0.40 turned +26.8 (the one that misses)', 0.4, 26.8],
  ['0.46 turned +23.6 (the one that passes)', 0.46, 23.6],
]) {
  const position = target.clone().add(new Vector3().setFromSpherical(new Spherical(radius, preset.polar, Math.PI + (turnDeg * Math.PI) / 180)));
  if (position.y > 6.0) position.y = 6.0;
  const camera = new PerspectiveCamera(M.SCENE_CAMERA_FOV, aspect, 0.1, 400);
  camera.position.copy(position);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();

  const caster = new Raycaster();
  const n = 40;
  const cells = new Map();
  const bare = [];
  let total = 0;
  for (let iy = 0; iy < n; iy++) {
    for (let ix = 0; ix < n; ix++) {
      caster.setFromCamera(new Vector2((ix / (n - 1)) * 2 - 1, (iy / (n - 1)) * 2 - 1), camera);
      const hit = caster.intersectObjects(scene.children, true)[0];
      total++;
      if (!hit) continue;
      let node = hit.object;
      while (node && !node.name) node = node.parent;
      const name = (node?.name || '').toLowerCase();
      if (name.includes('rug') || name.includes('runner') || name.includes('carpet')) continue;
      if (!(name.includes('floor') || name.includes('ground'))) continue;
      bare.push({ x: hit.point.x, z: hit.point.z, fy: iy / (n - 1), fx: ix / (n - 1) });
      const key = `${Math.round(hit.point.x)},${Math.round(hit.point.z)}`;
      cells.set(key, (cells.get(key) ?? 0) + 1);
    }
  }
  console.log(`\n=== ${label}   camera (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`);
  console.log(`  ${((bare.length / total) * 100).toFixed(1)}% bare boards`);
  const xs = bare.map((b) => b.x);
  const zs = bare.map((b) => b.z);
  console.log(`  landing on x [${Math.min(...xs).toFixed(1)}, ${Math.max(...xs).toFixed(1)}]  z [${Math.min(...zs).toFixed(1)}, ${Math.max(...zs).toFixed(1)}]`);
  const ranked = [...cells.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16);
  console.log('  emptiest 1x1 cells (x,z -> rays):');
  console.log('   ' + ranked.map(([k, v]) => `(${k}) ${v}`).join('  '));
  // Where in the FRAME the emptiness sits: bottom half is the foreground a child
  // looks at first, and is also where a floor prop can be added without getting
  // between the camera and a toybox.
  const low = bare.filter((b) => b.fy < 0.4);
  if (low.length) {
    console.log(`  bottom 40% of frame: ${low.length} rays on x [${Math.min(...low.map((b) => b.x)).toFixed(1)}, ${Math.max(...low.map((b) => b.x)).toFixed(1)}]  z [${Math.min(...low.map((b) => b.z)).toFixed(1)}, ${Math.max(...low.map((b) => b.z)).toFixed(1)}]`);
  }
}
gsap.ticker.sleep();
process.exit(0);
