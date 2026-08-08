/**
 * Placement data for the scoreboard in Baseball Park.
 *
 * One board, deep on the screen-right side (negative X) so it dresses the
 * outfield without stacking on the centreline behind the mound and second
 * base, turned slightly toward the centre of the field.
 */

import { Vector3 } from 'three';
import type { EntityPlacement } from '../types';

/** Authored placement for the outfield scoreboard. */
export const SCOREBOARD_STAGING: ReadonlyArray<EntityPlacement> = [{ position: new Vector3(-3.6, 0, 5.4), rotY: -0.25, scale: 1 }];
