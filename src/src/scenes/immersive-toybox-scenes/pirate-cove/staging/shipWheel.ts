/**
 * Placement data for the interactive ship wheel (helm).
 *
 * Solved by `.probe/pc-stage-solve.mjs`, which builds every prop with its real
 * factory, takes its real bounding box, and keeps only placements that are ON
 * DECK (whole footprint inside `HULL_OUTLINE`, inset by the railing's own
 * thickness), IN FRAME (every box corner inside NDC at all nine shipping
 * aspects) and CLEAR (no overlap with the mast, the portal disc, or a prop
 * placed earlier). 439 placements qualified; this is the one the helm's role
 * picks out of them.
 *
 * WHY AFT AND ON THE CENTRELINE. That is where a helm is. It is also the only
 * near foreground the scene has: at z -5.0 the wheel stands 6.4 units from the
 * eye while the stem stands 23.4, and a deck with something close, something
 * mid and something far is a deck that has depth. The preference targets -5.0
 * rather than simply minimising z, because the aft limit (-5.5) would put it
 * 0.3 units from where the bottom edge of the frame meets the deck (z -5.80,
 * identical on all nine aspects since vertical FOV does not vary with aspect) —
 * one pan from being cropped.
 *
 * The previous value, (0, 0, 2.8), was authored for a 15.3 x 13.3 deck. On this
 * hull it is forward of the mast, which is not a helm, it is a bowsprit.
 */

import { Vector3 } from 'three';
import type { EntityPlacement } from '../types';

/** Authored placement for the tappable ship wheel. */
export const SHIP_WHEEL_STAGING: ReadonlyArray<EntityPlacement> = [{ position: new Vector3(0, 0, -5.0), rotY: 0, scale: 1 }];
