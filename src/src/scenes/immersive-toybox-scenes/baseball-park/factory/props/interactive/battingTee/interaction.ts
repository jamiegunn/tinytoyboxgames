/**
 * Dispatcher-based interaction wiring for the batting tee.
 *
 * This file keeps the tap behavior out of `create.ts`, matching the pattern
 * every immersive scene uses: typed handles come from creation, behavior is
 * wired here.
 */

import { Scene, Vector3 } from 'three';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { createTapInteraction } from '@app/utils/tapInteraction';
import { playAnimation } from '@app/utils/animationHelpers';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';
import type { BattingTeeCreateResult } from './create';
import { ANIMATION_FPS, BALL_REST_Y, POP_FLY_APEX_Y, POP_FLY_DOWN_FRAME, POP_FLY_SETTLE_FRAME, POP_FLY_SPIN, POP_FLY_UP_FRAME } from './constants';

/**
 * Registers tap behavior for the batting tee's ball.
 *
 * On tap the ball leaves for a pop-fly and comes home: its own whistle-and-pop
 * cue, a rise to the apex with a full tumble, a drop back onto the cup with a
 * small settle, and a sparkle burst where the finger landed.
 *
 * @param scene - Scene used for spawning the burst effect.
 * @param dispatcher - Shared world tap dispatcher for this scene.
 * @param battingTee - Typed handles returned by `createBattingTee`.
 * @returns Cleanup function that unregisters the tap handler.
 */
export function setupBattingTeeTap(scene: Scene, dispatcher: WorldTapDispatcher, battingTee: BattingTeeCreateResult): (() => void) | undefined {
  return createTapInteraction(dispatcher, battingTee.tapTarget, () => {
    triggerSound('sfx_baseball_tee_pop');

    const currentSpin = battingTee.ball.rotation.z;

    playAnimation(
      battingTee.ball,
      'position.y',
      [
        { frame: 0, value: BALL_REST_Y },
        { frame: POP_FLY_UP_FRAME, value: POP_FLY_APEX_Y },
        { frame: POP_FLY_DOWN_FRAME, value: BALL_REST_Y - 0.04 },
        { frame: POP_FLY_SETTLE_FRAME, value: BALL_REST_Y },
      ],
      { fps: ANIMATION_FPS },
    );

    playAnimation(
      battingTee.ball,
      'rotation.z',
      [
        { frame: 0, value: currentSpin },
        { frame: POP_FLY_SETTLE_FRAME, value: currentSpin + POP_FLY_SPIN },
      ],
      { fps: ANIMATION_FPS },
    );

    getParticleEngine(scene).emit(PARTICLES.sceneSparkle, battingTee.tapTarget.getWorldPosition(new Vector3()));
  });
}
