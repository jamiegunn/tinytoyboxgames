import { Color, Mesh, PlaneGeometry, type Scene } from 'three';
import { createWoodMaterial } from '@app/utils/materialFactory';
import { FLOOR_DEPTH, FLOOR_WIDTH } from '../layout';

/**
 * Creates the generated room's floor.
 *
 * The floor is intentionally oversized so camera framing does not reveal hard
 * edges at the bottom of the room shell.
 *
 * @param scene - The Three.js scene that receives the floor mesh.
 * @returns The floor mesh used for owl floor-tap registration.
 */
export function createFloor(scene: Scene): Mesh {
  const floorGeometry = new PlaneGeometry(FLOOR_WIDTH, FLOOR_DEPTH);
  floorGeometry.rotateX(-Math.PI / 2);

  const floor = new Mesh(floorGeometry, createWoodMaterial('__SCENE_ID___floorMat', new Color(0.67, 0.5, 0.34)));
  floor.receiveShadow = true;
  scene.add(floor);
  return floor;
}
