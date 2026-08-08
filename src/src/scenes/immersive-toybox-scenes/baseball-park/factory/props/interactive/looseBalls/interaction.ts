/**
 * Dispatcher-based interaction wiring for the loose baseballs.
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
import type { LooseBallCreateResult } from './create';
import { ANIMATION_FPS, HOP_APEX_Y, HOP_FIRST_LAND_FRAME, HOP_SECOND_APEX_FRAME, HOP_SECOND_APEX_Y, HOP_SETTLE_FRAME, HOP_TUMBLE } from './constants';

/**
 * Registers tap behavior for one loose baseball.
 *
 * On tap the ball answers with its own rubbery double-boing, hops twice — the
 * second bounce smaller, the way a real ball dies out — tumbles half a turn,
 * and sparkles where the finger landed.
 *
 * @param scene - Scene used for spawning the burst effect.
 * @param dispatcher - Shared world tap dispatcher for this scene.
 * @param looseBall - Typed handles returned by `createLooseBall`.
 * @returns Cleanup function that unregisters the tap handler.
 */
export function setupLooseBallTap(scene: Scene, dispatcher: WorldTapDispatcher, looseBall: LooseBallCreateResult): (() => void) | undefined {
  return createTapInteraction(dispatcher, looseBall.tapTarget, () => {
    triggerSound('sfx_baseball_ball_bounce');

    const currentTumble = looseBall.root.rotation.x;

    playAnimation(
      looseBall.root,
      'position.y',
      [
        { frame: 0, value: 0 },
        { frame: HOP_FIRST_LAND_FRAME / 2, value: HOP_APEX_Y },
        { frame: HOP_FIRST_LAND_FRAME, value: 0 },
        { frame: HOP_SECOND_APEX_FRAME, value: HOP_SECOND_APEX_Y },
        { frame: HOP_SETTLE_FRAME, value: 0 },
      ],
      { fps: ANIMATION_FPS },
    );

    playAnimation(
      looseBall.root,
      'rotation.x',
      [
        { frame: 0, value: currentTumble },
        { frame: HOP_SETTLE_FRAME, value: currentTumble + HOP_TUMBLE },
      ],
      { fps: ANIMATION_FPS },
    );

    getParticleEngine(scene).emit(PARTICLES.sceneSparkle, looseBall.tapTarget.getWorldPosition(new Vector3()));
  });
}
