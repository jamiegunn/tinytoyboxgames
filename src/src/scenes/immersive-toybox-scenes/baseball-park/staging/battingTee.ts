/**
 * Placement data for the batting tee in Baseball Park.
 *
 * One tee beside home plate, offset to screen-left of the centreline so its
 * tap target is never stacked along the camera's view ray with the mound and
 * second base (the eye sits on x = 0 — see the axes note in `environment.ts`).
 */

import { Vector3 } from 'three';
import type { EntityPlacement } from '../types';

/** Authored placement for the batting tee. */
export const BATTING_TEE_STAGING: ReadonlyArray<EntityPlacement> = [{ position: new Vector3(0.9, 0, -0.9), rotY: 0, scale: 1 }];
