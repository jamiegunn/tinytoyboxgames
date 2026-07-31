import { Vector3, type Mesh, type Scene } from 'three';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import { createTapInteraction } from '@app/utils/tapInteraction';

/**
 * Registers a tap handler on the stream that splashes and triggers a water
 * ripple burst effect.
 *
 * `sfx_nature_stream_splash` has existed in `assets/audio/nature/index.ts` since
 * the scene was built and was called zero times until Round 5 of
 * `docs/reviews/2026-07-30-rooms-five-rounds.md`. Wiring it needed no new synth
 * and no argument about which cue fits: it is named for this prop, it is the
 * only water sound in the bank, and the ripple it now accompanies was already
 * here.
 *
 * NOTE THE INTERACTION WITH `background: true` BELOW. This surface is a lid over
 * two of the three leaves, so a tap that lands on leaf geometry passes THROUGH
 * the water and plays the leaf's cue, not this one. That is the correct
 * ordering — the child aimed at the leaf — and it means the splash answers only
 * taps on open water.
 *
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
      triggerSound('sfx_nature_stream_splash');
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
