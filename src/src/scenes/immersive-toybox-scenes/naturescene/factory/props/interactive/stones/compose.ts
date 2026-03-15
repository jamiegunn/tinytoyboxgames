import type { ComposeContext } from '@scenes/immersive-toybox-scenes/naturescene/types';
import { STONE_STAGING } from '@scenes/immersive-toybox-scenes/naturescene/staging/stones';
import { composeInteractiveCollection, type DisposeFn } from '@scenes/immersive-toybox-scenes/naturescene/factory/composeHelpers';
import { createStone } from './create';
import { setupStoneTap } from './interaction';

/**
 * Composes all stone props into the nature scene with body and grub materials, plus tap interactions.
 * @param ctx - Shared compose context.
 * @returns A cleanup function that removes all stone tap listeners.
 */
export function composeStones(ctx: ComposeContext): DisposeFn {
  return composeInteractiveCollection(
    ctx,
    STONE_STAGING,
    (scene, staging) =>
      createStone(scene, staging, {
        materials: {
          body: ctx.materials.stone,
          grub: ctx.materials.grub,
        },
      }),
    (scene, dispatcher, { tapTarget, revealHandle }) => setupStoneTap(scene, dispatcher, tapTarget, revealHandle),
  );
}
