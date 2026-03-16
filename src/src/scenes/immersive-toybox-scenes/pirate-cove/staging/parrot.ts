/**
 * Placement data for the parrot perched on the crow's nest.
 */

import { Vector3 } from 'three';
import type { EntityPlacement } from '../types';

/** Authored placement for the parrot — sitting on the crow's nest rim. */
export const PARROT_STAGING: ReadonlyArray<EntityPlacement> = [{ position: new Vector3(1.3, 3.85, 3.9), rotY: Math.PI + Math.PI / 4, scale: 1.2 }];
