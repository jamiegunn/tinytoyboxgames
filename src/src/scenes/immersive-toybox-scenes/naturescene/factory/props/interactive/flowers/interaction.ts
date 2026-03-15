import { Scene, Vector3 } from 'three';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { createTapInteraction } from '@app/utils/tapInteraction';
import { playAnimation } from '@app/utils/animationHelpers';
import { createBurstEffect, POLLEN_BURST } from '@app/utils/particleFactory';
import type { FlowerCreateResult } from './types';
import { BLOOM_FRAME_BASE, BLOOM_FRAME_STAGGER, BLOOMED_PETAL_SCALE_X, BLOOMED_PETAL_SCALE_Y, BLOOMED_PETAL_SCALE_Z } from './constants';

/**
 * Registers a tap interaction on a flower that blooms open the petals on first
 * tap and emits a pollen burst particle effect.
 *
 * @param scene - The Three.js scene for particle effects.
 * @param dispatcher - The world tap dispatcher.
 * @param flower - Typed flower handles returned by `createFlower`.
 * @returns A cleanup function to unregister the tap handler.
 */
export function setupFlowerTap(scene: Scene, dispatcher: WorldTapDispatcher, flower: FlowerCreateResult): () => void {
  let isOpen = false;

  return createTapInteraction(dispatcher, flower.tapTarget, () => {
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

    createBurstEffect(scene, flower.tapTarget.getWorldPosition(new Vector3()), POLLEN_BURST);
  });
}
