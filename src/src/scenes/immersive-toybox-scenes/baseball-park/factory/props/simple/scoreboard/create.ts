/**
 * Builds the outfield scoreboard: a navy face on wooden posts, three coloured
 * tokens where a real board would put numbers, and a little roof.
 *
 * The board faces local -Z (the camera once staged).
 */

import { BoxGeometry, CylinderGeometry, Group, Mesh, SphereGeometry, type Scene } from 'three';
import { createEntityRoot, type EntityPlacement } from '../../../../types';
import type { ImmersiveSceneMaterials } from '../../../../materials';
import {
  BOARD_CENTER_Y,
  BOARD_HEIGHT,
  BOARD_THICKNESS,
  BOARD_WIDTH,
  FACE_HEIGHT,
  FACE_THICKNESS,
  FACE_WIDTH,
  POST_HEIGHT,
  POST_RADIUS,
  POST_SPACING,
  ROOF_DEPTH,
  ROOF_HEIGHT,
  ROOF_WIDTH,
  TOKEN_RADIUS,
  TOKEN_SPACING,
} from './constants';

/** Shared dependencies required to build the scoreboard. */
export interface ScoreboardBuildOptions {
  materials: Pick<ImmersiveSceneMaterials, 'bleacherWood' | 'scoreboardFace' | 'seatRed' | 'seatBlue' | 'pennantYellow'>;
}

/**
 * Creates the scoreboard at its staged placement.
 *
 * @param scene - Scene that should receive the created prop.
 * @param placement - World placement authored in `staging/scoreboard.ts`.
 * @param options - Shared materials used by the prop.
 * @returns The root group for the created scoreboard.
 */
export function createScoreboard(scene: Scene, placement: EntityPlacement, options: ScoreboardBuildOptions): Group {
  const root = createEntityRoot('baseball_scoreboard', placement, scene);

  [-POST_SPACING / 2, POST_SPACING / 2].forEach((x, index) => {
    const post = new Mesh(new CylinderGeometry(POST_RADIUS, POST_RADIUS, POST_HEIGHT, 10), options.materials.bleacherWood);
    post.name = `baseball_scoreboard_post_${index}`;
    post.position.set(x, POST_HEIGHT / 2, 0);
    post.castShadow = true;
    root.add(post);
  });

  const board = new Mesh(new BoxGeometry(BOARD_WIDTH, BOARD_HEIGHT, BOARD_THICKNESS), options.materials.bleacherWood);
  board.name = 'baseball_scoreboard_board';
  board.position.y = BOARD_CENTER_Y;
  board.castShadow = true;
  board.receiveShadow = true;
  root.add(board);

  const face = new Mesh(new BoxGeometry(FACE_WIDTH, FACE_HEIGHT, FACE_THICKNESS), options.materials.scoreboardFace);
  face.name = 'baseball_scoreboard_face';
  face.position.set(0, BOARD_CENTER_Y, -(BOARD_THICKNESS / 2 + FACE_THICKNESS / 2));
  root.add(face);

  const tokenMaterials = [options.materials.seatRed, options.materials.pennantYellow, options.materials.seatBlue];
  tokenMaterials.forEach((material, index) => {
    const token = new Mesh(new SphereGeometry(TOKEN_RADIUS, 14, 14), material);
    token.name = `baseball_scoreboard_token_${index}`;
    token.position.set((index - 1) * TOKEN_SPACING, BOARD_CENTER_Y, -(BOARD_THICKNESS / 2 + FACE_THICKNESS + TOKEN_RADIUS * 0.4));
    token.castShadow = true;
    root.add(token);
  });

  const roof = new Mesh(new BoxGeometry(ROOF_WIDTH, ROOF_HEIGHT, ROOF_DEPTH), options.materials.bleacherWood);
  roof.name = 'baseball_scoreboard_roof';
  roof.position.set(0, BOARD_CENTER_Y + BOARD_HEIGHT / 2 + ROOF_HEIGHT / 2, -0.05);
  roof.castShadow = true;
  root.add(roof);

  return root;
}
