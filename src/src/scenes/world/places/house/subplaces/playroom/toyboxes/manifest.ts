import { Color } from 'three';
import type { ToyboxSpec } from '@app/toyboxes/framework';

export const PLAYROOM_TOYBOXES: ToyboxSpec[] = [
  {
    id: 'adventure',
    destination: 'pirate-cove',
    variant: 'classic',
    placement: {
      x: 5.25,
      y: 0.01,
      z: 1.5,
      rotationY: -Math.PI / 2,
      scale: 0.75,
    },
    palette: {
      base: new Color(0.9, 0.35, 0.3),
      accent: new Color(1.0, 0.9, 0.55),
    },
    emblem: 'stars',
  },
  {
    id: 'animals',
    destination: 'nature',
    variant: 'animals-open-box',
    placement: {
      x: -1.6,
      y: 0.01,
      z: -6.5,
      rotationY: -0.15,
      scale: 0.75,
    },
    palette: {
      base: new Color(0.45, 0.7, 0.92),
      accent: new Color(0.85, 0.85, 0.88),
    },
  },
  {
    id: 'creative',
    destination: null,
    variant: 'dresser',
    placement: {
      x: -2.8,
      y: 0.01,
      z: 8.25,
      rotationY: Math.PI,
      scale: 0.75,
    },
    palette: {
      base: new Color(0.5, 0.82, 0.55),
      accent: new Color(0.95, 0.92, 0.82),
    },
    emblem: 'clover',
  },
];
