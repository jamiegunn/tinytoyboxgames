/**
 * Dispatcher-based interaction wiring for the generated interactive prop.
 *
 * This file exists to keep the tap behavior out of `create.ts`. That separation
 * matters because generated scenes are meant to be read repeatedly over time,
 * and mixing geometry code with event wiring makes that much harder once a prop
 * becomes more complex.
 */

import { Scene, Vector3 } from 'three';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { createTapInteraction } from '@app/utils/tapInteraction';
import { playAnimation } from '@app/utils/animationHelpers';
import { createBurstEffect, POLLEN_BURST } from '@app/utils/particleFactory';
import type { SampleInteractiveCreateResult } from './create';
import { ANIMATION_FPS, BLOOM_EXPANDED_SCALE, TAP_SPIN_DELTA } from './constants';

/**
 * Registers tap behavior for one interactive example prop.
 *
 * The behavior is intentionally simple but complete:
 *
 * - play a shared tap sound
 * - pulse the bloom scale
 * - give the root a small rotational response
 * - emit a particle burst at the tap target
 *
 * @param scene - Scene used for spawning the burst effect.
 * @param dispatcher - Shared world tap dispatcher for this scene.
 * @param sampleInteractive - Typed handles returned by `createSampleInteractive`.
 * @returns Cleanup function that unregisters the tap handler.
 */
export function setupSampleInteractiveTap(
  scene: Scene,
  dispatcher: WorldTapDispatcher,
  sampleInteractive: SampleInteractiveCreateResult,
): (() => void) | undefined {
  return createTapInteraction(dispatcher, sampleInteractive.tapTarget, () => {
    triggerSound('sfx_shared_tap_fallback');

    const currentBloomScale = sampleInteractive.bloom.scale.clone();
    const expandedScale = currentBloomScale.clone().multiplyScalar(BLOOM_EXPANDED_SCALE);
    const currentRotation = sampleInteractive.root.rotation.y;

    playAnimation(
      sampleInteractive.bloom,
      'scale',
      [
        { frame: 0, value: currentBloomScale },
        { frame: 6, value: expandedScale },
        { frame: 12, value: currentBloomScale.clone().multiplyScalar(1.04) },
        { frame: 18, value: currentBloomScale },
      ],
      { fps: ANIMATION_FPS },
    );

    playAnimation(
      sampleInteractive.root,
      'rotation.y',
      [
        { frame: 0, value: currentRotation },
        { frame: 8, value: currentRotation + TAP_SPIN_DELTA },
        { frame: 18, value: currentRotation },
      ],
      { fps: ANIMATION_FPS },
    );

    createBurstEffect(scene, sampleInteractive.tapTarget.getWorldPosition(new Vector3()), POLLEN_BURST);
  });
}
