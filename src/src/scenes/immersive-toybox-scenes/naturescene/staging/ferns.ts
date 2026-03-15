import { Vector3 } from 'three';
import type { EntityPlacement } from '../types';

/** Casts 7 ferns along the perimeter and mid-ground. */
export const FERN_STAGING: readonly EntityPlacement[] = [
  { position: new Vector3(-3.5, 0, 0.5) },
  { position: new Vector3(4, 0, 1) },
  { position: new Vector3(-2, 0, -3) },
  { position: new Vector3(-4.2, 0, -1.5) },
  { position: new Vector3(3.5, 0, -3) },
  { position: new Vector3(1.5, 0, 4) },
  { position: new Vector3(-1, 0, -4) },
];
