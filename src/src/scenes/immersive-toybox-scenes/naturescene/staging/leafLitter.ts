import { Vector3 } from 'three';
import type { EntityPlacement } from '../types';

/** Casts 4 leaf litter clusters on the forest floor. */
export const LEAF_LITTER_STAGING: readonly EntityPlacement[] = [
  { position: new Vector3(-4.2, 0.01, -0.7), rotY: 0.2 },
  { position: new Vector3(3.7, 0.01, 0.8), rotY: -0.4 },
  { position: new Vector3(-1.6, 0.01, -3.2), rotY: 0.6 },
  { position: new Vector3(2.2, 0.01, -0.8), rotY: -0.1 },
];
