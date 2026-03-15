/**
 * Linearly interpolates between two values.
 * @param a - The start value.
 * @param b - The end value.
 * @param t - The interpolation factor (0 to 1).
 * @returns The interpolated value between a and b.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Applies a smooth Hermite interpolation clamped to [0, 1].
 * @param value - The input value to smooth.
 * @returns The smoothed value in [0, 1].
 */
export function smooth01(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * (3 - 2 * clamped);
}
