import { Scene, Vector3, type Mesh } from 'three';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import { createTapInteraction } from '@app/utils/tapInteraction';

/**
 * Registers a tap interaction on the log body that knocks and emits a sparkle burst.
 *
 * `sfx_nature_log_knock` was authored in Round 5 of
 * `docs/reviews/2026-07-30-rooms-five-rounds.md`: a 1400 Hz noise transient for
 * the knuckle, a 165 Hz triangle body for the wood, and a quiet fifth above it
 * so the body reads as HOLLOW rather than solid. The log is a fallen hollow log
 * and the sound says so.
 *
 * THE SHARED CANDIDATE WAS REJECTED ON IDENTITY, NOT ON TIMBRE.
 * `sfx_hub_toybox_tap` is a close enough knock that reusing it would have saved
 * a synth. It was refused because it is a named prop's voice and it is IN USE:
 * Round 4's rule is that a cue belonging to one prop must not be handed to
 * another, and a child who taps the toybox in the hub and the log in the forest
 * and hears the same thing has been taught that the log is a toybox. That is
 * exactly the confusion soul.md's Promise forbids.
 *
 * @param scene - The Three.js scene for particle effects.
 * @param dispatcher - The world tap dispatcher.
 * @param tapTarget - The log body mesh used as the tap target.
 * @returns A cleanup function to unregister the tap handler.
 */
export function setupLogTap(scene: Scene, dispatcher: WorldTapDispatcher, tapTarget: Mesh): () => void {
  return createTapInteraction(dispatcher, tapTarget, () => {
    triggerSound('sfx_nature_log_knock');
    getParticleEngine(scene).emit(PARTICLES.sceneSparkle, tapTarget.getWorldPosition(new Vector3()));
  });
}
