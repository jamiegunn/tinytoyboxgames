import { Vector3, type Mesh, type Scene } from 'three';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { createBurstEffect, WATER_RIPPLE } from '@app/utils/particleFactory';
import { createTapInteraction } from '@app/utils/tapInteraction';

/**
 * Registers a tap handler on the stream that triggers a water ripple burst effect.
 * @param scene - The Three.js scene for particle effects
 * @param dispatcher - The world tap dispatcher
 * @param tapTarget - The water surface mesh used as the tap target
 * @returns A cleanup function to unregister the tap handler.
 */
export function setupStreamTap(scene: Scene, dispatcher: WorldTapDispatcher, tapTarget: Mesh): () => void {
  return createTapInteraction(dispatcher, tapTarget, () => {
    createBurstEffect(scene, tapTarget.getWorldPosition(new Vector3()), WATER_RIPPLE);
  });
}
