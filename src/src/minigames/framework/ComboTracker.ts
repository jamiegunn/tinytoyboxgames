import type { ComboTracker } from './types';

/**
 * Computes the multiplier for a given streak value.
 * @param streak - Current consecutive hit count.
 * @returns The score multiplier (1x through 4x).
 */
function getMultiplier(streak: number): number {
  if (streak >= 10) return 4;
  if (streak >= 6) return 3;
  if (streak >= 3) return 2;
  return 1;
}

/**
 * Creates a combo tracker that monitors consecutive hits and computes a score multiplier.
 * Automatically breaks the combo if no hit is registered within the specified window.
 * @param windowSeconds - The time window in seconds before the combo decays.
 * @returns A ComboTracker instance.
 */
export function createComboTracker(windowSeconds: number): ComboTracker {
  let currentStreak = 0;
  let currentMultiplier = 1;
  let decayTimer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<(streak: number, multiplier: number) => void>();

  /** Notifies all subscribed listeners of the current combo state. */
  function notifyListeners(): void {
    for (const callback of listeners) {
      callback(currentStreak, currentMultiplier);
    }
  }

  /** Clears the decay timer if one is active. */
  function clearDecayTimer(): void {
    if (decayTimer !== null) {
      clearTimeout(decayTimer);
      decayTimer = null;
    }
  }

  /** Starts a new decay timer that will break the combo after the window expires. */
  function startDecayTimer(): void {
    clearDecayTimer();
    decayTimer = setTimeout(() => {
      decayTimer = null;
      // Auto-break combo on decay
      currentStreak = 0;
      currentMultiplier = 1;
      notifyListeners();
    }, windowSeconds * 1000);
  }

  return {
    get streak(): number {
      return currentStreak;
    },

    get multiplier(): number {
      return currentMultiplier;
    },

    registerHit(): void {
      currentStreak += 1;
      currentMultiplier = getMultiplier(currentStreak);
      notifyListeners();
      startDecayTimer();
    },

    breakCombo(): void {
      clearDecayTimer();
      currentStreak = 0;
      currentMultiplier = 1;
      notifyListeners();
    },

    reset(): void {
      clearDecayTimer();
      currentStreak = 0;
      currentMultiplier = 1;
      notifyListeners();
    },

    onComboChanged(callback: (streak: number, multiplier: number) => void): () => void {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
  };
}
