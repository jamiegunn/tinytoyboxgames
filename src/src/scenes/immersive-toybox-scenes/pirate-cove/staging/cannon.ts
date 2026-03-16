/**
 * Placement data for the interactive cannon prop.
 *
 * The cannon faces outward over the railing on the right side of the deck.
 */

import { Vector3 } from 'three';
import type { EntityPlacement } from '../types';

/** Authored placement for the tappable cannon. */
export const CANNON_STAGING: ReadonlyArray<EntityPlacement> = [{ position: new Vector3(4.0, 0, 3.5), rotY: Math.PI * 0.5, scale: 1 }];
