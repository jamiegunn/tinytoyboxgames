/**
 * Composes every staged cannon instance with interaction wiring.
 */

import type { ComposeContext } from '../../../../types';
import { CANNON_STAGING } from '../../../../staging/cannon';
import { composeInteractiveCollection, type DisposeFn } from '../../../composeHelpers';
import { createCannon } from './create';
import { setupCannonTap } from './interaction';

/**
 * Builds and wires every staged cannon.
 *
 * @param ctx - Shared compose context.
 * @returns Cleanup function that unregisters every cannon interaction.
 */
export function composeCannons(ctx: ComposeContext): DisposeFn {
  return composeInteractiveCollection(
    ctx,
    CANNON_STAGING,
    (scene, staging) =>
      createCannon(scene, staging, {
        materials: {
          metal: ctx.materials.metal,
          weatheredWood: ctx.materials.weatheredWood,
        },
      }),
    (scene, dispatcher, result) => setupCannonTap(scene, dispatcher, result),
  );
}
