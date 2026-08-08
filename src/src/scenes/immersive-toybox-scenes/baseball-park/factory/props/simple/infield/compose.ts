/**
 * Composes the staged infield.
 *
 * This file exists so the scene root never needs to know how the prop iterates
 * over staging or which materials it consumes.
 */

import type { ComposeContext } from '../../../../types';
import { INFIELD_STAGING } from '../../../../staging/infield';
import { composeCollection, type DisposeFn } from '../../../composeHelpers';
import { createInfield } from './create';

/**
 * Builds every staged infield entry in the scene.
 *
 * @param ctx - Shared compose context for the immersive scene.
 * @returns A no-op cleanup, matching the shared composer contract.
 */
export function composeInfieldProps(ctx: ComposeContext): DisposeFn {
  return composeCollection(ctx.scene, INFIELD_STAGING, (scene, staging) =>
    createInfield(scene, staging, {
      materials: {
        infieldDirt: ctx.materials.infieldDirt,
        moundClay: ctx.materials.moundClay,
        plateWhite: ctx.materials.plateWhite,
      },
    }),
  );
}
