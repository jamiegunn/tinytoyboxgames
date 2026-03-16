/**
 * Builds the tappable cannon prop — a chunky toy cannon on a wheeled carriage.
 */

import { BoxGeometry, CylinderGeometry, Group, Mesh, type Scene } from 'three';
import { createEntityRoot, type EntityPlacement } from '../../../../types';
import type { PirateCoveMaterials } from '../../../../materials';
import { BARREL_LENGTH, BARREL_MOUTH_RADIUS, BARREL_RADIUS, BASE_DEPTH, BASE_HEIGHT, BASE_WIDTH, WHEEL_RADIUS, WHEEL_THICKNESS } from './constants';

/** Shared dependencies required to build one cannon. */
export interface CannonBuildOptions {
  materials: Pick<PirateCoveMaterials, 'metal' | 'weatheredWood'>;
}

/** Typed handles returned to the interaction layer after mesh creation. */
export interface CannonCreateResult {
  root: Group;
  barrel: Mesh;
  tapTarget: Mesh;
}

/**
 * Creates one staged cannon instance.
 *
 * @param scene - Scene that should receive the cannon.
 * @param placement - World placement from staging.
 * @param options - Shared materials.
 * @returns Typed handles needed by the interaction layer.
 */
export function createCannon(scene: Scene, placement: EntityPlacement, options: CannonBuildOptions): CannonCreateResult {
  const root = createEntityRoot('cannon_prop', placement, scene);

  // Wooden carriage base
  const base = new Mesh(new BoxGeometry(BASE_WIDTH, BASE_HEIGHT, BASE_DEPTH), options.materials.weatheredWood);
  base.name = 'cannon_base';
  base.position.y = BASE_HEIGHT / 2 + WHEEL_RADIUS * 0.6;
  base.castShadow = true;
  base.receiveShadow = true;
  root.add(base);

  // Cannon barrel (horizontal cylinder)
  const barrel = new Mesh(new CylinderGeometry(BARREL_RADIUS, BARREL_MOUTH_RADIUS, BARREL_LENGTH, 16), options.materials.metal);
  barrel.name = 'cannon_barrel';
  barrel.position.set(0, BASE_HEIGHT + WHEEL_RADIUS * 0.6 + BARREL_RADIUS * 0.8, -BASE_DEPTH * 0.1);
  barrel.rotation.x = Math.PI / 2;
  barrel.castShadow = true;
  root.add(barrel);

  // Two wheels on each side
  const wheelPositions = [
    { x: -BASE_WIDTH / 2 - WHEEL_THICKNESS / 2, z: BASE_DEPTH * 0.2 },
    { x: BASE_WIDTH / 2 + WHEEL_THICKNESS / 2, z: BASE_DEPTH * 0.2 },
    { x: -BASE_WIDTH / 2 - WHEEL_THICKNESS / 2, z: -BASE_DEPTH * 0.2 },
    { x: BASE_WIDTH / 2 + WHEEL_THICKNESS / 2, z: -BASE_DEPTH * 0.2 },
  ];

  wheelPositions.forEach((pos, i) => {
    const wheel = new Mesh(new CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_THICKNESS, 12), options.materials.weatheredWood);
    wheel.name = `cannon_wheel_${i}`;
    wheel.position.set(pos.x, WHEEL_RADIUS * 0.6, pos.z);
    wheel.rotation.z = Math.PI / 2;
    wheel.castShadow = true;
    root.add(wheel);
  });

  return { root, barrel, tapTarget: barrel };
}
