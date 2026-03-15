import type { DirectionalLight, Scene } from 'three';
import { createMusicPlayer } from './critters/musicPlayer';
import { createWindUpMouse } from './critters/windUpMouse';
import { createHoppingChick } from './critters/hoppingChick';

/**
 * Creates all animated critter toys: music player, wind-up mouse, and hopping chick.
 * @param scene - The Three.js scene to add critters to
 * @param keyLight - The directional light for shadow casting
 */
export function createCritters(scene: Scene, keyLight: DirectionalLight): void {
  createMusicPlayer(scene, keyLight);
  createWindUpMouse(scene, keyLight);
  createHoppingChick(scene, keyLight);
}
