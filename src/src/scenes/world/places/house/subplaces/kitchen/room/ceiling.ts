import { BoxGeometry, Color, Mesh, type Scene } from 'three';
import { createPlasticMaterial } from '@app/utils/materialFactory';
import { BACK_WALL_CENTER_Z, CEILING_DEPTH_OFFSET, CEILING_THICKNESS, CEILING_Y, ROOM_DEPTH, ROOM_SPAN_X } from '../layout';

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
  // NAMED, and it shipped without a name. Every classifier in this repo that
  // has to tell scenery from content reads mesh names — the frame-composition
  // guard in tests/room/room-opening-framing.test.mjs counted this 11 x 20 slab
  // as a PROP, which flattered the Kitchen's prop share and made its ceiling
  // share read as zero. An unnamed mesh is not a cosmetic omission here.
  ceiling.name = 'kitchen_ceiling';
  ceiling.position.set(0, CEILING_Y + CEILING_THICKNESS / 2, BACK_WALL_CENTER_Z - ROOM_DEPTH / 2 + CEILING_DEPTH_OFFSET);
  ceiling.receiveShadow = true;
  scene.add(ceiling);
}
