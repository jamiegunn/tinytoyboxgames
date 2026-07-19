/**
 * Composes every staged parrot instance.
 */

import type { ComposeContext } from '../../../../types';
import { PARROT_STAGING } from '../../../../staging/parrot';
import { composeInteractiveCollection, type DisposeFn } from '../../../composeHelpers';
import { createParrot } from './create';
import { setupParrotTap } from './interaction';

/**
 * Builds and wires every staged parrot (tap → happy squawk + wing flap).
 *
 * @param ctx - Shared compose context.
 * @returns Cleanup function that unregisters every parrot interaction.
 */
export function composeParrots(ctx: ComposeContext): DisposeFn {
  return composeInteractiveCollection(
    ctx,
    PARROT_STAGING,
    (scene, staging) => createParrot(scene, staging),
    (scene, dispatcher, root) => setupParrotTap(scene, dispatcher, root),
  );
}
