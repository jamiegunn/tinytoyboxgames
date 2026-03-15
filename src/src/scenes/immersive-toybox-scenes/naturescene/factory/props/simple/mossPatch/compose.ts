import type { ComposeContext } from '@scenes/immersive-toybox-scenes/naturescene/types';
import { MOSS_PATCH_STAGING } from '@scenes/immersive-toybox-scenes/naturescene/staging/mossPatch';
import { composeCollection, type DisposeFn } from '@scenes/immersive-toybox-scenes/naturescene/factory/composeHelpers';
import { createMossPatch } from './create';

/**
 * Composes all moss-patch props into the nature scene with body materials from staging data.
 * @param ctx - Shared compose context.
 * @returns A cleanup function for the composed moss patches.
 */
export function composeMossPatches(ctx: ComposeContext): DisposeFn {
  return composeCollection(ctx.scene, MOSS_PATCH_STAGING, (scene, staging) =>
    createMossPatch(scene, staging, {
      materials: { body: ctx.materials.moss },
    }),
  );
}
