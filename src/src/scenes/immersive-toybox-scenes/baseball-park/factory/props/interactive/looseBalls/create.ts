/**
 * Builds one loose baseball: a white sphere with a red stitch ring, resting on
 * the grass. The whole ball is the tap target; `interaction.ts` makes it hop.
 */

import { Group, Mesh, SphereGeometry, TorusGeometry, type Scene } from 'three';
import { createEntityRoot, type EntityPlacement } from '../../../../types';
import type { ImmersiveSceneMaterials } from '../../../../materials';
import { BALL_RADIUS, STITCH_TUBE_RADIUS } from './constants';

/** Shared dependencies required to build one loose baseball. */
export interface LooseBallBuildOptions {
  materials: Pick<ImmersiveSceneMaterials, 'plateWhite' | 'ballStitch'>;
}

/** Typed handles returned to the interaction layer after mesh creation. */
export interface LooseBallCreateResult {
  root: Group;
  tapTarget: Mesh;
}

/**
 * Creates one staged loose baseball.
 *
 * @param scene - Scene that should receive the created prop.
 * @param placement - World placement authored in `staging/looseBalls.ts`.
 * @param options - Shared materials used by the prop.
 * @returns Typed handles needed by the interaction layer.
 */
export function createLooseBall(scene: Scene, placement: EntityPlacement, options: LooseBallBuildOptions): LooseBallCreateResult {
  const root = createEntityRoot('baseball_loose_ball', placement, scene);

  const ball = new Mesh(new SphereGeometry(BALL_RADIUS, 16, 16), options.materials.plateWhite);
  ball.name = 'baseball_loose_ball_core';
  ball.position.y = BALL_RADIUS;
  ball.castShadow = true;
  ball.receiveShadow = true;
  root.add(ball);

  const stitch = new Mesh(new TorusGeometry(BALL_RADIUS, STITCH_TUBE_RADIUS, 8, 24), options.materials.ballStitch);
  stitch.name = 'baseball_loose_ball_stitch';
  stitch.position.y = BALL_RADIUS;
  stitch.rotation.x = Math.PI / 2 - 0.55;
  root.add(stitch);

  return {
    root,
    tapTarget: ball,
  };
}
