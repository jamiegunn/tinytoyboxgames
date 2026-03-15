import { Vector3 } from 'three';
import type { EntityPlacement } from '../types';

/** Casts 3 large leaves with hidden ladybugs beneath. */
export const LEAF_STAGING: readonly EntityPlacement[] = [
  { position: new Vector3(0.5, 0.02, -0.5), rotY: 0.3 },
  { position: new Vector3(1.0, 0.02, 0.3), rotY: -0.5 },
  { position: new Vector3(-3.0, 0.02, -0.5), rotY: 0.8 },
];
