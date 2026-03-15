import { BOUNDS } from './types';
import { clamp } from './helpers';

/**
 * Proximity-based continuous fish spawner.
 *
 * Guarantees at least MIN_NEARBY_FISH active fish within camera view of the
 * shark at all times (except briefly after an eat, when a replenish timer
 * runs). When a fish is eaten, 3-4 replacements spawn after a short delay.
 */

/** How far from the shark a fish counts as "nearby" (roughly camera extent). */
const CAMERA_VIEW_RADIUS = 15;

/** Fish spawn from this distance off-screen relative to the shark. */
const SPAWN_DISTANCE = 18;

/** Minimum nearby fish to maintain. */
const MIN_NEARBY_FISH = 2;

/** Delay in seconds before replacement fish appear after an eat. */
const REPLENISH_DELAY = 2.0;

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

  // Drift target: 4-8 units from shark in a random direction
  const tAngle = Math.random() * Math.PI * 2;
  const tDist = 4 + Math.random() * 4;
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
 */
export function updateProximitySpawning(state: ProximitySpawnState, dt: number, sharkX: number, sharkZ: number, callbacks: SpawnCallbacks): void {
  const nearbyCount = callbacks.countNearbyFish();

  if (state.replenishTimer > 0) {
    // Post-eat grace period — don't force-fill the minimum
    state.replenishTimer -= dt;
    if (state.replenishTimer <= 0) {
      for (let i = 0; i < state.replenishCount; i++) {
        spawnNearShark(sharkX, sharkZ, callbacks.spawnFish);
      }
      state.replenishCount = 0;
      state.replenishTimer = -1;
    }
  } else {
    // No replenish pending — guarantee minimum nearby
    if (nearbyCount < MIN_NEARBY_FISH) {
      const deficit = MIN_NEARBY_FISH - nearbyCount;
      for (let i = 0; i < deficit; i++) {
        spawnNearShark(sharkX, sharkZ, callbacks.spawnFish);
      }
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
