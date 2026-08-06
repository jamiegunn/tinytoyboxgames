/**
 * HOW FAR INBOARD DOES THE KITCHEN'S TOYBOX HAVE TO MOVE?
 *
 * THE WALL THIS RAN INTO. `.probe/portrait-turn-composition.mjs`, asked for an
 * opening turn that brings the toybox properly into frame — bbox centre inside
 * 0.85 NDC with at least 90% of its projected area on screen, rather than merely
 * "reachable" at 60% — reports NO FEASIBLE ANGLE for the Kitchen at every aspect
 * from 0.60 to 0.90, which includes iPad portrait at 0.75 and a square window at
 * 1.00. And where it does succeed it only just does: 33.9 degrees needed at
 * aspect 0.56 against a clamp of 34.0.
 *
 * That is not a schedule problem. The Kitchen's toybox stands at x 3.1 in a room
 * whose wall is at 5.4, and framing something that far outboard means turning
 * further than the room's own walls allow before a frame corner escapes past the
 * end of one. No angle exists to be solved for.
 *
 * THE PRECEDENT FOR MOVING IT IS IN THIS REPOSITORY, in the Living Room's own
 * layout: "the two toyboxes came off the walls" by 0.9 because they were the
 * binding constraint on the stage aspect band, on rotation, and on framing at
 * once — and measured, that move cost nothing while taking the room's rotation
 * limit from ±1.6 degrees to ±29.3. Three earlier notes had called it set
 * dressing and left it.
 *
 * WHAT THIS SOLVES. For each candidate x, the turn the strict standard needs at
 * every portrait aspect, whether it fits the clamp with real slack, and whether
 * the new position collides with anything already on that floor. The answer is
 * the smallest move that clears every aspect — not the most central position,
 * because a toybox in the middle of a kitchen floor is not a kitchen.
 */
import { Box3, PerspectiveCamera, Scene, Spherical, Vector3 } from 'three';
import gsap from 'gsap';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'kitchenInboard',
  [
    `export { frameSeesPastWalls, orbitPositionsAt, resolveRotationRange } from '@app/utils/scene/rotationRange';`,
    `export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from '@app/utils/cameraPresets';`,
    `export { getSceneCameraPreset } from '@app/scenes/sceneCatalog';`,
    `export { buildRoomContents as buildKitchen } from '@scenes/world/places/house/subplaces/kitchen/room';`,
    `export * as KITCHEN from '@scenes/world/places/house/subplaces/kitchen/layout';`,
    `export { setSceneIdleAnimator } from '@app/utils/idle/registry';`,
    `export { createDisposalScope } from '@app/utils/disposal';`,
  ].join('\n'),
);

const CLAMP = 6.0;
const AZ = Math.PI;
const HALO_MARGIN = 0.06;
const CENTRE_LIMIT = 0.85;
const AREA_LIMIT = 0.9;
const ASPECTS = [0.4, 0.45, 0.46, 0.5, 0.55, 0.56, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0, 1.05, 1.1];

const noop = () => {};
const stubCanvas = () => ({ width: 1280, height: 720, clientWidth: 1280, clientHeight: 720, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }), addEventListener: noop, removeEventListener: noop, style: {} });

const scene = new Scene();
M.setSceneIdleAnimator(scene, M.createDisposalScope());
M.buildKitchen({
  scene,
  canvas: stubCanvas(),
  camera: new PerspectiveCamera(),
  dispatcher: { register: () => noop, registerWithPoint: () => noop, setMissHandler: noop, dispose: noop },
  nav: { navigateTo: noop, launchMiniGame: noop, exitMiniGame: noop },
  owl: { flyTo: noop, setSurfaceYAt: noop, land: noop, group: { position: new Vector3() } },
});
scene.updateMatrixWorld(true);

const L = M.KITCHEN;
const toybox = scene.children.find((c) => c.name.startsWith('toybox_') && c.name.endsWith('_root'));
const halo = scene.children.find((c) => c.name.startsWith('tapInvitation_'));
if (!toybox || !halo) throw new Error('kitchen has no toybox or no halo');
const box0 = new Box3().setFromObject(toybox);
const halo0 = halo.getWorldPosition(new Vector3());
const haloR = halo.scale.x / 2;
console.log(`toybox at x ${toybox.position.x.toFixed(2)}, z ${toybox.position.z.toFixed(2)}   bbox x [${box0.min.x.toFixed(2)}, ${box0.max.x.toFixed(2)}]  wall at ${L.LEFT_WALL_X}`);

// Everything else standing on this floor, so a move can be checked for collision
// rather than eyeballed. Footprints only: two things at different heights in the
// same place is still two things in the same place on a floor a child looks at.
const neighbours = [];
for (const root of scene.children) {
  if (root === toybox || root === halo) continue;
  if (!root.name || root.name.includes('floor') || root.name.includes('ceiling') || root.name.includes('wall') || root.name.includes('rug') || root.name.includes('runner')) continue;
  const b = new Box3().setFromObject(root);
  if (b.isEmpty() || b.min.y > 0.6) continue; // only things standing on the floor
  neighbours.push({ name: root.name, b });
}

const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, 1, 0.1, 400);
const aim = (p, t, a) => {
  cam.aspect = a;
  cam.position.copy(p);
  cam.lookAt(t);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
};
const corners = () =>
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([x, y]) => new Vector3(x, y, 1).unproject(cam).sub(cam.position).normalize());
const v = new Vector3();
function framed(pts) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    v.copy(p).project(cam);
    if (v.z > 1) return false;
    x0 = Math.min(x0, v.x);
    x1 = Math.max(x1, v.x);
    y0 = Math.min(y0, v.y);
    y1 = Math.max(y1, v.y);
  }
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  if (Math.abs(cx) > CENTRE_LIMIT || Math.abs(cy) > CENTRE_LIMIT) return false;
  const full = (x1 - x0) * (y1 - y0);
  if (full <= 1e-9) return true;
  return (Math.max(0, Math.min(x1, 1) - Math.max(x0, -1)) * Math.max(0, Math.min(y1, 1) - Math.max(y0, -1))) / full >= AREA_LIMIT;
}
function haloIn(centre) {
  const c = v.copy(centre).project(cam);
  if (c.z > 1) return false;
  const e = new Vector3().copy(centre).addScaledVector(new Vector3().setFromMatrixColumn(cam.matrixWorld, 0), haloR).project(cam);
  const rx = Math.abs(e.x - c.x);
  return Math.abs(c.x) + rx <= 1 - HALO_MARGIN && Math.abs(c.y) + rx * cam.aspect <= 1 - HALO_MARGIN;
}

const preset = M.getSceneCameraPreset('kitchen');
const target = new Vector3(...preset.target);
const shell = { wallX: L.LEFT_WALL_X, frontZ: L.BACK_WALL_CENTER_Z - L.ROOM_DEPTH, backZ: L.BACK_WALL_CENTER_Z, ceilingY: L.CEILING_Y, floorY: 0 };
const orbit = { azimuth: AZ, pivot: target, radii: [preset.distance], polars: [Math.max(0.75, preset.polar - 0.1), preset.polar, Math.min(1.5, preset.polar + 0.1)], ceilingClamp: CLAMP };

console.log('\n  x     worst aspect needing the most turn      slack at the tightest aspect   collides with');
for (const x of [3.1, 2.8, 2.6, 2.4, 2.2, 2.0, 1.8]) {
  const dx = x - toybox.position.x;
  const pts = [];
  for (const bx of [box0.min.x + dx, box0.max.x + dx]) for (const by of [box0.min.y, box0.max.y]) for (const bz of [box0.min.z, box0.max.z]) pts.push(new Vector3(bx, by, bz));
  const haloAt = halo0.clone().setX(halo0.x + dx);

  let worstAspect = null;
  let worstNeed = -1;
  let minSlack = Infinity;
  let infeasible = [];
  for (const aspect of ASPECTS) {
    const budget = M.resolveRotationRange(aspect, 'kitchen');
    const radius = M.resolveSceneCameraPose('kitchen', aspect).radius;
    let need = null;
    for (let step = 0; step <= 300; step++) {
      const delta = step * 0.004;
      if (delta > budget) break;
      let dirty = false;
      for (const pos of M.orbitPositionsAt(delta, orbit)) {
        aim(pos, target, aspect);
        if (M.frameSeesPastWalls(pos, corners(), shell)) {
          dirty = true;
          break;
        }
      }
      if (dirty) break;
      const position = target.clone().add(new Vector3().setFromSpherical(new Spherical(radius, preset.polar, AZ + delta)));
      if (position.y > CLAMP) position.y = CLAMP;
      aim(position, target, aspect);
      if (haloIn(haloAt) && framed(pts)) {
        need = delta;
        break;
      }
    }
    if (need === null) {
      infeasible.push(aspect);
      continue;
    }
    if (need > worstNeed) {
      worstNeed = need;
      worstAspect = aspect;
    }
    minSlack = Math.min(minSlack, budget - need);
  }

  // Footprint overlap against everything else standing on this floor.
  const moved = { min: { x: box0.min.x + dx, z: box0.min.z }, max: { x: box0.max.x + dx, z: box0.max.z } };
  const hits = neighbours.filter((n) => moved.min.x < n.b.max.x && moved.max.x > n.b.min.x && moved.min.z < n.b.max.z && moved.max.z > n.b.min.z).map((n) => n.name);

  console.log(
    `  ${x.toFixed(1)}   ` +
      (infeasible.length ? `INFEASIBLE at ${infeasible.join(', ')}`.padEnd(42) : `${((worstNeed * 180) / Math.PI).toFixed(1)}° at aspect ${worstAspect}`.padEnd(42)) +
      (Number.isFinite(minSlack) ? `${((minSlack * 180) / Math.PI).toFixed(1)}°`.padStart(10) : '—'.padStart(10)) +
      `                     ${hits.length ? hits.join(', ') : 'nothing'}`,
  );
}
gsap.ticker.sleep();
process.exit(0);
