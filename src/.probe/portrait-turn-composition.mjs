/**
 * THE OPENING TURN, RE-SOLVED WITH COMPOSITION AS A CONSTRAINT.
 *
 * `.probe/portrait-open-turn.mjs` solved for the smallest turn that puts a
 * toybox's halo in the resting frame, subject to the frame staying clean, the
 * ceiling staying out, and the turn fitting inside the room's clamp. Shipping
 * that schedule broke two of `room-opening-framing`'s composition bounds at the
 * narrowest shipping aspect, 0.40:
 *
 *     playroom    0.40   props 18.6%  (bound 20.0%)   rug 21.6, wall 18.7, floor 41.2
 *     living-room 0.40   floor 46.8%  (bound 46.0%)   props 19.1, rug 10.7, wall 23.3
 *
 * Those bounds are not decoration and they are not mine to move: they are the
 * two claims that the previous round of work EARNED -- "this room is made of
 * things, not of empty carpet" and "this floor is dressed" -- and each was paid
 * for with real set dressing. Loosening either because a new feature happens to
 * cross it would silently spend that work. So the turn is re-solved with them as
 * hard constraints instead.
 *
 * WHAT CHANGES IN THE SEARCH. Round one took the FIRST angle, sweeping outward
 * from zero, that showed a halo, and it swept the cheap direction first. This
 * sweeps BOTH directions all the way to the clamp, keeps every angle that shows a
 * halo AND holds every composition bound, and takes the smallest of those. A room
 * whose cheap side opens onto bare floor can now be turned the other way instead,
 * which round one could never discover because it stopped at the first hit.
 *
 * WHAT IT COSTS WHEN THERE IS NO SUCH ANGLE. Then the room genuinely cannot open
 * onto a toybox at that aspect without showing an undressed part of itself, and
 * the answer is set dressing, not a smaller bound. The probe says so in as many
 * words rather than returning the least-bad angle, because the least-bad angle is
 * exactly what would get shipped.
 *
 * ROUND THREE ADDED THE BOX ITSELF TO THE TEST, and the reason is what the phone
 * renders looked like. Solving only for "the halo is wholly in frame" is
 * satisfied by a pose where the halo clears the edge and the TOYBOX under it is
 * cut in half by it — which is what shipped: on a 393x852 frame the Kitchen's
 * chest and the Living Room's nature box both sat clipped against the left edge
 * with a tidy ring floating above them. A halo is a pointer, and a pointer at
 * something half off screen is pointing at half a thing.
 *
 * So a candidate angle now has to satisfy BOTH: the halo disc wholly inside the
 * frame with a margin, AND the box under it passing `tappable` — bbox centre
 * inside 0.85 NDC with at least 60% of its projected area on screen. That is not a
 * new rule invented here; it is the same reachability predicate
 * `room-opening-framing.test.mjs` and `.probe/joint-solve.mjs` use to decide
 * whether a child can reach a prop at all. A box worth turning toward is a box
 * that would count as reachable if the child had turned there themselves.
 *
 * The rasteriser and its buckets are copied from `room-opening-framing.test.mjs`
 * deliberately and not imported: a probe that shares an instrument with the guard
 * it is trying to satisfy cannot tell you that the instrument is the problem.
 */
import { Box3, PerspectiveCamera, Raycaster, Scene, Spherical, Vector2, Vector3 } from 'three';
import gsap from 'gsap';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'portraitTurnComposition',
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

/** Copied from `room-opening-framing.test.mjs`. See the header for why. */
const EXPECTED_COMPOSITION = {
  playroom: { maxCeiling: 0.01, minObjects: 0.17, minObjectsPortrait: 0.2, maxBareFloor: 0.45 },
  kitchen: { maxCeiling: 0.01, minObjects: 0.145, minObjectsPortrait: 0.185, maxBareFloor: 0.42 },
  'living-room': { maxCeiling: 0.01, minObjects: 0.115, minObjectsPortrait: 0.175, maxBareFloor: 0.46 },
};
const PORTRAIT_MAX_ASPECT = 0.75;
/**
 * Margin demanded above/below each composition bound, in frame fraction.
 *
 * WITHOUT IT THE SOLVER SITS ON THE LINE. Asked only to SATISFY the bounds, it
 * returned 10.5 degrees for the Playroom at aspect 0.45 with objects at exactly
 * 20.0% against a 20.0% bound — and the guard, evaluating at the real device
 * aspect of 0.4503 rather than the round number, measured 19.9% and failed. A
 * schedule whose margin is zero is a schedule that breaks on the next piece of
 * set dressing anyone moves, in either direction. One point of frame is ten rays
 * out of 1024.
 */
const COMPOSITION_MARGIN = 0.01;
const CLAMP = 6.0;
const AZ = Math.PI;
const HALO_MARGIN = 0.06;

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
function haloInFrame(centre, radius) {
  const c = v.copy(centre).project(cam);
  if (c.z > 1) return false;
  const e = new Vector3().copy(centre).addScaledVector(new Vector3().setFromMatrixColumn(cam.matrixWorld, 0), radius).project(cam);
  const rx = Math.abs(e.x - c.x);
  const ry = rx * cam.aspect;
  return Math.abs(c.x) + rx <= 1 - HALO_MARGIN && Math.abs(c.y) + ry <= 1 - HALO_MARGIN;
}

/**
 * How well framed the box under the halo has to be.
 *
 * ROUND THREE USED THE SHIPPED REACHABILITY RULE — centre inside 0.85 NDC, 60% of
 * projected area on screen — on the reasoning that a box worth turning toward is
 * one that would count as reachable anyway. It changed almost nothing: the Living
 * Room and Kitchen schedules came out identical to round two's and only the
 * Playroom moved. Which is the finding, not a null result. Those boxes were
 * ALREADY passing `tappable` at the clipped-looking angles, because 0.85 of a half
 * frame with 60% of the area showing IS "jammed against the edge with a corner
 * missing". The predicate was never wrong; it answers "could a finger find this",
 * and the question here is "did the room open onto it".
 *
 * So these are tighter and they are their own numbers: centre inside 0.55 — the
 * middle 55% of the frame rather than the outer 15% of it — and 90% of the box's
 * projected area actually on screen, so no visible corner is cut.
 */
const CENTRE_LIMIT = Number(process.env.CENTRE_LIMIT ?? 0.55);
const AREA_LIMIT = Number(process.env.AREA_LIMIT ?? 0.9);
function tappable(pts) {
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

function rasterise(scene, position, target, aspect) {
  const camera = new PerspectiveCamera(M.SCENE_CAMERA_FOV, aspect, 0.1, 400);
  camera.position.copy(position);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  const caster = new Raycaster();
  const tally = { props: 0, rug: 0, wall: 0, floor: 0, ceiling: 0, nothing: 0 };
  const n = 32;
  for (let iy = 0; iy < n; iy++) {
    for (let ix = 0; ix < n; ix++) {
      caster.setFromCamera(new Vector2((ix / (n - 1)) * 2 - 1, (iy / (n - 1)) * 2 - 1), camera);
      const hit = caster.intersectObjects(scene.children, true)[0];
      if (!hit) {
        tally.nothing += 1;
        continue;
      }
      let node = hit.object;
      while (node && !node.name) node = node.parent;
      const name = (node?.name || '').toLowerCase();
      if (name.includes('ceiling')) tally.ceiling += 1;
      else if (name.includes('rug') || name.includes('runner') || name.includes('carpet')) tally.rug += 1;
      else if (name.includes('floor') || name.includes('ground')) tally.floor += 1;
      else if (name.includes('wall') || name.includes('wainscot') || name.includes('wallpaper')) tally.wall += 1;
      else tally.props += 1;
    }
  }
  return Object.fromEntries(Object.entries(tally).map(([k, val]) => [k, val / (n * n)]));
}

const ASPECTS = (process.env.ASPECTS || '0.4,0.43,0.46,0.5,0.55,0.6,0.65,0.7,0.75,0.8,0.85,0.9,0.95,1,1.05,1.1').split(',').map(Number);
/** Force a single turn direction, so a schedule cannot flip sign between two adjacent aspects and interpolate through zero on the way. */
const FORCE_DIR = process.env.FORCE_DIR ? Number(process.env.FORCE_DIR) : 0;

const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
for (const [id, build, L] of [
  ['playroom', M.buildPlayroomContents, M.PLAYROOM],
  ['living-room', M.buildLiving, M.LIVING],
  ['kitchen', M.buildKitchen, M.KITCHEN],
].filter(([id]) => !ONLY || ONLY.includes(id))) {
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
    // The box the halo hangs over, by name, so the pairing cannot drift from
    // whatever `createTapInvitation` decided to hang a halo on.
    const target = scene.children.find((c) => c.name === boxName);
    const b = target ? new Box3().setFromObject(target) : null;
    const pts = [];
    if (b && !b.isEmpty()) {
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(new Vector3(x, y, z));
    }
    halos.push({ name: boxName, centre: o.getWorldPosition(new Vector3()), radius: o.scale.x / 2, pts });
  });

  const preset = M.getSceneCameraPreset(id);
  const target = new Vector3(...preset.target);
  const shell = { wallX: L.LEFT_WALL_X, frontZ: L.BACK_WALL_CENTER_Z - L.ROOM_DEPTH, backZ: L.BACK_WALL_CENTER_Z, ceilingY: L.CEILING_Y, floorY: 0 };
  const bounds = EXPECTED_COMPOSITION[id];
  const orbit = {
    azimuth: AZ,
    pivot: target,
    radii: [preset.distance],
    polars: [Math.max(0.75, preset.polar - 0.1), preset.polar, Math.min(1.5, preset.polar + 0.1)],
    ceilingClamp: CLAMP,
  };

  console.log(`\n=== ${id}   halos: ${halos.map((h) => h.name).join(', ') || 'none'}`);
  console.log('aspect  budget    best turn   halo shown            props   rug   wall  floor  ceil   verdict');

  const SCHEDULE = [];
  for (const aspect of ASPECTS) {
    const budget = M.resolveRotationRange(aspect, id);
    // The shipped radius for this aspect, taken from the shipped resolver so the
    // pull-back rule cannot be re-implemented slightly differently here. Its
    // azimuth already carries whatever opening turn is currently shipped, which is
    // why only the radius is used.
    const radius = M.resolveSceneCameraPose(id, aspect).radius;
    const minProps = aspect <= PORTRAIT_MAX_ASPECT ? bounds.minObjectsPortrait : bounds.minObjects;

    // OUTWARD FROM ZERO, RASTERISING ONLY WHEN A HALO IS ACTUALLY IN FRAME.
    // A rasterisation is 1024 rays through the whole room; the first version of
    // this loop rasterised every viable angle before choosing and would have
    // taken about ninety minutes. Stopping at the first angle that satisfies
    // both tests gives the same answer -- the search is over |delta| ascending
    // and the objective IS smallest |delta| -- for a few hundredths of the cost.
    let pick = null;
    let showsAtRest = false;
    let nearestShowing = null;
    for (let step = 0; step <= 240 && !pick; step++) {
      for (const dir of step === 0 ? [1] : FORCE_DIR ? [FORCE_DIR] : [1, -1]) {
        const delta = dir * step * 0.004;
        if (Math.abs(delta) > budget) continue;

        // The frame must stay clean over the whole polar spread, since the
        // shipped orbit is free to tilt within it.
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
        const shown = halos.filter((h) => haloInFrame(h.centre, h.radius) && h.pts.length > 0 && tappable(h.pts));
        if (shown.length === 0) continue;

        const c = rasterise(scene, position, target, aspect);
        const ok = c.ceiling <= bounds.maxCeiling && c.props >= minProps + COMPOSITION_MARGIN && c.floor <= bounds.maxBareFloor - COMPOSITION_MARGIN;
        if (!nearestShowing) nearestShowing = { delta, c, minProps };
        if (!ok) continue;
        pick = { delta, shown: shown.map((x) => x.name), c };
        showsAtRest = delta === 0;
        break;
      }
    }

    if (!pick) {
      const closest = nearestShowing;
      console.log(
        `  ${aspect.toFixed(2)}   ±${((budget * 180) / Math.PI).toFixed(1)}°`.padEnd(18) +
          `   NO ANGLE SHOWS A HALO AND HOLDS COMPOSITION` +
          (closest
            ? `  (nearest that shows one: ${((closest.delta * 180) / Math.PI).toFixed(1)}\u00b0 -> props ${(closest.c.props * 100).toFixed(1)}%, floor ${(closest.c.floor * 100).toFixed(1)}%, bounds props>=${(minProps * 100).toFixed(1)}% floor<=${(bounds.maxBareFloor * 100).toFixed(0)}%)`
            : ''),
      );
      SCHEDULE.push([aspect, null]);
      continue;
    }

    const c = pick.c;
    console.log(
      `  ${aspect.toFixed(2)}   ±${((budget * 180) / Math.PI).toFixed(1)}°`.padEnd(18) +
        `${((pick.delta * 180) / Math.PI).toFixed(1)}°`.padStart(8) +
        `   ${(pick.shown.join('+') || '-').padEnd(22)}` +
        `${(c.props * 100).toFixed(1)}`.padStart(6) +
        `${(c.rug * 100).toFixed(1)}`.padStart(6) +
        `${(c.wall * 100).toFixed(1)}`.padStart(6) +
        `${(c.floor * 100).toFixed(1)}`.padStart(7) +
        `${(c.ceiling * 100).toFixed(1)}`.padStart(6) +
        `   ${showsAtRest ? 'no turn needed' : 'ok'}`,
    );
    SCHEDULE.push([aspect, +pick.delta.toFixed(4)]);
  }
  console.log(`  SCHEDULE ${id}: ` + JSON.stringify(SCHEDULE));
}
void Box3;
gsap.ticker.sleep();
process.exit(0);
