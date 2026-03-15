import { type Mesh, type Scene } from 'three';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { createTapInteraction } from '@app/utils/tapInteraction';
import type { IdleInterruptHandle } from '@app/utils/idleInterruptible';

/**
 * Registers a tap interaction on a butterfly that triggers the flee-and-return reaction.
 *
 * @param _scene - The Three.js scene (unused).
 * @param dispatcher - The world tap dispatcher.
 * @param body - The butterfly body mesh used as the tap target.
 * @param fleeHandle - The idle interrupt handle that triggers the flee reaction.
 * @returns A cleanup function to unregister the tap handler.
 */
export function setupButterflyTap(_scene: Scene, dispatcher: WorldTapDispatcher, body: Mesh, fleeHandle: IdleInterruptHandle): () => void {
  return createTapInteraction(dispatcher, body, () => {
    fleeHandle.trigger();
  });
}
