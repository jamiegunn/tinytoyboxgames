/**
 * Tuning values for the loose baseballs.
 *
 * These are separated from `create.ts` and `interaction.ts` so the prop can be
 * retuned without mixing design values into geometry or dispatcher code.
 */

/** Ball radius and its stitch ring tube. */
export const BALL_RADIUS = 0.17;
export const STITCH_TUBE_RADIUS = 0.02;

/** Hop animation: two bounces, the second smaller, plus a half tumble. */
export const HOP_APEX_Y = 0.62;
export const HOP_SECOND_APEX_Y = 0.24;
export const HOP_FIRST_LAND_FRAME = 12;
export const HOP_SECOND_APEX_FRAME = 17;
export const HOP_SETTLE_FRAME = 24;
export const HOP_TUMBLE = Math.PI;
export const ANIMATION_FPS = 30;
