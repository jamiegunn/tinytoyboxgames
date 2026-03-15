import { BoxGeometry, Color, Mesh, type MeshStandardMaterial, type Scene } from 'three';
import { createPlasticMaterial } from '@app/utils/materialFactory';
import { WALL_HEIGHT, WALL_CENTER_Y, WALL_THICKNESS, ROOM_SPAN_X, BACK_WALL_CENTER_Z } from '@app/scenes/world/places/house/subplaces/playroom/layout';

/**
 * Creates the back wall panel and returns its material for reuse by decals.
 * @param scene - The Three.js scene to add the panel to
 * @returns The wall panel material for decal alignment
 */
export function createBackWallPanel(scene: Scene): MeshStandardMaterial {
  const wallMat = createPlasticMaterial('hub_backWallMat', new Color(0.6, 0.82, 0.88));
  const backWall = new Mesh(new BoxGeometry(ROOM_SPAN_X, WALL_HEIGHT, WALL_THICKNESS), wallMat);
  backWall.name = 'backWall';
  backWall.position.set(0, WALL_CENTER_Y, BACK_WALL_CENTER_Z);
  scene.add(backWall);
  return wallMat;
}
