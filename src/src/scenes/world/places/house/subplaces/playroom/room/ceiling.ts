import { BoxGeometry, Color, Mesh, type Scene } from 'three';
import { createPlasticMaterial } from '@app/utils/materialFactory';
import { CEILING_Y, CEILING_THICKNESS, ROOM_SPAN_X, ROOM_DEPTH } from '@app/scenes/world/places/house/subplaces/playroom/layout';

/**
 * Creates the room ceiling.
 * @param scene - The Three.js scene to add the ceiling to
 */
export function createCeiling(scene: Scene): void {
  const ceilingMat = createPlasticMaterial('hub_ceilingMat', new Color(0.95, 0.95, 0.97));
  const ceiling = new Mesh(new BoxGeometry(ROOM_SPAN_X, CEILING_THICKNESS, ROOM_DEPTH), ceilingMat);
  ceiling.name = 'ceiling';
  ceiling.position.set(0, CEILING_Y, 0);
  scene.add(ceiling);
}
