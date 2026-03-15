import type { ComposeContext } from '@scenes/immersive-toybox-scenes/naturescene/types';
import { LOG_STAGING } from '@scenes/immersive-toybox-scenes/naturescene/staging/log';
import type { DisposeFn } from '@scenes/immersive-toybox-scenes/naturescene/factory/composeHelpers';
import { createLog } from './create';
import { setupLogTap } from './interaction';

/**
 * Composes the log prop into the nature scene and registers its tap interaction.
 * @param ctx - Shared compose context.
 * @returns A cleanup function that removes the log tap listener and kills raccoon animations.
 */
export function composeLog(ctx: ComposeContext): DisposeFn {
  const { scene, dispatcher } = ctx;
  const { tapTarget, killAnimations } = createLog(scene, LOG_STAGING);
  const removeTap = setupLogTap(scene, dispatcher, tapTarget);
  return () => {
    removeTap();
    killAnimations();
  };
}
