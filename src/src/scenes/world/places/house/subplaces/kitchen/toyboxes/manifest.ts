import { Color } from 'three';
import type { ToyboxSpec } from '@app/toyboxes/framework';
import { BASEBALL_TOYBOX_ROTATION_Y, BASEBALL_TOYBOX_X, BASEBALL_TOYBOX_Z, TOYBOX_ROTATION_Y, TOYBOX_X, TOYBOX_Y, TOYBOX_Z } from '../layout';

/**
 * Scene-local toybox manifest for the Kitchen.
 *
 * Two destinations: the wooden clover chest on the front floor leads into
 * Nature, and the white-and-red chest deep by the cabinets — coloured like the
 * baseball it opens onto — leads to the Baseball Park. Edit this manifest
 * rather than hard-coding toybox placement in `room.ts`; placement constants
 * live in `../layout.ts` with the derivation notes.
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
  {
    id: 'kitchen-baseball-park',
    destination: 'baseball-park',
    variant: 'classic',
    placement: {
      x: BASEBALL_TOYBOX_X,
      y: TOYBOX_Y,
      z: BASEBALL_TOYBOX_Z,
      rotationY: BASEBALL_TOYBOX_ROTATION_Y,
      scale: 0.75,
    },
    palette: {
      base: new Color(0.9, 0.88, 0.82),
      accent: new Color(0.82, 0.28, 0.24),
    },
    emblem: 'stars',
  },
];
