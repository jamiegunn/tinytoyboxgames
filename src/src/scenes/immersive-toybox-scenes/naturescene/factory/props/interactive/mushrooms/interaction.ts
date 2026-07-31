import { Scene, Vector3, Color } from 'three';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import { createTapInteraction } from '@app/utils/tapInteraction';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';
import { playAnimation } from '@app/utils/animationHelpers';
import type { MushroomCreateResult } from './types';
import {
  BOUNCE_START_SCALE,
  BOUNCE_WIDE_FRAME,
  BOUNCE_TALL_FRAME,
  BOUNCE_RESET_FRAME,
  BOUNCE_WIDE_SCALE_X,
  BOUNCE_WIDE_SCALE_Y,
  BOUNCE_TALL_SCALE_X,
  BOUNCE_TALL_SCALE_Y,
  GLOW_COLOR,
  GLOW_START_FRAME,
  GLOW_END_FRAME,
} from './constants';

/**
 * Registers a tap interaction on a mushroom that plays a springy boing, a
 * squash-and-stretch bounce animation, an emissive glow pulse and sparkles.
 *
 * THE SOUND AND THE PICTURE WERE DESIGNED TOGETHER AND THEN NEVER CONNECTED.
 * `sfx_nature_mushroom_bounce` has existed in `assets/audio/nature/index.ts`
 * since the scene was built — a 600 Hz to 200 Hz sine sweep with a second,
 * softer re-trigger at +0.15s — and until Round 5 of
 * `docs/reviews/2026-07-30-rooms-five-rounds.md` it was called zero times. Note
 * what that re-trigger is FOR: it is a sound written for a two-stage bounce,
 * and the animation below is exactly two stages (wide at frame 8, tall at frame
 * 16, home at 24). Somebody wrote the boing to match this curve. The wire
 * between them was simply never run, so the mushroom bounced in silence and the
 * dispatcher's safety net answered with `sfx_shared_tap_fallback` — the cue for
 * a tap that hit nothing at all.
 *
 * @param scene - The Three.js scene for particle effects.
 * @param dispatcher - The world tap dispatcher.
 * @param mushroom - Typed mushroom handles returned by `createMushroom`.
 * @returns A cleanup function to unregister the tap handler.
 */
export function setupMushroomTap(scene: Scene, dispatcher: WorldTapDispatcher, mushroom: MushroomCreateResult): () => void {
  return createTapInteraction(dispatcher, mushroom.tapTarget, () => {
    triggerSound('sfx_nature_mushroom_bounce');

    playAnimation(mushroom.root, 'scale', [
      { frame: 0, value: new Vector3(BOUNCE_START_SCALE, BOUNCE_START_SCALE, BOUNCE_START_SCALE) },
      { frame: BOUNCE_WIDE_FRAME, value: new Vector3(BOUNCE_WIDE_SCALE_X, BOUNCE_WIDE_SCALE_Y, BOUNCE_WIDE_SCALE_X) },
      { frame: BOUNCE_TALL_FRAME, value: new Vector3(BOUNCE_TALL_SCALE_X, BOUNCE_TALL_SCALE_Y, BOUNCE_TALL_SCALE_X) },
      { frame: BOUNCE_RESET_FRAME, value: new Vector3(BOUNCE_START_SCALE, BOUNCE_START_SCALE, BOUNCE_START_SCALE) },
    ]);

    playAnimation(mushroom.tapTarget, 'material.emissive', [
      { frame: 0, value: new Color(0, 0, 0) },
      { frame: GLOW_START_FRAME, value: GLOW_COLOR.clone() },
      { frame: GLOW_END_FRAME, value: new Color(0, 0, 0) },
    ]);

    getParticleEngine(scene).emit(PARTICLES.sceneSparkle, mushroom.tapTarget.getWorldPosition(new Vector3()));
  });
}
