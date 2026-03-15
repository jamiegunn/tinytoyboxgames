import type { ComposeContext } from '@scenes/immersive-toybox-scenes/naturescene/types';
import { FERN_STAGING } from '@scenes/immersive-toybox-scenes/naturescene/staging/ferns';
import { composeCollection, type DisposeFn } from '@scenes/immersive-toybox-scenes/naturescene/factory/composeHelpers';
import { createFern } from './create';

/**
 * Composes all fern props into the nature scene with frond materials from staging data.
 * @param ctx - Shared compose context.
 * @returns A cleanup function for the composed fern props.
 */
export function composeFerns(ctx: ComposeContext): DisposeFn {
  return composeCollection(ctx.scene, FERN_STAGING, (scene, staging) =>
    createFern(scene, staging, {
      materials: { frond: ctx.materials.fern },
    }),
  );
}
