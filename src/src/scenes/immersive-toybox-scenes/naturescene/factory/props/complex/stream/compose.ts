import type { ComposeContext } from '@scenes/immersive-toybox-scenes/naturescene/types';
import { STREAM_STAGING } from '@scenes/immersive-toybox-scenes/naturescene/staging/stream';
import type { DisposeFn } from '@scenes/immersive-toybox-scenes/naturescene/factory/composeHelpers';
import { createStream } from './create';
import { setupStreamTap } from './interaction';

/**
 * Composes the stream prop into the nature scene and registers its tap interaction.
 * @param ctx - Shared compose context.
 * @returns A cleanup function that removes the stream tap listener and stops the water animation.
 */
export function composeStream(ctx: ComposeContext): DisposeFn {
  const { scene, dispatcher } = ctx;
  const { tapTarget, killAnimations } = createStream(scene, STREAM_STAGING);
  const removeTap = setupStreamTap(scene, dispatcher, tapTarget);
  return () => {
    removeTap();
    killAnimations();
  };
}
