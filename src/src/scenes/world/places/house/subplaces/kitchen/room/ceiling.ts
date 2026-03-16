import { BoxGeometry, Color, Mesh, type Scene } from 'three';
import { createPlasticMaterial } from '@app/utils/materialFactory';
import { BACK_WALL_CENTER_Z, CEILING_THICKNESS, CEILING_Y, ROOM_DEPTH, ROOM_SPAN_X } from '../layout';

/**
 * Creates the ceiling slab for the generated room.
 *
 * @param scene - The Three.js scene that receives the ceiling mesh.
 */
export function createCeiling(scene: Scene): void {
  const ceiling = new Mesh(
    new BoxGeometry(ROOM_SPAN_X, CEILING_THICKNESS, ROOM_DEPTH),
    createPlasticMaterial('kitchen_ceilingMat', new Color(0.96, 0.94, 0.9)),
  );
  ceiling.position.set(0, CEILING_Y + CEILING_THICKNESS / 2, BACK_WALL_CENTER_Z - ROOM_DEPTH / 2 + WALL_DEPTH_OFFSET);
  ceiling.receiveShadow = true;
  scene.add(ceiling);
}

/**
 * Local offset that keeps the ceiling centered over the visible shell rather
 * than the oversized floor plane.
 */
const WALL_DEPTH_OFFSET = 1.2;
