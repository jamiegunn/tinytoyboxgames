import type { ComposeContext } from '@scenes/immersive-toybox-scenes/naturescene/types';
import { LEAF_LITTER_STAGING } from '@scenes/immersive-toybox-scenes/naturescene/staging/leafLitter';
import { composeCollection, type DisposeFn } from '@scenes/immersive-toybox-scenes/naturescene/factory/composeHelpers';
import { createLeafLitter } from './create';

/**
 * Composes all leaf-litter props into the nature scene using predefined staging data.
 * @param ctx - Shared compose context.
 * @returns A cleanup function for the composed leaf-litter props.
 */
export function composeLeafLitter(ctx: ComposeContext): DisposeFn {
  return composeCollection(ctx.scene, LEAF_LITTER_STAGING, createLeafLitter);
}
