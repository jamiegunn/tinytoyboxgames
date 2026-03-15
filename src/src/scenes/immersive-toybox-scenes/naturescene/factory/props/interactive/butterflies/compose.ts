import type { ComposeContext } from '@scenes/immersive-toybox-scenes/naturescene/types';
import { BUTTERFLY_STAGING } from '@scenes/immersive-toybox-scenes/naturescene/staging/butterflies';
import { composeInteractiveCollection, type DisposeFn } from '@scenes/immersive-toybox-scenes/naturescene/factory/composeHelpers';
import { createButterfly } from './create';
import { getButterflyConfig } from './config';
import { setupButterflyTap } from './interaction';

/**
 * Composes all butterfly props into the nature scene with variant-specific configs and tap interactions.
 * @param ctx - Shared compose context.
 * @returns A cleanup function that removes all butterfly tap listeners and kills animations.
 */
export function composeButterflies(ctx: ComposeContext): DisposeFn {
  return composeInteractiveCollection(
    ctx,
    BUTTERFLY_STAGING,
    (scene, staging) =>
      createButterfly(scene, staging, {
        config: getButterflyConfig(staging.variant),
      }),
    (scene, dispatcher, { body, fleeHandle, killAnimations }) => {
      const removeTap = setupButterflyTap(scene, dispatcher, body, fleeHandle);
      return () => {
        removeTap();
        killAnimations();
      };
    },
  );
}
