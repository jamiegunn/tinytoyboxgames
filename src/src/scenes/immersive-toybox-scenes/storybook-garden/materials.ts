/**
 * Scene-shared material palette for Storybook Garden.
 *
 * This file exists so the scene has one obvious place to define reusable
 * materials. That matters because the template wants future scenes to answer
 * material ownership the same way every time:
 *
 * 1. scene-shared materials live here
 * 2. feature-local cached materials live beside the feature that owns them
 * 3. per-instance materials are used only when mutation isolation is required
 *
 * This is a direct continuation of the discipline already established in the
 * Nature scene, but the generated baseline keeps the palette intentionally
 * small.
 */

import type { Material } from 'three';
import { Color } from 'three';
import { createFeltMaterial, createGlossyPaintMaterial, createPlasticMaterial, createWoodMaterial } from '@app/utils/materialFactory';

/** Scene-local collection of shared materials injected through `ComposeContext`. */
export interface ImmersiveSceneMaterials {
  skyBackdrop: Material;
  shellWall: Material;
  shellTrim: Material;
  sampleSimpleBase: Material;
  sampleSimpleAccent: Material;
  sampleInteractiveStem: Material;
  sampleInteractiveBloom: Material;
}

const MATERIAL_PREFIX = 'storybook-garden';

const PALETTE = {
  skyBackdrop: new Color(0.35, 0.55, 0.7),
  shellWall: new Color(0.55, 0.38, 0.65),
  shellTrim: new Color(0.5, 0.32, 0.18),
  sampleSimpleBase: new Color(0.74, 0.62, 0.42),
  sampleSimpleAccent: new Color(0.98, 0.85, 0.48),
  sampleInteractiveStem: new Color(0.24, 0.52, 0.28),
  sampleInteractiveBloom: new Color(0.82, 0.54, 0.92),
} as const;

/**
 * Creates the reusable material palette for the generated scene.
 *
 * The template deliberately creates materials eagerly here so simple and
 * interactive examples can demonstrate dependency injection through
 * `ComposeContext` instead of allocating their own identical materials.
 *
 * @returns The scene-shared material collection for this immersive scene.
 */
export function createImmersiveSceneMaterials(): ImmersiveSceneMaterials {
  return {
    skyBackdrop: createPlasticMaterial(`${MATERIAL_PREFIX}_sky_backdrop_mat`, PALETTE.skyBackdrop),
    shellWall: createFeltMaterial(`${MATERIAL_PREFIX}_shell_wall_mat`, PALETTE.shellWall),
    shellTrim: createWoodMaterial(`${MATERIAL_PREFIX}_shell_trim_mat`, PALETTE.shellTrim),
    sampleSimpleBase: createWoodMaterial(`${MATERIAL_PREFIX}_sample_simple_base_mat`, PALETTE.sampleSimpleBase),
    sampleSimpleAccent: createGlossyPaintMaterial(`${MATERIAL_PREFIX}_sample_simple_accent_mat`, PALETTE.sampleSimpleAccent),
    sampleInteractiveStem: createFeltMaterial(`${MATERIAL_PREFIX}_sample_interactive_stem_mat`, PALETTE.sampleInteractiveStem),
    sampleInteractiveBloom: createGlossyPaintMaterial(`${MATERIAL_PREFIX}_sample_interactive_bloom_mat`, PALETTE.sampleInteractiveBloom),
  };
}
