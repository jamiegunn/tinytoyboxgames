import { BoxGeometry, Color, Mesh, type Scene } from 'three';
import { createPlasticMaterial } from '@app/utils/materialFactory';
import { BACK_WALL_CENTER_Z, CEILING_Y, LEFT_WALL_X, RIGHT_WALL_X, ROOM_DEPTH, WALL_HEIGHT, WALL_THICKNESS } from '../layout';

/**
 * Creates the three-wall shell for the generated room.
 *
 * The template keeps this intentionally simple: three painted wall boxes that
 * define the room volume without trying to carry over all of Playroom's custom
 * trim and wallpaper detail.
 *
 * @param scene - The Three.js scene that receives the wall meshes.
 */
export function createWalls(scene: Scene): void {
  const wallMaterial = createPlasticMaterial('__SCENE_ID___wallMat', new Color(0.9, 0.82, 0.72));
  wallMaterial.roughness = 0.55;

  const backWall = new Mesh(new BoxGeometry(LEFT_WALL_X - RIGHT_WALL_X + WALL_THICKNESS, WALL_HEIGHT, WALL_THICKNESS), wallMaterial);
  backWall.position.set(0, CEILING_Y / 2, BACK_WALL_CENTER_Z);
  backWall.receiveShadow = true;
  scene.add(backWall);

  const leftWall = new Mesh(new BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, ROOM_DEPTH), wallMaterial);
  leftWall.position.set(LEFT_WALL_X, CEILING_Y / 2, -1.2);
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  const rightWall = new Mesh(new BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, ROOM_DEPTH), wallMaterial);
  rightWall.position.set(RIGHT_WALL_X, CEILING_Y / 2, -1.2);
  rightWall.receiveShadow = true;
  scene.add(rightWall);
}
