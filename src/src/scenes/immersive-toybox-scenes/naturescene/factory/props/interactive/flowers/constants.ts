import { Color } from 'three';

// ── Stem ──
export const STEM_TOP_RADIUS = 0.03 / 2;
export const STEM_BOTTOM_RADIUS = 0.04 / 2;
export const STEM_HEIGHT = 0.5;
export const STEM_Y = 0.25;

// ── Center ──
export const CENTER_RADIUS = 0.12 / 2;
export const CENTER_Y = 0.52;
export const CENTER_COLOR = new Color(1, 0.85, 0.2);

// ── Petals ──
export const PETAL_COUNT = 5;
export const PETAL_SPHERE_RADIUS = 0.5;
export const PETAL_SCALE_X = 0.15 * 0.5;
export const PETAL_SCALE_Y = 0.06 * 0.5;
export const PETAL_SCALE_Z = 0.08 * 0.5;
export const PETAL_ORBIT_RADIUS = 0.1;
export const PETAL_Y = 0.5;

// Bloom animation
export const BLOOM_FRAME_BASE = 20;
export const BLOOM_FRAME_STAGGER = 3;
export const BLOOMED_PETAL_SCALE_X = 0.15;
export const BLOOMED_PETAL_SCALE_Y = 0.06;
export const BLOOMED_PETAL_SCALE_Z = 0.08;
