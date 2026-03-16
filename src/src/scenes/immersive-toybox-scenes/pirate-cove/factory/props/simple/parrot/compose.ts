/**
 * Composes every staged parrot instance.
 */

import type { ComposeContext } from '../../../../types';
import { PARROT_STAGING } from '../../../../staging/parrot';
import { composeCollection, type DisposeFn } from '../../../composeHelpers';
import { createParrot } from './create';

/**
 * Builds every staged parrot.
 *
 * @param ctx - Shared compose context.
 * @returns A no-op cleanup, matching the shared composer contract.
 */
export function composeParrots(ctx: ComposeContext): DisposeFn {
  return composeCollection(ctx.scene, PARROT_STAGING, (scene, staging) => createParrot(scene, staging));
}
