/**
 * Creates a seeded pseudo-random number generator using a linear
 * congruential generator (LCG). Deterministic: the same seed always
 * produces the same sequence.
 *
 * @param seed - The seed value for deterministic random sequences
 * @returns A function that returns the next pseudo-random number in [0, 1)
 *
 * @example
 * ```ts
 * const rand = seededRng(42);
 * rand(); // 0.812…
 * rand(); // 0.370…
 * ```
 */
export function seededRng(seed: number): () => number {
  let s = Math.abs(seed * 9301 + 49297) % 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * Derives a deterministic numeric seed from a world-space position and
 * an entity-type salt string. Different salts guarantee uncorrelated
 * sequences at the same position.
 *
 * @param position - Object with x and z world coordinates.
 * @param salt - A unique string per entity type (e.g. 'grassPatch').
 * @returns A numeric seed suitable for {@link seededRng}.
 */
export function placementSeed(position: { x: number; z: number }, salt: string): number {
  let h = 0;
  for (let i = 0; i < salt.length; i++) {
    h = ((h << 5) - h + salt.charCodeAt(i)) | 0;
  }
  return position.x * (73.7 + (h & 0xff)) + position.z * (131.7 + ((h >> 8) & 0xff));
}
