import { BoxGeometry, Color, Mesh, type Scene } from 'three';
import { createPlasticMaterial } from '@app/utils/materialFactory';
import { WALL_HEIGHT, WALL_CENTER_Y, WALL_THICKNESS, ROOM_DEPTH, LEFT_WALL_X } from '@app/scenes/world/places/house/subplaces/playroom/layout';

/**
 * Creates the left wall panel.
 * @param scene - The Three.js scene to add the panel to
 */
export function createLeftWallPanel(scene: Scene): void {
  const wallMat = createPlasticMaterial('hub_leftWallMat', new Color(0.6, 0.82, 0.88));
  const leftWall = new Mesh(new BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, ROOM_DEPTH), wallMat);
  leftWall.name = 'leftWall';
  leftWall.position.set(LEFT_WALL_X, WALL_CENTER_Y, 0);
  scene.add(leftWall);
}
