/**
 * Placement data for the parrot perched on the crow's nest.
 *
 * WHY THIS ONE IS DERIVED AND NOT SEARCHED
 * ----------------------------------------
 * Every other file in this directory holds a solved constant. This one holds a
 * derivation, because the parrot's position is not a free choice — it is a
 * RELATIONSHIP to the crow's nest, and the previous constant is what happens
 * when a relationship is stored as a number. That value was y 3.85 under a
 * comment reading "sitting on the crow's nest rim". The rim was at 5.83. The
 * comment was the only thing asserting the relationship and it was wrong by 1.98
 * units: the bird hung in mid-air beside the sail. Reading the height from
 * {@link MAST.nestRailTopY}, which is also what `sceneShell/create.ts` builds the
 * hoop from, makes the claim true by construction rather than by assertion.
 *
 * WHY THE PORT BEAM
 * -----------------
 * The seat around the rim is the one degree of freedom left, and it is not free
 * either. `.probe/pc-parrot-perch.mjs` walks sixteen seats and measures two
 * things per seat: the distance from the masthead pennant (sampled as 861 points
 * across the flag triangle, tested against the parrot's PER-MESH world boxes —
 * the union box of a bird is mostly air and would have answered the wrong
 * question), and how far the bird's silhouette stands off the mast's in NDC at
 * the worst of the nine aspects.
 *
 * Three of the sixteen seats put the flag THROUGH the bird — 0.375PI, 0.5PI and
 * 0.625PI, i.e. the starboard beam, which is the side the pennant flies to.
 * Thirteen qualify. This one, the port beam, is both the furthest from the
 * pennant (0.474 units, against 0.138 for the seat the staging solver's own
 * preference would have picked) and the furthest off the mast on screen (0.0661
 * NDC, the maximum available), so the bird is silhouetted against sky instead of
 * being a lump on a pole.
 *
 * The bird's head does finish 0.06 units above the truck. That is not a fault to
 * correct: the nest sits at 0.85 of the mast and the hoop eats 0.33 of the 0.98
 * that remains, so anything actually standing on the rim overtops the pole. It
 * is what a masthead looks like.
 */

import { Vector3 } from 'three';
import { MAST } from '../hullPlan';
import type { EntityPlacement } from '../types';

/** Seat around the crow's nest rim, measured about the mast; 0 is dead forward. */
const PERCH_ANGLE = Math.PI * 1.5;

/** The hoop stands slightly proud of the nest platform, so the bird stands on it. */
const PERCH_RADIUS = MAST.nestRadius * 1.02;

/** Authored placement for the parrot — sitting on the crow's nest rim, port beam. */
export const PARROT_STAGING: ReadonlyArray<EntityPlacement> = [
  {
    position: new Vector3(Math.sin(PERCH_ANGLE) * PERCH_RADIUS, MAST.nestRailTopY, MAST.z + Math.cos(PERCH_ANGLE) * PERCH_RADIUS),
    // Facing outboard, away from the mast, so the bird is seen broadside.
    rotY: PERCH_ANGLE + Math.PI,
    scale: 1.2,
  },
];
