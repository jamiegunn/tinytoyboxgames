import { Color } from 'three';

// ── Stem (ratios relative to config.scale) ──
export const STEM_TOP_RADIUS_RATIO = 0.12;
export const STEM_BOTTOM_RADIUS_RATIO = 0.18;
export const STEM_HEIGHT_RATIO = 0.5;
export const STEM_Y_RATIO = 0.25;

// ── Cap (ratios relative to config.scale) ──
export const CAP_SPHERE_RADIUS = 0.5;
export const CAP_SCALE_X_RATIO = 0.6;
export const CAP_SCALE_Y_RATIO = 0.3;
export const CAP_SCALE_Z_RATIO = 0.6;
export const CAP_Y_RATIO = 0.5;

// ── Spots ──
export const SPOT_COUNT = 4;
export const SPOT_RADIUS_RATIO = 0.06;
export const SPOT_ORBIT_RADIUS_RATIO = 0.2;
export const SPOT_Y_RATIO = 0.1;
export const SPOT_ANGLE_OFFSET = 0.3;
export const SPOT_COLOR = new Color(0.95, 0.95, 0.9);

/** Only add spots when the cap's red channel exceeds this threshold. */
export const RED_SPOT_THRESHOLD = 0.7;

// Tap animation
export const BOUNCE_START_SCALE = 1;
export const BOUNCE_WIDE_FRAME = 8;
export const BOUNCE_TALL_FRAME = 16;
export const BOUNCE_RESET_FRAME = 24;
export const BOUNCE_WIDE_SCALE_X = 1.15;
export const BOUNCE_WIDE_SCALE_Y = 0.8;
export const BOUNCE_TALL_SCALE_X = 0.9;
export const BOUNCE_TALL_SCALE_Y = 1.2;
export const GLOW_COLOR = new Color(0.3, 0.5, 0.2);
export const GLOW_START_FRAME = 10;
export const GLOW_END_FRAME = 30;
