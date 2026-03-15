import { Vector3 } from 'three';
import type { EntityPlacement } from '../types';

/** Casts 5 toadstools spread around the scene edges. */
export const TOADSTOOL_STAGING: readonly EntityPlacement[] = [
  { position: new Vector3(-3.2, 0, 0.8) },
  { position: new Vector3(2.5, 0, -1.5) },
  { position: new Vector3(-0.8, 0, 3.5) },
  { position: new Vector3(4.5, 0, -0.5) },
  { position: new Vector3(-4.0, 0, 2.5) },
];
