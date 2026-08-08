/**
 * Placement data for the bleacher banks in Baseball Park.
 *
 * Two small banks flank the field against the side walls, each turned to face
 * the diamond and angled a few degrees toward the camera so their steps read
 * as steps rather than as a flat wall. +X is screen LEFT (see the axes note in
 * `environment.ts`), so the +5.3 bank is the left-hand one.
 */

import { Vector3 } from 'three';
import type { EntityPlacement } from '../types';

/** Authored placements for the two bleacher banks. */
export const BLEACHERS_STAGING: ReadonlyArray<EntityPlacement> = [
  { position: new Vector3(5.3, 0, 2.2), rotY: Math.PI / 2 - 0.3, scale: 1 },
  { position: new Vector3(-5.3, 0, 2.6), rotY: -(Math.PI / 2 - 0.3), scale: 1 },
];
