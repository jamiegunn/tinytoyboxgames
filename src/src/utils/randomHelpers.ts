/**
 * Named random-value helpers that centralise intent around randomness.
 *
 * Two flavours are provided:
 *
 * 1. **Unseeded helpers** (`rand.*`) — convenience wrappers around
 *    `Math.random()` for runtime situations where reproducibility is
 *    not required (animation timing, flee directions, etc.).
 *
 * 2. **Seeded factory** (`createSeededHelpers(seed)`) — returns the
 *    same API backed by a deterministic {@link seededRng} so that
 *    geometry generation produces identical results for the same seed.
 *
 * Using named helpers instead of scattering raw `Math.random()` calls
 * makes it easy to audit, tune, and later replace the source of
 * randomness without a project-wide search-and-replace.
 *
 * @see {@link seededRng} for the underlying LCG implementation.
 */
import { seededRng } from './seededRng';

// ── Public type ──────────────────────────────────────────────────────

/** A bag of named random-value helpers backed by a single RNG source. */
export interface RandomHelpers {
  /** Returns a uniform float in `[min, max)`. */
  range: (min: number, max: number) => number;

  /** Returns a float in `[center − spread/2, center + spread/2)`. */
  spread: (center: number, spread: number) => number;

  /** Returns a float in `[−half, +half)` — shorthand for `spread(0, range)`. */
  bipolar: (range: number) => number;

  /** Returns `true` approximately `chance` fraction of the time (default 0.5). */
  coin: (chance?: number) => boolean;

  /** Returns a random integer in `[min, max]` (inclusive). */
  int: (min: number, max: number) => number;

  /** Picks one element from `items` uniformly at random. */
  pick: <T>(items: readonly T[]) => T;
}

// ── Factory ──────────────────────────────────────────────────────────

/**
 * Builds a {@link RandomHelpers} bag from an arbitrary `() => number`
 * source that returns values in `[0, 1)`.
 *
 * @param nextFn - The underlying random number source.
 * @returns A full set of named helpers.
 */
function buildHelpers(nextFn: () => number): RandomHelpers {
  return {
    range: (min, max) => min + nextFn() * (max - min),
    spread: (center, s) => center + (nextFn() - 0.5) * s,
    bipolar: (r) => (nextFn() - 0.5) * r,
    coin: (chance = 0.5) => nextFn() < chance,
    int: (min, max) => min + Math.floor(nextFn() * (max - min + 1)),
    pick: (items) => items[Math.floor(nextFn() * items.length)],
  };
}

// ── Unseeded (runtime) helpers ───────────────────────────────────────

/**
 * Pre-built helpers backed by `Math.random()`.
 * Use for runtime randomness where reproducibility is unnecessary
 * (animation delays, flee directions, sparkle timing, etc.).
 */
export const rand: RandomHelpers = buildHelpers(Math.random);

// ── Seeded helpers ───────────────────────────────────────────────────

/**
 * Creates a deterministic {@link RandomHelpers} bag from a numeric seed.
 * Calling this with the same seed always produces the same sequence,
 * making geometry generation reproducible.
 *
 * @param seed - Numeric seed forwarded to {@link seededRng}.
 * @returns A full set of named helpers backed by the seeded LCG.
 *
 * @example
 * ```ts
 * const r = createSeededHelpers(42);
 * const radius = r.range(0.01, 0.03); // deterministic
 * ```
 */
export function createSeededHelpers(seed: number): RandomHelpers {
  return buildHelpers(seededRng(seed));
}
