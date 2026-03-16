/**
 * Placement data for barrel props on the ship deck.
 *
 * Barrels are clustered near the left side of the deck.
 */

import { Vector3 } from 'three';
import type { EntityPlacement } from '../types';

/** Authored placements for barrels on the ship deck. */
export const BARREL_STAGING: ReadonlyArray<EntityPlacement> = [
  { position: new Vector3(-3.2, 0, -1.5), rotY: 0, scale: 1 },
  { position: new Vector3(-3.8, 0, -0.8), rotY: Math.PI * 0.3, scale: 0.85 },
  { position: new Vector3(-2.8, 0, -0.4), rotY: Math.PI * -0.15, scale: 1.1 },
  { position: new Vector3(-3.5, 0, 0.2), rotY: Math.PI * 0.6, scale: 0.75 },
];
