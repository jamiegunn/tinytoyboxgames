import { Color } from 'three';

// ── Trunk ──
export const TRUNK_HEIGHT_MIN = 4.5;
export const TRUNK_HEIGHT_MAX = 6.0;
export const TRUNK_BASE_RADIUS_MIN = 0.35;
export const TRUNK_BASE_RADIUS_MAX = 0.5;
export const TRUNK_TOP_RADIUS_SCALE_MIN = 0.35;
export const TRUNK_TOP_RADIUS_SCALE_MAX = 0.5;
export const TRUNK_RADIAL_SEGMENTS = 16;
export const TRUNK_HEIGHT_SEGMENTS = 20;

// ── Roots ──
export const ROOT_COUNT_MIN = 4;
export const ROOT_COUNT_RANGE = 4;
export const ROOT_LENGTH_MIN = 0.6;
export const ROOT_LENGTH_MAX = 1.5;
export const ROOT_THICKNESS_SCALE_MIN = 0.2;
export const ROOT_THICKNESS_SCALE_MAX = 0.4;
export const ROOT_THINNING_MIN = 0.15;
export const ROOT_THINNING_MAX = 0.3;
export const ROOT_DISTANCE_FACTOR = 0.7;
export const ROOT_Y_FACTOR = -0.15;
export const ROOT_ANGLE_JITTER = 0.5;
export const ROOT_ROTATION_MIN = 0.5;
export const ROOT_ROTATION_MAX = 0.8;

// ── Canopy ──
export const CANOPY_RADIUS_MIN = 1.2;
export const CANOPY_RADIUS_MAX = 2.0;
export const CANOPY_SUBDIVISION = 3;
export const CANOPY_SPREAD_MIN = 0.3;
export const CANOPY_SPREAD_MAX = 1.0;
export const CANOPY_Y_OFFSET_MIN = -0.3;
export const CANOPY_Y_OFFSET_MAX = 0.8;
export const CANOPY_Y_SCALE_MIN = 0.55;
export const CANOPY_Y_SCALE_MAX = 0.75;
export const CLUSTER_COUNT_MIN = 3;
export const CLUSTER_COUNT_RANGE = 2;
export const CROWN_Y_RATIO = 0.85;

// ── Bark material colors ──
export const BARK_COLOR = new Color(0.35, 0.22, 0.13);
export const BARK_DARK_COLOR = new Color(0.12, 0.07, 0.03);
export const BARK_MOSS_COLOR = new Color(0.18, 0.32, 0.1);

// ── Canopy material colors ──
export const LEAF_LIGHT_COLOR = new Color(0.35, 0.58, 0.22);
export const LEAF_MID_COLOR = new Color(0.18, 0.42, 0.1);
export const LEAF_DARK_COLOR = new Color(0.08, 0.22, 0.04);
