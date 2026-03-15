import type { DirectionalLight, Scene } from 'three';
import { createBeanbag } from './beanbag';
import { createPillows } from './pillows';
import { createBaskets } from './baskets';

/**
 * Creates soft floor furnishings: a beanbag, two floor pillows, and two woven baskets with peeking toys.
 * @param scene - The Three.js scene to add furnishings to
 * @param keyLight - The directional light for shadow casting
 */
export function createPillowsAndBaskets(scene: Scene, keyLight: DirectionalLight): void {
  createBeanbag(scene, keyLight);
  createPillows(scene, keyLight);
  createBaskets(scene, keyLight);
}
