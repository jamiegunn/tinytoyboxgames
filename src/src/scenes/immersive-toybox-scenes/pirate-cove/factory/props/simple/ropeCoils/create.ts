/**
 * Builds a coiled rope pile on the deck using stacked torus geometry.
 */

import { Group, Mesh, TorusGeometry, type Scene } from 'three';
import { createEntityRoot, type EntityPlacement } from '../../../../types';
import type { PirateCoveMaterials } from '../../../../materials';
import { COIL_RADIUS, COIL_STACK_COUNT, COIL_STACK_OFFSET, COIL_TUBE_RADIUS } from './constants';

/** Shared dependencies required to build one rope coil pile. */
export interface RopeCoilBuildOptions {
  materials: Pick<PirateCoveMaterials, 'rope'>;
}

/**
 * Creates one staged rope coil instance.
 *
 * @param scene - Scene that should receive the rope coil.
 * @param placement - World placement from staging.
 * @param options - Shared materials.
 * @returns The root group for the rope coil.
 */
export function createRopeCoil(scene: Scene, placement: EntityPlacement, options: RopeCoilBuildOptions): Group {
  const root = createEntityRoot('rope_coil_prop', placement, scene);

  // Stack multiple torus rings to simulate a coiled pile of rope
  for (let i = 0; i < COIL_STACK_COUNT; i++) {
    const shrinkFactor = 1 - i * 0.12;
    const coil = new Mesh(new TorusGeometry(COIL_RADIUS * shrinkFactor, COIL_TUBE_RADIUS, 8, 20), options.materials.rope);
    coil.name = `rope_coil_ring_${i}`;
    coil.position.y = COIL_TUBE_RADIUS + i * (COIL_TUBE_RADIUS * 2 + COIL_STACK_OFFSET);
    coil.rotation.x = Math.PI / 2;
    coil.castShadow = true;
    coil.receiveShadow = true;
    root.add(coil);
  }

  return root;
}
