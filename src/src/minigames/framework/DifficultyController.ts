import type { DifficultyController, DifficultyThresholds } from './types';

/** Configuration for creating a difficulty controller. */
export interface DifficultyConfig {
  /** Score at which difficulty begins ramping up from 0. */
  rampStart: number;
  /** Score at which difficulty reaches maximum (1.0). */
  rampEnd: number;
  /** Score threshold for unlocking special items. Defaults to 999999 (never). */
  specialItemThreshold?: number;
}

/** Extended difficulty controller with an update method for the shell to call. */
export interface UpdatableDifficultyController extends DifficultyController {
  /**
   * Updates the difficulty level based on the current score.
   * @param score - The player's current score.
   */
  update(score: number): void;
}

/**
 * Creates a difficulty controller that scales from 0 to 1 based on score progression.
 * @param config - Ramp and threshold configuration.
 * @returns A DifficultyController with an additional update method for the shell.
 */
export function createDifficultyController(config: DifficultyConfig): UpdatableDifficultyController {
  const { rampStart, rampEnd, specialItemThreshold = 999999 } = config;

  let currentLevel = 0;
  let currentThresholds: DifficultyThresholds = {
    rampStart,
    rampEnd,
    specialItemsUnlocked: false,
  };

  return {
    get level(): number {
      return currentLevel;
    },

    get thresholds(): DifficultyThresholds {
      return currentThresholds;
    },

    update(score: number): void {
      const range = rampEnd - rampStart;
      if (range <= 0) {
        currentLevel = score >= rampStart ? 1 : 0;
      } else {
        currentLevel = Math.min(1, Math.max(0, (score - rampStart) / range));
      }
      currentThresholds = {
        rampStart,
        rampEnd,
        specialItemsUnlocked: score >= specialItemThreshold,
      };
    },
  };
}
