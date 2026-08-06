// SCRATCH PROBE. Where exactly does each room stop needing an opening turn?
//
// The schedule's last two rows have to bracket that aspect, and guessing cost two
// test failures: holding the last non-zero value to 0.69 (Playroom) and 1.04
// (Kitchen) put a turn at aspects where the room was ALREADY opening onto a
// framed toybox, which `tests/room/opening-turn.test.mjs` correctly calls
// gratuitous. This finds the crossover instead of guessing at it: the smallest
// aspect at which a halo and the box under it are both in frame with no turn at
// all. No rasterisation, so it is cheap enough to sweep finely.
import { Box3, PerspectiveCamera, Scene, Spherical, Vector3 } from 'three';
import gsap from 'gsap';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'turnCrossover',
  [
    `export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from '@app/utils/cameraPresets';`,
    `export { getSceneCameraPreset } from '@app/scenes/sceneCatalog';`,
    `export { buildPlayroomContents } from '@scenes/world/places/house/subplaces/playroom/room';`,
    `export { buildRoomContents as buildKitchen } from '@scenes/world/places/house/subplaces/kitchen/room';`,
    `export { buildRoomContents as buildLiving } from '@scenes/world/places/house/subplaces/living-room/room';`,
    `export { setSceneIdleAnimator } from '@app/utils/idle/registry';`,
    `export { createDisposalScope } from '@app/utils/disposal';`,
  ].join('\n'),
);

const CLAMP = 6.0;
const HALO_MARGIN = 0.06;
const BOX_CENTRE_LIMIT = 0.85;
const BOX_AREA_LIMIT = 0.9;
const noop = () => {};
const stubCanvas = () => ({ width: 1280, height: 720, clientWidth: 1280, clientHeight: 720, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }), addEventListener: noop, removeEventListener: noop, style: {} });

const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, 1, 0.1, 400);
const aim = (p, t, a) => {
  cam.aspect = a;
  cam.position.copy(p);
  cam.lookAt(t);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
};
const boxFramed = (pts) => {
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (const p of pts) {
    const q = p.clone().project(cam);
    if (q.z > 1) return false;
    x0 = Math.min(x0, q.x);
    x1 = Math.max(x1, q.x);
    y0 = Math.min(y0, q.y);
    y1 = Math.max(y1, q.y);
  }
  if (Math.abs((x0 + x1) / 2) > BOX_CENTRE_LIMIT || Math.abs((y0 + y1) / 2) > BOX_CENTRE_LIMIT) return false;
  const full = (x1 - x0) * (y1 - y0);
  if (full <= 1e-9) return true;
  return (Math.max(0, Math.min(x1, 1) - Math.max(x0, -1)) * Math.max(0, Math.min(y1, 1) - Math.max(y0, -1))) / full >= BOX_AREA_LIMIT;
};
const haloIn = (centre, radius) => {
  const c = centre.clone().project(cam);
  if (c.z > 1) return false;
  const e = centre.clone().addScaledVector(new Vector3().setFromMatrixColumn(cam.matrixWorld, 0), radius).project(cam);
  const rx = Math.abs(e.x - c.x);
  return Math.abs(c.x) + rx <= 1 - HALO_MARGIN && Math.abs(c.y) + rx * cam.aspect <= 1 - HALO_MARGIN;
};

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

  const halos = [];
  scene.traverse((o) => {
    if (!o.name.startsWith('tapInvitation_')) return;
    const boxName = o.name.replace('tapInvitation_', '');
    const t = scene.children.find((c) => c.name === boxName);
    const b = t ? new Box3().setFromObject(t) : null;
    const pts = [];
    if (b && !b.isEmpty()) for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(new Vector3(x, y, z));
    halos.push({ name: boxName, centre: o.getWorldPosition(new Vector3()), radius: o.scale.x / 2, pts });
  });

  const preset = M.getSceneCameraPreset(id);
  const target = new Vector3(...preset.target);
  let first = null;
  const bands = [];
  let prev = null;
  for (let a = 0.4; a <= 2.601; a += 0.005) {
    const aspect = +a.toFixed(3);
    const radius = M.resolveSceneCameraPose(id, aspect).radius;
    const position = target.clone().add(new Vector3().setFromSpherical(new Spherical(radius, preset.polar, preset.azimuth)));
    if (position.y > CLAMP) position.y = CLAMP;
    aim(position, target, aspect);
    const ok = halos.some((h) => haloIn(h.centre, h.radius) && h.pts.length > 0 && boxFramed(h.pts));
    if (ok && first === null) first = aspect;
    if (prev !== null && prev !== ok) bands.push(`${ok ? 'needs no turn' : 'NEEDS A TURN'} from ${aspect}`);
    prev = ok;
  }
  console.log(`${id.padEnd(13)} first aspect needing no turn: ${first ?? 'none in range'}   transitions: ${bands.join('; ') || 'none'}`);
}
gsap.ticker.sleep();
process.exit(0);
