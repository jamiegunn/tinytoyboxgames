/**
 * HOW FAR INBOARD DO THE DESTINATION TOYBOXES HAVE TO COME?
 *
 * WHERE THIS CAME FROM. Requiring the opening turn to bring the BOX properly into
 * frame — bbox centre inside 0.85 NDC with 90% of its projected area on screen,
 * not merely the halo above it — costs 34 to 38 degrees of turn on a phone in the
 * Living Room and the Kitchen. That works and it is guarded, but it means the room
 * opens looking nearly three frame-widths off its own axis, which is a lot of
 * crooked for a room a three-year-old is meant to recognise.
 *
 * A big turn is a symptom. The cause is that the boxes stand far outboard —
 * ±2.7 in the Living Room, 4.05 and -1.6 in the Playroom, 2.6 in the Kitchen after
 * its own move — and a narrow portrait frame cannot contain something that far off
 * axis without being pointed almost at it. The Kitchen's box has already been
 * through this once; its `layout.ts` records the sweep. So has the Living Room's
 * pair, for three unrelated reasons at once, before any of this existed.
 *
 * WHAT THIS SWEEPS. Each destination toybox pulled toward the room's centre line
 * by a common fraction of its own |x|, and for each fraction: the turn the strict
 * standard needs at the worst portrait aspect, the slack left against the room's
 * clamp, and whether the moved footprint now overlaps anything else standing on
 * that floor. Positions are moved analytically — the bbox and the halo shifted by
 * the same delta — so one build serves the whole sweep.
 *
 * WHAT IT CANNOT SEE, and the reason the winner still has to go through
 * `.probe/portrait-turn-composition.mjs` afterwards: nothing here rasterises, so
 * it says nothing about whether the frame at the new angle is still made of things
 * rather than of empty floor. It narrows the search; it does not close it.
 */
import { Box3, PerspectiveCamera, Scene, Spherical, Vector3 } from 'three';
import gsap from 'gsap';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'inboardSweep',
  [
    `export { frameSeesPastWalls, orbitPositionsAt, resolveRotationRange } from '@app/utils/scene/rotationRange';`,
    `export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from '@app/utils/cameraPresets';`,
    `export { getSceneCameraPreset } from '@app/scenes/sceneCatalog';`,
    `export { buildPlayroomContents } from '@scenes/world/places/house/subplaces/playroom/room';`,
    `export { buildRoomContents as buildKitchen } from '@scenes/world/places/house/subplaces/kitchen/room';`,
    `export { buildRoomContents as buildLiving } from '@scenes/world/places/house/subplaces/living-room/room';`,
    `export * as PLAYROOM from '@scenes/world/places/house/subplaces/playroom/layout';`,
    `export * as KITCHEN from '@scenes/world/places/house/subplaces/kitchen/layout';`,
    `export * as LIVING from '@scenes/world/places/house/subplaces/living-room/layout';`,
    `export { setSceneIdleAnimator } from '@app/utils/idle/registry';`,
    `export { createDisposalScope } from '@app/utils/disposal';`,
  ].join('\n'),
);

const CLAMP = 6.0;
const AZ = Math.PI;
const HALO_MARGIN = 0.06;
const BOX_CENTRE_LIMIT = 0.85;
const BOX_AREA_LIMIT = 0.9;
const ASPECTS = [0.4, 0.45, 0.46, 0.5, 0.56, 0.6, 0.65, 0.7, 0.75, 0.8, 0.9, 1.0, 1.1];
const PULLS = [0, 0.15, 0.25, 0.35, 0.45, 0.55];

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
const corners = () =>
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([x, y]) => new Vector3(x, y, 1).unproject(cam).sub(cam.position).normalize());
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

for (const [id, build, L] of [
  ['playroom', M.buildPlayroomContents, M.PLAYROOM],
  ['living-room', M.buildLiving, M.LIVING],
  ['kitchen', M.buildKitchen, M.KITCHEN],
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

  const units = [];
  scene.traverse((o) => {
    if (!o.name.startsWith('tapInvitation_')) return;
    const boxName = o.name.replace('tapInvitation_', '');
    const t = scene.children.find((c) => c.name === boxName);
    if (!t) return;
    const b = new Box3().setFromObject(t);
    if (b.isEmpty()) return;
    units.push({ name: boxName, anchorX: t.position.x, box: b, haloCentre: o.getWorldPosition(new Vector3()), haloR: o.scale.x / 2 });
  });

  const others = [];
  for (const root of scene.children) {
    if (!root.name || root.name.startsWith('tapInvitation_') || units.some((u) => u.name === root.name)) continue;
    const n = root.name.toLowerCase();
    if (n.includes('floor') || n.includes('ceiling') || n.includes('wall') || n.includes('rug') || n.includes('runner') || n.includes('carpet')) continue;
    const b = new Box3().setFromObject(root);
    if (b.isEmpty() || b.min.y > 0.6) continue;
    others.push({ name: root.name, b });
  }

  const preset = M.getSceneCameraPreset(id);
  const target = new Vector3(...preset.target);
  const shell = { wallX: L.LEFT_WALL_X, frontZ: L.BACK_WALL_CENTER_Z - L.ROOM_DEPTH, backZ: L.BACK_WALL_CENTER_Z, ceilingY: L.CEILING_Y, floorY: 0 };
  const orbit = { azimuth: AZ, pivot: target, radii: [preset.distance], polars: [Math.max(0.75, preset.polar - 0.1), preset.polar, Math.min(1.5, preset.polar + 0.1)], ceilingClamp: CLAMP };

  console.log(`\n=== ${id}   boxes at x ${units.map((u) => u.anchorX.toFixed(2)).join(', ')}`);
  console.log('  pull   new x            worst turn (aspect)     min clamp slack   crossover   collides');
  for (const pull of PULLS) {
    const moved = units.map((u) => {
      const dx = -u.anchorX * pull;
      const pts = [];
      for (const x of [u.box.min.x + dx, u.box.max.x + dx]) for (const y of [u.box.min.y, u.box.max.y]) for (const z of [u.box.min.z, u.box.max.z]) pts.push(new Vector3(x, y, z));
      return { name: u.name, newX: u.anchorX + dx, pts, halo: u.haloCentre.clone().setX(u.haloCentre.x + dx), haloR: u.haloR, footprint: { x0: u.box.min.x + dx, x1: u.box.max.x + dx, z0: u.box.min.z, z1: u.box.max.z } };
    });

    let worstNeed = -1;
    let worstAspect = null;
    let minSlack = Infinity;
    let crossover = null;
    const infeasible = [];
    for (const aspect of ASPECTS) {
      const budget = M.resolveRotationRange(aspect, id);
      const radius = M.resolveSceneCameraPose(id, aspect).radius;
      let need = null;
      for (let step = 0; step <= 300; step++) {
        for (const dir of step === 0 ? [1] : [1, -1]) {
          const delta = dir * step * 0.004;
          if (Math.abs(delta) > budget) continue;
          let dirty = false;
          for (const pos of M.orbitPositionsAt(Math.abs(delta), orbit)) {
            aim(pos, target, aspect);
            if (M.frameSeesPastWalls(pos, corners(), shell)) {
              dirty = true;
              break;
            }
          }
          if (dirty) continue;
          const position = target.clone().add(new Vector3().setFromSpherical(new Spherical(radius, preset.polar, AZ + delta)));
          if (position.y > CLAMP) position.y = CLAMP;
          aim(position, target, aspect);
          if (moved.some((m) => haloIn(m.halo, m.haloR) && boxFramed(m.pts))) {
            need = Math.abs(delta);
            break;
          }
        }
        if (need !== null) break;
      }
      if (need === null) {
        infeasible.push(aspect);
        continue;
      }
      if (need === 0 && crossover === null) crossover = aspect;
      if (need > worstNeed) {
        worstNeed = need;
        worstAspect = aspect;
      }
      minSlack = Math.min(minSlack, budget - need);
    }

    const hits = new Set();
    for (const m of moved) {
      for (const o of others) if (m.footprint.x0 < o.b.max.x && m.footprint.x1 > o.b.min.x && m.footprint.z0 < o.b.max.z && m.footprint.z1 > o.b.min.z) hits.add(o.name);
      for (const n of moved) if (n !== m && m.footprint.x0 < n.footprint.x1 && m.footprint.x1 > n.footprint.x0 && m.footprint.z0 < n.footprint.z1 && m.footprint.z1 > n.footprint.z0) hits.add(`${m.name} INTO ${n.name}`);
    }

    console.log(
      `  ${(pull * 100).toFixed(0).padStart(3)}%   ${moved
        .map((m) => m.newX.toFixed(2))
        .join(', ')
        .padEnd(16)} ` +
        (infeasible.length ? `INFEASIBLE at ${infeasible.join(',')}`.padEnd(24) : `${((worstNeed * 180) / Math.PI).toFixed(1)}° (${worstAspect})`.padEnd(24)) +
        (Number.isFinite(minSlack) ? `${((minSlack * 180) / Math.PI).toFixed(1)}°`.padStart(12) : '—'.padStart(12)) +
        `${crossover === null ? '  none' : '   ' + crossover}`.padEnd(14) +
        `  ${hits.size ? [...hits].join(', ') : 'nothing'}`,
    );
  }
}
gsap.ticker.sleep();
process.exit(0);
