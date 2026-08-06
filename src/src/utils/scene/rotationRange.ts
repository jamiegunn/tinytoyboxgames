import { Spherical, Vector3 } from 'three';

/**
 * How far the player may turn a scene, and why that number is what it is.
 *
 * WHAT ROTATION ALREADY WAS
 * -------------------------
 * `createSceneCamera` has always supported turning the view — but on SHIFT+DRAG,
 * with the plain drag spent on panning, and clamped to a per-scene authored
 * `maxAzimuthRange`. On a tablet there is no shift key, so for the device this
 * app is actually played on, rotation did not exist. Panning has since been
 * removed outright and the plain drag now turns the room; this module is where
 * the limit on that turn comes from, derived rather than authored.
 *
 * THE LIMIT IS A PROPERTY OF THE SET, NOT A TASTE DECISION
 * --------------------------------------------------------
 * The three house rooms are built with THREE walls — back, left, right, and an
 * open front the camera looks in through. Turn far enough and the corner of the
 * frame sweeps past the end of a side wall and shows the void beyond, because
 * nothing is modelled out there.
 *
 * That angle is computable, and it is computed jointly with two other things it
 * cannot be separated from: the opening pose of each room, and the stage aspect
 * band in `stageRect.ts`. All three trade against each other —
 *
 *   - a TIGHTER pose shows the props larger and turns less, because the camera
 *     is nearer the walls;
 *   - a WIDER stage reaches further round before it passes a wall end, so it
 *     turns less too;
 *   - and a pose loose enough to turn a long way is one that frames props off
 *     the edge, which is how the previous framing shipped the way OUT of every
 *     room off-screen at the square end of the band.
 *
 * ROTATION IS NOW LOAD-BEARING, NOT A GARNISH
 * -------------------------------------------
 * It used to be that every way out of a room was on screen at rest and turning
 * was decoration. That is what forced the letterbox: keeping four toyboxes and a
 * doorway inside a frame at once needs a frame nearly as wide as it is tall, and
 * a phone is 0.46, so the scene was cropped to a square and the rest of the
 * screen was painted over. `.probe/narrow-binding.mjs` measured which of the
 * three constraints actually moves with aspect and the answer was: only that one.
 * The void limit and the ceiling limit are IDENTICAL at 0.40 and at 1.00 — the
 * field of view is vertical and fixed, so what escapes the shell vertically does
 * not care how wide the window is.
 *
 * So the requirement was relaxed from "on screen" to "reachable", and the turn
 * carries the difference. On a phone the frame is a tall slot that must swing
 * ±45° to sweep the room; on a desktop it takes the room in at once and turns
 * ±10°. Both are the same rule — turn as far as you must, and never as far as the
 * wall ends. See {@link ROTATION_BUDGET} for the measured schedule.
 *
 * ONE SHARED SCHEDULE, AND ONE SCENE THAT CANNOT TAKE IT
 * ------------------------------------------------------
 * Nature's ground plane would allow far more than any room's walls. Letting each
 * scene take its own maximum would mean the same drag turns the forest a long
 * way and the nursery barely at all — the control would feel broken rather than
 * generous, and a child cannot be told why. So the schedule is shared and set by
 * the tightest ROOM at each aspect.
 *
 * Pirate Cove does not fit under it, and the reason is worth writing down because
 * it is the same shape of problem as the one that made this a schedule at all.
 * The rooms NEED ±33.4° at aspect 0.40 to bring their toyboxes within reach.
 * `tests/room/pirate-cove-hull.test.mjs` measures the ship's two side rails
 * converging on screen — a hull whose rails read near-horizontal is a fence, not
 * a ship, and the version that shipped before that guard measured 4.8°. At ±45°
 * of turn the rails fall to 7.1°; at ±31.5° they hold. So the rooms' floor and
 * the ship's ceiling are 33.4° and about 35°, and no single number has margin in
 * between.
 *
 * One number could not serve a narrow frame and a wide one, so it became a
 * function of aspect. It cannot serve a room and a ship either, so
 * {@link SCENE_TURN_CEILING} caps it per scene — DERIVED from that guard's own
 * measurement, not authored. This is deliberately not a `constraints` field on
 * the catalog: per-scene authored azimuth data is exactly what was removed when
 * the Playroom was found carrying a third more rotation than its walls allow,
 * and `rotation-range.test.mjs` still fails if it comes back.
 *
 * WHAT REMOVING PANNING BOUGHT
 * ----------------------------
 * Rotation used to orbit the PANNED target, so the reachable set was the product
 * of how far the player had dragged aside and how far they had turned. Measured
 * that way the Playroom afforded ±10.7° — and it was authored at ±14.3°, so it
 * was shipping a third more rotation than its own walls could take. Panning is
 * gone and the pivot is the room centre, which is what makes the numbers above
 * reachable at all.
 */

/**
 * The three-walled box a room is built as.
 *
 * Back wall, two side walls, floor and ceiling — and an OPEN FRONT the camera
 * looks in through. There is no fourth wall, which is the whole reason rotation
 * has a limit at all.
 */
export interface RoomShell {
  /** Absolute x of the side wall inner faces. */
  wallX: number;
  /** World z of the open front edge. */
  frontZ: number;
  /** World z of the back wall inner face. */
  backZ: number;
  /** World y of the ceiling. */
  ceilingY: number;
  /** World y of the floor. */
  floorY: number;
}

/**
 * Does this ray fail to land on any surface of the room?
 *
 * THE RULE, and it took two wrong versions to get here.
 *
 * The first asked whether the CAMERA was outboard of a side wall. That misses
 * the actual complaint: a camera safely between the walls can still be pointed
 * so the corner of the frame sweeps past the end of one and shows the void.
 *
 * The second asked whether a ray left a box the camera was assumed to be inside.
 * That was worse — on narrow viewports the portrait pull-back moves the camera
 * BACK OUT THROUGH THE OPENING, so it stands in front of the room looking in,
 * which is completely normal and which that rule called a failure at every
 * scene. It reported a rotation limit of zero everywhere.
 *
 * What is actually being asked does not care where the camera is. A ray is fine
 * if it ends on something the set contains — the back wall, a side wall, the
 * floor, the ceiling. It is a problem if it ends on nothing, either by missing
 * the room altogether or by passing out through the open front. So: intersect
 * the ray with the room's box, and look at which face it LEAVES by.
 *
 * @param origin - Ray origin, inside the room or in front of it.
 * @param direction - Normalised ray direction.
 * @param shell - The room's box.
 * @returns True when the ray shows the child something that is not there.
 */
export function rayMissesTheRoom(origin: Vector3, direction: Vector3, shell: RoomShell): boolean {
  // Slab intersection. `enter` is where the ray meets the box, `exit` where it
  // leaves; `exitAxis` records which slab decided the exit.
  let enter = -Infinity;
  let exit = Infinity;
  let exitAxis = -1;

  const slab = (o: number, d: number, lo: number, hi: number, axis: number): boolean => {
    if (Math.abs(d) < 1e-9) return o >= lo && o <= hi;
    let t0 = (lo - o) / d;
    let t1 = (hi - o) / d;
    if (t0 > t1) [t0, t1] = [t1, t0];
    if (t0 > enter) enter = t0;
    if (t1 < exit) {
      exit = t1;
      exitAxis = axis;
    }
    return true;
  };

  if (!slab(origin.x, direction.x, -shell.wallX, shell.wallX, 0)) return true;
  if (!slab(origin.y, direction.y, shell.floorY, shell.ceilingY, 1)) return true;
  if (!slab(origin.z, direction.z, shell.frontZ, shell.backZ, 2)) return true;

  // Never meets the box, or only behind the camera: it shows nothing at all.
  if (enter > exit || exit < 0) return true;

  // Leaves through the open front. Everything else is a surface.
  return exitAxis === 2 && direction.z < 0;
}

/**
 * Does any corner of this frame show the child something that is not there?
 *
 * Corners only. The frame is a rectangle and the room is convex, so a region
 * that escapes has to reach a corner of the frame before anything a midpoint
 * sample would catch that a corner would not.
 *
 * @param position - World camera position.
 * @param cornerDirections - The four frustum corner directions, normalised.
 * @param shell - The room's box.
 * @returns True when the child can see out of the room.
 */
export function frameSeesPastWalls(position: Vector3, cornerDirections: readonly Vector3[], shell: RoomShell): boolean {
  return cornerDirections.some((direction) => rayMissesTheRoom(position, direction, shell));
}

/**
 * Every camera pose an orbit reaches at a given azimuth offset.
 *
 * THE PIVOT IS FIXED, AND THAT IS THE POINT. Rotation used to orbit the PANNED
 * target, so the reachable set was the product of "how far the player has panned
 * aside" and "how far they have turned" — and the binding case was always both
 * at once. Measured that way the Playroom could only afford ±10.7°.
 *
 * Turning a room means turning it about the middle of the room, which is also
 * how a person describes it. With the pivot fixed at the scene's authored centre
 * that product disappears, the worst case goes with it, and the honest limit is
 * several times larger.
 *
 * Both extremes only: a clamp is symmetric and the failure is always at one end
 * of it, so sampling the middle costs time and finds nothing.
 *
 * @param range - Azimuth offset from the scene's base heading, in radians.
 * @param orbit - Fixed pivot, orbit radii and tilts to sweep.
 * @returns Camera positions at both extremes of the range.
 */
export function orbitPositionsAt(range: number, orbit: OrbitEnvelope): Vector3[] {
  const out: Vector3[] = [];
  for (const radius of orbit.radii) {
    for (const polar of orbit.polars) {
      for (const sign of [-1, 1]) {
        const position = orbit.pivot.clone().add(new Vector3().setFromSpherical(new Spherical(radius, polar, orbit.azimuth + sign * range)));
        // The app's own ceiling clamp, and it is not cosmetic: the portrait
        // pull-back lifts the Playroom camera to y 10.3 against a 6.75 ceiling,
        // and without this the measurement sees the top corners sail over the
        // back wall and calls every room unrotatable. `createSceneCamera` clamps
        // exactly here, after the spherical and before the look-at.
        if (position.y > orbit.ceilingClamp) position.y = orbit.ceilingClamp;
        out.push(position);
      }
    }
  }
  return out;
}

/** The spread of camera poses a player can reach, independent of azimuth. */
export interface OrbitEnvelope {
  /** The scene's base heading, in the native three.js Spherical convention. */
  azimuth: number;
  /** The room centre the view turns about. Fixed — see `orbitPositionsAt`. */
  pivot: Vector3;
  /** Orbit radii to sweep — one per shipping aspect, since pull-back varies. */
  radii: readonly number[];
  /** Tilts to sweep, from the scene's polar constraints. */
  polars: readonly number[];
  /** The camera height ceiling `createSceneCamera` applies. */
  ceilingClamp: number;
}

/**
 * The largest azimuth range at which no reachable frame shows the void.
 *
 * Bisection rather than algebra: the envelope is a product of radii and tilts,
 * and the binding combination is not the same one in every room. Solving it in
 * closed form would be a second model of the camera that could disagree with the
 * first.
 *
 * @param shell - The room's box.
 * @param orbit - The reachable pose envelope.
 * @param cornersAt - Frustum corner directions for a camera at a given position.
 * @param ceiling - Largest range to consider, in radians.
 * @returns The largest safe range, in radians. Zero if even a still camera sees out.
 */
export function largestSafeRotation(
  shell: RoomShell,
  orbit: OrbitEnvelope,
  cornersAt: (position: Vector3, pivot: Vector3) => Vector3[],
  ceiling = Math.PI / 2,
): number {
  const safe = (range: number): boolean =>
    orbitPositionsAt(range, orbit).every((position) => !frameSeesPastWalls(position, cornersAt(position, orbit.pivot), shell));

  if (!safe(0)) return 0;

  let lo = 0;
  let hi = ceiling;
  // 24 halvings of pi/2 resolves to well under a hundredth of a degree, which is
  // far finer than any constant this feeds.
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (safe(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * How far the player may turn, at each aspect the stage can be. Radians either
 * side of the scene's own heading.
 *
 * TWO MEASURED BOUNDS, AND THE BUDGET SITS BETWEEN THEM. At each aspect
 * `.probe/turn-schedule.mjs` measures, against the shipped poses:
 *
 *   NEED — the smallest turn that brings every way out of every room within
 *          reach, taking "within reach" to be what tapping actually requires:
 *          the prop's middle inside 0.85 NDC with at least 60% of it on screen.
 *   SAFE — the largest turn before a frame corner of any room passes the end of
 *          a side wall and shows the void beyond it.
 *
 * Turn less than NEED and a toybox is unreachable — a child cannot get out of
 * the room. Turn more than SAFE and they see nothing where the world should be.
 *
 *     aspect   need    safe    shipped
 *      0.40   ±33.4°  ±80.2°   ±45.3°   <- tightest, 1.35x clear of need
 *      0.70   ±16.5°  ±72.0°   ±25.2°
 *      1.00    ±6.7°  ±44.7°   ±12.6°
 *      1.60    ±0.0°  ±26.8°   ±10.3°
 *      2.60    ±0.0°   ±9.8°    ±5.2°
 *
 * NOT THE MIDPOINT, WHICH THE FIRST VERSION OF THIS USED. Halfway between 0 and
 * ±80° is ±40° of free spin on a wide screen that needs none of it, and a room
 * seen from 40° off its own axis is a room with a wall across the frame. What
 * the schedule actually is: a third again as much turn as the narrow end NEEDS,
 * easing to about ±10° at the aspects where nothing needs any — near the ±10.3°
 * that shipped before, so a laptop feels the same as it did. Swept at 0.02 the
 * interpolated curve clears NEED by at least 1.35x and stays under SAFE by at
 * least 1.77x.
 *
 * WHY IT IS A FUNCTION OF ASPECT AT ALL, WHEN IT USED TO BE ONE NUMBER. The
 * camera's field of view is vertical and fixed, so a narrower viewport does not
 * see less height — it sees less WIDTH. Both halves of this move with that, in
 * the same direction: a narrow frame has further to turn before it reaches the
 * exits, and further it may turn before it reaches a wall end. A single constant
 * has to satisfy the narrowest frame's NEED and the widest frame's SAFE at once,
 * and those two do not overlap. `SHARED_ROTATION_RANGE = 0.18` satisfied them by
 * never letting the frame get narrow — which is what the letterbox in
 * `stageRect.ts` was for, and what it cost.
 *
 * `tests/room/rotation-range.test.mjs` re-measures both bounds across the whole
 * stage band and fails if the interpolated budget leaves the interval anywhere,
 * so a pinned entry cannot drift and interpolation cannot step over a dip
 * between two of them.
 */
export const ROTATION_BUDGET: readonly (readonly [aspect: number, range: number])[] = [
  [0.4, 0.79],
  [0.5, 0.66],
  [0.6, 0.55],
  [0.7, 0.44],
  [0.8, 0.34],
  [0.9, 0.26],
  [1.0, 0.22],
  [1.2, 0.2],
  [1.4, 0.19],
  [1.6, 0.18],
  [1.8, 0.17],
  [2.0, 0.15],
  [2.2, 0.13],
  [2.4, 0.11],
  [2.6, 0.09],
];
/**
 * Scenes whose own geometry cannot take the shared schedule, and what they can.
 *
 * MEASURED, NOT CHOSEN, and by a guard that already existed. Sweeping a flat turn
 * through `tests/room/pirate-cove-hull.test.mjs`, the worst rail convergence
 * anywhere in Pirate Cove's reachable envelope is 10.0° at ±35.5° of turn — the
 * bound that guard holds — and it still clears it comfortably at ±31.5°. This is
 * ±28.6°, under both, and it binds only at the narrow end: from aspect 1.05
 * outward the shared schedule is already tighter than this and the cap does
 * nothing.
 *
 * ADMISSIONS, NOT PERMISSIONS. A scene is on the shared schedule until something
 * measures that it cannot be.
 */
export const SCENE_TURN_CEILING: Readonly<Record<string, number>> = {
  'pirate-cove': 0.5,
};

/**
 * Applies a scene's own ceiling to a scheduled range, if it has one.
 *
 * @param range - The shared schedule's answer at this aspect, in radians.
 * @param sceneId - Scene being turned, or undefined to skip the cap.
 * @returns The smaller of the two, in radians.
 */
const capped = (range: number, sceneId?: string): number => {
  const ceiling = sceneId === undefined ? undefined : SCENE_TURN_CEILING[sceneId];
  return ceiling === undefined ? range : Math.min(range, ceiling);
};

/**
 * The azimuth range at a viewport aspect.
 *
 * Linear between the pinned entries of {@link ROTATION_BUDGET} and flat outside
 * them. Flat rather than extrapolated because outside the band the stage is
 * letterboxed to the nearest edge of it, so the camera never receives an aspect
 * out here — and a linear extrapolation of the last two entries crosses zero at
 * 3.7, which would silently lock rotation rather than fail.
 *
 * @param aspect - Viewport aspect ratio (width / height).
 * @param sceneId - Scene being turned, for the {@link SCENE_TURN_CEILING} cap.
 * @returns The permitted offset either side of the scene's base heading, in radians.
 */
export function resolveRotationRange(aspect: number, sceneId?: string): number {
  const first = ROTATION_BUDGET[0];
  const last = ROTATION_BUDGET[ROTATION_BUDGET.length - 1];
  // AN ASPECT THAT IS NOT A NUMBER GETS THE TIGHTEST BUDGET, NOT THE WIDEST.
  // This is the fail-safe direction and it is not hypothetical: three test files
  // reproduce the camera envelope and all three called this with no argument at
  // all while it still took none. They carried on compiling — they are .mjs — and
  // silently applied the narrow-phone budget of ±45° to a 1.78 landscape frame,
  // which is how `pirate-cove-hull` came to report its side rails converging at
  // 7.1° when the pose it actually ships reads at 30.9°. Too little turn is a
  // control that feels stiff; too much is a child looking at nothing.
  if (!Number.isFinite(aspect)) return capped(last[1], sceneId);
  if (aspect <= first[0]) return capped(first[1], sceneId);
  if (aspect >= last[0]) return capped(last[1], sceneId);
  for (let i = 1; i < ROTATION_BUDGET.length; i++) {
    const [aHi, rHi] = ROTATION_BUDGET[i];
    if (aspect > aHi) continue;
    const [aLo, rLo] = ROTATION_BUDGET[i - 1];
    return capped(rLo + ((rHi - rLo) * (aspect - aLo)) / (aHi - aLo), sceneId);
  }
  return capped(last[1], sceneId);
}

/**
 * Clamps a heading to a scene's permitted arc.
 *
 * @param theta - Proposed heading, in radians.
 * @param baseAzimuth - The scene's authored heading.
 * @param range - Permitted offset either side.
 * @returns The clamped heading.
 */
export function clampAzimuth(theta: number, baseAzimuth: number, range: number): number {
  return Math.min(Math.max(theta, baseAzimuth - range), baseAzimuth + range);
}
