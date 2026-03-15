import { Group, Mesh, PlaneGeometry, CylinderGeometry, type Material, type Scene } from 'three';
import { seededRng, placementSeed } from '@app/utils/seededRng';
import { createEntityRoot, type EntityPlacement } from '@scenes/immersive-toybox-scenes/naturescene/types';
import type { FernBuildOptions } from './types';
import {
  FROND_COUNT_MIN,
  FROND_COUNT_RANGE,
  FROND_TILT_BASE,
  FROND_TILT_RANGE,
  FROND_ANGLE_JITTER,
  STEM_TOP_RADIUS,
  STEM_BOTTOM_RADIUS,
  STEM_LENGTH_MIN,
  STEM_LENGTH_RANGE,
  LEAFLET_COUNT_MIN,
  LEAFLET_COUNT_RANGE,
  LEAFLET_BASE_SIZE,
  LEAFLET_TAPER,
  LEAFLET_X_OFFSET,
  LEAFLET_ROTATION_Z,
  LEAFLET_ROTATION_Y,
} from './constants';

function addLeafletPair(side: number, leafSize: number, t: number, stemLen: number, frondIdx: number, leafIdx: number, material: Material, parent: Mesh): void {
  const leaflet = new Mesh(new PlaneGeometry(leafSize, leafSize * 2), material);
  leaflet.name = `leaflet_${frondIdx}_${leafIdx}_${side}`;
  leaflet.position.set(side * LEAFLET_X_OFFSET, t * stemLen - stemLen * LEAFLET_TAPER, 0);
  leaflet.rotation.z = side * LEAFLET_ROTATION_Z;
  leaflet.rotation.y = side * LEAFLET_ROTATION_Y;
  parent.add(leaflet);
}

function addLeaflets(frondIdx: number, stemLen: number, material: Material, stem: Mesh, rand: () => number): void {
  const leafletCount = LEAFLET_COUNT_MIN + Math.floor(rand() * LEAFLET_COUNT_RANGE);
  for (let l = 0; l < leafletCount; l++) {
    const t = (l + 1) / (leafletCount + 1);
    const leafSize = LEAFLET_BASE_SIZE * (1 - t * LEAFLET_TAPER);
    [-1, 1].forEach((side) => addLeafletPair(side, leafSize, t, stemLen, frondIdx, l, material, stem));
  }
}

function addFrond(index: number, frondCount: number, material: Material, parent: Group, rand: () => number): void {
  const frondGroup = new Group();
  frondGroup.name = `frond_${index}`;
  frondGroup.rotation.y = (index * Math.PI * 2) / frondCount + rand() * FROND_ANGLE_JITTER;
  frondGroup.rotation.x = FROND_TILT_BASE - rand() * FROND_TILT_RANGE;
  parent.add(frondGroup);

  const stemLen = STEM_LENGTH_MIN + rand() * STEM_LENGTH_RANGE;
  const stem = new Mesh(new CylinderGeometry(STEM_TOP_RADIUS, STEM_BOTTOM_RADIUS, stemLen, 4), material);
  stem.name = `frondStem_${index}`;
  stem.position.y = stemLen / 2;
  frondGroup.add(stem);

  addLeaflets(index, stemLen, material, stem, rand);
}

/**
 * Creates a detailed fern with serrated fronds that have individual leaflets.
 *
 * @param scene - The Three.js scene to add the fern to.
 * @param placement - World-space placement for the fern root.
 * @param options - Build options for the fern factory.
 * @returns The root group that owns the fern meshes.
 */
export function createFern(scene: Scene, placement: EntityPlacement, options: FernBuildOptions): Group {
  const rand = seededRng(placementSeed(placement.position, 'fern'));
  const root = createEntityRoot('fern_root', placement, scene);
  const frondCount = FROND_COUNT_MIN + Math.floor(rand() * FROND_COUNT_RANGE);

  for (let f = 0; f < frondCount; f++) {
    addFrond(f, frondCount, options.materials.frond, root, rand);
  }

  return root;
}
