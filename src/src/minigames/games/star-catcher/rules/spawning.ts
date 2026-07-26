/**
 * Spawn and difficulty rules for the generated template minigame.
 *
 * The template keeps these values explicit so developers can see where game
 * pacing lives without hunting through the root lifecycle file.
 */

import type { SpawnBounds, TemplateTargetKind } from '../types';

/**
 * Authored play-space envelope used by the baseline tap loop.
 *
 * `y` is a *spawn altitude*, not a resting height. With the authored camera the
 * top of the frame sits at world y ~= 3.8-3.94 across the z band, and the
 * largest star's half-height is 0.41, so 4.4 is the lowest altitude at which a
 * star is guaranteed to be fully out of shot when it appears. Spawning inside
 * the frame (the old y = 0.55) made stars blink into existence mid-air.
 */
export const TEMPLATE_SPAWN_BOUNDS: SpawnBounds = {
  minX: -3.3,
  maxX: 3.3,
  minZ: -1.8,
  maxZ: 1.8,
  y: 4.4,
};

/**
 * Extra random spawn altitude above {@link TEMPLATE_SPAWN_BOUNDS}.`y`, so a
 * burst of scheduled spawns does not arrive as a rank of stars at one height.
 */
export const SPAWN_ALTITUDE_JITTER = 0.4;

/**
 * World Y at which a falling star has "drifted away" and starts its fade.
 *
 * Just above the moonlit grass (the hilltop crown is y = 0 at the play depth),
 * so the star is still fully visible when it gives up rather than sinking into
 * the ground.
 */
export const TARGET_FLOOR_Y = 0.25;

/** World Z of the vertical plane the stars fall through, used to place tap feedback. */
export const PLAY_PLANE_Z = 0;

/**
 * Coarse spawn bands used to decide when the scheduler should be re-registered.
 *
 * @param difficultyLevel - Current normalized difficulty level.
 * @returns One of the template's authored spawn bands.
 */
export function getSpawnBand(difficultyLevel: number): 0 | 1 | 2 {
  if (difficultyLevel >= 0.67) return 2;
  if (difficultyLevel >= 0.34) return 1;
  return 0;
}

/**
 * Maximum simultaneous targets allowed for the current difficulty level.
 *
 * @param difficultyLevel - Current normalized difficulty level.
 * @returns Maximum number of active targets allowed at once.
 */
export function computeMaxActiveTargets(difficultyLevel: number): number {
  switch (getSpawnBand(difficultyLevel)) {
    case 2:
      return 7;
    case 1:
      return 5;
    default:
      return 4;
  }
}

/**
 * Spawn cadence used when registering the shared scheduler.
 *
 * @param difficultyLevel - Current normalized difficulty level.
 * @returns Seconds between scheduled spawn attempts.
 */
export function computeSpawnIntervalSeconds(difficultyLevel: number): number {
  switch (getSpawnBand(difficultyLevel)) {
    case 2:
      return 0.85;
    case 1:
      return 1.1;
    default:
      return 1.4;
  }
}

/**
 * Chooses which target kind to spawn for the current difficulty level.
 *
 * @param difficultyLevel - Current normalized difficulty level.
 * @returns The next target kind to spawn.
 */
export function chooseTargetKind(difficultyLevel: number): TemplateTargetKind {
  const bonusChance = 0.14 + difficultyLevel * 0.22;
  return Math.random() < bonusChance ? 'bonus' : 'standard';
}
