import { Vector3, type Mesh, type Group, type Scene } from 'three';
import { createSparkleBurst } from '@app/utils/particles';
import { startIdleLoop } from '@app/utils/animationHelpers';
import { idleWithInterrupt, type IdleInterruptHandle } from '@app/utils/idleInterruptible';
import { rand } from '@app/utils/randomHelpers';
import {
  FLUTTER_AMPLITUDE,
  FLUTTER_HALF_FRAME,
  FLUTTER_FULL_FRAME,
  DRIFT_FRAME_1,
  DRIFT_FRAME_2,
  DRIFT_FRAME_3,
  DRIFT_OFFSET_1,
  DRIFT_OFFSET_2,
  FLEE_RANGE,
  FLEE_HEIGHT,
  FLEE_FRAME,
  FLEE_RETURN_FRAME,
  PARTICLE_OFFSET_Y,
} from './constants';

/**
 * Starts the wing flutter idle loop on both wings.
 * @param wingL - The left wing mesh.
 * @param wingR - The right wing mesh.
 * @returns A cleanup function that stops both wing flutter loops.
 */
export function animateWingFlutter(wingL: Mesh, wingR: Mesh): () => void {
  const leftHandle = startIdleLoop(wingL, 'rotation.z', [
    { frame: 0, value: 0 },
    { frame: FLUTTER_HALF_FRAME, value: FLUTTER_AMPLITUDE },
    { frame: FLUTTER_FULL_FRAME, value: 0 },
  ]);
  const rightHandle = startIdleLoop(wingR, 'rotation.z', [
    { frame: 0, value: 0 },
    { frame: FLUTTER_HALF_FRAME, value: -FLUTTER_AMPLITUDE },
    { frame: FLUTTER_FULL_FRAME, value: 0 },
  ]);
  return () => {
    leftHandle.stop();
    rightHandle.stop();
  };
}

/**
 * Sets up the butterfly's idle drift path and flee-and-return reaction.
 * @param root - The butterfly root group.
 * @param homePos - The butterfly's rest position.
 * @param scene - The Three.js scene, required for particle emission.
 * @returns The idle interrupt handle for triggering the flee reaction.
 */
export function setupDriftAndFlee(root: Group, homePos: Vector3, scene: Scene): IdleInterruptHandle {
  return idleWithInterrupt(
    root,
    {
      idleProperty: 'position',
      idleKeys: [
        { frame: 0, value: homePos.clone() },
        { frame: DRIFT_FRAME_1, value: new Vector3(homePos.x + DRIFT_OFFSET_1.x, homePos.y + DRIFT_OFFSET_1.y, homePos.z + DRIFT_OFFSET_1.z) },
        { frame: DRIFT_FRAME_2, value: new Vector3(homePos.x + DRIFT_OFFSET_2.x, homePos.y + DRIFT_OFFSET_2.y, homePos.z + DRIFT_OFFSET_2.z) },
        { frame: DRIFT_FRAME_3, value: homePos.clone() },
      ],
      reactionAnimations: () => {
        const p = root.position.clone();
        const fleePos = new Vector3(p.x + rand.bipolar(FLEE_RANGE), p.y + FLEE_HEIGHT, p.z + rand.bipolar(FLEE_RANGE));
        return [
          {
            property: 'position',
            keys: [
              { frame: 0, value: p },
              { frame: FLEE_FRAME, value: fleePos },
              { frame: FLEE_RETURN_FRAME, value: homePos.clone() },
            ],
          },
        ];
      },
      particleFn: createSparkleBurst,
      particleOffset: new Vector3(0, PARTICLE_OFFSET_Y, 0),
      lockDuringReaction: true,
    },
    scene,
  );
}
