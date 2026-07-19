import { Color, Mesh, PlaneGeometry, type Scene } from 'three';
import { createWoodMaterial } from '@app/utils/materialFactory';
import { FLOOR_DEPTH, FLOOR_WIDTH } from '../layout';

/**
 * Creates the Living Room's warm wooden floor.
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

  const floor = new Mesh(floorGeometry, createWoodMaterial('livingRoom_floorMat', new Color(0.62, 0.44, 0.29)));
  floor.name = 'livingRoom_floor';
  floor.receiveShadow = true;
  scene.add(floor);
  return floor;
}
