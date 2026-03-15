import { Scene, Group } from 'three';
import { seededRng, placementSeed } from '@app/utils/seededRng';
import { createEntityRoot, type EntityPlacement } from '@scenes/immersive-toybox-scenes/naturescene/types';
import { lerp } from '@app/utils/mathHelpers';
import { createTreeMaterials } from './materials';
import { addTrunk } from './trunk';
import { addRoots } from './roots';
import { addCanopy } from './canopy';
import {
  TRUNK_HEIGHT_MIN,
  TRUNK_HEIGHT_MAX,
  TRUNK_BASE_RADIUS_MIN,
  TRUNK_BASE_RADIUS_MAX,
  TRUNK_TOP_RADIUS_SCALE_MIN,
  TRUNK_TOP_RADIUS_SCALE_MAX,
  CROWN_Y_RATIO,
} from './constants';

interface TreeDimensions {
  trunkHeight: number;
  baseRadius: number;
  topRadius: number;
}

/**
 * Rolls the main trunk dimensions for a procedural tree from a seeded RNG.
 *
 * @param rng - Deterministic random source for this tree instance.
 * @returns The trunk height and radius values for the tree.
 */
function rollDimensions(rng: () => number): TreeDimensions {
  const trunkHeight = lerp(TRUNK_HEIGHT_MIN, TRUNK_HEIGHT_MAX, rng());
  const baseRadius = lerp(TRUNK_BASE_RADIUS_MIN, TRUNK_BASE_RADIUS_MAX, rng());
  return {
    trunkHeight,
    baseRadius,
    topRadius: baseRadius * lerp(TRUNK_TOP_RADIUS_SCALE_MIN, TRUNK_TOP_RADIUS_SCALE_MAX, rng()),
  };
}

/**
 * Creates a procedural tree by rolling shared dimensions, creating the
 * bark/canopy materials, and delegating trunk, roots, and canopy assembly
 * to focused part modules.
 *
 * @param scene - The Three.js scene to add the tree to.
 * @param placement - World-space placement for the tree root.
 * @returns The root group that owns the full procedural tree.
 */
export function createTree(scene: Scene, placement: EntityPlacement): Group {
  const { position } = placement;
  const rng = seededRng(placementSeed(position, 'tree'));
  const seed = placementSeed(position, 'treeMaterial');
  const { trunkHeight, baseRadius, topRadius } = rollDimensions(rng);
  const materials = createTreeMaterials(seed);
  const root = createEntityRoot(`tree_${position.x.toFixed(1)}_${position.z.toFixed(1)}`, placement, scene);

  addTrunk(trunkHeight, baseRadius, topRadius, seed, materials.bark, root);
  addRoots(root, materials.bark, rng, seed, baseRadius);
  addCanopy(rng, seed, trunkHeight * CROWN_Y_RATIO, materials.canopy, root);

  return root;
}
