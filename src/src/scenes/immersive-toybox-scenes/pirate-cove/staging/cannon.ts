/**
 * Placement data for the interactive cannon prop.
 *
 * Solved by `.probe/pc-stage-solve.mjs` — see `shipWheel.ts` for the three rules
 * every placement in this directory has to satisfy. 182 placements qualified.
 *
 * WHY HERE. A gun runs out through a port on the beam, so the role searches the
 * starboard side and scores by how hard against the rail the piece sits. "Hard
 * against the rail" cannot be written as a literal x on this hull: the beam is
 * 5.0 half-wide amidships and 1.4 half-wide at z 7.2, so the same x is at the
 * rail at one station and mid-deck at another. The solver scores distance
 * inside the rail AT THE PROP'S OWN STATION instead, which is why the answer is
 * x 2.1 rather than the old x 4.0 — on this hull x 4.0 at z 3.5 is over water.
 *
 * The old value, (4.0, 0, 3.5), was 1.1 units outside the port rail at its own
 * station. It was correct for the deck it was written against and has been
 * wrong since the hull changed.
 */

import { Vector3 } from 'three';
import type { EntityPlacement } from '../types';

/** Authored placement for the tappable cannon — starboard gunport, muzzle outboard. */
export const CANNON_STAGING: ReadonlyArray<EntityPlacement> = [{ position: new Vector3(2.1, 0, 1.9), rotY: Math.PI * 0.5, scale: 1 }];
