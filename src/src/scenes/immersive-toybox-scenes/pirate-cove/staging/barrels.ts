/**
 * Placement data for barrel props on the ship deck.
 *
 * Solved by `.probe/pc-stage-solve.mjs` — see `shipWheel.ts` for the three rules
 * every placement in this directory has to satisfy. Candidates surviving all
 * three, in order: 247, 89, 6, 18. The counts fall because each barrel placed
 * blocks the next; barrel 2 had six places left to stand.
 *
 * WHY A CLUSTER AND NOT A ROW. Barrels are stores. Stores get struck below in
 * one lot and stand where they were landed, so they crowd. The first version of
 * this solve scored each barrel independently against the rail and produced four
 * barrels evenly spaced along the starboard side, which reads as fence posts,
 * not cargo. All four now share ONE preferred centre (2.2, 4.6) and the varied
 * rotations and scales are what stop the cluster reading as a stack of clones.
 *
 * The old values (x -3.8..-2.8, z -1.5..0.2) were authored against a deck 15.3
 * wide; on this hull's 10-unit beam x -3.8 at z -1.5 is inside the rail by only
 * 0.6 and the cluster straddled the portal.
 */

import { Vector3 } from 'three';
import type { EntityPlacement } from '../types';

/** Authored placements for barrels — ship's stores, clustered on the starboard waist. */
export const BARREL_STAGING: ReadonlyArray<EntityPlacement> = [
  { position: new Vector3(1.4, 0, 4.5), rotY: 0, scale: 1 },
  { position: new Vector3(1.6, 0, 3.5), rotY: Math.PI * 0.3, scale: 0.85 },
  { position: new Vector3(0.8, 0, 5.6), rotY: Math.PI * -0.15, scale: 1.1 },
  { position: new Vector3(1.0, 0, 2.5), rotY: Math.PI * 0.6, scale: 0.75 },
];
