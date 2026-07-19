/**
 * Spawn scheduling and difficulty scaling for Cannonball Splash.
 */

import { Vector3 } from 'three';
import { C, type TargetKind } from '../types';
import { getSpawnCapacity, getSpawnInterval, randomRange, selectTargetKind, randomDriftVector } from '../helpers';

/**
 * Picks a spawn position (left or right edge) and a random z depth.
 * @returns The world-space spawn position and which edge it is on.
 */
export function pickSpawnPosition(): { position: Vector3; side: 'left' | 'right' } {
  const side = Math.random() < 0.5 ? 'left' : 'right';
  const x = side === 'left' ? -C.SPAWN_X_EDGE : C.SPAWN_X_EDGE;
  const z = randomRange(C.SPAWN_Z_NEAR, C.SPAWN_Z_FAR);
  return {
    position: new Vector3(x, -0.3, z),
    side,
  };
}

/**
 * Determines whether a special target should be spawned.
 * @param difficulty - Normalized difficulty in [0, 1].
 * @returns True once difficulty reaches 0.3 (timing is handled by the scheduler).
 */
export function shouldSpawnSpecial(difficulty: number): boolean {
  if (difficulty < 0.3) return false;
  return true; // The special spawn scheduler handles timing
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
