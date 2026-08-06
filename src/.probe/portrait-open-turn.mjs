/**
 * WHAT ANGLE SHOULD A ROOM OPEN AT ON A PORTRAIT PHONE?
 *
 * THE PROBLEM, MEASURED FIRST. The rooms open facing the back wall (azimuth pi).
 * That was chosen when the framing rule was "every exit on screen at rest"; the
 * rule is now "every exit REACHABLE BY TURNING", which is what let the letterbox
 * go and gave a phone back the 54% of its screen the bands were eating. The cost
 * only became visible when something had to be drawn ON an exit: at rest on a
 * 393x852 phone the destination toyboxes project to NDC x of -1.27 and +1.10
 * (Playroom), -1.59 and +1.63 (Living Room) and -1.90 (Kitchen). The frame ends
 * at 1.0. A halo above a toybox is therefore off screen in five cases out of
 * five, and a three-year-old who does not know to drag never meets one.
 *
 * WHAT THIS SOLVES FOR. The smallest opening turn `delta` that brings ONE exit's
 * halo wholly into the resting frame, subject to three things that all have to
 * hold at the same time:
 *
 *   1. THE FRAME STAYS CLEAN. `frameSeesPastWalls` at the turned pose, over the
 *      same polar spread the shipped orbit uses — a turn that shows a toybox and
 *      the void past a wall corner is not a turn.
 *   2. NO CEILING. The Playroom's ceiling was the complaint that started all of
 *      this; a turn that tips it back into frame undoes that.
 *   3. EVERY OTHER EXIT IS STILL REACHABLE.
 *
 * ROUND 1 GOT (3) WRONG, AND THE WRONG ANSWER WAS THE INTERESTING ONE. It assumed
 * the turn budget travels with the opening pose -- that offsetting the rest
 * azimuth by `delta` also offsets the clamp window, so an exit that needed `r`
 * now needs `r + delta` and the room is only honest if `need + |delta| <=
 * budget`. Under that assumption the Living Room is OVER BUDGET at every portrait
 * aspect below 0.78: showing one of its toyboxes puts the other 46.4 degrees away
 * with only 40.8 degrees of clamp to reach it, and the whole option dies.
 *
 * But the two are not the same thing and never were. The clamp is a fact about
 * the ROOM -- how far it can be turned before the frame sees past a wall -- and it
 * is measured from the room's axis, not from wherever the camera happens to have
 * been put down. The opening pose is a fact about the FIRST MOMENT. Offsetting one
 * has no reason to drag the other, and `cameraPresets` keeps them in separate
 * fields already. Once the clamp stays centred on the room's axis, condition (3)
 * is satisfied by construction -- nothing about reachability changed -- and all
 * that is left is that the opening pose itself be inside the legal window,
 * `|delta| <= budget(aspect)`.
 *
 * WHAT IS STILL SPENT, and it is not free. The child at the turned opening pose
 * has less room to turn one way and more the other. That asymmetry is real, and
 * the far exit's true cost is reported below as `far exit` so it can be seen
 * rather than assumed away.
 *
 * WHY THE HALO AND NOT THE BOX IS THE TARGET. The thing that must be seen is the
 * invitation, and it hangs above the lid and is wider than the lid is at that
 * height. Solving for the box centre would put the halo half off the edge, which
 * is exactly what the frame looked like at rest for `toybox_animals` before this.
 * The disc is projected from the sprite's real position and real scale.
 *
 * WHY IT IS NOT SOLVED FOR "BOTH EXITS AT ONCE". In every two-exit room the exits
 * are on OPPOSITE sides of the opening axis, so any turn that brings one in
 * pushes the other further out. There is no delta that shows both, and a probe
 * that reported one would be wrong. One is the goal: a child needs to find A box,
 * not every box.
 */
import { Box3, PerspectiveCamera, Scene, Spherical, Vector3 } from 'three';
import gsap from 'gsap';
import { bundleEntry } from '../tests/framework/_tsload.mjs';

const M = await bundleEntry(
  'portraitOpenTurn',
  [
    `export { frameSeesPastWalls, orbitPositionsAt, resolveRotationRange } from '@app/utils/scene/rotationRange';`,
    `export { SCENE_CAMERA_FOV } from '@app/utils/cameraPresets';`,
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

/** The shipped opening poses, from `sceneCatalog.ts`. */
const POSE = {
  playroom: { polar: 0.9, d: 5.0, ty: 3.75, tz: -8.0 },
  kitchen: { polar: 0.86, d: 5.0, ty: 3.75, tz: -4.6 },
  'living-room': { polar: 0.84, d: 5.0, ty: 3.75, tz: -4.6 },
};
const CLAMP = 6.0;
const AZ = Math.PI;
/** Same reachability rule as `room-opening-framing` and `.probe/joint-solve`. */
const CENTRE_LIMIT = 0.85;
const AREA_LIMIT = 0.6;
/** How much clear frame a halo must keep around it to count as arrived. */
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
const seesCeiling = (pos, shell) => {
  const d4 = corners();
  for (const d of [d4[2], d4[3]]) {
    if (d.y <= 0) continue;
    const tC = (shell.ceilingY - pos.y) / d.y;
    const tB = d.z > 1e-6 ? (shell.backZ - pos.z) / d.z : Infinity;
    if (tC > 0 && tC < tB) return true;
  }
  return false;
};
const poseAt = (r, pivot, d, polar) => {
  const p = pivot.clone().add(new Vector3().setFromSpherical(new Spherical(d, polar, AZ + r)));
  if (p.y > CLAMP) p.y = CLAMP;
  return p;
};

const v = new Vector3();
/** The reachability rule, unchanged, so the numbers stay comparable. */
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

/** Is the whole halo disc inside the frame, with a margin? */
function haloInFrame(halo) {
  const c = v.copy(halo.centre).project(cam);
  if (c.z > 1) return false;
  const e = new Vector3().copy(halo.edge).project(cam);
  const rx = Math.abs(e.x - c.x);
  // The sprite is screen-facing, so its NDC height per unit differs from its
  // width by the aspect; deriving ry from rx keeps it exact at every aspect.
  const ry = rx * cam.aspect;
  return Math.abs(c.x) + rx <= 1 - HALO_MARGIN && Math.abs(c.y) + ry <= 1 - HALO_MARGIN;
}

const ASPECTS = [];
for (let a = 0.4; a <= 1.801; a += 0.05) ASPECTS.push(+a.toFixed(2));

for (const [id, build, L] of [
  ['playroom', M.buildPlayroomContents, M.PLAYROOM],
  ['living-room', M.buildLiving, M.LIVING],
  ['kitchen', M.buildKitchen, M.KITCHEN],
]) {
  const scene = new Scene();
  M.setSceneIdleAnimator(scene, M.createDisposalScope());
  const tap = [];
  const contents = build({
    scene,
    canvas: stubCanvas(),
    camera: new PerspectiveCamera(),
    dispatcher: {
      register: (t) => {
        tap.push(t);
        return noop;
      },
      registerWithPoint: (t) => {
        tap.push(t);
        return noop;
      },
      setMissHandler: noop,
      dispose: noop,
    },
    nav: { navigateTo: noop, launchMiniGame: noop, exitMiniGame: noop },
    owl: { flyTo: noop, setSurfaceYAt: noop, land: noop, group: { position: new Vector3() } },
  });
  scene.updateMatrixWorld(true);

  // The exits, and the halos that hang over the ones that go somewhere. The
  // halos are read off the scene rather than recomputed, so this probe cannot
  // disagree with `tapInvitation.ts` about where they are.
  const ground = contents.floorTargets?.[0];
  const seen = new Set();
  const exits = [];
  for (const t of tap) {
    if (t === ground || seen.has(t)) continue;
    seen.add(t);
    const b = new Box3().setFromObject(t);
    if (b.isEmpty()) continue;
    const name = t.name || '?';
    if (!name.startsWith('toybox_') && !name.includes('_doorway')) continue;
    const pts = [];
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(new Vector3(x, y, z));
    exits.push({ name, pts });
  }
  const halos = [];
  scene.traverse((o) => {
    if (!o.name.startsWith('tapInvitation_')) return;
    const centre = o.getWorldPosition(new Vector3());
    halos.push({ name: o.name.replace('tapInvitation_', ''), centre, radius: o.scale.x / 2 });
  });

  const shell = { wallX: L.LEFT_WALL_X, frontZ: L.BACK_WALL_CENTER_Z - L.ROOM_DEPTH, backZ: L.BACK_WALL_CENTER_Z, ceilingY: L.CEILING_Y, floorY: 0 };
  const c = POSE[id];
  const pivot = new Vector3(0, c.ty, c.tz);
  const orbit = { azimuth: AZ, pivot, radii: [c.d], polars: [Math.max(0.75, c.polar - 0.1), c.polar, Math.min(1.5, c.polar + 0.1)], ceilingClamp: CLAMP };
  const dirtyAt = (r, aspect) => {
    for (const pos of M.orbitPositionsAt(r, orbit)) {
      aim(pos, pivot, aspect);
      if (M.frameSeesPastWalls(pos, corners(), shell)) return true;
    }
    return false;
  };

  console.log(`\n=== ${id}   ${halos.length} halo(s): ${halos.map((h) => `${h.name} r${h.radius.toFixed(2)}`).join(', ')}`);
  console.log('aspect  budget    opening turn   halo it shows                 far exit   verdict');

  for (const aspect of ASPECTS) {
    const budget = M.resolveRotationRange(aspect, id);

    // The smallest turn, either way, that lands a whole halo in a clean frame.
    let best = null;
    for (const dir of [1, -1]) {
      for (let step = 0; step <= 200; step++) {
        const delta = dir * step * 0.004;
        if (Math.abs(delta) > budget) break;
        if (dirtyAt(Math.abs(delta), aspect)) break;
        const p = poseAt(delta, pivot, c.d, c.polar);
        aim(p, pivot, aspect);
        if (seesCeiling(p, shell)) continue;
        const shown = halos.filter((h) =>
          haloInFrame({
            centre: h.centre,
            edge: new Vector3().copy(h.centre).addScaledVector(new Vector3().setFromMatrixColumn(cam.matrixWorld, 0), h.radius),
          }),
        );
        if (shown.length === 0) continue;
        if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { delta, shown: shown.map((s) => s.name) };
        break;
      }
    }

    if (!best) {
      console.log(`  ${aspect.toFixed(2)}   \u00b1${((budget * 180) / Math.PI).toFixed(1)}\u00b0     NO TURN INSIDE THE BUDGET SHOWS A HALO`);
      continue;
    }

    // What the FAR side costs from the new opening pose. Not a feasibility test
    // any more -- the clamp did not move -- but the honest price of the turn.
    let farthest = 0;
    let unreachable = null;
    for (const ex of exits) {
      let bestR = Infinity;
      for (let r = -budget; r <= budget + 1e-9; r += budget / 120) {
        const p = poseAt(r, pivot, c.d, c.polar);
        aim(p, pivot, aspect);
        if (seesCeiling(p, shell)) continue;
        if (tappable(ex.pts)) bestR = Math.min(bestR, Math.abs(r - best.delta));
      }
      if (!Number.isFinite(bestR)) {
        unreachable = ex.name;
        break;
      }
      farthest = Math.max(farthest, bestR);
    }

    console.log(
      `  ${aspect.toFixed(2)}   \u00b1${((budget * 180) / Math.PI).toFixed(1)}\u00b0`.padEnd(18) +
        `${((best.delta * 180) / Math.PI).toFixed(1)}\u00b0`.padStart(8) +
        `   ${best.shown.join('+').padEnd(30)}` +
        `${((farthest * 180) / Math.PI).toFixed(1)}\u00b0`.padStart(8) +
        `   ${unreachable ? 'UNREACHABLE: ' + unreachable : Math.abs(best.delta) <= budget ? 'ok' : 'OUTSIDE THE CLAMP'}`,
    );
  }
  contents?.cleanup?.();
}
gsap.ticker.sleep();
process.exit(0);
