import type { ComposeContext } from '@scenes/immersive-toybox-scenes/naturescene/types';
import { TOADSTOOL_STAGING } from '@scenes/immersive-toybox-scenes/naturescene/staging/toadstools';
import { composeCollection, type DisposeFn } from '@scenes/immersive-toybox-scenes/naturescene/factory/composeHelpers';
import { createToadstool } from './create';

/**
 * Composes all toadstool props into the nature scene using predefined staging data.
 * @param ctx - Shared compose context.
 * @returns A cleanup function for the composed toadstool props.
 */
export function composeToadstools(ctx: ComposeContext): DisposeFn {
  return composeCollection(ctx.scene, TOADSTOOL_STAGING, createToadstool);
}
