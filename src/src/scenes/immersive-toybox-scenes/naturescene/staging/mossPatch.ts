import { Vector3 } from 'three';
import type { EntityPlacement } from '../types';

/** Casts 4 moss patches near tree bases and shaded areas. */
export const MOSS_PATCH_STAGING: readonly EntityPlacement[] = [
  { position: new Vector3(-3.6, 0.01, 0.3), rotY: 0.2 },
  { position: new Vector3(0.8, 0.01, -1.1), rotY: -0.3 },
  { position: new Vector3(-4.7, 0.01, 2.9), rotY: 0.5 },
  { position: new Vector3(3.9, 0.01, -3.6), rotY: -0.2 },
];
