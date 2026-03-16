/**
 * Composes every staged barrel instance.
 */

import type { ComposeContext } from '../../../../types';
import { BARREL_STAGING } from '../../../../staging/barrels';
import { composeCollection, type DisposeFn } from '../../../composeHelpers';
import { createBarrel } from './create';

/**
 * Builds every staged barrel on the ship deck.
 *
 * @param ctx - Shared compose context.
 * @returns A no-op cleanup, matching the shared composer contract.
 */
export function composeBarrels(ctx: ComposeContext): DisposeFn {
  return composeCollection(ctx.scene, BARREL_STAGING, (scene, staging) =>
    createBarrel(scene, staging, {
      materials: {
        weatheredWood: ctx.materials.weatheredWood,
        metal: ctx.materials.metal,
      },
    }),
  );
}
