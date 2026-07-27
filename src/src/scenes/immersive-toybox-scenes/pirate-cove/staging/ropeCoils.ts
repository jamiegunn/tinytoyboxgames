/**
 * Placement data for rope coil props on the ship deck.
 *
 * Solved by `.probe/pc-stage-solve.mjs` — see `shipWheel.ts` for the three rules
 * every placement in this directory has to satisfy. 208 and 74 placements
 * qualified.
 *
 * Rope coils are the small change of a deck: they go where nothing else went, so
 * the deck reads as used rather than as arranged. One to port, roughly opposite
 * the barrel cluster, and one aft on the starboard quarter between the helm and
 * the gun, which is the largest gap the other six props leave.
 */

import { Vector3 } from 'three';
import type { EntityPlacement } from '../types';

/** Authored placements for rope coils scattered on the deck. */
export const ROPE_COIL_STAGING: ReadonlyArray<EntityPlacement> = [
  { position: new Vector3(-1.9, 0, 2.2), rotY: 0, scale: 1 },
  { position: new Vector3(1.2, 0, -3.2), rotY: Math.PI * 0.4, scale: 0.9 },
];
