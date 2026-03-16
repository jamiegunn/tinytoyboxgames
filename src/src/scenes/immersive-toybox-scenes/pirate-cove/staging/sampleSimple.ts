/**
 * Placement data for the simple example prop in Pirate Cove.
 *
 * The template keeps staging intentionally boring. That is a feature, not a
 * limitation. Staging files should be easy to skim when you want to understand
 * a scene's layout quickly.
 */

import { Vector3 } from 'three';
import type { EntityPlacement } from '../types';

/** Authored placements for the baseline simple prop example. */
export const SAMPLE_SIMPLE_STAGING: ReadonlyArray<EntityPlacement> = [
  { position: new Vector3(-1.9, 0, -0.8), rotY: Math.PI * 0.12, scale: 1 },
  { position: new Vector3(-0.8, 0, -2.1), rotY: Math.PI * -0.08, scale: 0.92 },
];
