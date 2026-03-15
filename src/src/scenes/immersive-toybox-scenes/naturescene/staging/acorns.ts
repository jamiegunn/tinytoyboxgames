import { Vector3 } from 'three';
import type { EntityPlacement } from '../types';

/** Casts 3 acorns scattered across the forest floor. */
export const ACORN_STAGING: readonly EntityPlacement[] = [
  { position: new Vector3(-4, 0.05, -0.5) },
  { position: new Vector3(3.8, 0.05, 0.5) },
  { position: new Vector3(-1, 0.05, -2.5) },
];
