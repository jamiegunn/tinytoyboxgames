/**
 * Dimensions for the infield diamond, bases, and pitcher's mound.
 *
 * Everything is derived from `HALF_DIAGONAL`: the dirt square's side length,
 * where the base corners sit, and how far the cushions are inset from them.
 * Change that one number and the whole infield rescales coherently.
 */

/** Distance from the diamond's centre to each corner (home, first, second, third). */
export const HALF_DIAGONAL = 3.2;

/** Side length of the dirt square whose diagonal spans the corners. */
export const DIRT_SIDE = HALF_DIAGONAL * Math.SQRT2;

/** Lift above the ground plane so the dirt never z-fights the grass. */
export const DIRT_LIFT = 0.01;

/** How far each base cushion is pulled in from its corner, toward the centre. */
export const BASE_INSET = 0.35;

/** Base cushion footprint and thickness. */
export const BASE_SIZE = 0.45;
export const BASE_HEIGHT = 0.09;

/** Home plate disc radius and thickness (five segments make the pentagon). */
export const HOME_PLATE_RADIUS = 0.3;
export const HOME_PLATE_HEIGHT = 0.06;

/** Pitcher's mound radii, height, and the rubber on top. */
export const MOUND_TOP_RADIUS = 0.55;
export const MOUND_BOTTOM_RADIUS = 0.85;
export const MOUND_HEIGHT = 0.2;
export const RUBBER_WIDTH = 0.35;
export const RUBBER_HEIGHT = 0.05;
export const RUBBER_DEPTH = 0.12;
