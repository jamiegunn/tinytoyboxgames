import { Vector3, type Mesh, type Scene } from 'three';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';
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
    getParticleEngine(scene).emit(PARTICLES.waterRipple, tapTarget.getWorldPosition(new Vector3()));
  });
}
