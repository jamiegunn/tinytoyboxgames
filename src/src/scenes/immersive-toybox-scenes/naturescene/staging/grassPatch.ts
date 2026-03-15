import { Vector3 } from 'three';
import type { EntityPlacement } from '../types';

/** Casts 5 grass patches in the outer ground areas. */
export const GRASS_PATCH_STAGING: readonly EntityPlacement[] = [
  { position: new Vector3(-4.6, 0, 1.4), rotY: 0.4 },
  { position: new Vector3(4.4, 0, -3.4), rotY: -0.2 },
  { position: new Vector3(1.8, 0, 4.4), rotY: 0.1 },
  { position: new Vector3(-0.8, 0, -4.2), rotY: -0.5 },
  { position: new Vector3(4.4, 0, 2.0), rotY: 0.3 },
];
