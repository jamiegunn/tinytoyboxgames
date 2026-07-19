/**
 * Canonical math helpers — the single source of truth.
 *
 * See architecture-standards.md#math. `utils/mathHelpers.ts` and
 * `minigames/shared/mathUtils.ts` re-export from here so the two stacks share
 * one implementation. NOTE: two historical `lerp`s differed — the scenes stack
 * did not clamp `t`, the minigames stack did — so both are preserved here
 * (`lerp` unclamped, `lerpClamped` clamped) to avoid changing any caller's
 * behaviour during consolidation.
 */

/**
 * Clamps a value to the inclusive range [lo, hi].
 *
 * @param v - The value to clamp.
 * @param lo - Lower bound.
 * @param hi - Upper bound.
 * @returns The clamped value.
 */
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Linearly interpolates between two values. `t` is not clamped.
 *
 * @param a - The start value.
 * @param b - The end value.
 * @param t - The interpolation factor.
 * @returns The interpolated value.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Linearly interpolates between two values with `t` clamped to [0, 1].
 *
 * @param a - The start value.
 * @param b - The end value.
 * @param t - The interpolation factor (clamped to [0, 1]).
 * @returns The interpolated value.
 */
export function lerpClamped(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

/**
 * Applies a smooth Hermite interpolation clamped to [0, 1].
 *
 * @param value - The input value to smooth.
 * @returns The smoothed value in [0, 1].
 */
export function smooth01(value: number): number {
  const c = clamp(value, 0, 1);
  return c * c * (3 - 2 * c);
}

/**
 * Applies a cubic ease-out curve to t in [0, 1].
 *
 * @param t - Progress value in [0, 1].
 * @returns The eased value.
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Returns a random floating-point number in the range [min, max).
 *
 * @param min - Lower bound (inclusive).
 * @param max - Upper bound (exclusive).
 * @returns A random float in [min, max).
 */
export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Returns a random integer in the range [0, max).
 *
 * @param max - Upper bound (exclusive).
 * @returns A random integer in [0, max).
 */
export function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

/**
 * Returns a random element from a non-empty readonly array.
 *
 * @param arr - The array to pick from.
 * @returns A randomly selected element.
 */
export function randomPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Wraps an angle in radians to the range [-PI, PI].
 *
 * @param a - The angle in radians.
 * @returns The wrapped angle.
 */
export function wrapAngle(a: number): number {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
}

/**
 * Shuffles an array in-place using the Fisher-Yates algorithm.
 *
 * @param arr - The array to shuffle.
 * @returns The same array, now shuffled.
 */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Computes the horizontal (XZ plane) distance between two points.
 *
 * @param a - First point.
 * @param b - Second point.
 * @returns The XZ-plane distance.
 */
export function xzDistance(a: { x: number; z: number }, b: { x: number; z: number }): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Computes the parabolic arc height for a projectile at progress t.
 *
 * @param t - Progress along the arc in [0, 1].
 * @param distance - Total horizontal distance of the arc.
 * @returns The vertical height at progress t.
 */
export function parabolicY(t: number, distance: number): number {
  const peakHeight = distance * 0.3;
  return peakHeight * 4 * t * (1 - t);
}
