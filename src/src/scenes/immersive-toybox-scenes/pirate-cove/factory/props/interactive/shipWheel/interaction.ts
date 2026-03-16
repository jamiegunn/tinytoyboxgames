/**
 * Dispatcher-based interaction wiring for the ship wheel.
 *
 * On tap: the wheel spins with a rotation animation and plays a creaking sound.
 */

import { Scene } from 'three';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { createTapInteraction } from '@app/utils/tapInteraction';
import { playAnimation } from '@app/utils/animationHelpers';
import type { ShipWheelCreateResult } from './create';
import { ANIMATION_FPS, SPIN_AMOUNT } from './constants';

/**
 * Registers tap behavior for the ship wheel.
 *
 * @param _scene - Scene (unused but kept for the standard compose contract).
 * @param dispatcher - Shared world tap dispatcher.
 * @param wheel - Typed handles from `createShipWheel`.
 * @returns Cleanup function that unregisters the tap handler.
 */
export function setupShipWheelTap(_scene: Scene, dispatcher: WorldTapDispatcher, wheel: ShipWheelCreateResult): (() => void) | undefined {
  return createTapInteraction(dispatcher, wheel.tapTarget, () => {
    triggerSound('sfx_shared_tap_fallback');

    // Spin the wheel group around its Z axis (the face normal)
    const currentZ = wheel.wheelGroup.rotation.z;
    playAnimation(
      wheel.wheelGroup,
      'rotation.z',
      [
        { frame: 0, value: currentZ },
        { frame: 8, value: currentZ + SPIN_AMOUNT * 0.6 },
        { frame: 20, value: currentZ + SPIN_AMOUNT },
        { frame: 30, value: currentZ + SPIN_AMOUNT - 0.1 },
      ],
      { fps: ANIMATION_FPS },
    );
  });
}
