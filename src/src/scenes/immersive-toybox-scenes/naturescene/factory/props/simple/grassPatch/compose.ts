import type { ComposeContext } from '@scenes/immersive-toybox-scenes/naturescene/types';
import { GRASS_PATCH_STAGING } from '@scenes/immersive-toybox-scenes/naturescene/staging/grassPatch';
import { composeCollection, type DisposeFn } from '@scenes/immersive-toybox-scenes/naturescene/factory/composeHelpers';
import { createGrassPatch } from './create';

/**
 * Composes all grass-patch props into the nature scene with blade materials from staging data.
 * @param ctx - Shared compose context.
 * @returns A cleanup function for the composed grass patches.
 */
export function composeGrassPatches(ctx: ComposeContext): DisposeFn {
  return composeCollection(ctx.scene, GRASS_PATCH_STAGING, (scene, staging) =>
    createGrassPatch(scene, staging, {
      materials: { blade: ctx.materials.grass },
    }),
  );
}
