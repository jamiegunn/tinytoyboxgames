import type { Scene } from 'three';
import { createLeftWallPanel } from './leftWall/panel';
import { createLeftWallTrim } from './leftWall/trim';
import { createLeftWallDecals } from './leftWall/decals';
import { createLeftWallWindow } from '../../window';

/**
 * Creates the left wall panel, trim, decorative decals, and window.
 * @param scene - The Three.js scene to add the left wall to
 */
export function createLeftWall(scene: Scene): void {
  createLeftWallPanel(scene);
  createLeftWallTrim(scene);
  createLeftWallDecals(scene);
  createLeftWallWindow(scene);
}
