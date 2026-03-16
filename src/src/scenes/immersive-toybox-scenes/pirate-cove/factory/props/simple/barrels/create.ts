/**
 * Builds a single barrel prop — a round wooden barrel with metal rims.
 */

import { CylinderGeometry, Group, Mesh, type Scene } from 'three';
import { createEntityRoot, type EntityPlacement } from '../../../../types';
import type { PirateCoveMaterials } from '../../../../materials';
import { BARREL_HEIGHT, BARREL_RADIUS, BARREL_RIM_HEIGHT, BARREL_RIM_RADIUS } from './constants';

/** Shared dependencies required to build one barrel. */
export interface BarrelBuildOptions {
  materials: Pick<PirateCoveMaterials, 'weatheredWood' | 'metal'>;
}

/**
 * Creates one staged barrel instance.
 *
 * @param scene - Scene that should receive the barrel.
 * @param placement - World placement from staging.
 * @param options - Shared materials.
 * @returns The root group for the barrel.
 */
export function createBarrel(scene: Scene, placement: EntityPlacement, options: BarrelBuildOptions): Group {
  const root = createEntityRoot('barrel_prop', placement, scene);

  // Main barrel body
  const body = new Mesh(new CylinderGeometry(BARREL_RADIUS, BARREL_RADIUS * 0.92, BARREL_HEIGHT, 16), options.materials.weatheredWood);
  body.name = 'barrel_body';
  body.position.y = BARREL_HEIGHT / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  // Top metal rim
  const topRim = new Mesh(new CylinderGeometry(BARREL_RIM_RADIUS, BARREL_RIM_RADIUS, BARREL_RIM_HEIGHT, 16), options.materials.metal);
  topRim.name = 'barrel_top_rim';
  topRim.position.y = BARREL_HEIGHT * 0.85;
  topRim.castShadow = true;
  root.add(topRim);

  // Bottom metal rim
  const bottomRim = new Mesh(new CylinderGeometry(BARREL_RIM_RADIUS, BARREL_RIM_RADIUS, BARREL_RIM_HEIGHT, 16), options.materials.metal);
  bottomRim.name = 'barrel_bottom_rim';
  bottomRim.position.y = BARREL_HEIGHT * 0.15;
  bottomRim.castShadow = true;
  root.add(bottomRim);

  // Middle metal band
  const middleBand = new Mesh(new CylinderGeometry(BARREL_RIM_RADIUS * 0.99, BARREL_RIM_RADIUS * 0.99, BARREL_RIM_HEIGHT, 16), options.materials.metal);
  middleBand.name = 'barrel_middle_band';
  middleBand.position.y = BARREL_HEIGHT / 2;
  middleBand.castShadow = true;
  root.add(middleBand);

  return root;
}
