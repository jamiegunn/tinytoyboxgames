import { Group, Mesh, SphereGeometry, CylinderGeometry, type Material, type Scene } from 'three';
import { createGlossyPaintMaterial, getOrCreateMaterial } from '@app/utils/materialFactory';
import { createEntityRoot, type EntityPlacement } from '@scenes/immersive-toybox-scenes/naturescene/types';
import type { MushroomBuildOptions, MushroomConfig, MushroomCreateResult } from './types';
import {
  STEM_TOP_RADIUS_RATIO,
  STEM_BOTTOM_RADIUS_RATIO,
  STEM_HEIGHT_RATIO,
  STEM_Y_RATIO,
  CAP_SPHERE_RADIUS,
  CAP_SCALE_X_RATIO,
  CAP_SCALE_Y_RATIO,
  CAP_SCALE_Z_RATIO,
  CAP_Y_RATIO,
  SPOT_COUNT,
  SPOT_RADIUS_RATIO,
  SPOT_ORBIT_RADIUS_RATIO,
  SPOT_Y_RATIO,
  SPOT_ANGLE_OFFSET,
  SPOT_COLOR,
  RED_SPOT_THRESHOLD,
} from './constants';

function addStem(config: MushroomConfig, material: Material, parent: Group): void {
  const stem = new Mesh(
    new CylinderGeometry((STEM_TOP_RADIUS_RATIO * config.scale) / 2, (STEM_BOTTOM_RADIUS_RATIO * config.scale) / 2, STEM_HEIGHT_RATIO * config.scale, 8),
    material,
  );
  stem.name = 'mush_stem';
  stem.position.y = STEM_Y_RATIO * config.scale;
  stem.castShadow = true;
  parent.add(stem);
}

function addCap(config: MushroomConfig, parent: Group): Mesh {
  const matName = `mushCapMat_#${config.capColor.getHexString()}`;
  const mat = getOrCreateMaterial(matName, () => createGlossyPaintMaterial(matName, config.capColor));
  const cap = new Mesh(new SphereGeometry(CAP_SPHERE_RADIUS, 10, 10), mat);
  cap.name = 'mush_cap';
  cap.scale.set(CAP_SCALE_X_RATIO * config.scale, CAP_SCALE_Y_RATIO * config.scale, CAP_SCALE_Z_RATIO * config.scale);
  cap.position.y = CAP_Y_RATIO * config.scale;
  cap.castShadow = true;
  parent.add(cap);
  return cap;
}

function addSpots(config: MushroomConfig, cap: Mesh): void {
  if (config.capColor.r <= RED_SPOT_THRESHOLD) return;
  const mat = getOrCreateMaterial('mushSpotMat', () => createGlossyPaintMaterial('mushSpotMat', SPOT_COLOR));
  for (let s = 0; s < SPOT_COUNT; s++) {
    const spot = new Mesh(new SphereGeometry((SPOT_RADIUS_RATIO * config.scale) / 2, 6, 6), mat);
    spot.name = `mush_spot_${s}`;
    const angle = (s * Math.PI) / 2 + SPOT_ANGLE_OFFSET;
    spot.position.set(
      Math.cos(angle) * SPOT_ORBIT_RADIUS_RATIO * config.scale,
      SPOT_Y_RATIO * config.scale,
      Math.sin(angle) * SPOT_ORBIT_RADIUS_RATIO * config.scale,
    );
    cap.add(spot);
  }
}

/**
 * Creates a toy mushroom with a stem, cap, and optional white spots.
 * Returns typed handles for interaction wiring.
 *
 * @param scene - The Three.js scene to add the mushroom to.
 * @param placement - World-space placement for the mushroom root.
 * @param options - Build options including mushroom config and materials.
 * @returns Typed result with the root and tap target.
 */
export function createMushroom(scene: Scene, placement: EntityPlacement, options: MushroomBuildOptions): MushroomCreateResult {
  const { config, materials } = options;
  const root = createEntityRoot('mushroom_root', placement, scene);

  addStem(config, materials.stem, root);
  const tapTarget = addCap(config, root);
  addSpots(config, tapTarget);

  return { root, tapTarget };
}
