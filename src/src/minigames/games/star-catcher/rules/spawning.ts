/**
 * Spawn and difficulty rules for the Star Catcher minigame.
 *
 * These values are kept explicit so game pacing is visible in one place rather
 * than scattered through the root lifecycle file.
 */

import type { PlayFieldBounds, TemplateTargetKind } from '../types';

/**
 * The play field, authored in normalized device coordinates.
 *
 * The old envelope was `x in [-3.3, 3.3], z in [-1.8, 1.8], spawn y = 4.4` with
 * a retirement floor at `y = 0.25`. Measured against the manifest camera at
 * 1200x810 that x span covers screen columns 197..1003 of 1200 (67% of the
 * width) and the floor projects to screen *row 446 of 810* — so the bottom 45%
 * of the frame was structurally incapable of holding a catchable star, which is
 * exactly what the motion profile `[18.8, 2.9, 0.25, 0.04, 0, 0]` recorded.
 *
 * - `ndcHalfWidth` 0.94 puts the outermost column at screen x 36 / 1164.
 * - `landingNdcMin/Max` -0.96..-0.30 puts landing rows at screen y 794..527,
 *   i.e. spread across the lower two fifths, on ground that is genuinely
 *   visible (the hill's silhouette crosses at row 293).
 * - `spawnClearance` 0.35 world units above the top edge: the largest star's
 *   half-height is 0.36, so the star is fully out of shot when it appears but
 *   only just, rather than the 0.5-0.9 seconds of dead time the old fixed
 *   altitude of 4.4 bought (the top of the frame is at y ~= 3.72-3.89).
 */
export const TEMPLATE_PLAY_FIELD: PlayFieldBounds = {
  ndcHalfWidth: 0.94,
  landingNdcMin: -0.96,
  landingNdcMax: -0.3,
  spawnClearance: 0.35,
};

/**
 * Extra random spawn clearance above {@link TEMPLATE_PLAY_FIELD}.`spawnClearance`,
 * so a burst of scheduled spawns does not arrive as a rank of stars at one height.
 */
export const SPAWN_ALTITUDE_JITTER = 0.3;

/**
 * Apparent fall speed, in fractions of the frame's height per second.
 *
 * Fall speed is derived from this rather than authored in world units, because
 * world units are not what the child sees: a star on the near edge of the play
 * band covers 2.4x more pixels per world unit than one on the far edge, so a
 * shared world speed made near stars visibly race and far stars crawl. Solving
 * for a constant *apparent* speed makes every star equally leadable.
 *
 * 0.123 and 0.160 are 100 px/s and 130 px/s at the measured 810 px viewport
 * height — a full-height crossing in 8.1 s and 6.2 s respectively. Being a
 * fraction rather than a pixel count, it holds at any viewport size.
 */
export const TARGET_SCREEN_SPEED: Record<TemplateTargetKind, number> = {
  standard: 0.123,
  bonus: 0.16,
};

/** Random multiplier applied to the screen speed so stars are not in lockstep. */
export const SCREEN_SPEED_VARIANCE = 0.15;

/** World Z of the vertical plane used to place tap feedback for a clean miss. */
export const PLAY_PLANE_Z = -2;

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
 * Raised from 4/5/7. With stars now spread over the whole frame instead of its
 * top half, the old counts left large empty regions: a 6x4 grid sweep scored
 * 3 of 24 taps. A headless simulation of the new field puts 8/9/10 concurrent
 * stars at 5.6/6.1/7.1 of 24, with every sixth of the frame occupied.
 *
 * @param difficultyLevel - Current normalized difficulty level.
 * @returns Maximum number of active targets allowed at once.
 */
export function computeMaxActiveTargets(difficultyLevel: number): number {
  switch (getSpawnBand(difficultyLevel)) {
    case 2:
      return 10;
    case 1:
      return 9;
    default:
      return 8;
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
      return 0.65;
    case 1:
      return 0.75;
    default:
      return 0.85;
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
