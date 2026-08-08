/**
 * Composes every staged loose baseball.
 *
 * This file is the bridge between authored placement data, mesh creation, and
 * dispatcher-based interaction wiring.
 */

import type { ComposeContext } from '../../../../types';
import { LOOSE_BALLS_STAGING } from '../../../../staging/looseBalls';
import { composeInteractiveCollection, type DisposeFn } from '../../../composeHelpers';
import { createLooseBall } from './create';
import { setupLooseBallTap } from './interaction';

/**
 * Builds and wires every staged loose baseball.
 *
 * @param ctx - Shared compose context for the immersive scene.
 * @returns Cleanup function that unregisters every created interaction.
 */
export function composeLooseBallProps(ctx: ComposeContext): DisposeFn {
  return composeInteractiveCollection(
    ctx,
    LOOSE_BALLS_STAGING,
    (scene, staging) =>
      createLooseBall(scene, staging, {
        materials: {
          plateWhite: ctx.materials.plateWhite,
          ballStitch: ctx.materials.ballStitch,
        },
      }),
    (scene, dispatcher, result) => setupLooseBallTap(scene, dispatcher, result),
  );
}
