/**
 * Composes every staged rope coil instance.
 */

import type { ComposeContext } from '../../../../types';
import { ROPE_COIL_STAGING } from '../../../../staging/ropeCoils';
import { composeCollection, type DisposeFn } from '../../../composeHelpers';
import { createRopeCoil } from './create';

/**
 * Builds every staged rope coil on the ship deck.
 *
 * @param ctx - Shared compose context.
 * @returns A no-op cleanup, matching the shared composer contract.
 */
export function composeRopeCoils(ctx: ComposeContext): DisposeFn {
  return composeCollection(ctx.scene, ROPE_COIL_STAGING, (scene, staging) =>
    createRopeCoil(scene, staging, {
      materials: { rope: ctx.materials.rope },
    }),
  );
}
