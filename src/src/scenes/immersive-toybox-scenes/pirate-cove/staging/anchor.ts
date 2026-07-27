/**
 * Placement data for the anchor prop.
 *
 * Solved by `.probe/pc-stage-solve.mjs` — see `shipWheel.ts` for the three rules
 * every placement in this directory has to satisfy. 383 placements qualified.
 *
 * WHY FORWARD AND AGAINST THE RAIL. Ground tackle lives forward, where the cable
 * runs to the hawse. The preference weights rail-hugging above forwardness on
 * purpose: at z 7.2 the hull is only 2.9 units wide, and scoring "forward" alone
 * drags the anchor onto the centreline, which on a narrowing forebody is the
 * walkway to the stem. Rail first, forward second, gives x -0.6 at z 7.2 — the
 * anchor stowed against the port rail where the deck starts to pinch, which is
 * exactly where an anchor is stowed.
 *
 * The old value, (-4.5, 0, 3.5), sat 0.15 units OUTSIDE the port rail at its own
 * station on this hull: the anchor was hanging over the water.
 */

import { Vector3 } from 'three';
import type { EntityPlacement } from '../types';

/** Authored placement for the anchor — forward, stowed against the port rail. */
export const ANCHOR_STAGING: ReadonlyArray<EntityPlacement> = [{ position: new Vector3(-0.6, 0, 7.2), rotY: Math.PI * 0.95, scale: 1 }];
