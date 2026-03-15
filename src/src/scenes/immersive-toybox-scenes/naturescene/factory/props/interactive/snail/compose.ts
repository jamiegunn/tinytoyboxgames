import type { ComposeContext } from '@scenes/immersive-toybox-scenes/naturescene/types';
import { SNAIL_STAGING } from '@scenes/immersive-toybox-scenes/naturescene/staging/snail';
import type { DisposeFn } from '@scenes/immersive-toybox-scenes/naturescene/factory/composeHelpers';
import { createSnail } from './create';

/**
 * Composes the snail prop into the nature scene and returns animation cleanup.
 * @param ctx - Shared compose context.
 * @returns A cleanup function that kills all snail animations.
 */
export function composeSnail(ctx: ComposeContext): DisposeFn {
  const { killAnimations } = createSnail(ctx.scene, SNAIL_STAGING);
  return killAnimations;
}
