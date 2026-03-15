import { randomRange, clamp, wrapAngle } from '@app/minigames/shared/mathUtils';
import { BOUNDS, MIN_FISH_COUNT, MAX_FISH_COUNT, MIN_SPEED_MULTIPLIER, MAX_SPEED_MULTIPLIER } from './types';

export { randomRange, clamp, wrapAngle };

/**
 * Returns a random position on the XZ plane at least minDist from the given origin.
 * @param originX - X to avoid.
 * @param originZ - Z to avoid.
 * @param minDist - Minimum distance from origin.
 * @returns [x, z] coordinates.
 */
export function randomPositionAwayFrom(originX: number, originZ: number, minDist: number): [number, number] {
  for (let attempt = 0; attempt < 30; attempt++) {
    const x = randomRange(-BOUNDS, BOUNDS);
    const z = randomRange(-BOUNDS, BOUNDS);
    const dx = x - originX;
    const dz = z - originZ;
    if (Math.sqrt(dx * dx + dz * dz) >= minDist) {
      return [x, z];
    }
  }
  // Fallback: place at opposite corner
  return [-Math.sign(originX || 1) * BOUNDS * 0.8, -Math.sign(originZ || 1) * BOUNDS * 0.8];
}

/**
 * Returns the target fish count for a given difficulty level.
 * Interpolated linearly from MIN_FISH_COUNT to MAX_FISH_COUNT.
 * @param difficultyLevel - Normalized difficulty (0–1).
 * @returns Integer fish count.
 */
export function getTargetFishCount(difficultyLevel: number): number {
  return Math.round(MIN_FISH_COUNT + (MAX_FISH_COUNT - MIN_FISH_COUNT) * difficultyLevel);
}

/**
 * Returns the speed multiplier for a given difficulty level.
 * Interpolated linearly from MIN_SPEED_MULTIPLIER to MAX_SPEED_MULTIPLIER.
 * @param difficultyLevel - Normalized difficulty (0–1).
 * @returns Speed multiplier.
 */
export function getSpeedMultiplier(difficultyLevel: number): number {
  return MIN_SPEED_MULTIPLIER + (MAX_SPEED_MULTIPLIER - MIN_SPEED_MULTIPLIER) * difficultyLevel;
}
