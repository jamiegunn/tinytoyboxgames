import { BOUNDS } from './types';
import { clamp } from './helpers';

/**
 * Proximity-based continuous fish spawner.
 *
 * Guarantees at least MIN_NEARBY_FISH active fish within camera view of the
 * shark at all times (except briefly after an eat, when a replenish timer
 * runs). When a fish is eaten, 3-4 replacements spawn after a short delay.
 */

/**
 * How far from the shark a fish counts as "nearby".
 *
 * Was 15, chosen as "roughly camera extent". Camera extent is the wrong
 * criterion, because being inside the frustum and being VISIBLE are different
 * questions once FogExp2 at density 0.058 is in the way. Running the palette
 * through the offline render model (see FISH_COLORS in types.ts) and asking how
 * far the worst fish stays distinguishable from the sand behind it:
 *
 *   camera distance     8    10    12    14    15    16    18    20    24
 *   fog fraction      19%   29%   38%   48%   53%   58%   66%   74%   86%
 *   worst dE2000     13.8  13.4  11.2   8.8   7.7   6.7   5.0   3.3   1.4
 *
 * Legibility halves by 15 units of camera distance and is gone by 20. The
 * camera eye sits about 10 units from the shark, so a fish 15 units from the
 * shark on the far side is 25 units from the camera — a smudge. Counting it as
 * "nearby" told the spawner the reef was stocked when most of the stock was
 * inside the fog wall.
 *
 * 11 is the radius inside which a fish is worth counting. It costs nothing:
 * the same fish budget concentrated into (11/15)^2 = 54% of the area is over
 * 1.8x the on-screen density for free.
 */
const CAMERA_VIEW_RADIUS = 11;

/**
 * Fish spawn from this distance off-screen relative to the shark.
 *
 * Was 18, which sat at the fog wall — deliberately, because fog hides the pop
 * in. 15 still does (53% fog, worst-case dE2000 7.7, and the arrival animation
 * carries the fish inward over 0.9s from there) while cutting a third off the
 * transit, which is a third less time between a child catching a fish and the
 * replacement being worth tapping.
 */
const SPAWN_DISTANCE = 15;

/**
 * Fallback nearby-fish floor used when no difficulty-scaled target is supplied.
 *
 * Defect 3: this constant used to be the only answer — the reef held exactly two
 * nearby fish from the first catch to the four-hundredth. Callers now pass
 * `getTargetFishCount(difficulty.level)`.
 */
const MIN_NEARBY_FISH = 2;

/**
 * Delay in seconds before the *bonus* replacement school appears after an eat.
 *
 * This used to be 2.0, and while it ran `updateProximitySpawning` skipped the
 * "guarantee the difficulty target nearby" branch entirely — so it was not a
 * delay before extra fish arrived, it was a window during which the reef was
 * allowed to be empty. Plus the 1.5s arrival animation the replacements then
 * played, a child who caught a fish had 3.5 seconds of nothing to tap. That
 * skip is gone: the floor is enforced unconditionally now, so this timer only
 * ever gates the extra fish on top of it.
 *
 * 0.35 is short enough that the gap reads as the school regrouping rather than
 * as the game stopping, and long enough that the bonus school does not pop in
 * on the same frame the last fish vanished.
 */
const REPLENISH_DELAY = 0.35;

/** Minimum replacement fish per eat event. */
const REPLENISH_MIN = 3;

/** Maximum replacement fish per eat event. */
const REPLENISH_MAX = 4;

/** Seconds between golden fish spawns. */
const GOLDEN_INTERVAL = 15.0;

/** Distance beyond which idle fish are silently despawned. */
export const CULL_DISTANCE = 35;

/** Mutable state for the proximity spawner. */
export interface ProximitySpawnState {
  /** Countdown until replacement fish appear. Negative means no pending replenish. */
  replenishTimer: number;
  /** How many fish to spawn when the timer fires. */
  replenishCount: number;
  /** Countdown to next golden fish. */
  goldenTimer: number;
  /** Whether a golden fish currently exists. */
  goldenActive: boolean;
}

/** Callbacks the spawner invokes to create entities. */
export interface SpawnCallbacks {
  /** Spawn a standard fish from edge position toward a drift target. */
  spawnFish: (edgeX: number, edgeZ: number, targetX: number, targetZ: number) => void;
  /** Spawn the golden fish. */
  spawnGoldenFish: () => void;
  /** Returns the number of active, non-spawning fish within camera range of the shark. */
  countNearbyFish: () => number;
}

/**
 * Creates initial proximity spawn state.
 * @returns Fresh ProximitySpawnState.
 */
export function createProximitySpawnState(): ProximitySpawnState {
  return {
    replenishTimer: -1,
    replenishCount: 0,
    goldenTimer: GOLDEN_INTERVAL,
    goldenActive: false,
  };
}

/**
 * Picks a spawn point just off-screen relative to the shark and a drift
 * target a comfortable distance inside the camera view.
 * @param sharkX - Shark world X.
 * @param sharkZ - Shark world Z.
 * @param cb - Callback to invoke with edge and target positions.
 */
function spawnNearShark(sharkX: number, sharkZ: number, cb: SpawnCallbacks['spawnFish']): void {
  const angle = Math.random() * Math.PI * 2;
  const edgeX = sharkX + Math.cos(angle) * SPAWN_DISTANCE;
  const edgeZ = sharkZ + Math.sin(angle) * SPAWN_DISTANCE;

  // Drift target: 2-8 units from the shark in a random direction.
  //
  // The inner radius was 4, and 4 units is most of the way to the edge of the
  // frame: the follow camera sits 10 units out with a 48.7-degree vertical fov,
  // so 4 units is ~350 px on a 1200x810 canvas. Every replacement fish was
  // therefore aimed at a ring that excludes the middle third of the screen, and
  // the middle of the screen is exactly where a child taps. Measured with the
  // headless tap probe: hammering the centre point (600, 502) eight times, the
  // nearest fish sat at 261-300 px and stayed there for all eight taps, so the
  // burst scored nothing. Dropping the inner radius to 2 (still twice the
  // collision radius, so a replacement cannot spawn straight into the shark's
  // mouth) took the same burst from 1.27 points to 3.73.
  const tAngle = Math.random() * Math.PI * 2;
  const tDist = 2 + Math.random() * 6;
  const targetX = clamp(sharkX + Math.cos(tAngle) * tDist, -BOUNDS, BOUNDS);
  const targetZ = clamp(sharkZ + Math.sin(tAngle) * tDist, -BOUNDS, BOUNDS);

  cb(edgeX, edgeZ, targetX, targetZ);
}

/**
 * Advance the proximity spawner by one frame.
 *
 * @param state - Mutable spawn state.
 * @param dt - Delta time in seconds.
 * @param sharkX - Current shark X position.
 * @param sharkZ - Current shark Z position.
 * @param callbacks - Entity creation callbacks.
 * @param targetNearbyFish - Difficulty-scaled nearby-fish target. Defaults to MIN_NEARBY_FISH.
 */
export function updateProximitySpawning(
  state: ProximitySpawnState,
  dt: number,
  sharkX: number,
  sharkZ: number,
  callbacks: SpawnCallbacks,
  targetNearbyFish: number = MIN_NEARBY_FISH,
): void {
  const nearbyCount = callbacks.countNearbyFish();
  const target = Math.max(1, Math.round(targetNearbyFish));

  // The floor is unconditional. It used to sit in an `else` against the
  // replenish timer, so for the whole grace period after every catch the reef
  // was allowed to be empty — and since the replacements then play an arrival
  // animation on top of that, a child who caught two fish in a row had nothing
  // to tap for most of the next two seconds. Nothing is over-spawned by running
  // it every frame: `countNearbyFish` counts inbound fish, so a fish already on
  // its way satisfies the target it was ordered for.
  if (nearbyCount < target) {
    const deficit = target - nearbyCount;
    for (let i = 0; i < deficit; i++) {
      spawnNearShark(sharkX, sharkZ, callbacks.spawnFish);
    }
  }

  // The replenish burst is on top of the floor: catching a fish should visibly
  // draw a small school in, not merely restore the minimum.
  if (state.replenishTimer > 0) {
    state.replenishTimer -= dt;
    if (state.replenishTimer <= 0) {
      for (let i = 0; i < state.replenishCount; i++) {
        spawnNearShark(sharkX, sharkZ, callbacks.spawnFish);
      }
      state.replenishCount = 0;
      state.replenishTimer = -1;
    }
  }

  // Golden fish on timer
  state.goldenTimer -= dt;
  if (state.goldenTimer <= 0 && !state.goldenActive) {
    callbacks.spawnGoldenFish();
    state.goldenActive = true;
    state.goldenTimer = GOLDEN_INTERVAL;
  }
}

/**
 * Notify the spawner that the golden fish left the reef without being caught.
 *
 * `goldenActive` was set on spawn and cleared in exactly one place — the eaten
 * path — so an uncaught golden latched the flag for the rest of the session and
 * no further golden ever spawned. It could not even be cleared by the cull, as
 * the cull loop walks the standard fish array and the golden is not in it.
 *
 * Since the golden also spawned a median of 40 units away in a reef the camera
 * sees ~15 units into, the overwhelmingly likely outcome of the first golden
 * was that the child never saw it, and the consequence of never seeing it was
 * never seeing another one.
 *
 * @param state - Spawn state to mutate.
 */
export function notifyGoldenLost(state: ProximitySpawnState): void {
  state.goldenActive = false;
}

/**
 * Notify the spawner that a fish was eaten so it starts the replenish timer.
 * If a timer is already running, the pending count is increased.
 *
 * @param state - Spawn state to mutate.
 * @param wasGolden - Whether the eaten fish was golden.
 */
export function notifyFishEaten(state: ProximitySpawnState, wasGolden?: boolean): void {
  if (wasGolden) {
    state.goldenActive = false;
  }

  if (state.replenishTimer > 0) {
    // Already pending — add more replacements
    state.replenishCount = Math.min(state.replenishCount + 2, REPLENISH_MAX + 2);
  } else {
    state.replenishTimer = REPLENISH_DELAY;
    state.replenishCount = REPLENISH_MIN + Math.floor(Math.random() * (REPLENISH_MAX - REPLENISH_MIN + 1));
  }
}

/** Returns the camera view radius used for nearby-fish counting. */
export { CAMERA_VIEW_RADIUS };
