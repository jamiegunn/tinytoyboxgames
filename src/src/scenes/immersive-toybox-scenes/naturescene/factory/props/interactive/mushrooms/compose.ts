import type { ComposeContext } from '@scenes/immersive-toybox-scenes/naturescene/types';
import { MUSHROOM_STAGING } from '@scenes/immersive-toybox-scenes/naturescene/staging/mushrooms';
import { composeInteractiveCollection, type DisposeFn } from '@scenes/immersive-toybox-scenes/naturescene/factory/composeHelpers';
import { createMushroom } from './create';
import { getMushroomConfig } from './config';
import { setupMushroomTap } from './interaction';

/**
 * Composes all mushroom props into the nature scene with variant configs, stem materials, and tap interactions.
 * @param ctx - Shared compose context.
 * @returns A cleanup function that removes all mushroom tap listeners.
 */
export function composeMushrooms(ctx: ComposeContext): DisposeFn {
  return composeInteractiveCollection(
    ctx,
    MUSHROOM_STAGING,
    (scene, staging) =>
      createMushroom(scene, staging, {
        config: getMushroomConfig(staging.variant),
        materials: { stem: ctx.materials.mushStem },
      }),
    (scene, dispatcher, mushroom) => setupMushroomTap(scene, dispatcher, mushroom),
  );
}
