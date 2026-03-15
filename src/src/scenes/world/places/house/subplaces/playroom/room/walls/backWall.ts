import type { Scene } from 'three';
import { createBackWallPanel } from './backWall/panel';
import { createBackWallTrim } from './backWall/trim';
import { createBackWallDecals } from './backWall/decals';
import { createWindow } from '../../window';

/**
 * Creates the back wall panel, trim, decorative decals, and window.
 * @param scene - The Three.js scene to add the back wall to
 */
export function createBackWall(scene: Scene): void {
  const wallMat = createBackWallPanel(scene);
  createBackWallTrim(scene);
  createBackWallDecals(scene, wallMat);
  createWindow(scene);
}
