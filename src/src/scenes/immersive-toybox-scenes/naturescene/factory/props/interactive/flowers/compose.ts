import type { ComposeContext } from '@scenes/immersive-toybox-scenes/naturescene/types';
import { FLOWER_STAGING } from '@scenes/immersive-toybox-scenes/naturescene/staging/flowers';
import { composeInteractiveCollection, type DisposeFn } from '@scenes/immersive-toybox-scenes/naturescene/factory/composeHelpers';
import { createFlower } from './create';
import { getFlowerConfig } from './config';
import { setupFlowerTap } from './interaction';

/**
 * Composes all flower props into the nature scene with variant configs, stem materials, and tap interactions.
 * @param ctx - Shared compose context.
 * @returns A cleanup function that removes all flower tap listeners.
 */
export function composeFlowers(ctx: ComposeContext): DisposeFn {
  return composeInteractiveCollection(
    ctx,
    FLOWER_STAGING,
    (scene, staging) =>
      createFlower(scene, staging, {
        config: getFlowerConfig(staging.variant),
        materials: { stem: ctx.materials.flowerStem },
      }),
    (scene, dispatcher, flower) => setupFlowerTap(scene, dispatcher, flower),
  );
}
