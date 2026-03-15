/**
 * Builds the generated simple prop example.
 *
 * The prop is intentionally simple: a small stacked floor marker with a few
 * accent tokens. The geometry is not the point. The point is to show where
 * authored mesh creation belongs when a prop does not own interactions.
 */

import { CylinderGeometry, Group, Mesh, SphereGeometry, type Scene } from 'three';
import { createEntityRoot, type EntityPlacement } from '../../../../types';
import type { ImmersiveSceneMaterials } from '../../../../materials';
import {
  ACCENT_HEIGHT,
  ACCENT_RADIUS,
  BASE_HEIGHT,
  BASE_RADIUS,
  SIDE_TOKEN_COUNT,
  SIDE_TOKEN_DISTANCE,
  SIDE_TOKEN_RADIUS,
} from './constants';

/** Shared dependencies required to build one simple example prop. */
export interface SampleSimpleBuildOptions {
  materials: Pick<ImmersiveSceneMaterials, 'sampleSimpleBase' | 'sampleSimpleAccent'>;
}

/**
 * Creates one staged instance of the simple example prop.
 *
 * @param scene - Scene that should receive the created prop.
 * @param placement - World placement authored in `staging/sampleSimple.ts`.
 * @param options - Shared materials used by the prop.
 * @returns The root group for the created prop.
 */
export function createSampleSimple(scene: Scene, placement: EntityPlacement, options: SampleSimpleBuildOptions): Group {
  const root = createEntityRoot('sample_simple_prop', placement, scene);

  const base = new Mesh(new CylinderGeometry(BASE_RADIUS, BASE_RADIUS * 0.92, BASE_HEIGHT, 20), options.materials.sampleSimpleBase);
  base.name = 'sample_simple_base';
  base.position.y = BASE_HEIGHT / 2;
  base.castShadow = true;
  base.receiveShadow = true;
  root.add(base);

  const accent = new Mesh(new CylinderGeometry(ACCENT_RADIUS, ACCENT_RADIUS * 0.86, ACCENT_HEIGHT, 16), options.materials.sampleSimpleAccent);
  accent.name = 'sample_simple_accent';
  accent.position.y = BASE_HEIGHT + ACCENT_HEIGHT / 2 - 0.02;
  accent.castShadow = true;
  root.add(accent);

  for (let index = 0; index < SIDE_TOKEN_COUNT; index += 1) {
    const angle = (index / SIDE_TOKEN_COUNT) * Math.PI * 2;
    const token = new Mesh(new SphereGeometry(SIDE_TOKEN_RADIUS, 10, 10), options.materials.sampleSimpleAccent);
    token.name = `sample_simple_token_${index}`;
    token.position.set(
      Math.cos(angle) * SIDE_TOKEN_DISTANCE,
      BASE_HEIGHT * 0.65,
      Math.sin(angle) * SIDE_TOKEN_DISTANCE,
    );
    token.castShadow = true;
    root.add(token);
  }

  return root;
}
