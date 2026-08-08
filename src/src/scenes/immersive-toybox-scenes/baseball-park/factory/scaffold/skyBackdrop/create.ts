/**
 * Creates a simple backdrop plane behind the generated immersive scene.
 *
 * This file stays intentionally lightweight so authors can see the scaffold
 * seam clearly: walls and backdrop belong to scaffold, not to props.
 */

import { Mesh, PlaneGeometry, type Material, type Scene } from 'three';

/** Options controlling the backdrop plane placement and size. */
export interface SkyBackdropBuildOptions {
  width: number;
  height: number;
  y: number;
  z: number;
  material: Material;
}

/**
 * Builds and places a backdrop plane.
 *
 * @param scene - Scene that should receive the backdrop mesh.
 * @param options - Dimensions, position, and material for the backdrop.
 * @returns The created backdrop mesh.
 */
export function createSkyBackdrop(scene: Scene, options: SkyBackdropBuildOptions): Mesh {
  const backdrop = new Mesh(new PlaneGeometry(options.width, options.height), options.material);
  backdrop.name = 'sky_backdrop';
  backdrop.position.set(0, options.y, options.z);
  scene.add(backdrop);
  return backdrop;
}
