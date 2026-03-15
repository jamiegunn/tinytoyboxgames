import { Scene, Mesh, Group, CircleGeometry, SphereGeometry, type Material } from 'three';
import { createEntityRoot, type EntityPlacement } from '@scenes/immersive-toybox-scenes/naturescene/types';
import type { LeafBuildOptions, LeafCreateResult, LeafRevealHandle } from './types';
import { LEAF_DISC_RADIUS, LADYBUG_RADIUS, SPOT_COUNT, SPOT_RADIUS, SPOT_SPACING, SPOT_Y } from './constants';

function addLeafDisc(material: Material, parent: Group): Mesh {
  const geo = new CircleGeometry(LEAF_DISC_RADIUS, 8);
  geo.rotateX(-Math.PI / 2);
  const leaf = new Mesh(geo, material);
  leaf.name = 'leaf_cover';
  parent.add(leaf);
  return leaf;
}

function createLadybug(bodyMat: Material, spotMat: Material): Mesh {
  const bug = new Mesh(new SphereGeometry(LADYBUG_RADIUS, 8, 8), bodyMat);
  bug.name = 'ladybug';

  for (let s = 0; s < SPOT_COUNT; s++) {
    const spot = new Mesh(new SphereGeometry(SPOT_RADIUS, 6, 6), spotMat);
    spot.name = `ladybug_spot_${s}`;
    spot.position.set((s - 1) * SPOT_SPACING, SPOT_Y, 0);
    bug.add(spot);
  }

  return bug;
}

/**
 * Creates a flat leaf disc on the ground with a hidden ladybug beneath.
 * Returns typed handles for interaction wiring.
 *
 * @param scene - The Three.js scene to add the leaf root to.
 * @param placement - World-space placement for the leaf root.
 * @param options - Build options including the leaf and ladybug materials.
 * @returns Typed result with root, tap target, and reveal handle.
 */
export function createLeaf(scene: Scene, placement: EntityPlacement, options: LeafBuildOptions): LeafCreateResult {
  const { materials } = options;
  const root = createEntityRoot('leaf_root', placement, scene);

  const tapTarget = addLeafDisc(materials.body, root);
  const revealHandle: LeafRevealHandle = {
    ladybug: createLadybug(materials.ladybug, materials.ladybugSpot),
  };

  return { root, tapTarget, revealHandle };
}
