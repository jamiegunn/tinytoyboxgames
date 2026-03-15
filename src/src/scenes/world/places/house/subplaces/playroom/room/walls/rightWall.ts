import type { Scene } from 'three';
import { createRightWallPanel } from './rightWall/panel';
import { createRightWallTrim } from './rightWall/trim';
import { createRightWallDecals } from './rightWall/decals';

/**
 * Creates the right wall panel, trim, and decorative decals.
 * @param scene - The Three.js scene to add the right wall to
 */
export function createRightWall(scene: Scene): void {
  createRightWallPanel(scene);
  createRightWallTrim(scene);
  createRightWallDecals(scene);
}
