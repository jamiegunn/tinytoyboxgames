/**
 * Composes every staged treasure chest instance with interaction wiring.
 */

import type { ComposeContext } from '../../../../types';
import { TREASURE_CHEST_STAGING } from '../../../../staging/treasureChest';
import { composeInteractiveCollection, type DisposeFn } from '../../../composeHelpers';
import { createTreasureChest } from './create';
import { setupTreasureChestTap } from './interaction';

/**
 * Builds and wires every staged treasure chest.
 *
 * @param ctx - Shared compose context.
 * @returns Cleanup function that unregisters every chest interaction.
 */
export function composeTreasureChests(ctx: ComposeContext): DisposeFn {
  return composeInteractiveCollection(
    ctx,
    TREASURE_CHEST_STAGING,
    (scene, staging) =>
      createTreasureChest(scene, staging, {
        materials: {
          chestWood: ctx.materials.chestWood,
          gold: ctx.materials.gold,
          metal: ctx.materials.metal,
        },
      }),
    (scene, dispatcher, result) => setupTreasureChestTap(scene, dispatcher, result),
  );
}
