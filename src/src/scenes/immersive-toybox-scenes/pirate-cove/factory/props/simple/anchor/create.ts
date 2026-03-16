/**
 * Builds a chunky, cartoonish anchor leaning against the railing.
 */

import { CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry, type Scene } from 'three';
import { createEntityRoot, type EntityPlacement } from '../../../../types';
import type { PirateCoveMaterials } from '../../../../materials';
import { CROWN_HEIGHT, CROWN_RADIUS, FLUKE_LENGTH, FLUKE_RADIUS, RING_RADIUS, RING_TUBE_RADIUS, SHANK_HEIGHT, SHANK_RADIUS } from './constants';

/** Shared dependencies required to build one anchor. */
export interface AnchorBuildOptions {
  materials: Pick<PirateCoveMaterials, 'metal'>;
}

/**
 * Creates one staged anchor instance.
 *
 * @param scene - Scene that should receive the anchor.
 * @param placement - World placement from staging.
 * @param options - Shared materials.
 * @returns The root group for the anchor.
 */
export function createAnchor(scene: Scene, placement: EntityPlacement, options: AnchorBuildOptions): Group {
  const root = createEntityRoot('anchor_prop', placement, scene);

  // Lean the anchor slightly against the railing
  root.rotation.z = Math.PI * 0.08;

  // Lift everything so the lowest point (fluke balls) sits at y=0
  const liftY = 0.25;

  // Vertical shank
  const shank = new Mesh(new CylinderGeometry(SHANK_RADIUS, SHANK_RADIUS, SHANK_HEIGHT, 10), options.materials.metal);
  shank.name = 'anchor_shank';
  shank.position.y = SHANK_HEIGHT / 2 + liftY;
  shank.castShadow = true;
  root.add(shank);

  // Crown (cross bar at bottom)
  const crown = new Mesh(new CylinderGeometry(CROWN_RADIUS, CROWN_RADIUS, CROWN_HEIGHT, 10), options.materials.metal);
  crown.name = 'anchor_crown';
  crown.position.y = 0.05 + liftY;
  crown.rotation.z = Math.PI / 2;
  crown.castShadow = true;
  root.add(crown);

  // Left fluke (arm)
  const leftFluke = new Mesh(new CylinderGeometry(FLUKE_RADIUS, FLUKE_RADIUS * 1.8, FLUKE_LENGTH, 8), options.materials.metal);
  leftFluke.name = 'anchor_left_fluke';
  leftFluke.position.set(-0.2, liftY, 0);
  leftFluke.rotation.z = Math.PI * 0.35;
  leftFluke.castShadow = true;
  root.add(leftFluke);

  // Right fluke (arm)
  const rightFluke = new Mesh(new CylinderGeometry(FLUKE_RADIUS, FLUKE_RADIUS * 1.8, FLUKE_LENGTH, 8), options.materials.metal);
  rightFluke.name = 'anchor_right_fluke';
  rightFluke.position.set(0.2, liftY, 0);
  rightFluke.rotation.z = Math.PI * -0.35;
  rightFluke.castShadow = true;
  root.add(rightFluke);

  // Ring at top
  const ring = new Mesh(new TorusGeometry(RING_RADIUS, RING_TUBE_RADIUS, 8, 16), options.materials.metal);
  ring.name = 'anchor_ring';
  ring.position.y = SHANK_HEIGHT + RING_RADIUS * 0.5 + liftY;
  ring.castShadow = true;
  root.add(ring);

  // Chunky ball at the base of each fluke
  const leftBall = new Mesh(new SphereGeometry(FLUKE_RADIUS * 1.5, 8, 8), options.materials.metal);
  leftBall.name = 'anchor_left_ball';
  leftBall.position.set(-0.35, liftY - 0.1, 0);
  root.add(leftBall);

  const rightBall = new Mesh(new SphereGeometry(FLUKE_RADIUS * 1.5, 8, 8), options.materials.metal);
  rightBall.name = 'anchor_right_ball';
  rightBall.position.set(0.35, liftY - 0.1, 0);
  root.add(rightBall);

  return root;
}
