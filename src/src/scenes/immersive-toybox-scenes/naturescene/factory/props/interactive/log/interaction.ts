import { Scene, Vector3, type Mesh } from 'three';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { createSparkleBurst } from '@app/utils/particles';
import { createTapInteraction } from '@app/utils/tapInteraction';

/**
 * Registers a tap interaction on the log body that emits a sparkle burst.
 *
 * @param scene - The Three.js scene for particle effects.
 * @param dispatcher - The world tap dispatcher.
 * @param tapTarget - The log body mesh used as the tap target.
 * @returns A cleanup function to unregister the tap handler.
 */
export function setupLogTap(scene: Scene, dispatcher: WorldTapDispatcher, tapTarget: Mesh): () => void {
  return createTapInteraction(dispatcher, tapTarget, () => {
    createSparkleBurst(scene, tapTarget.getWorldPosition(new Vector3()));
  });
}
