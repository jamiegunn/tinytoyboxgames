/**
 * Scene-shared material palette for Baseball Park.
 *
 * This file exists so the scene has one obvious place to define reusable
 * materials. That matters because the template wants future scenes to answer
 * material ownership the same way every time:
 *
 * 1. scene-shared materials live here
 * 2. feature-local cached materials live beside the feature that owns them
 * 3. per-instance materials are used only when mutation isolation is required
 *
 * The palette is a toy ballpark on a sunny day: green felt outfield walls,
 * warm dirt, glossy white plates and balls, and primary-coloured seats and
 * flags. `plateWhite` is deliberately one material for bases, home plate, the
 * pitcher's rubber and the balls — in a toybox they are all the same painted
 * wood.
 */

import type { Material } from 'three';
import { Color } from 'three';
import { createFeltMaterial, createGlossyPaintMaterial, createPlasticMaterial, createWoodMaterial } from '@app/utils/materialFactory';

/** Scene-local collection of shared materials injected through `ComposeContext`. */
export interface ImmersiveSceneMaterials {
  skyBackdrop: Material;
  shellWall: Material;
  shellTrim: Material;
  infieldDirt: Material;
  moundClay: Material;
  plateWhite: Material;
  ballStitch: Material;
  teeBody: Material;
  bleacherWood: Material;
  seatRed: Material;
  seatBlue: Material;
  pennantYellow: Material;
  scoreboardFace: Material;
}

const MATERIAL_PREFIX = 'baseball-park';

const PALETTE = {
  skyBackdrop: new Color(0.5, 0.72, 0.9),
  shellWall: new Color(0.24, 0.42, 0.26),
  shellTrim: new Color(0.5, 0.32, 0.18),
  infieldDirt: new Color(0.68, 0.5, 0.3),
  moundClay: new Color(0.6, 0.42, 0.24),
  plateWhite: new Color(0.94, 0.93, 0.88),
  ballStitch: new Color(0.82, 0.24, 0.2),
  teeBody: new Color(0.2, 0.28, 0.42),
  bleacherWood: new Color(0.62, 0.44, 0.26),
  seatRed: new Color(0.85, 0.38, 0.3),
  seatBlue: new Color(0.34, 0.52, 0.78),
  pennantYellow: new Color(0.95, 0.8, 0.3),
  scoreboardFace: new Color(0.16, 0.26, 0.38),
} as const;

/**
 * Creates the reusable material palette for the Baseball Park.
 *
 * Materials are created eagerly here so props receive them through
 * `ComposeContext` instead of allocating their own identical copies.
 *
 * @returns The scene-shared material collection for this immersive scene.
 */
export function createImmersiveSceneMaterials(): ImmersiveSceneMaterials {
  return {
    skyBackdrop: createPlasticMaterial(`${MATERIAL_PREFIX}_sky_backdrop_mat`, PALETTE.skyBackdrop),
    shellWall: createFeltMaterial(`${MATERIAL_PREFIX}_shell_wall_mat`, PALETTE.shellWall),
    shellTrim: createWoodMaterial(`${MATERIAL_PREFIX}_shell_trim_mat`, PALETTE.shellTrim),
    infieldDirt: createFeltMaterial(`${MATERIAL_PREFIX}_infield_dirt_mat`, PALETTE.infieldDirt),
    moundClay: createFeltMaterial(`${MATERIAL_PREFIX}_mound_clay_mat`, PALETTE.moundClay),
    plateWhite: createGlossyPaintMaterial(`${MATERIAL_PREFIX}_plate_white_mat`, PALETTE.plateWhite),
    ballStitch: createGlossyPaintMaterial(`${MATERIAL_PREFIX}_ball_stitch_mat`, PALETTE.ballStitch),
    teeBody: createPlasticMaterial(`${MATERIAL_PREFIX}_tee_body_mat`, PALETTE.teeBody),
    bleacherWood: createWoodMaterial(`${MATERIAL_PREFIX}_bleacher_wood_mat`, PALETTE.bleacherWood),
    seatRed: createPlasticMaterial(`${MATERIAL_PREFIX}_seat_red_mat`, PALETTE.seatRed),
    seatBlue: createPlasticMaterial(`${MATERIAL_PREFIX}_seat_blue_mat`, PALETTE.seatBlue),
    pennantYellow: createGlossyPaintMaterial(`${MATERIAL_PREFIX}_pennant_yellow_mat`, PALETTE.pennantYellow),
    scoreboardFace: createPlasticMaterial(`${MATERIAL_PREFIX}_scoreboard_face_mat`, PALETTE.scoreboardFace),
  };
}
