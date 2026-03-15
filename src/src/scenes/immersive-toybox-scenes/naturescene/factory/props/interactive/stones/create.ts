import { Scene, Mesh, SphereGeometry, CylinderGeometry, type Material } from 'three';
import { createEntityRoot, type EntityPlacement } from '@scenes/immersive-toybox-scenes/naturescene/types';
import type { StoneBuildOptions, StoneCreateResult, StoneRevealHandle } from './types';
import { STONE_RADIUS, STONE_SCALE_X, STONE_SCALE_Y, STONE_SCALE_Z, STONE_Y, GRUB_TOP_RADIUS, GRUB_BOTTOM_RADIUS, GRUB_HEIGHT } from './constants';

function createGrub(mat: Material): Mesh {
  const grub = new Mesh(new CylinderGeometry(GRUB_TOP_RADIUS, GRUB_BOTTOM_RADIUS, GRUB_HEIGHT, 6), mat);
  grub.name = 'grub';
  grub.rotation.z = Math.PI / 2;
  return grub;
}

/**
 * Creates a rounded stone on the ground with a hidden grub beneath.
 * Returns typed handles for interaction wiring.
 *
 * @param scene - The Three.js scene to add the stone to.
 * @param placement - World-space placement for the stone.
 * @param options - Build options including body and grub materials.
 * @returns Typed result with root, tap target, and reveal handle.
 */
export function createStone(scene: Scene, placement: EntityPlacement, options: StoneBuildOptions): StoneCreateResult {
  const { materials } = options;
  const root = createEntityRoot('stone_root', placement, scene);

  const stone = new Mesh(new SphereGeometry(STONE_RADIUS, 8, 8), materials.body);
  const revealHandle: StoneRevealHandle = {
    grub: createGrub(materials.grub),
  };
  stone.name = 'stone_cover';
  stone.scale.set(STONE_SCALE_X, STONE_SCALE_Y, STONE_SCALE_Z);
  stone.position.y = STONE_Y;
  stone.castShadow = true;
  root.add(stone);

  return { root, tapTarget: stone, revealHandle };
}
