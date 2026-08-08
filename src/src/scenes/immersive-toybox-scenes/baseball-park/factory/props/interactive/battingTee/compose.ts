/**
 * Composes every staged batting tee.
 *
 * This file is the bridge between authored placement data, mesh creation, and
 * dispatcher-based interaction wiring.
 */

import type { ComposeContext } from '../../../../types';
import { BATTING_TEE_STAGING } from '../../../../staging/battingTee';
import { composeInteractiveCollection, type DisposeFn } from '../../../composeHelpers';
import { createBattingTee } from './create';
import { setupBattingTeeTap } from './interaction';

/**
 * Builds and wires every staged batting tee.
 *
 * @param ctx - Shared compose context for the immersive scene.
 * @returns Cleanup function that unregisters every created interaction.
 */
export function composeBattingTeeProps(ctx: ComposeContext): DisposeFn {
  return composeInteractiveCollection(
    ctx,
    BATTING_TEE_STAGING,
    (scene, staging) =>
      createBattingTee(scene, staging, {
        materials: {
          teeBody: ctx.materials.teeBody,
          plateWhite: ctx.materials.plateWhite,
          ballStitch: ctx.materials.ballStitch,
        },
      }),
    (scene, dispatcher, result) => setupBattingTeeTap(scene, dispatcher, result),
  );
}
