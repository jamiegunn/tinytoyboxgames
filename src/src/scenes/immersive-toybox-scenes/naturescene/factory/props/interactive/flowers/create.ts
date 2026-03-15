import { Color, Group, Mesh, SphereGeometry, CylinderGeometry, type Material, type Scene } from 'three';
import { createGlossyPaintMaterial, createFeltMaterial, getOrCreateMaterial } from '@app/utils/materialFactory';
import { createEntityRoot, type EntityPlacement } from '@scenes/immersive-toybox-scenes/naturescene/types';
import type { FlowerBuildOptions, FlowerCreateResult } from './types';
import {
  STEM_TOP_RADIUS,
  STEM_BOTTOM_RADIUS,
  STEM_HEIGHT,
  STEM_Y,
  CENTER_RADIUS,
  CENTER_Y,
  CENTER_COLOR,
  PETAL_COUNT,
  PETAL_SPHERE_RADIUS,
  PETAL_SCALE_X,
  PETAL_SCALE_Y,
  PETAL_SCALE_Z,
  PETAL_ORBIT_RADIUS,
  PETAL_Y,
} from './constants';

function addStem(material: Material, parent: Group): void {
  const stem = new Mesh(new CylinderGeometry(STEM_TOP_RADIUS, STEM_BOTTOM_RADIUS, STEM_HEIGHT, 6), material);
  stem.name = 'flower_stem';
  stem.position.y = STEM_Y;
  stem.castShadow = true;
  parent.add(stem);
}

function addCenter(parent: Group): Mesh {
  const mat = getOrCreateMaterial('flowerCenterMat', () => createGlossyPaintMaterial('flowerCenterMat', CENTER_COLOR));
  const center = new Mesh(new SphereGeometry(CENTER_RADIUS, 8, 8), mat);
  center.name = 'flower_center';
  center.position.y = CENTER_Y;
  parent.add(center);
  return center;
}

function addPetals(petalColor: Color, parent: Group): Mesh[] {
  const matName = `petalMat_#${petalColor.getHexString()}`;
  const mat = getOrCreateMaterial(matName, () => createFeltMaterial(matName, petalColor));
  const petals: Mesh[] = [];
  for (let p = 0; p < PETAL_COUNT; p++) {
    const petal = new Mesh(new SphereGeometry(PETAL_SPHERE_RADIUS, 6, 6), mat);
    petal.name = `petal_${p}`;
    petal.scale.set(PETAL_SCALE_X, PETAL_SCALE_Y, PETAL_SCALE_Z);
    const angle = (p * Math.PI * 2) / PETAL_COUNT;
    petal.position.set(Math.cos(angle) * PETAL_ORBIT_RADIUS, PETAL_Y, Math.sin(angle) * PETAL_ORBIT_RADIUS);
    petal.rotation.y = angle;
    parent.add(petal);
    petals.push(petal);
  }
  return petals;
}

/**
 * Creates a flower with a stem, center, and five petals that start closed.
 * Returns typed handles for interaction wiring.
 *
 * @param scene - The Three.js scene to add the flower to.
 * @param placement - World-space placement for the flower root.
 * @param options - Build options for the flower factory.
 * @returns Typed result with the root, tap target, and petal meshes.
 */
export function createFlower(scene: Scene, placement: EntityPlacement, options: FlowerBuildOptions): FlowerCreateResult {
  const { config, materials } = options;
  const root = createEntityRoot('flower_root', placement, scene);

  addStem(materials.stem, root);
  const tapTarget = addCenter(root);
  const petals = addPetals(config.petalColor, root);

  return { root, tapTarget, petals };
}
