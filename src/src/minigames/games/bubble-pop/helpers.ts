import { randomRange } from '@app/minigames/shared/mathUtils';
import type { BubbleKind, GamePhase } from './types';
import { CRESCENDO_CYCLE } from './types';

export { randomRange };

/**
 * Returns the current game phase based on difficulty level and elapsed time.
 * Difficulty determines when crescendo becomes available; elapsed time drives
 * the breathing rhythm within the crescendo phase.
 * @param difficultyLevel - Normalized difficulty from 0 (easiest) to 1 (hardest).
 * @param elapsedTime - Total elapsed game time in seconds (for cycling rhythm).
 * @returns The current GamePhase.
 */
export function getPhase(difficultyLevel: number, elapsedTime: number): GamePhase {
  if (difficultyLevel < 0.2) return 'calm';
  if (difficultyLevel < 0.5) return 'building';
  // At high difficulty, alternate between crescendo/calm/building on a breathing rhythm
  const cycleTime = elapsedTime % CRESCENDO_CYCLE;
  if (cycleTime < 5) return 'crescendo';
  if (cycleTime < 20) return 'calm';
  return 'building';
}

/**
 * Determines what kind of bubble to spawn based on difficulty level.
 * Rarer kinds unlock and become more probable as difficulty increases.
 * @param difficultyLevel - Normalized difficulty from 0 (easiest) to 1 (hardest).
 * @returns The BubbleKind to spawn.
 */
export function pickBubbleKind(difficultyLevel: number): BubbleKind {
  const roll = Math.random();
  if (difficultyLevel >= 0.6 && roll < 0.02 + difficultyLevel * 0.04) return 'giant';
  if (difficultyLevel >= 0.3 && roll < 0.04 + difficultyLevel * 0.08) return 'rainbow';
  if (difficultyLevel >= 0.1 && roll < 0.08 + difficultyLevel * 0.12) return 'golden';
  return 'normal';
}
