import type { ComposeContext } from '@scenes/immersive-toybox-scenes/naturescene/types';
import { TREE_STAGING } from '@scenes/immersive-toybox-scenes/naturescene/staging/trees';
import { composeCollection, type DisposeFn } from '@scenes/immersive-toybox-scenes/naturescene/factory/composeHelpers';
import { createTree } from './create';

/**
 * Composes all tree props into the nature scene using predefined staging data.
 * @param ctx - Shared compose context.
 * @returns A cleanup function for the composed tree props.
 */
export function composeTrees(ctx: ComposeContext): DisposeFn {
  return composeCollection(ctx.scene, TREE_STAGING, createTree);
}
