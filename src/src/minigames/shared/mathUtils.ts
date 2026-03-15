/**
 * Returns a random floating-point number in the range [min, max).
 * @param min - Lower bound (inclusive).
 * @param max - Upper bound (exclusive).
 * @returns A random float in [min, max).
 */
export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Returns a random integer in the range [0, max).
 * @param max - Upper bound (exclusive).
 * @returns A random integer in [0, max).
 */
export function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

/**
 * Returns a random element from a non-empty readonly array.
 * @param arr - The array to pick from.
 * @returns A randomly selected element.
 */
export function randomPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Clamps a value to the inclusive range [lo, hi].
 * @param v - The value to clamp.
 * @param lo - Lower bound.
 * @param hi - Upper bound.
 * @returns The clamped value.
 */
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Linearly interpolates between a and b by factor t, clamped to [0, 1].
 * @param a - Start value.
 * @param b - End value.
 * @param t - Interpolation factor.
 * @returns The interpolated value.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

/**
 * Wraps an angle in radians to the range [-PI, PI].
 * @param a - The angle in radians.
 * @returns The wrapped angle.
 */
export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Applies a cubic ease-out curve to t in [0, 1].
 * @param t - Progress value in [0, 1].
 * @returns The eased value.
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Shuffles an array in-place using the Fisher-Yates algorithm.
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
 * Computes the horizontal (XZ plane) distance between two 3D points.
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
 * Computes the parabolic arc height for a projectile at progress t with given distance.
 * @param t - Progress along the arc in [0, 1].
 * @param distance - Total horizontal distance of the arc.
 * @returns The vertical height at progress t.
 */
export function parabolicY(t: number, distance: number): number {
  const peakHeight = distance * 0.3;
  return peakHeight * 4 * t * (1 - t);
}
