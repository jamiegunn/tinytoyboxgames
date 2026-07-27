/**
 * Spawn scheduling and difficulty scaling for Cannonball Splash.
 */

import { Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import type { DifficultyThresholds } from '../../../framework/types';
import { C, type Target, type TargetKind } from '../types';
import { getSpawnCapacity, getSpawnInterval, playHalfWidthAt, randomRange, selectTargetKind, randomDriftVector } from '../helpers';

// Rejection-sampling budget for pickSpawnPosition.
const SPAWN_ATTEMPTS = 12;

// Distance from (x, z) to the nearest existing target, on the water plane.
function separationFrom(x: number, z: number, targets: Target[]): number {
  let nearest = Infinity;
  for (const t of targets) {
    if (t.state === 'hit' || t.state === 'drifted-off') continue;
    const dx = t.root.position.x - x;
    const dz = t.root.position.z - z;
    nearest = Math.min(nearest, Math.sqrt(dx * dx + dz * dz));
  }
  return nearest;
}

/**
 * Picks a spawn position anywhere inside the visible play trapezoid.
 *
 * Targets used to spawn only at |x| = 9 with z ∈ [-16, -4]. At the shipped
 * camera the visible half-width at the water plane is 5.53 units at z = -4 and
 * 8.58 at z = -8, so a spawn at |x| = 9 is *off the side of the screen* for the
 * whole near half of that range, and with a drift speed of 0.3 units/s at
 * difficulty 0 it takes 25-30 seconds to walk into view. A headless probe of the
 * first four seconds reproduced the eval exactly — three barrels at x = 7.9,
 * 7.9, 8.7, all outside the frame, and 0 of 24 grid taps scoring.
 *
 * Rejection sampling keeps the spread even without letting two targets land on
 * top of each other; after SPAWN_ATTEMPTS tries the best candidate so far wins,
 * so this always terminates.
 * @param camera - The live game camera, used to derive the trapezoid.
 * @param targets - Targets already in play, kept at arm's length.
 * @returns The world-space spawn position and which half it landed in.
 */
export function pickSpawnPosition(camera: PerspectiveCamera, targets: Target[]): { position: Vector3; side: 'left' | 'right' } {
  const best = new Vector3();
  let bestSeparation = -Infinity;

  for (let attempt = 0; attempt < SPAWN_ATTEMPTS; attempt++) {
    const z = randomRange(C.PLAY_Z_MIN, C.PLAY_Z_MAX);
    const halfWidth = playHalfWidthAt(camera, z);
    const x = randomRange(-halfWidth, halfWidth);
    const separation = separationFrom(x, z, targets);

    if (separation > bestSeparation) {
      bestSeparation = separation;
      best.set(x, 0, z);
    }
    if (separation >= C.SPAWN_MIN_SEPARATION) break;
  }

  return { position: best, side: best.x < 0 ? 'left' : 'right' };
}

/**
 * Determines whether a special target may be spawned.
 *
 * The unlock used to be a local GOLDEN_UNLOCK constant of 150 points, which had
 * drifted out of step with the manifest's specialItemScore of 180 — two numbers
 * claiming to be the same rule. The framework derives this flag from the
 * manifest, so the manifest is the single source of truth.
 * @param thresholds - The difficulty controller's current thresholds.
 * @returns True once specials are unlocked (timing is handled by the scheduler).
 */
export function shouldSpawnSpecial(thresholds: DifficultyThresholds): boolean {
  return thresholds.specialItemsUnlocked;
}

/**
 * Selects a special target kind based on difficulty.
 * @param difficulty - Normalized difficulty in [0, 1].
 * @returns 'golden-barrel' below 0.5 difficulty, otherwise a coin flip with 'rainbow-bottle'.
 */
export function selectSpecialKind(difficulty: number): TargetKind {
  if (difficulty < 0.5) return 'golden-barrel';
  return Math.random() < 0.5 ? 'golden-barrel' : 'rainbow-bottle';
}

/**
 * Coarse spawn band for scheduler re-registration.
 * @param difficulty - Normalized difficulty in [0, 1].
 * @returns Band index 0-4 (higher difficulty maps to a higher band).
 */
export function getSpawnBand(difficulty: number): number {
  if (difficulty >= 0.8) return 4;
  if (difficulty >= 0.6) return 3;
  if (difficulty >= 0.4) return 2;
  if (difficulty >= 0.2) return 1;
  return 0;
}

export { getSpawnCapacity, getSpawnInterval, selectTargetKind, randomDriftVector };
