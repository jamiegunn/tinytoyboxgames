/**
 * Tuning values for the generated interactive example prop.
 *
 * These values are intentionally separated from `create.ts` and
 * `interaction.ts` so future authors can tweak the prop without mixing design
 * tuning into geometry or dispatcher code.
 */

export const STEM_HEIGHT = 0.72;
export const STEM_RADIUS = 0.055;
export const BLOOM_RADIUS = 0.2;
export const LEAF_RADIUS = 0.1;
export const TAP_SPIN_DELTA = Math.PI * 0.18;
export const ANIMATION_FPS = 30;
export const BLOOM_EXPANDED_SCALE = 1.18;
