/**
 * Composes every staged bleacher bank.
 *
 * This file exists so the scene root never needs to know how the prop iterates
 * over staging or which materials it consumes.
 */

import type { ComposeContext } from '../../../../types';
import { BLEACHERS_STAGING } from '../../../../staging/bleachers';
import { composeCollection, type DisposeFn } from '../../../composeHelpers';
import { createBleachers } from './create';

/**
 * Builds every staged bleacher bank in the scene.
 *
 * @param ctx - Shared compose context for the immersive scene.
 * @returns A no-op cleanup, matching the shared composer contract.
 */
export function composeBleacherProps(ctx: ComposeContext): DisposeFn {
  return composeCollection(ctx.scene, BLEACHERS_STAGING, (scene, staging) =>
    createBleachers(scene, staging, {
      materials: {
        bleacherWood: ctx.materials.bleacherWood,
        seatRed: ctx.materials.seatRed,
        seatBlue: ctx.materials.seatBlue,
        pennantYellow: ctx.materials.pennantYellow,
        shellTrim: ctx.materials.shellTrim,
      },
    }),
  );
}
