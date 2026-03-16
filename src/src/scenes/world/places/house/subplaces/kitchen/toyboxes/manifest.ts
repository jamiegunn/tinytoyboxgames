import { Color } from 'three';
import type { ToyboxSpec } from '@app/toyboxes/framework';
import { TOYBOX_ROTATION_Y, TOYBOX_X, TOYBOX_Y, TOYBOX_Z } from '../layout';

/**
 * Scene-local toybox manifest for the generated room.
 *
 * The template points at the existing `nature` immersive scene so a freshly
 * generated room has one real destination immediately. Future rooms should edit
 * this manifest rather than hard-coding toybox placement in `room.ts`.
 */
export const ROOM_TOYBOXES: ToyboxSpec[] = [
  {
    id: 'kitchen-nature',
    destination: 'nature',
    variant: 'classic',
    placement: {
      x: TOYBOX_X,
      y: TOYBOX_Y,
      z: TOYBOX_Z,
      rotationY: TOYBOX_ROTATION_Y,
      scale: 0.75,
    },
    palette: {
      base: new Color(0.72, 0.54, 0.36),
      accent: new Color(0.86, 0.78, 0.42),
    },
    emblem: 'clover',
  },
];
