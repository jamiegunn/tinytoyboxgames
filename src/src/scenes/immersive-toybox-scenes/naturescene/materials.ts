/**
 * Scene-wide shared material palette for the nature scene.
 *
 * ## Material ownership policy
 *
 * Materials in the nature scene follow three tiers:
 *
 * **Tier 1 — Scene-shared palette (this file)**
 * Materials that multiple features reference with identical settings.
 * Created once in `createNatureMaterials()`, injected via `ComposeContext.materials`.
 * Examples: mushStem, flowerStem, leaf, stone, moss.
 * Rule: never mutate these at runtime — they are shared across meshes.
 *
 * **Tier 2 — Feature-local cached materials (`getOrCreateMaterial`)**
 * Materials owned by a single feature but shared across instances of that
 * feature. Created via `getOrCreateMaterial()` in a feature's own
 * `materials.ts` or `create.ts`.
 * Examples: log bark variants (`log/materials.ts`), acorn nut/cap,
 * toadstool stems/caps, stream bank layers.
 * Rule: use when a feature needs multiple materials that no other feature
 * shares, and instances within the feature do not mutate them.
 *
 * **Tier 3 — Per-instance materials (direct factory calls)**
 * Materials created fresh per mesh because the feature mutates them at
 * runtime (e.g. emissive color animation) or because the entity is a
 * one-off (e.g. the raccoon's body parts).
 * Examples: firefly translucent spheres (emissive blink), raccoon felt
 * parts, shelf fungi on the log.
 * Rule: use only when mutation isolation is required or the entity is
 * guaranteed to be a singleton with unique colors.
 */
import type { Material } from 'three';
import { Color } from 'three';
import { createFeltMaterial, createGlossyPaintMaterial, createPlasticMaterial } from '@app/utils/materialFactory';

export interface NatureMaterials {
  mushStem: Material;
  flowerStem: Material;
  leaf: Material;
  stone: Material;
  moss: Material;
  fern: Material;
  grass: Material;
  ladybug: Material;
  ladybugSpot: Material;
  grub: Material;
}

const NATURE_PALETTE = {
  mushStem: new Color(0.9, 0.88, 0.8),
  flowerStem: new Color(0.25, 0.5, 0.2),
  leaf: new Color(0.4, 0.55, 0.2),
  stone: new Color(0.5, 0.48, 0.45),
  moss: new Color(0.2, 0.4, 0.15),
  fern: new Color(0.2, 0.5, 0.15),
  grass: new Color(0.3, 0.55, 0.18),
  ladybug: new Color(0.9, 0.15, 0.1),
  ladybugSpot: new Color(0.05, 0.05, 0.05),
  grub: new Color(0.7, 0.5, 0.3),
} as const;

/**
 * Creates the shared material palette used by nature scene entities.
 *
 * @returns A collection of pre-configured materials for nature scene elements.
 */
export function createNatureMaterials(): NatureMaterials {
  return {
    mushStem: createFeltMaterial('mushStemMat', NATURE_PALETTE.mushStem),
    flowerStem: createFeltMaterial('flowerStemMat', NATURE_PALETTE.flowerStem),
    leaf: createFeltMaterial('leafMat', NATURE_PALETTE.leaf),
    stone: createPlasticMaterial('stoneMat', NATURE_PALETTE.stone),
    moss: createFeltMaterial('mossMat', NATURE_PALETTE.moss),
    fern: createFeltMaterial('fernMat', NATURE_PALETTE.fern),
    grass: createFeltMaterial('grassMat', NATURE_PALETTE.grass),
    ladybug: createGlossyPaintMaterial('ladybugMat', NATURE_PALETTE.ladybug),
    ladybugSpot: createGlossyPaintMaterial('ladybugSpotMat', NATURE_PALETTE.ladybugSpot),
    grub: createGlossyPaintMaterial('grubMat', NATURE_PALETTE.grub),
  };
}
