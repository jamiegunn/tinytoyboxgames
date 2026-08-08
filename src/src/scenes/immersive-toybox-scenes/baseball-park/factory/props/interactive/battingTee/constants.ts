/**
 * Tuning values for the batting tee.
 *
 * These are separated from `create.ts` and `interaction.ts` so the prop can be
 * retuned without mixing design values into geometry or dispatcher code.
 */

/** Tee base disc, stem, and cup. */
export const TEE_BASE_RADIUS = 0.3;
export const TEE_BASE_HEIGHT = 0.06;
export const TEE_STEM_RADIUS = 0.05;
export const TEE_STEM_HEIGHT = 0.75;
export const TEE_CUP_TOP_RADIUS = 0.12;
export const TEE_CUP_BOTTOM_RADIUS = 0.07;
export const TEE_CUP_HEIGHT = 0.1;

/** Ball radius, its stitch ring, and where it rests on the cup. */
export const BALL_RADIUS = 0.16;
export const STITCH_TUBE_RADIUS = 0.02;
export const BALL_REST_Y = TEE_BASE_HEIGHT + TEE_STEM_HEIGHT + TEE_CUP_HEIGHT + BALL_RADIUS * 0.7;

/** Pop-fly animation: how high the ball sails and the keyframe schedule. */
export const POP_FLY_APEX_Y = BALL_REST_Y + 1.6;
export const POP_FLY_UP_FRAME = 9;
export const POP_FLY_DOWN_FRAME = 22;
export const POP_FLY_SETTLE_FRAME = 26;
export const POP_FLY_SPIN = Math.PI * 2;
export const ANIMATION_FPS = 30;
