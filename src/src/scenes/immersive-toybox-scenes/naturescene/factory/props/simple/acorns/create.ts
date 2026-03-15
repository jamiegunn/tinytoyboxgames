import { Group, Mesh, CylinderGeometry, SphereGeometry, type Material, type Scene } from 'three';
import { createGlossyPaintMaterial, createWoodMaterial, getOrCreateMaterial } from '@app/utils/materialFactory';
import { seededRng, placementSeed } from '@app/utils/seededRng';
import { createEntityRoot, type EntityPlacement } from '@scenes/immersive-toybox-scenes/naturescene/types';
import { NUT_RADIUS, NUT_SCALE_Y, NUT_COLOR, CAP_RADIUS, CAP_Y, CAP_COLOR, STEM_RADIUS, STEM_HEIGHT, STEM_Y } from './constants';

function createAcornMaterials() {
  return {
    nut: getOrCreateMaterial('acornNutMat', () => createGlossyPaintMaterial('acornNutMat', NUT_COLOR)),
    cap: getOrCreateMaterial('acornCapMat', () => createWoodMaterial('acornCapMat', CAP_COLOR)),
  };
}

function addNut(material: Material, parent: Group): void {
  const nut = new Mesh(new SphereGeometry(NUT_RADIUS, 8, 8), material);
  nut.name = 'acorn_nut';
  nut.scale.set(1, NUT_SCALE_Y, 1);
  parent.add(nut);
}

function addCap(material: Material, parent: Group): void {
  const cap = new Mesh(new SphereGeometry(CAP_RADIUS, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), material);
  cap.name = 'acorn_cap';
  cap.position.y = CAP_Y;
  cap.rotation.x = Math.PI;
  parent.add(cap);
}

function addStem(material: Material, parent: Group): void {
  const stem = new Mesh(new CylinderGeometry(STEM_RADIUS, STEM_RADIUS, STEM_HEIGHT, 4), material);
  stem.name = 'acorn_stem';
  stem.position.y = STEM_Y;
  parent.add(stem);
}

/**
 * Creates a decorative acorn with a nut, textured cap, and tiny stem.
 *
 * @param scene - The Three.js scene to add the acorn to.
 * @param placement - World-space placement for the acorn root.
 * @returns The root group that owns the acorn meshes.
 */
export function createAcorn(scene: Scene, placement: EntityPlacement): Group {
  const root = createEntityRoot('acorn_root', placement, scene);
  if (placement.rotY == null) {
    const rand = seededRng(placementSeed(placement.position, 'acorn'));
    root.rotation.y = rand() * Math.PI;
  }

  const mats = createAcornMaterials();
  addNut(mats.nut, root);
  addCap(mats.cap, root);
  addStem(mats.cap, root);

  return root;
}
