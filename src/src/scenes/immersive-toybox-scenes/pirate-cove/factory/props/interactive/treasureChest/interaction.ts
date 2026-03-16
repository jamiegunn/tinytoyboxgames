/**
 * Dispatcher-based interaction wiring for the treasure chest.
 *
 * On tap: lid opens with a rotation animation, golden sparkle burst, then
 * closes slowly. Plays a cheerful chime sound.
 */

import { Color, Scene, Vector3 } from 'three';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { createTapInteraction } from '@app/utils/tapInteraction';
import { playAnimation } from '@app/utils/animationHelpers';
import { createBurstEffect, type BurstConfig } from '@app/utils/particleFactory';
import type { TreasureChestCreateResult } from './create';
import { ANIMATION_FPS, LID_OPEN_ANGLE } from './constants';

/** Golden sparkle burst when the chest opens. */
const GOLD_SPARKLE_BURST: BurstConfig = {
  capacity: 35,
  emitCount: 25,
  lifetime: [0.5, 1.2],
  size: [0.015, 0.05],
  color1: new Color(1, 0.9, 0.4),
  alpha1: 0.9,
  color2: new Color(0.9, 0.75, 0.2),
  alpha2: 0.4,
  gravity: new Vector3(0, 0.2, 0),
  direction1: new Vector3(-0.5, 0.5, -0.5),
  direction2: new Vector3(0.5, 1.2, 0.5),
  emitPower: [0.2, 0.6],
  blendMode: 'additive',
};

/**
 * Registers tap behavior for the treasure chest.
 *
 * @param scene - Scene used for spawning the burst effect.
 * @param dispatcher - Shared world tap dispatcher.
 * @param chest - Typed handles from `createTreasureChest`.
 * @returns Cleanup function that unregisters the tap handler.
 */
export function setupTreasureChestTap(scene: Scene, dispatcher: WorldTapDispatcher, chest: TreasureChestCreateResult): (() => void) | undefined {
  let isAnimating = false;

  return createTapInteraction(dispatcher, chest.tapTarget, () => {
    if (isAnimating) return;
    isAnimating = true;

    triggerSound('sfx_shared_tap_fallback');

    // Open the lid, hold, then close slowly
    playAnimation(
      chest.lid,
      'rotation.x',
      [
        { frame: 0, value: 0 },
        { frame: 10, value: LID_OPEN_ANGLE },
        { frame: 40, value: LID_OPEN_ANGLE },
        { frame: 60, value: 0 },
      ],
      {
        fps: ANIMATION_FPS,
        onEnd: () => {
          isAnimating = false;
        },
      },
    );

    // Golden sparkle burst from the chest opening
    const burstOrigin = chest.root.getWorldPosition(new Vector3());
    burstOrigin.y += 0.6;
    createBurstEffect(scene, burstOrigin, GOLD_SPARKLE_BURST);
  });
}
