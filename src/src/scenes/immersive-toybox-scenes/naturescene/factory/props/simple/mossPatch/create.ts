import { CircleGeometry, Group, Mesh, type Material, type Scene } from 'three';
import { seededRng, placementSeed } from '@app/utils/seededRng';
import { createEntityRoot, type EntityPlacement } from '@scenes/immersive-toybox-scenes/naturescene/types';
import { setEllipticalScatterPosition } from '@scenes/immersive-toybox-scenes/naturescene/factory/shared/scatter';
import type { MossPatchBuildOptions } from './types';
import {
  CLUMP_COUNT_MIN,
  CLUMP_COUNT_RANGE,
  PATCH_RADIUS_X_MIN,
  PATCH_RADIUS_X_RANGE,
  PATCH_RADIUS_Z_MIN,
  PATCH_RADIUS_Z_RANGE,
  CLUMP_SIZE_MIN,
  CLUMP_SIZE_RANGE,
  CLUMP_Y_VARIATION,
  SUB_CLUMP_COUNT_MIN,
  SUB_CLUMP_COUNT_RANGE,
  SUB_CLUMP_SCALE_MIN,
  SUB_CLUMP_SCALE_RANGE,
  SUB_CLUMP_Y,
  SUB_CLUMP_POSITION_FACTOR,
} from './constants';

function createMossClump(rand: () => number, radiusX: number, radiusZ: number, index: number, material: Material, parent: Group): void {
  const clumpRoot = new Group();
  const size = CLUMP_SIZE_MIN + rand() * CLUMP_SIZE_RANGE;
  clumpRoot.name = `moss_clump_${index}`;
  setEllipticalScatterPosition(clumpRoot, rand, radiusX, radiusZ, () => rand() * CLUMP_Y_VARIATION);
  parent.add(clumpRoot);

  const disc = new Mesh(new CircleGeometry(size, 8), material);
  disc.name = `moss_disc_${index}`;
  disc.rotation.x = -Math.PI / 2;
  clumpRoot.add(disc);

  const subClumpCount = SUB_CLUMP_COUNT_MIN + Math.floor(rand() * SUB_CLUMP_COUNT_RANGE);
  for (let subIndex = 0; subIndex < subClumpCount; subIndex++) {
    const subSize = size * (SUB_CLUMP_SCALE_MIN + rand() * SUB_CLUMP_SCALE_RANGE);
    const subClump = new Mesh(new CircleGeometry(subSize, 6), material);
    subClump.name = `moss_sub_${index}_${subIndex}`;
    subClump.rotation.x = -Math.PI / 2;
    subClump.position.set((rand() - 0.5) * size * SUB_CLUMP_POSITION_FACTOR, SUB_CLUMP_Y, (rand() - 0.5) * size * SUB_CLUMP_POSITION_FACTOR);
    clumpRoot.add(subClump);
  }
}

function rollDimensions(rand: () => number) {
  return {
    clumpCount: CLUMP_COUNT_MIN + Math.floor(rand() * CLUMP_COUNT_RANGE),
    radiusX: PATCH_RADIUS_X_MIN + rand() * PATCH_RADIUS_X_RANGE,
    radiusZ: PATCH_RADIUS_Z_MIN + rand() * PATCH_RADIUS_Z_RANGE,
  };
}

/**
 * Creates a patch of overlapping moss disc clumps on the ground.
 *
 * @param scene - The Three.js scene to add the moss patch to.
 * @param placement - World-space placement for the patch root.
 * @param options - Build options including the shared moss material.
 * @returns The root group that owns the moss patch geometry.
 */
export function createMossPatch(scene: Scene, placement: EntityPlacement, options: MossPatchBuildOptions): Group {
  const root = createEntityRoot('moss_patch', placement, scene);
  const rand = seededRng(placementSeed(placement.position, 'mossPatch'));
  const { clumpCount, radiusX, radiusZ } = rollDimensions(rand);

  for (let clumpIndex = 0; clumpIndex < clumpCount; clumpIndex++) {
    createMossClump(rand, radiusX, radiusZ, clumpIndex, options.materials.body, root);
  }

  return root;
}
