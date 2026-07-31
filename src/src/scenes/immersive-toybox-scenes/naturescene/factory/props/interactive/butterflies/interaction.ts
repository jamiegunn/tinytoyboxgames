import { type Mesh, type Scene } from 'three';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import { createTapInteraction } from '@app/utils/tapInteraction';
import type { IdleInterruptHandle } from '@app/utils/idleInterruptible';

/**
 * Registers a tap interaction on a butterfly that plays a wingbeat flutter and
 * triggers the flee-and-return reaction.
 *
 * `sfx_nature_butterfly_flutter` is a very soft high-passed noise with a 10 Hz
 * tremolo — a wingbeat, and specifically a wingbeat that STARTS, which is what
 * a startled butterfly does. It was written for this prop and called zero times
 * until Round 5 of `docs/reviews/2026-07-30-rooms-five-rounds.md`.
 *
 * I PREDICTED THIS PROP WOULD CARRY THE ROUND'S ONLY REAL RISK. THE MEASUREMENT
 * SAID OTHERWISE, AND THE CORRECTION IS RECORDED HERE RATHER THAN QUIETLY
 * DELETED. The pre-registered worry was sound in shape: `interactionController.fire`
 * withholds its shared sparkle from any handler that made a sound, so every prop
 * that GAINS a voice LOSES that sparkle, and a prop with no particles of its own
 * would trade a picture for a noise. What was wrong was the factual premise —
 * that the butterfly has no particles of its own. It does. `animation.ts` passes
 * `particleFn: (s, p) => emit(PARTICLES.sceneSparkle, p)` to the idle-interruptible,
 * and `fleeHandle.trigger()` fires it. The post-fix run of
 * `.probe/render/r5-nature-voice.mjs` shows `bfly_body ... emits sceneSparkle` on
 * all four rows, so nothing was traded away here at all.
 *
 * The two props that DO tap-time-lose their sparkle are the leaf and the stone,
 * whose own particles are deferred into `playAnimation`'s `onEnd`. They are the
 * ones measured in pixels; see the review doc. The lesson filed is the ordinary
 * one: I named the at-risk prop from reading the file I was editing, and the
 * risk was in the sibling file I had not opened.
 *
 * @param _scene - The Three.js scene (unused).
 * @param dispatcher - The world tap dispatcher.
 * @param body - The butterfly body mesh used as the tap target.
 * @param fleeHandle - The idle interrupt handle that triggers the flee reaction.
 * @returns A cleanup function to unregister the tap handler.
 */
export function setupButterflyTap(_scene: Scene, dispatcher: WorldTapDispatcher, body: Mesh, fleeHandle: IdleInterruptHandle): () => void {
  return createTapInteraction(dispatcher, body, () => {
    triggerSound('sfx_nature_butterfly_flutter');
    fleeHandle.trigger();
  });
}
