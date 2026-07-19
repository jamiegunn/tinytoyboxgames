/**
 * Dispatcher-based interaction wiring for the treasure chest.
 *
 * On tap: lid opens with a rotation animation, golden sparkle burst, then
 * closes slowly. Plays a cheerful chime sound.
 */

import { Scene, Vector3 } from 'three';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { createTapInteraction } from '@app/utils/tapInteraction';
import { playAnimation } from '@app/utils/animationHelpers';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';
import type { TreasureChestCreateResult } from './create';
import { ANIMATION_FPS, LID_OPEN_ANGLE } from './constants';

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

    // A treasure-reveal chime (not the generic tap fallback) so the chest reads
    // as its own delightful reward, distinct from the game-portal toyboxes.
    triggerSound('sfx_shared_chime');

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
    getParticleEngine(scene).emit(PARTICLES.treasureGold, burstOrigin);
  });
}
