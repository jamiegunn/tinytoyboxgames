/**
 * Placement data for the interactive example prop in Pirate Cove.
 *
 * These entries stay deliberately tiny so authors can focus on the interaction
 * pattern instead of the staging format.
 */

import { Vector3 } from 'three';
import type { EntityPlacement } from '../types';

/** Authored placements for the baseline interactive prop example. */
export const SAMPLE_INTERACTIVE_STAGING: ReadonlyArray<EntityPlacement> = [
  { position: new Vector3(0.35, 0, -0.6), rotY: Math.PI * 0.06, scale: 1 },
  { position: new Vector3(1.55, 0, -1.7), rotY: Math.PI * -0.14, scale: 1.08 },
];
