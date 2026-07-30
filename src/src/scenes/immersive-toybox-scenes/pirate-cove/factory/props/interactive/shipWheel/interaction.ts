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
    // THE DOCBLOCK ABOVE HAS PROMISED "A CREAKING SOUND" SINCE THIS FILE WAS
    // WRITTEN. UNTIL ROUND 3 THE CODE PLAYED `sfx_shared_tap_fallback` INSTEAD.
    //
    // That cue is documented in `uiSounds.ts` as the acknowledgement chirp for
    // tap-fallback feedback: the sound a tap makes when it finds NOTHING. Measured
    // in `.probe/render/r3-cove.mjs` against a verified miss baseline, a tap on
    // this wheel and a tap on empty sky were audibly identical. The wheel spun
    // anyway, which is worse than silence, because the eyes and the ears then
    // disagree — and soul.md's promise is "Nothing will confuse you."
    //
    // No creak existed to borrow, so one was written: `sfx_pirate_cove_wheel_creak`
    // in `assets/audio/pirateCove`. `sfx_shared_whoosh` was the nearest shared fit
    // and was rejected twice over — the sail already answers with it a few metres
    // away, so the wheel would have spoken in another prop's voice, and a whoosh is
    // moving air rather than wood under load.
    //
    // A CHARGE THIS ROUND MADE AGAINST THIS PROP AND THEN WITHDREW. This handler
    // emits no particles, and the round opened by claiming its answer was therefore
    // poorer than a miss's — a miss at least gets `sceneSparkle`. That was measured
    // in `r3-cove-visible.mjs` and it was WRONG. The rotation is a large visible
    // answer that an emit-recorder is simply unable to see: the wheel's peak pixel
    // change came in at 6.18x the sparkle it displaces, the biggest reaction of any
    // prop in the cove. So the missing emit is not a defect, `fire` is right to
    // withhold the sparkle here, and the only real defect was this one line.
    triggerSound('sfx_pirate_cove_wheel_creak');

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
