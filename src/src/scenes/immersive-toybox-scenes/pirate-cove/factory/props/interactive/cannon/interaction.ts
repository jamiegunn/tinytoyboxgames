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
    // `sfx_shared_pop`, NOT `sfx_shared_tap_fallback`, AND THE DIFFERENCE IS THE
    // WHOLE OF ROUND 3'S CHARGE AGAINST THIS PROP.
    //
    // Until now this line played `sfx_shared_tap_fallback`, which `uiSounds.ts`
    // documents as "a gentle acknowledgement chirp for tap-fallback feedback" —
    // the cue the controller plays when a tap finds NOTHING. Measured in
    // `.probe/render/r3-cove.mjs` against a verified miss baseline: a tap on this
    // cannon and a tap on empty sky produced the identical sound. The cannon fired
    // confetti; the sky did not; a child with their eyes elsewhere heard no
    // difference between them.
    //
    // The scene was already its own control. Four of the cove's six answers had a
    // voice of their own — the sea splashes, the sail whooshes, the parrot and the
    // chest chime. Only this prop and the ship wheel borrowed the miss's cue, and
    // those two are the props that most LOOK like controls on a ship, so they are
    // the two a child reaches for first.
    //
    // The docblock above this function has said "play a 'pop' sound" since it was
    // written, and `sfx_shared_pop` has been in the shared catalogue the whole
    // time. Nothing had to be authored; the promise simply was not kept.
    //
    // `sfx_cannonball_fire` was the other candidate and was rejected deliberately:
    // it belongs to the cannonball-splash minigame's louder register, and this
    // cannon's own docblock asks for "playful, not violent".
    //
    // WHAT THIS DOES NOT FIX, MEASURED AND ON THE RECORD. Playing any sound here
    // still ticks `fire`'s sound counter, so the controller concludes this prop
    // answered for itself and withholds the shared sparkle. For this prop that is
    // CORRECT, and it was verified rather than assumed: `r3-cove-visible.mjs`
    // measured the cannon's own reaction at 6.97x the peak pixel change of the
    // sparkle it displaces. The visible half of the charge was REFUTED. Only the
    // audible half was ever real, and this line is the whole of it.
    triggerSound('sfx_shared_pop');

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
