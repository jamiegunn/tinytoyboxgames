/**
 * Minigames-stack math helpers.
 *
 * Re-exported from the canonical `utils/math.ts` (single source of truth) to
 * remove the historical duplicate implementations. `lerp` here maps to the
 * clamped variant to preserve this stack's original behaviour. New code should
 * import from `@app/utils/math` directly. See architecture-standards.md#math.
 */

export { randomRange, randomInt, randomPick, clamp, wrapAngle, easeOutCubic, shuffle, xzDistance, parabolicY, lerpClamped as lerp } from '@app/utils/math';
