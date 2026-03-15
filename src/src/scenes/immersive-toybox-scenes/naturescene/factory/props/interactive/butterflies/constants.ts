import { Color } from 'three';

// ── Body ──
export const BODY_TOP_RADIUS = 0.02 / 2;
export const BODY_BOTTOM_RADIUS = 0.03 / 2;
export const BODY_HEIGHT = 0.15;
export const BODY_COLOR = new Color(0.1, 0.1, 0.1);

// ── Wings ──
export const WING_SPHERE_RADIUS = 0.5;
export const WING_SCALE_X = 0.2;
export const WING_SCALE_Y = 0.02;
export const WING_SCALE_Z = 0.15;
export const WING_X_OFFSET = 0.1;
export const WING_OPACITY = 0.7;

// ── Flutter animation ──
export const FLUTTER_AMPLITUDE = 0.5;
export const FLUTTER_HALF_FRAME = 5;
export const FLUTTER_FULL_FRAME = 10;

// ── Idle drift path ──
export const DRIFT_FRAME_1 = 90;
export const DRIFT_FRAME_2 = 180;
export const DRIFT_FRAME_3 = 270;
export const DRIFT_OFFSET_1 = { x: 0.5, y: 0.2, z: 0.3 } as const;
export const DRIFT_OFFSET_2 = { x: -0.3, y: -0.1, z: -0.2 } as const;

// ── Flee reaction ──
export const FLEE_RANGE = 3;
export const FLEE_HEIGHT = 1.5;
export const FLEE_FRAME = 15;
export const FLEE_RETURN_FRAME = 60;

// ── Particles ──
export const PARTICLE_OFFSET_Y = 0.1;
