/**
 * Placement data for the interactive ship wheel (helm).
 *
 * The wheel is at the back-center helm position.
 */

import { Vector3 } from 'three';
import type { EntityPlacement } from '../types';

/** Authored placement for the tappable ship wheel. */
export const SHIP_WHEEL_STAGING: ReadonlyArray<EntityPlacement> = [{ position: new Vector3(0, 0, 2.8), rotY: 0, scale: 1 }];
