import { Vector3 } from 'three';
import type { EntityPlacement } from '../types';

/** Casts 3 stones with hidden grubs beneath. */
export const STONE_STAGING: readonly EntityPlacement[] = [
  { position: new Vector3(3.5, 0, -2) },
  { position: new Vector3(3.0, 0, -2.5) },
  { position: new Vector3(-2.5, 0, -2) },
];
