/**
 * Placement data for the interactive treasure chest prop.
 *
 * Solved by `.probe/pc-stage-solve.mjs` — see `shipWheel.ts` for the three rules
 * every placement in this directory has to satisfy. 114 placements qualified.
 *
 * WHY HERE. Treasure is the thing a child is meant to want to open, so it goes
 * on open deck, prominent, and on the side the cannon is not. The preference
 * targets the port waist; the solver returns the nearest qualifying station.
 *
 * WHAT WAS HERE BEFORE, AND WHY ITS REASONING NO LONGER HOLDS. The old value
 * (-2.1, 0, 5.7) carried a comment citing `.probe/pc-chest.mjs`, which had
 * searched the OLD 15.3 x 13.3 deck and found "exactly one" position in frame at
 * every aspect. That was true of that deck and that camera preset, and it is the
 * kind of claim that goes silently false the moment either changes: on this hull
 * z 5.7 is on the narrowing forebody where the deck is 2.8 units wide, and the
 * chest's own footprint is 1.4 across. The citation is dropped rather than
 * updated, because the probe it named no longer describes this scene.
 */

import { Vector3 } from 'three';
import type { EntityPlacement } from '../types';

/** Authored placement for the tappable treasure chest — port waist, on open deck. */
export const TREASURE_CHEST_STAGING: ReadonlyArray<EntityPlacement> = [{ position: new Vector3(-1.6, 0, 0.3), rotY: Math.PI * 0.55, scale: 1 }];
