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
 * `.probe/room-pose-final.mjs` solves all three at once. With the stage band at
 * 1.0–1.4 and every tappable prop required to be fully in frame:
 *
 *                   at stage 1.00   at 1.33   at 1.40
 *     playroom          ±26.4°       ±26.4°    ±26.4°
 *     kitchen           ±19.0°       ±12.8°    ±12.1°   <- binds
 *     living-room       ±19.0°       ±12.8°    ±12.1°
 *     nature        bounded by the ground plane, not by walls
 *     pirate-cove   bounded by the OCEAN, not by the deck
 *
 * READ THE ROW, NOT THE FIRST CELL. The Kitchen affords more than twice as much
 * turn at the square end of the stage band as it does at the wide end, which is
 * why this is measured per aspect in the guard rather than once per room: a
 * limit taken at the opening aspect alone would ship more than double what a
 * desktop window can take.
 *     nature        bounded by the ground plane, not by walls
 *     pirate-cove   bounded by the OCEAN, not by the deck
 *
 * The two shortened rooms share a limit because they now share a pose: their
 * shells are identical (10.8 x 15 x 6.2) and, once the Living Room's toyboxes
 * came off the side walls, neither has a prop that forces a wider frame than the
 * other. The Living Room used to bind alone and at ±12.0° — those two toyboxes
 * had to be contained, so the frame had to contain the walls themselves.
 *
 * Note which direction shortening moved this: the rooms went from 20 deep to 15
 * and their limit BARELY changed, because the camera came forward with the front
 * wall. A shorter room is not a more turnable one.
 *
 * WHY ONE SHARED RANGE
 * --------------------
 * Nature's ground plane would allow far more than any room's walls. Letting each
 * scene take its own maximum would mean the same drag turns the forest a long
 * way and the nursery barely at all — the control would feel broken rather than
 * generous, and a child cannot be told why. One number, set by the tightest set.
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
 * How far the player may turn any scene, in radians. About ±10.3°.
 *
 * Set from the measurement in this file's header, not chosen: the tightest case
 * is the Kitchen at the wide end of the stage band, ±12.1°, and this sits 15%
 * inside that so a small change
 * — a wall moved, a preset re-tilted, a prop nudged toward a wall — does not
 * silently start showing the void.
 *
 * `tests/room/rotation-range.test.mjs` recomputes every scene's limit from its
 * own geometry and fails if this exceeds any of them, and
 * `tests/room/room-opening-framing.test.mjs` checks the other half of the same
 * trade — that turning this far never puts a prop off the edge. The margin is
 * checked rather than asserted.
 */
export const SHARED_ROTATION_RANGE = 0.18;

/**
 * The azimuth range for a scene.
 *
 * A function rather than a bare constant because the shape of this decision is
 * per-scene even though the answer currently is not, and because a caller asking
 * "how far may THIS scene turn" is the question worth being able to change the
 * answer to later — when the Playroom grows a fourth wall, this is the one place
 * that has to know.
 *
 * @returns The permitted offset either side of the scene's base heading, in radians.
 */
export function resolveRotationRange(): number {
  return SHARED_ROTATION_RANGE;
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
