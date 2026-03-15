import { ConeGeometry, Group, Mesh, type Material, type Scene } from 'three';
import { seededRng, placementSeed } from '@app/utils/seededRng';
import { createEntityRoot, type EntityPlacement } from '@scenes/immersive-toybox-scenes/naturescene/types';
import { randomFullRotation, setEllipticalScatterPosition } from '@scenes/immersive-toybox-scenes/naturescene/factory/shared/scatter';
import type { GrassPatchBuildOptions } from './types';
import {
  TUFT_COUNT_MIN,
  TUFT_COUNT_RANGE,
  PATCH_RADIUS_X_MIN,
  PATCH_RADIUS_X_RANGE,
  PATCH_RADIUS_Z_MIN,
  PATCH_RADIUS_Z_RANGE,
  BLADE_COUNT_MIN,
  BLADE_COUNT_RANGE,
  BLADE_HEIGHT_MIN,
  BLADE_HEIGHT_RANGE,
  BLADE_RADIUS,
  BLADE_POSITION_RANGE,
  BLADE_ROTATION_RANGE,
} from './constants';

function rollDimensions(rand: () => number) {
  return {
    tuftCount: TUFT_COUNT_MIN + Math.floor(rand() * TUFT_COUNT_RANGE),
    radiusX: PATCH_RADIUS_X_MIN + rand() * PATCH_RADIUS_X_RANGE,
    radiusZ: PATCH_RADIUS_Z_MIN + rand() * PATCH_RADIUS_Z_RANGE,
  };
}

function addBlade(rand: () => number, index: number, material: Material, parent: Group): void {
  const height = BLADE_HEIGHT_MIN + rand() * BLADE_HEIGHT_RANGE;
  const blade = new Mesh(new ConeGeometry(BLADE_RADIUS, height, 3), material);
  blade.name = `blade_${index}`;
  blade.position.set((rand() - 0.5) * BLADE_POSITION_RANGE, height / 2, (rand() - 0.5) * BLADE_POSITION_RANGE);
  blade.rotation.x = (rand() - 0.5) * BLADE_ROTATION_RANGE;
  blade.rotation.z = (rand() - 0.5) * BLADE_ROTATION_RANGE;
  parent.add(blade);
}

function addBlades(rand: () => number, material: Material, parent: Group): void {
  const bladeCount = BLADE_COUNT_MIN + Math.floor(rand() * BLADE_COUNT_RANGE);
  for (let i = 0; i < bladeCount; i++) {
    addBlade(rand, i, material, parent);
  }
}

function createTuft(rand: () => number, index: number, radiusX: number, radiusZ: number, bladeMaterial: Material, parent: Group): void {
  const tuft = new Group();
  tuft.name = `grass_tuft_${index}`;
  setEllipticalScatterPosition(tuft, rand, radiusX, radiusZ);
  tuft.rotation.y = randomFullRotation(rand);
  parent.add(tuft);

  addBlades(rand, bladeMaterial, tuft);
}

/**
 * Creates a scattered grass patch with multiple tufts of cone-shaped blades.
 *
 * @param scene - The Three.js scene to add the grass patch to.
 * @param placement - World-space placement for the patch root.
 * @param options - Build options including the shared grass blade material.
 * @returns The root group that owns the grass patch geometry.
 */
export function createGrassPatch(scene: Scene, placement: EntityPlacement, options: GrassPatchBuildOptions): Group {
  const root = createEntityRoot('grass_patch', placement, scene);
  const rand = seededRng(placementSeed(placement.position, 'grassPatch'));
  const { tuftCount, radiusX, radiusZ } = rollDimensions(rand);

  for (let i = 0; i < tuftCount; i++) {
    createTuft(rand, i, radiusX, radiusZ, options.materials.blade, root);
  }

  return root;
}
