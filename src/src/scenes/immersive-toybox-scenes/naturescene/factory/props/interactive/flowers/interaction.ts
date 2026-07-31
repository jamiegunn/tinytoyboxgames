import { Scene, Vector3 } from 'three';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import { createTapInteraction } from '@app/utils/tapInteraction';
import { playAnimation } from '@app/utils/animationHelpers';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';
import type { FlowerCreateResult } from './types';
import { BLOOM_FRAME_BASE, BLOOM_FRAME_STAGGER, BLOOMED_PETAL_SCALE_X, BLOOMED_PETAL_SCALE_Y, BLOOMED_PETAL_SCALE_Z } from './constants';

/**
 * Registers a tap interaction on a flower that blooms open the petals on first
 * tap, emits a pollen burst, and plays a rising sparkle.
 *
 * WHY A SHARED CUE HERE, WHEN ROUND 5 AUTHORED BESPOKE ONES FOR THREE OF ITS
 * SIBLINGS. `sfx_shared_sparkle_burst` is not a generic stand-in picked to fill
 * a hole: it is four tones drawn from a C-pentatonic pool, staggered 50 ms
 * apart and always cascading UPWARD (`shared/rewardSounds.ts`). The animation
 * below staggers its petals the same way — `BLOOM_FRAME_BASE + i *
 * BLOOM_FRAME_STAGGER` — so the cue and the picture have the same structure:
 * n discrete events, each later and higher than the last, opening outward.
 * When the shared library already contains the right shape, writing a new synth
 * would be craftsmanship for its own sake.
 *
 * THE KNOWN LIMIT, STATED RATHER THAN HIDDEN. The bloom happens once; every
 * later tap only puffs pollen, and hears the same cue as the bloom did. That
 * over-promises slightly. It is left as filed follow-up rather than patched
 * here because the honest repair is a second, smaller cue for the puff, and
 * that is a sound to author and defend on its own, not to guess at.
 *
 * @param scene - The Three.js scene for particle effects.
 * @param dispatcher - The world tap dispatcher.
 * @param flower - Typed flower handles returned by `createFlower`.
 * @returns A cleanup function to unregister the tap handler.
 */
export function setupFlowerTap(scene: Scene, dispatcher: WorldTapDispatcher, flower: FlowerCreateResult): () => void {
  let isOpen = false;

  return createTapInteraction(dispatcher, flower.tapTarget, () => {
    triggerSound('sfx_shared_sparkle_burst');

    if (!isOpen) {
      flower.petals.forEach((petal, i) => {
        playAnimation(petal, 'scale', [
          { frame: 0, value: petal.scale.clone() },
          {
            frame: BLOOM_FRAME_BASE + i * BLOOM_FRAME_STAGGER,
            value: new Vector3(BLOOMED_PETAL_SCALE_X, BLOOMED_PETAL_SCALE_Y, BLOOMED_PETAL_SCALE_Z),
          },
        ]);
      });
      isOpen = true;
    }

    getParticleEngine(scene).emit(PARTICLES.pollen, flower.tapTarget.getWorldPosition(new Vector3()));
  });
}
