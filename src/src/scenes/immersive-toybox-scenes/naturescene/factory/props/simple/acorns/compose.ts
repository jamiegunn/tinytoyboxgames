import type { ComposeContext } from '@scenes/immersive-toybox-scenes/naturescene/types';
import { ACORN_STAGING } from '@scenes/immersive-toybox-scenes/naturescene/staging/acorns';
import { composeCollection, type DisposeFn } from '@scenes/immersive-toybox-scenes/naturescene/factory/composeHelpers';
import { createAcorn } from './create';

/**
 * Composes all acorn props into the nature scene using predefined staging data.
 * @param ctx - Shared compose context.
 * @returns A cleanup function for the composed acorn props.
 */
export function composeAcorns(ctx: ComposeContext): DisposeFn {
  return composeCollection(ctx.scene, ACORN_STAGING, createAcorn);
}
