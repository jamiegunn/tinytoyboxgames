import type { Scene } from 'three';
import { createRightWall } from './walls/rightWall';
import { createLeftWall } from './walls/leftWall';
import { createBackWall } from './walls/backWall';

/**
 * Creates all three walls (left, right, back) with their trim and decals.
 * @param scene - The Three.js scene to add the walls to
 */
export function createWalls(scene: Scene): void {
  createRightWall(scene);
  createLeftWall(scene);
  createBackWall(scene);
}
