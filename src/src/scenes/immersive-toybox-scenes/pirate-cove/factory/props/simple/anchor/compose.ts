/**
 * Composes every staged anchor instance.
 */

import type { ComposeContext } from '../../../../types';
import { ANCHOR_STAGING } from '../../../../staging/anchor';
import { composeCollection, type DisposeFn } from '../../../composeHelpers';
import { createAnchor } from './create';

/**
 * Builds every staged anchor on the ship deck.
 *
 * @param ctx - Shared compose context.
 * @returns A no-op cleanup, matching the shared composer contract.
 */
export function composeAnchor(ctx: ComposeContext): DisposeFn {
  return composeCollection(ctx.scene, ANCHOR_STAGING, (scene, staging) =>
    createAnchor(scene, staging, {
      materials: { metal: ctx.materials.metal },
    }),
  );
}
