import { Vector3 } from 'three';
import type { EntityPlacement } from '../types';

/** Casts 5 procedural trees around the scene perimeter. */
export const TREE_STAGING: readonly EntityPlacement[] = [
  { position: new Vector3(-5, 0, 2), rotY: 0.15 },
  { position: new Vector3(5.2, 0, -1), rotY: -0.1 },
  { position: new Vector3(-4.5, 0, -3), rotY: 0.05 },
  { position: new Vector3(4.8, 0, 3.5), rotY: 0.3 },
  { position: new Vector3(-3, 0, 4.5), rotY: -0.2 },
];
