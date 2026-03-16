/**
 * Placement data for the interactive treasure chest prop.
 *
 * The chest is placed near the mast at the center-back of the deck.
 */

import { Vector3 } from 'three';
import type { EntityPlacement } from '../types';

/** Authored placement for the tappable treasure chest. */
export const TREASURE_CHEST_STAGING: ReadonlyArray<EntityPlacement> = [{ position: new Vector3(0.5, 0, -3.5), rotY: Math.PI + Math.PI * 0.08, scale: 1 }];
