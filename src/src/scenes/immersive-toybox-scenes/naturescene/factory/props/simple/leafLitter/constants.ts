import { Color } from 'three';

// ── Leaf colors ──
export const LEAF_COLORS = [
  new Color(0.7, 0.45, 0.15),
  new Color(0.8, 0.55, 0.2),
  new Color(0.6, 0.35, 0.1),
  new Color(0.5, 0.4, 0.15),
  new Color(0.75, 0.3, 0.1),
] as const;

// ── Cluster layout ──
export const LEAF_COUNT_MIN = 4;
export const LEAF_COUNT_RANGE = 4;
export const CLUSTER_RADIUS_X_MIN = 0.32;
export const CLUSTER_RADIUS_X_RANGE = 0.12;
export const CLUSTER_RADIUS_Z_MIN = 0.2;
export const CLUSTER_RADIUS_Z_RANGE = 0.12;

// ── Individual leaf ──
export const LEAF_SIZE_MIN = 0.08;
export const LEAF_SIZE_RANGE = 0.08;
export const LEAF_Y_VARIATION = 0.004;
