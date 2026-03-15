import type { DirectionalLight, Scene } from 'three';
import { createStackingRings } from './stackingRings';
import { createToyBlocks } from './toyBlocks';
import { createToyBall } from './toyBall';
import { createCrayon } from './crayon';
import { createToyCar } from './toyCar';
import { createStuffedStar } from './stuffedStar';
import { createRubberDuck } from './rubberDuck';
import { createToyTrain } from './toyTrain';
import { createPaperAirplane } from './paperAirplane';
import { createFloorBooks } from './floorBooks';

/**
 * Creates all scattered floor toys in the playroom scene.
 * @param scene - The Three.js scene to add the floor toys to
 * @param keyLight - The directional light for shadow casting
 */
export function createFloorToys(scene: Scene, keyLight: DirectionalLight): void {
  createStackingRings(scene, keyLight);
  createToyBlocks(scene, keyLight);
  createToyBall(scene, keyLight);
  createCrayon(scene, keyLight);
  createToyCar(scene, keyLight);
  createStuffedStar(scene, keyLight);
  createRubberDuck(scene, keyLight);
  createToyTrain(scene, keyLight);
  createPaperAirplane(scene, keyLight);
  createFloorBooks(scene, keyLight);
}
