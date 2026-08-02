import { BoxGeometry, Color, Mesh, type Scene } from 'three';
import { createPlasticMaterial } from '@app/utils/materialFactory';
import { BACK_WALL_CENTER_Z, CEILING_DEPTH_OFFSET, CEILING_THICKNESS, CEILING_Y, ROOM_DEPTH, ROOM_SPAN_X } from '../layout';

/**
 * Creates the ceiling slab for the Living Room.
 *
 * @param scene - The Three.js scene that receives the ceiling mesh.
 */
export function createCeiling(scene: Scene): void {
  const ceiling = new Mesh(
    new BoxGeometry(ROOM_SPAN_X, CEILING_THICKNESS, ROOM_DEPTH),
    createPlasticMaterial('livingRoom_ceilingMat', new Color(0.97, 0.93, 0.86)),
  );
  ceiling.name = 'livingRoom_ceiling';
  ceiling.position.set(0, CEILING_Y + CEILING_THICKNESS / 2, BACK_WALL_CENTER_Z - ROOM_DEPTH / 2 + CEILING_DEPTH_OFFSET);
  ceiling.receiveShadow = true;
  scene.add(ceiling);
}

// CEILING_DEPTH_OFFSET moved to ../layout.ts on 2026-08-01. This file's own
// README says "do not invent local sizes that drift from the layout", and this
// was the one dimension in the room that did.
