/**
 * Placement data for rope coil props on the ship deck.
 */

import { Vector3 } from 'three';
import type { EntityPlacement } from '../types';

/** Authored placements for rope coils scattered on the deck. */
export const ROPE_COIL_STAGING: ReadonlyArray<EntityPlacement> = [
  { position: new Vector3(-1.5, 0, 1.5), rotY: 0, scale: 1 },
  { position: new Vector3(2.0, 0, 0.5), rotY: Math.PI * 0.4, scale: 0.9 },
];
