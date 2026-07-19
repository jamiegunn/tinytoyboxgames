import { BoxGeometry, Color, Mesh, type Scene } from 'three';
import { createPlasticMaterial, createWoodMaterial } from '@app/utils/materialFactory';
import {
  BACK_WALL_CENTER_Z,
  BACK_WALL_FACE_Z,
  CEILING_Y,
  LEFT_WALL_X,
  LEFT_WALL_FACE_X,
  RIGHT_WALL_X,
  RIGHT_WALL_FACE_X,
  ROOM_DEPTH,
  WALL_HEIGHT,
  WALL_THICKNESS,
} from '../layout';

/** Z center shared by both side walls (matches the shell footprint). */
const SIDE_WALL_CENTER_Z = -1.2;

/** Baseboard cross-section. */
const BASEBOARD_HEIGHT = 0.24;
const BASEBOARD_DEPTH = 0.14;

/**
 * Creates the Kitchen's three-wall shell: warm biscuit-cream paint with a
 * soft wooden baseboard running along every wall, matching the Living Room's
 * wall treatment so the two rooms read as one house.
 *
 * @param scene - The Three.js scene that receives the wall meshes.
 */
export function createWalls(scene: Scene): void {
  const wallMaterial = createPlasticMaterial('kitchen_wallMat', new Color(0.93, 0.86, 0.7));
  wallMaterial.roughness = 0.55;
  const baseboardMaterial = createWoodMaterial('kitchen_baseboardMat', new Color(0.82, 0.7, 0.55));

  const backWall = new Mesh(new BoxGeometry(LEFT_WALL_X - RIGHT_WALL_X + WALL_THICKNESS, WALL_HEIGHT, WALL_THICKNESS), wallMaterial);
  backWall.name = 'kitchen_backWall';
  backWall.position.set(0, CEILING_Y / 2, BACK_WALL_CENTER_Z);
  backWall.receiveShadow = true;
  scene.add(backWall);

  const leftWall = new Mesh(new BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, ROOM_DEPTH), wallMaterial);
  leftWall.name = 'kitchen_leftWall';
  leftWall.position.set(LEFT_WALL_X, CEILING_Y / 2, SIDE_WALL_CENTER_Z);
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  const rightWall = new Mesh(new BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, ROOM_DEPTH), wallMaterial);
  rightWall.name = 'kitchen_rightWall';
  rightWall.position.set(RIGHT_WALL_X, CEILING_Y / 2, SIDE_WALL_CENTER_Z);
  rightWall.receiveShadow = true;
  scene.add(rightWall);

  // Baseboards: one along the back wall, one along each side wall.
  const roomSpanX = LEFT_WALL_X - RIGHT_WALL_X + WALL_THICKNESS;
  const backBaseboard = new Mesh(new BoxGeometry(roomSpanX, BASEBOARD_HEIGHT, BASEBOARD_DEPTH), baseboardMaterial);
  backBaseboard.name = 'kitchen_backBaseboard';
  backBaseboard.position.set(0, BASEBOARD_HEIGHT / 2, BACK_WALL_FACE_Z - BASEBOARD_DEPTH / 2 + 0.05);
  scene.add(backBaseboard);

  const leftBaseboard = new Mesh(new BoxGeometry(BASEBOARD_DEPTH, BASEBOARD_HEIGHT, ROOM_DEPTH), baseboardMaterial);
  leftBaseboard.name = 'kitchen_leftBaseboard';
  leftBaseboard.position.set(LEFT_WALL_FACE_X - BASEBOARD_DEPTH / 2 + 0.05, BASEBOARD_HEIGHT / 2, SIDE_WALL_CENTER_Z);
  scene.add(leftBaseboard);

  const rightBaseboard = new Mesh(new BoxGeometry(BASEBOARD_DEPTH, BASEBOARD_HEIGHT, ROOM_DEPTH), baseboardMaterial);
  rightBaseboard.name = 'kitchen_rightBaseboard';
  rightBaseboard.position.set(RIGHT_WALL_FACE_X + BASEBOARD_DEPTH / 2 - 0.05, BASEBOARD_HEIGHT / 2, SIDE_WALL_CENTER_Z);
  scene.add(rightBaseboard);
}
