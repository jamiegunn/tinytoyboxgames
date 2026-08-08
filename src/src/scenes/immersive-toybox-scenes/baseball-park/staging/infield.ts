/**
 * Placement data for the infield diamond in Baseball Park.
 *
 * One entry: the diamond is the centrepiece and everything else in the scene
 * is placed relative to where it puts home plate (toward the camera) and
 * second base (deep). The centre sits at z 1.5 so home plate lands near the
 * camera edge of the field without falling off the near frame edge on phones.
 */

import { Vector3 } from 'three';
import type { EntityPlacement } from '../types';

/** Authored placement for the infield diamond, mound, and bases. */
export const INFIELD_STAGING: ReadonlyArray<EntityPlacement> = [{ position: new Vector3(0, 0, 1.5), rotY: 0, scale: 1 }];
