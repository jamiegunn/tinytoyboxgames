import { Color } from 'three';
import type { ToyboxSpec } from '@app/toyboxes/framework';
import { NATURE_TOYBOX_ROTATION_Y, NATURE_TOYBOX_X, NATURE_TOYBOX_Z, PIRATE_TOYBOX_ROTATION_Y, PIRATE_TOYBOX_X, PIRATE_TOYBOX_Z, TOYBOX_Y } from '../layout';

/**
 * Scene-local toybox manifest for the Living Room.
 *
 * Two active destinations flank the rug: a leafy-green open box of animals
 * that leads into Nature, and a red treasure chest that leads to Pirate Cove.
 * Edit this manifest rather than hard-coding toybox placement in `room.ts`.
 */
export const ROOM_TOYBOXES: ToyboxSpec[] = [
  {
    id: 'living-room-nature',
    destination: 'nature',
    variant: 'animals-open-box',
    placement: {
      x: NATURE_TOYBOX_X,
      y: TOYBOX_Y,
      z: NATURE_TOYBOX_Z,
      rotationY: NATURE_TOYBOX_ROTATION_Y,
      scale: 0.75,
    },
    palette: {
      base: new Color(0.5, 0.72, 0.45),
      accent: new Color(0.92, 0.88, 0.72),
    },
  },
  {
    id: 'living-room-pirate-cove',
    destination: 'pirate-cove',
    variant: 'classic',
    placement: {
      x: PIRATE_TOYBOX_X,
      y: TOYBOX_Y,
      z: PIRATE_TOYBOX_Z,
      rotationY: PIRATE_TOYBOX_ROTATION_Y,
      scale: 0.75,
    },
    palette: {
      base: new Color(0.85, 0.38, 0.3),
      accent: new Color(1.0, 0.88, 0.5),
    },
    emblem: 'stars',
  },
];
