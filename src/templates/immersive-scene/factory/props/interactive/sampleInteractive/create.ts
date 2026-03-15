/**
 * Builds the generated interactive prop example.
 *
 * The prop is a stylized bloom with a tappable head. The geometry is simple on
 * purpose so the instructional value stays focused on the interaction contract:
 * create typed handles here, then wire behavior in `interaction.ts`.
 */

import { CylinderGeometry, Group, Mesh, SphereGeometry, type Scene } from 'three';
import { createEntityRoot, type EntityPlacement } from '../../../../types';
import type { ImmersiveSceneMaterials } from '../../../../materials';
import { BLOOM_RADIUS, LEAF_RADIUS, STEM_HEIGHT, STEM_RADIUS } from './constants';

/** Shared dependencies required to build one interactive example prop. */
export interface SampleInteractiveBuildOptions {
  materials: Pick<ImmersiveSceneMaterials, 'sampleInteractiveStem' | 'sampleInteractiveBloom'>;
}

/** Typed handles returned to the interaction layer after mesh creation. */
export interface SampleInteractiveCreateResult {
  root: Group;
  bloom: Mesh;
  tapTarget: Mesh;
}

/**
 * Creates one staged interactive prop instance.
 *
 * @param scene - Scene that should receive the created prop.
 * @param placement - World placement authored in `staging/sampleInteractive.ts`.
 * @param options - Shared materials used by the prop.
 * @returns Typed handles needed by the interaction layer.
 */
export function createSampleInteractive(
  scene: Scene,
  placement: EntityPlacement,
  options: SampleInteractiveBuildOptions,
): SampleInteractiveCreateResult {
  const root = createEntityRoot('sample_interactive_prop', placement, scene);

  const stem = new Mesh(new CylinderGeometry(STEM_RADIUS, STEM_RADIUS * 1.1, STEM_HEIGHT, 14), options.materials.sampleInteractiveStem);
  stem.name = 'sample_interactive_stem';
  stem.position.y = STEM_HEIGHT / 2;
  stem.castShadow = true;
  root.add(stem);

  const bloom = new Mesh(new SphereGeometry(BLOOM_RADIUS, 16, 16), options.materials.sampleInteractiveBloom);
  bloom.name = 'sample_interactive_bloom';
  bloom.position.y = STEM_HEIGHT + BLOOM_RADIUS * 0.85;
  bloom.castShadow = true;
  root.add(bloom);

  const leftLeaf = new Mesh(new SphereGeometry(LEAF_RADIUS, 10, 10), options.materials.sampleInteractiveStem);
  leftLeaf.name = 'sample_interactive_leaf_left';
  leftLeaf.scale.set(1.2, 0.45, 0.8);
  leftLeaf.position.set(-0.12, STEM_HEIGHT * 0.45, 0);
  leftLeaf.rotation.z = Math.PI * 0.32;
  leftLeaf.castShadow = true;
  root.add(leftLeaf);

  const rightLeaf = new Mesh(new SphereGeometry(LEAF_RADIUS, 10, 10), options.materials.sampleInteractiveStem);
  rightLeaf.name = 'sample_interactive_leaf_right';
  rightLeaf.scale.set(1.2, 0.45, 0.8);
  rightLeaf.position.set(0.12, STEM_HEIGHT * 0.52, 0);
  rightLeaf.rotation.z = Math.PI * -0.28;
  rightLeaf.castShadow = true;
  root.add(rightLeaf);

  return {
    root,
    bloom,
    tapTarget: bloom,
  };
}
