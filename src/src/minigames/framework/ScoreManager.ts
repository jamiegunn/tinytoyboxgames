import type { ComboTracker, ScoreManager } from './types';

/**
 * Creates a score manager that tracks points and applies combo multipliers.
 * @param comboTracker - The combo tracker used to determine the current multiplier.
 * @returns A ScoreManager instance.
 */
export function createScoreManager(comboTracker: ComboTracker): ScoreManager {
  let currentScore = 0;
  const listeners = new Set<(newScore: number) => void>();

  /** Notifies all subscribed listeners of the current score. */
  function notifyListeners(): void {
    for (const callback of listeners) {
      callback(currentScore);
    }
  }

  return {
    get score(): number {
      return currentScore;
    },

    addPoints(basePoints: number): number {
      const actual = Math.round(basePoints * comboTracker.multiplier);
      currentScore += actual;
      notifyListeners();
      return actual;
    },

    reset(): void {
      currentScore = 0;
      notifyListeners();
    },

    onScoreChanged(callback: (newScore: number) => void): () => void {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
  };
}
