/**
 * Composes the staged scoreboard.
 *
 * This file exists so the scene root never needs to know how the prop iterates
 * over staging or which materials it consumes.
 */

import type { ComposeContext } from '../../../../types';
import { SCOREBOARD_STAGING } from '../../../../staging/scoreboard';
import { composeCollection, type DisposeFn } from '../../../composeHelpers';
import { createScoreboard } from './create';

/**
 * Builds every staged scoreboard entry in the scene.
 *
 * @param ctx - Shared compose context for the immersive scene.
 * @returns A no-op cleanup, matching the shared composer contract.
 */
export function composeScoreboardProps(ctx: ComposeContext): DisposeFn {
  return composeCollection(ctx.scene, SCOREBOARD_STAGING, (scene, staging) =>
    createScoreboard(scene, staging, {
      materials: {
        bleacherWood: ctx.materials.bleacherWood,
        scoreboardFace: ctx.materials.scoreboardFace,
        seatRed: ctx.materials.seatRed,
        seatBlue: ctx.materials.seatBlue,
        pennantYellow: ctx.materials.pennantYellow,
      },
    }),
  );
}
