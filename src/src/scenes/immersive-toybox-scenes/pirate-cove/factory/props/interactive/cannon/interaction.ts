/**
 * Dispatcher-based interaction wiring for the cannon prop.
 *
 * On tap: play a "pop" sound, recoil with a bounce animation, and emit a
 * colorful confetti particle burst. Playful, not violent.
 */

import { Color, Scene, Vector3 } from 'three';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { createTapInteraction } from '@app/utils/tapInteraction';
import { playAnimation } from '@app/utils/animationHelpers';
import { createBurstEffect, type BurstConfig } from '@app/utils/particleFactory';
import type { CannonCreateResult } from './create';
import { ANIMATION_FPS, RECOIL_DISTANCE } from './constants';

/** Colorful confetti burst for the cannon pop effect. */
const CONFETTI_BURST: BurstConfig = {
  capacity: 40,
  emitCount: 30,
  lifetime: [0.6, 1.4],
  size: [0.02, 0.06],
  color1: new Color(1, 0.4, 0.5),
  alpha1: 1,
  color2: new Color(0.3, 0.6, 1),
  alpha2: 0.8,
  gravity: new Vector3(0, -0.8, 0),
  direction1: new Vector3(-0.8, 0.5, -1.5),
  direction2: new Vector3(0.8, 1.5, -2.5),
  emitPower: [0.8, 1.5],
  blendMode: 'normal',
};

/**
 * Registers tap behavior for the cannon.
 *
 * @param scene - Scene used for spawning the burst effect.
 * @param dispatcher - Shared world tap dispatcher.
 * @param cannon - Typed handles from `createCannon`.
 * @returns Cleanup function that unregisters the tap handler.
 */
export function setupCannonTap(scene: Scene, dispatcher: WorldTapDispatcher, cannon: CannonCreateResult): (() => void) | undefined {
  return createTapInteraction(dispatcher, cannon.tapTarget, () => {
    triggerSound('sfx_shared_tap_fallback');

    // Recoil: root slides backward then bounces back
    const startZ = cannon.root.position.z;
    playAnimation(
      cannon.root,
      'position.z',
      [
        { frame: 0, value: startZ },
        { frame: 4, value: startZ + RECOIL_DISTANCE },
        { frame: 10, value: startZ - RECOIL_DISTANCE * 0.3 },
        { frame: 16, value: startZ },
      ],
      { fps: ANIMATION_FPS },
    );

    // Barrel tilts up slightly
    const startRotX = cannon.barrel.rotation.x;
    playAnimation(
      cannon.barrel,
      'rotation.x',
      [
        { frame: 0, value: startRotX },
        { frame: 4, value: startRotX - 0.15 },
        { frame: 12, value: startRotX },
      ],
      { fps: ANIMATION_FPS },
    );

    // Confetti burst from the barrel mouth
    const burstOrigin = cannon.barrel.getWorldPosition(new Vector3());
    burstOrigin.z -= 0.5;
    burstOrigin.y += 0.1;
    createBurstEffect(scene, burstOrigin, CONFETTI_BURST);
  });
}
