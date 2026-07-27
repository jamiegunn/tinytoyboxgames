/**
 * Dimensions for the rail stowage — spare spars lashed along the side rails.
 *
 * The spars are deliberately LONG and THIN. That is not a styling choice, it is
 * the property that lets them stand outboard of the narrowest frame at all: see
 * the module comment on `staging/railStowage.ts` for why only elongated,
 * self-similar elements may live where the frame edge will cut them.
 */

/** Radius of one spare spar. */
export const SPAR_RADIUS = 0.15;
/** Height of the chocks the spars rest on. */
export const CHOCK_HEIGHT = 0.11;
/** Half-width of a chock across the run. */
export const CHOCK_HALF_WIDTH = 0.42;
/** Length of a chock along the run. */
export const CHOCK_LENGTH = 0.26;
/** How many chocks per world unit of run length. One every ~2 units. */
export const CHOCK_SPACING = 2.0;
/** How many lashings per world unit of run length. One every ~2.6 units. */
export const LASHING_SPACING = 2.6;
/** Tube radius of a lashing rope. */
export const LASHING_TUBE = 0.035;
