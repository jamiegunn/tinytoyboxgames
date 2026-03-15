import { Scene, Vector3, type Mesh } from 'three';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import { createSparkleBurst } from '@app/utils/particles';
import { createRevealInteraction } from '@app/utils/revealInteraction';
import type { LeafRevealHandle } from './types';
import {
  LEAF_FLIP_END_FRAME,
  LADYBUG_REVEAL_Y,
  LADYBUG_ESCAPE_END_FRAME,
  LADYBUG_ESCAPE_OFFSET_X,
  LADYBUG_ESCAPE_OFFSET_Z,
  LEAF_PARTICLE_OFFSET_Y,
} from './constants';

/**
 * Registers a tap interaction on a leaf that flips it over and reveals a ladybug.
 *
 * @param scene - The Three.js scene for adding revealed creatures.
 * @param dispatcher - The world tap dispatcher.
 * @param tapTarget - The leaf cover mesh used as the tap target.
 * @param revealHandle - The reveal handle containing the ladybug mesh.
 * @returns A cleanup function to unregister the tap handler.
 */
export function setupLeafTap(scene: Scene, dispatcher: WorldTapDispatcher, tapTarget: Mesh, revealHandle: LeafRevealHandle): () => void {
  return createRevealInteraction(scene, dispatcher, {
    coverMesh: tapTarget,
    coverAnimation: {
      property: 'rotation.z',
      keys: [
        { frame: 0, value: tapTarget.rotation.z },
        { frame: LEAF_FLIP_END_FRAME, value: tapTarget.rotation.z + Math.PI },
      ],
    },
    creatureFactory: (pos: Vector3) => {
      revealHandle.ladybug.position.copy(pos);
      revealHandle.ladybug.position.y = LADYBUG_REVEAL_Y;
      return revealHandle.ladybug;
    },
    escapeKeys: (pos: Vector3) => [
      { frame: 0, value: pos.clone() },
      { frame: LADYBUG_ESCAPE_END_FRAME, value: new Vector3(pos.x + LADYBUG_ESCAPE_OFFSET_X, pos.y, pos.z + LADYBUG_ESCAPE_OFFSET_Z) },
    ],
    particleFn: createSparkleBurst,
    particleOffset: new Vector3(0, LEAF_PARTICLE_OFFSET_Y, 0),
    repeatOnTap: false,
  });
}
