import type { ComposeContext } from '@scenes/immersive-toybox-scenes/naturescene/types';
import { LEAF_STAGING } from '@scenes/immersive-toybox-scenes/naturescene/staging/leaves';
import { composeInteractiveCollection, type DisposeFn } from '@scenes/immersive-toybox-scenes/naturescene/factory/composeHelpers';
import { createLeaf } from './create';
import { setupLeafTap } from './interaction';

/**
 * Composes all leaf props into the nature scene with body, ladybug, and ladybug-spot materials, plus tap interactions.
 * @param ctx - Shared compose context.
 * @returns A cleanup function that removes all leaf tap listeners.
 */
export function composeLeaves(ctx: ComposeContext): DisposeFn {
  return composeInteractiveCollection(
    ctx,
    LEAF_STAGING,
    (scene, staging) =>
      createLeaf(scene, staging, {
        materials: {
          body: ctx.materials.leaf,
          ladybug: ctx.materials.ladybug,
          ladybugSpot: ctx.materials.ladybugSpot,
        },
      }),
    (scene, dispatcher, { tapTarget, revealHandle }) => setupLeafTap(scene, dispatcher, tapTarget, revealHandle),
  );
}
