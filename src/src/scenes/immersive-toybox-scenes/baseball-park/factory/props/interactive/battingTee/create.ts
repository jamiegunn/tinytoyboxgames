/**
 * Builds the batting tee: a weighted base, a stem, a cup, and a baseball
 * resting on top. The ball is the tap target; `interaction.ts` sends it on a
 * pop-fly and brings it home.
 */

import { CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry, type Scene } from 'three';
import { createEntityRoot, type EntityPlacement } from '../../../../types';
import type { ImmersiveSceneMaterials } from '../../../../materials';
import {
  BALL_RADIUS,
  BALL_REST_Y,
  STITCH_TUBE_RADIUS,
  TEE_BASE_HEIGHT,
  TEE_BASE_RADIUS,
  TEE_CUP_BOTTOM_RADIUS,
  TEE_CUP_HEIGHT,
  TEE_CUP_TOP_RADIUS,
  TEE_STEM_HEIGHT,
  TEE_STEM_RADIUS,
} from './constants';

/** Shared dependencies required to build the batting tee. */
export interface BattingTeeBuildOptions {
  materials: Pick<ImmersiveSceneMaterials, 'teeBody' | 'plateWhite' | 'ballStitch'>;
}

/** Typed handles returned to the interaction layer after mesh creation. */
export interface BattingTeeCreateResult {
  root: Group;
  ball: Group;
  tapTarget: Mesh;
}

/**
 * Creates the batting tee at its staged placement.
 *
 * @param scene - Scene that should receive the created prop.
 * @param placement - World placement authored in `staging/battingTee.ts`.
 * @param options - Shared materials used by the prop.
 * @returns Typed handles needed by the interaction layer.
 */
export function createBattingTee(scene: Scene, placement: EntityPlacement, options: BattingTeeBuildOptions): BattingTeeCreateResult {
  const root = createEntityRoot('baseball_batting_tee', placement, scene);

  const base = new Mesh(new CylinderGeometry(TEE_BASE_RADIUS * 0.85, TEE_BASE_RADIUS, TEE_BASE_HEIGHT, 16), options.materials.teeBody);
  base.name = 'baseball_tee_base';
  base.position.y = TEE_BASE_HEIGHT / 2;
  base.castShadow = true;
  base.receiveShadow = true;
  root.add(base);

  const stem = new Mesh(new CylinderGeometry(TEE_STEM_RADIUS, TEE_STEM_RADIUS * 1.3, TEE_STEM_HEIGHT, 12), options.materials.teeBody);
  stem.name = 'baseball_tee_stem';
  stem.position.y = TEE_BASE_HEIGHT + TEE_STEM_HEIGHT / 2;
  stem.castShadow = true;
  root.add(stem);

  const cup = new Mesh(new CylinderGeometry(TEE_CUP_TOP_RADIUS, TEE_CUP_BOTTOM_RADIUS, TEE_CUP_HEIGHT, 12), options.materials.teeBody);
  cup.name = 'baseball_tee_cup';
  cup.position.y = TEE_BASE_HEIGHT + TEE_STEM_HEIGHT + TEE_CUP_HEIGHT / 2;
  cup.castShadow = true;
  root.add(cup);

  // The ball is a group so the white sphere and its red stitch ring fly and
  // spin as one thing.
  const ball = new Group();
  ball.name = 'baseball_tee_ball';
  ball.position.y = BALL_REST_Y;
  root.add(ball);

  const ballMesh = new Mesh(new SphereGeometry(BALL_RADIUS, 16, 16), options.materials.plateWhite);
  ballMesh.name = 'baseball_tee_ball_core';
  ballMesh.castShadow = true;
  ball.add(ballMesh);

  const stitch = new Mesh(new TorusGeometry(BALL_RADIUS, STITCH_TUBE_RADIUS, 8, 24), options.materials.ballStitch);
  stitch.name = 'baseball_tee_ball_stitch';
  stitch.rotation.x = Math.PI / 2 - 0.5;
  stitch.rotation.y = 0.4;
  ball.add(stitch);

  return {
    root,
    ball,
    tapTarget: ballMesh,
  };
}
