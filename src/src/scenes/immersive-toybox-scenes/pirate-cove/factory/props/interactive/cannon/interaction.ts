/**
 * Dispatcher-based interaction wiring for the cannon prop.
 *
 * On tap: play a "pop" sound, recoil with a bounce animation, and emit a
 * colorful confetti particle burst. Playful, not violent.
 */

import { Scene, Vector3 } from 'three';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { createTapInteraction } from '@app/utils/tapInteraction';
import { playAnimation } from '@app/utils/animationHelpers';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';
import type { CannonCreateResult } from './create';
import { ANIMATION_FPS, RECOIL_DISTANCE } from './constants';

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
    getParticleEngine(scene).emit(PARTICLES.cannonConfetti, burstOrigin);
  });
}
