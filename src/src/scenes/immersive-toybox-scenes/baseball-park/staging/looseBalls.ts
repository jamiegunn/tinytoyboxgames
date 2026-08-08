/**
 * Placement data for the loose baseballs in Baseball Park.
 *
 * Three balls scattered on the grass, all outside the infield diamond, all
 * clear of the Bubble Pop portal at (3.1, -2.35), and none on the centreline.
 * Each has its own rotation so the red stitch rings never line up.
 */

import { Vector3 } from 'three';
import type { EntityPlacement } from '../types';

/** Authored placements for the loose baseballs. */
export const LOOSE_BALLS_STAGING: ReadonlyArray<EntityPlacement> = [
  { position: new Vector3(-3.4, 0, -2.0), rotY: 0.6, scale: 1 },
  { position: new Vector3(4.4, 0, 0.8), rotY: 2.3, scale: 0.92 },
  { position: new Vector3(-2.4, 0, 3.6), rotY: 4.1, scale: 1.05 },
];
