/**
 * Composes every staged run of rail stowage.
 */

import type { ComposeContext } from '../../../../types';
import { RAIL_STOWAGE_STAGING } from '../../../../staging/railStowage';
import { composeCollection, type DisposeFn } from '../../../composeHelpers';
import { createRailStowage } from './create';

/**
 * Builds the spare spars lashed along both side rails.
 *
 * @param ctx - Shared compose context.
 * @returns A no-op cleanup, matching the shared composer contract.
 */
export function composeRailStowage(ctx: ComposeContext): DisposeFn {
  return composeCollection(ctx.scene, RAIL_STOWAGE_STAGING, (scene, run) =>
    createRailStowage(scene, run, {
      materials: { weatheredWood: ctx.materials.weatheredWood, shellTrim: ctx.materials.shellTrim, rope: ctx.materials.rope },
    }),
  );
}
