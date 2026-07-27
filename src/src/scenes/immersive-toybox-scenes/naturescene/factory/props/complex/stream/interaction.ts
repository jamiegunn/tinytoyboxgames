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
  return createTapInteraction(
    dispatcher,
    tapTarget,
    () => {
      getParticleEngine(scene).emit(PARTICLES.waterRipple, tapTarget.getWorldPosition(new Vector3()));
    },
    // The water is environment-scale — 2.8 x 11.3 units, the largest single
    // catchment in the scene at 47000-61000 px^2 — and it is also a LID. Two of
    // the three leaves are staged in the stream at y = 0.02, under this surface
    // at y = 0.038; the surface is transparent and `depthWrite: false`, but a
    // raycast reads geometry, not appearance, so it took every one of their taps
    // and both leaves measured zero tappable pixels at all nine viewports.
    // Marking it background lets the raycast read past it to the leaf and lets a
    // near-miss on any small prop reach the proximity rule. Open water still
    // ripples.
    { background: true },
  );
}
