import type { DirectionalLight, Scene } from 'three';
import { createPennantBanner } from './pennantBanner';
import { createPillowsAndBaskets } from './pillowsAndBaskets';
import { createPullToy } from './pullToy';
import { createSpinningTop } from './spinningTop';
import { createHangingMobile } from './hangingMobile';
import { createLamp } from './lamp';
import { createRaggedyDolls } from './raggedyDolls';
import { createToyDrum } from './toyDrum';
import { createBackpack } from './backpack';
import { createChalkboardEasel } from './chalkboardEasel';

/**
 * Creates all decorative props in the playroom scene.
 * @param scene - The Three.js scene to add decor to
 * @param keyLight - The directional light for shadow casting
 */
export function createDecor(scene: Scene, keyLight: DirectionalLight): void {
  createPennantBanner(scene);
  createPillowsAndBaskets(scene, keyLight);
  createPullToy(scene, keyLight);
  createSpinningTop(scene, keyLight);
  createHangingMobile(scene);
  createLamp(scene, keyLight);
  createRaggedyDolls(scene, keyLight);
  createToyDrum(scene, keyLight);
  createBackpack(scene, keyLight);
  createChalkboardEasel(scene, keyLight);
}
