/**
 * Scene-shared material palette for Pirate Cove.
 *
 * Material tiers follow the same discipline as Nature:
 *
 * 1. Scene-shared materials live here — injected via `ComposeContext.materials`
 * 2. Feature-local cached materials live beside the feature that owns them
 * 3. Per-instance materials only when mutation isolation is required
 */

import type { Material } from 'three';
import { Color } from 'three';
import { createFeltMaterial, createGlossyPaintMaterial, createWoodMaterial } from '@app/utils/materialFactory';

/**
 * Scene-local collection of shared materials injected through `ComposeContext`.
 *
 * NOT HERE, DELIBERATELY: `skyBackdrop`. This interface used to declare it and
 * `createPirateCoveMaterials` used to build it — a plastic material at
 * rgb(0.35, 0.5, 0.7) — on every scene load. Its only consumer was
 * `factory/scaffold/skyBackdrop/create.ts`, which nothing imported, so the
 * material was allocated, held for the life of the scene and disposed, without
 * ever being bound to a mesh. The cove's sky is `createGradientSkydome` plus
 * `createSkyMatchedFog` from `@app/utils/skyRig` (index.ts:113, :239), with
 * clouds from `createCloudPuff` handed to `startAmbientMotion` (:154-159).
 */
export interface PirateCoveMaterials {
  /** Ship railing walls — weathered wood. */
  shellWall: Material;
  /** Railing trim / posts — darker wood. */
  shellTrim: Material;
  /** Weathered wood for deck, railings, mast, barrels. */
  weatheredWood: Material;
  /** Dark grey metal for anchor, cannon. */
  metal: Material;
  /** Bright gold for treasure accents. */
  gold: Material;
  /** Tan/cream rope and cloth for rope coils. */
  rope: Material;
  /** Treasure chest body wood. */
  chestWood: Material;
}

const MATERIAL_PREFIX = 'pirate-cove';

const PALETTE = {
  shellWall: new Color(0.5, 0.35, 0.2),
  shellTrim: new Color(0.4, 0.28, 0.15),
  weatheredWood: new Color(0.6, 0.42, 0.25),
  metal: new Color(0.44, 0.36, 0.26),
  gold: new Color(1.0, 0.82, 0.3),
  rope: new Color(0.75, 0.65, 0.48),
  chestWood: new Color(0.45, 0.3, 0.15),
} as const;

/**
 * Creates the reusable material palette for Pirate Cove.
 *
 * @returns The scene-shared material collection.
 */
export function createPirateCoveMaterials(): PirateCoveMaterials {
  return {
    shellWall: createWoodMaterial(`${MATERIAL_PREFIX}_shell_wall_mat`, PALETTE.shellWall),
    shellTrim: createWoodMaterial(`${MATERIAL_PREFIX}_shell_trim_mat`, PALETTE.shellTrim),
    weatheredWood: createWoodMaterial(`${MATERIAL_PREFIX}_weathered_wood_mat`, PALETTE.weatheredWood),
    metal: createGlossyPaintMaterial(`${MATERIAL_PREFIX}_metal_mat`, PALETTE.metal),
    gold: createGlossyPaintMaterial(`${MATERIAL_PREFIX}_gold_mat`, PALETTE.gold),
    rope: createFeltMaterial(`${MATERIAL_PREFIX}_rope_mat`, PALETTE.rope),
    chestWood: createWoodMaterial(`${MATERIAL_PREFIX}_chest_wood_mat`, PALETTE.chestWood),
  };
}
