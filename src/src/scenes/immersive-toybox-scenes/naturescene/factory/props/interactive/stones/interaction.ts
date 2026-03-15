import { Scene, Vector3, type Mesh } from 'three';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { createDustPuff } from '@app/utils/particles';
import { createRevealInteraction } from '@app/utils/revealInteraction';
import { rand } from '@app/utils/randomHelpers';
import type { StoneRevealHandle } from './types';
import {
  STONE_REVEAL_SHIFT_RANGE,
  STONE_REVEAL_END_FRAME,
  GRUB_REVEAL_OFFSET_X,
  GRUB_REVEAL_OFFSET_Y,
  GRUB_ESCAPE_END_FRAME,
  GRUB_ESCAPE_OFFSET_X,
  GRUB_ESCAPE_OFFSET_Z,
} from './constants';

/**
 * Registers a tap interaction on a stone that shifts it aside and reveals a grub.
 *
 * @param scene - The Three.js scene for adding revealed creatures.
 * @param dispatcher - The world tap dispatcher.
 * @param tapTarget - The stone mesh used as the tap target.
 * @param revealHandle - The reveal handle containing the grub mesh.
 * @returns A cleanup function to unregister the tap handler.
 */
export function setupStoneTap(scene: Scene, dispatcher: WorldTapDispatcher, tapTarget: Mesh, revealHandle: StoneRevealHandle): () => void {
  const dir = new Vector3(rand.bipolar(STONE_REVEAL_SHIFT_RANGE), 0, rand.bipolar(STONE_REVEAL_SHIFT_RANGE));

  return createRevealInteraction(scene, dispatcher, {
    coverMesh: tapTarget,
    coverAnimation: {
      property: 'position',
      keys: [
        { frame: 0, value: tapTarget.position.clone() },
        { frame: STONE_REVEAL_END_FRAME, value: tapTarget.position.clone().add(dir) },
      ],
    },
    creatureFactory: (pos: Vector3) => {
      revealHandle.grub.position.copy(pos);
      revealHandle.grub.position.x += GRUB_REVEAL_OFFSET_X;
      revealHandle.grub.position.y = GRUB_REVEAL_OFFSET_Y;
      return revealHandle.grub;
    },
    escapeKeys: (pos: Vector3) => [
      { frame: 0, value: pos.clone() },
      { frame: GRUB_ESCAPE_END_FRAME, value: new Vector3(pos.x + GRUB_ESCAPE_OFFSET_X, pos.y, pos.z + GRUB_ESCAPE_OFFSET_Z) },
    ],
    particleFn: createDustPuff,
  });
}
