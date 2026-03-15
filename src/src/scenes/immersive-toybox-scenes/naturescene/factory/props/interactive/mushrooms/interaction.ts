import { Scene, Vector3, Color } from 'three';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { createTapInteraction } from '@app/utils/tapInteraction';
import { createSparkleBurst } from '@app/utils/particles';
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
 * Registers a tap interaction on a mushroom that plays a squash-and-stretch
 * bounce animation with an emissive glow pulse and sparkle particles.
 *
 * @param scene - The Three.js scene for particle effects.
 * @param dispatcher - The world tap dispatcher.
 * @param mushroom - Typed mushroom handles returned by `createMushroom`.
 * @returns A cleanup function to unregister the tap handler.
 */
export function setupMushroomTap(scene: Scene, dispatcher: WorldTapDispatcher, mushroom: MushroomCreateResult): () => void {
  return createTapInteraction(dispatcher, mushroom.tapTarget, () => {
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

    createSparkleBurst(scene, mushroom.tapTarget.getWorldPosition(new Vector3()));
  });
}
