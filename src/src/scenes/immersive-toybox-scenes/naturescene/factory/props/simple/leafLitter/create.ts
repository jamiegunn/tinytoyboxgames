import { CircleGeometry, Group, Mesh, type Scene } from 'three';
import { createFeltMaterial, getOrCreateMaterial } from '@app/utils/materialFactory';
import { seededRng, placementSeed } from '@app/utils/seededRng';
import { createEntityRoot, type EntityPlacement } from '@scenes/immersive-toybox-scenes/naturescene/types';
import { randomFullRotation, setEllipticalScatterPosition } from '@scenes/immersive-toybox-scenes/naturescene/factory/shared/scatter';
import {
  LEAF_COLORS,
  LEAF_COUNT_MIN,
  LEAF_COUNT_RANGE,
  CLUSTER_RADIUS_X_MIN,
  CLUSTER_RADIUS_X_RANGE,
  CLUSTER_RADIUS_Z_MIN,
  CLUSTER_RADIUS_Z_RANGE,
  LEAF_SIZE_MIN,
  LEAF_SIZE_RANGE,
  LEAF_Y_VARIATION,
} from './constants';

function getLeafMaterial(index: number) {
  const name = `leafLitterMat_${index}`;
  return getOrCreateMaterial(name, () => createFeltMaterial(name, LEAF_COLORS[index]));
}

function addFallenLeaf(rand: () => number, radiusX: number, radiusZ: number, index: number, parent: Group): void {
  const size = LEAF_SIZE_MIN + rand() * LEAF_SIZE_RANGE;
  const leaf = new Mesh(new CircleGeometry(size, 6), getLeafMaterial(Math.floor(rand() * LEAF_COLORS.length)));
  leaf.name = `fallen_leaf_${index}`;
  leaf.rotation.x = -Math.PI / 2;
  leaf.rotation.z = randomFullRotation(rand);
  setEllipticalScatterPosition(leaf, rand, radiusX, radiusZ, () => rand() * LEAF_Y_VARIATION);
  parent.add(leaf);
}

function rollDimensions(rand: () => number) {
  return {
    leafCount: LEAF_COUNT_MIN + Math.floor(rand() * LEAF_COUNT_RANGE),
    radiusX: CLUSTER_RADIUS_X_MIN + rand() * CLUSTER_RADIUS_X_RANGE,
    radiusZ: CLUSTER_RADIUS_Z_MIN + rand() * CLUSTER_RADIUS_Z_RANGE,
  };
}

/**
 * Creates a cluster of fallen leaf discs scattered on the ground.
 *
 * @param scene - The Three.js scene to add the leaf litter to.
 * @param placement - World-space placement for the leaf litter cluster.
 * @returns The root group containing the fallen leaf meshes.
 */
export function createLeafLitter(scene: Scene, placement: EntityPlacement): Group {
  const root = createEntityRoot('leaf_litter', placement, scene);
  const rand = seededRng(placementSeed(placement.position, 'leafLitter'));
  const { leafCount, radiusX, radiusZ } = rollDimensions(rand);

  for (let leafIndex = 0; leafIndex < leafCount; leafIndex++) {
    addFallenLeaf(rand, radiusX, radiusZ, leafIndex, root);
  }

  return root;
}
