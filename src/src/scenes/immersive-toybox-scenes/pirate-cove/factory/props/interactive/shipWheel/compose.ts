/**
 * Composes every staged ship wheel instance with interaction wiring.
 */

import type { ComposeContext } from '../../../../types';
import { SHIP_WHEEL_STAGING } from '../../../../staging/shipWheel';
import { composeInteractiveCollection, type DisposeFn } from '../../../composeHelpers';
import { createShipWheel } from './create';
import { setupShipWheelTap } from './interaction';

/**
 * Builds and wires every staged ship wheel.
 *
 * @param ctx - Shared compose context.
 * @returns Cleanup function that unregisters every wheel interaction.
 */
export function composeShipWheels(ctx: ComposeContext): DisposeFn {
  return composeInteractiveCollection(
    ctx,
    SHIP_WHEEL_STAGING,
    (scene, staging) =>
      createShipWheel(scene, staging, {
        materials: { weatheredWood: ctx.materials.weatheredWood },
      }),
    (scene, dispatcher, result) => setupShipWheelTap(scene, dispatcher, result),
  );
}
