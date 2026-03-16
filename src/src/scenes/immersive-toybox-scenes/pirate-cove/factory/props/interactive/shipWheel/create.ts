/**
 * Builds the tappable ship wheel (helm) prop.
 *
 * A classic ship wheel with spokes and handles, mounted on a vertical post.
 */

import { CylinderGeometry, Group, Mesh, TorusGeometry, type Scene } from 'three';
import { createEntityRoot, type EntityPlacement } from '../../../../types';
import type { PirateCoveMaterials } from '../../../../materials';
import {
  HANDLE_LENGTH,
  HANDLE_RADIUS,
  HUB_DEPTH,
  HUB_RADIUS,
  POST_HEIGHT,
  POST_RADIUS,
  SPOKE_COUNT,
  SPOKE_LENGTH,
  SPOKE_RADIUS,
  WHEEL_RADIUS,
  WHEEL_TUBE_RADIUS,
} from './constants';

/** Shared dependencies required to build one ship wheel. */
export interface ShipWheelBuildOptions {
  materials: Pick<PirateCoveMaterials, 'weatheredWood'>;
}

/** Typed handles returned to the interaction layer after mesh creation. */
export interface ShipWheelCreateResult {
  root: Group;
  wheelGroup: Group;
  tapTarget: Mesh;
}

/**
 * Creates one staged ship wheel instance.
 *
 * @param scene - Scene that should receive the wheel.
 * @param placement - World placement from staging.
 * @param options - Shared materials.
 * @returns Typed handles needed by the interaction layer.
 */
export function createShipWheel(scene: Scene, placement: EntityPlacement, options: ShipWheelBuildOptions): ShipWheelCreateResult {
  const root = createEntityRoot('ship_wheel_prop', placement, scene);

  // Vertical post
  const post = new Mesh(new CylinderGeometry(POST_RADIUS, POST_RADIUS * 1.1, POST_HEIGHT, 10), options.materials.weatheredWood);
  post.name = 'wheel_post';
  post.position.y = POST_HEIGHT / 2;
  post.castShadow = true;
  root.add(post);

  // Wheel group — rotates around Z axis (wheel face is in X-Y plane)
  const wheelGroup = new Group();
  wheelGroup.name = 'wheel_rotation_group';
  wheelGroup.position.y = POST_HEIGHT;
  root.add(wheelGroup);

  // Outer ring (torus)
  const ring = new Mesh(new TorusGeometry(WHEEL_RADIUS, WHEEL_TUBE_RADIUS, 8, 24), options.materials.weatheredWood);
  ring.name = 'wheel_ring';
  ring.castShadow = true;
  wheelGroup.add(ring);

  // Hub (cylinder)
  const hub = new Mesh(new CylinderGeometry(HUB_RADIUS, HUB_RADIUS, HUB_DEPTH, 12), options.materials.weatheredWood);
  hub.name = 'wheel_hub';
  hub.rotation.x = Math.PI / 2;
  hub.castShadow = true;
  wheelGroup.add(hub);

  // Spokes + handles
  for (let i = 0; i < SPOKE_COUNT; i++) {
    const angle = (i / SPOKE_COUNT) * Math.PI * 2;

    // Spoke
    const spoke = new Mesh(new CylinderGeometry(SPOKE_RADIUS, SPOKE_RADIUS, SPOKE_LENGTH, 6), options.materials.weatheredWood);
    spoke.name = `wheel_spoke_${i}`;
    spoke.position.set(Math.cos(angle) * (SPOKE_LENGTH / 2 + HUB_RADIUS * 0.5), Math.sin(angle) * (SPOKE_LENGTH / 2 + HUB_RADIUS * 0.5), 0);
    spoke.rotation.z = angle - Math.PI / 2;
    spoke.castShadow = true;
    wheelGroup.add(spoke);

    // Handle (extends beyond the ring)
    const handle = new Mesh(new CylinderGeometry(HANDLE_RADIUS, HANDLE_RADIUS, HANDLE_LENGTH, 6), options.materials.weatheredWood);
    handle.name = `wheel_handle_${i}`;
    handle.position.set(Math.cos(angle) * (WHEEL_RADIUS + HANDLE_LENGTH * 0.4), Math.sin(angle) * (WHEEL_RADIUS + HANDLE_LENGTH * 0.4), 0);
    handle.rotation.z = angle - Math.PI / 2;
    handle.castShadow = true;
    wheelGroup.add(handle);
  }

  return { root, wheelGroup, tapTarget: ring };
}
