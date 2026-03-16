/**
 * Builds a cute, chunky toy parrot.
 *
 * Big round head, round body, stubby hooked beak, big cartoon eyes, colourful
 * wings and long flowing tail feathers. Designed to read well at a distance.
 */

import { Color, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, type Scene } from 'three';
import { createEntityRoot, type EntityPlacement } from '../../../../types';
import {
  BEAK_LOWER_LENGTH,
  BEAK_LOWER_RADIUS,
  BEAK_UPPER_LENGTH,
  BEAK_UPPER_RADIUS,
  BODY_HEIGHT,
  BODY_WIDTH,
  EYE_RADIUS,
  FOOT_HEIGHT,
  HEAD_RADIUS,
  PUPIL_RADIUS,
  TAIL_LENGTH,
  TAIL_WIDTH,
  TOE_LENGTH,
  TOE_RADIUS,
  WING_LENGTH,
  WING_WIDTH,
} from './constants';

// Per-instance materials — unique parrot colours.
const mat = (c: Color) => new MeshStandardMaterial({ color: c, metalness: 0, roughness: 0.45 });

const bodyGreen = mat(new Color(0.18, 0.72, 0.22));
const headGreen = mat(new Color(0.22, 0.78, 0.28));
const breastYellow = mat(new Color(0.95, 0.85, 0.25));
const beakOrange = mat(new Color(0.95, 0.6, 0.1));
const beakBlack = mat(new Color(0.15, 0.12, 0.1));
const eyeWhite = mat(new Color(0.97, 0.97, 0.97));
const pupilBlack = mat(new Color(0.05, 0.05, 0.05));
const wingBlue = mat(new Color(0.15, 0.4, 0.92));
const wingTipYellow = mat(new Color(0.95, 0.82, 0.15));
const tailRed = mat(new Color(0.88, 0.18, 0.12));
const tailBlue = mat(new Color(0.2, 0.35, 0.9));
const tailYellow = mat(new Color(0.95, 0.8, 0.12));
const tailGreen = mat(new Color(0.12, 0.6, 0.18));
const footGrey = mat(new Color(0.45, 0.42, 0.4));

/**
 * Creates one parrot instance.
 *
 * @param scene - Scene that should receive the parrot.
 * @param placement - World placement from staging.
 * @returns The root group for the parrot.
 */
export function createParrot(scene: Scene, placement: EntityPlacement): Group {
  const root = createEntityRoot('parrot_prop', placement, scene);

  const baseY = FOOT_HEIGHT;

  // ── Body — round egg shape ──────────────────────────────────────────────
  const body = new Mesh(new SphereGeometry(BODY_WIDTH, 14, 10), bodyGreen);
  body.name = 'parrot_body';
  body.scale.set(1, BODY_HEIGHT / BODY_WIDTH, 0.9);
  body.position.y = baseY + BODY_HEIGHT;
  body.castShadow = true;
  root.add(body);

  // Lighter breast/belly (front-facing half-sphere overlay)
  const breast = new Mesh(new SphereGeometry(BODY_WIDTH * 0.85, 10, 8, 0, Math.PI), breastYellow);
  breast.name = 'parrot_breast';
  breast.scale.set(0.9, (BODY_HEIGHT / BODY_WIDTH) * 0.7, 0.5);
  breast.position.set(0, baseY + BODY_HEIGHT * 0.9, BODY_WIDTH * 0.3);
  breast.castShadow = true;
  root.add(breast);

  // ── Head — big and round ────────────────────────────────────────────────
  const head = new Mesh(new SphereGeometry(HEAD_RADIUS, 12, 10), headGreen);
  head.name = 'parrot_head';
  head.position.y = baseY + BODY_HEIGHT * 2 + HEAD_RADIUS * 0.55;
  head.castShadow = true;
  root.add(head);

  // ── Beak — hooked parrot beak (upper + lower) ──────────────────────────
  // Upper beak — curves downward
  const upperBeak = new Mesh(new CylinderGeometry(BEAK_UPPER_RADIUS * 0.2, BEAK_UPPER_RADIUS, BEAK_UPPER_LENGTH, 8), beakOrange);
  upperBeak.name = 'parrot_upper_beak';
  upperBeak.position.set(0, baseY + BODY_HEIGHT * 2 + HEAD_RADIUS * 0.3, HEAD_RADIUS * 0.85);
  upperBeak.rotation.x = Math.PI * 0.55;
  upperBeak.castShadow = true;
  root.add(upperBeak);

  // Lower beak — smaller, underneath
  const lowerBeak = new Mesh(new CylinderGeometry(BEAK_LOWER_RADIUS * 0.4, BEAK_LOWER_RADIUS, BEAK_LOWER_LENGTH, 6), beakBlack);
  lowerBeak.name = 'parrot_lower_beak';
  lowerBeak.position.set(0, baseY + BODY_HEIGHT * 2 + HEAD_RADIUS * 0.12, HEAD_RADIUS * 0.82);
  lowerBeak.rotation.x = Math.PI * 0.45;
  root.add(lowerBeak);

  // ── Eyes — big white circles with shiny pupils ─────────────────────────
  [-1, 1].forEach((side, i) => {
    const eye = new Mesh(new SphereGeometry(EYE_RADIUS, 10, 8), eyeWhite);
    eye.name = `parrot_eye_${i}`;
    eye.position.set(side * HEAD_RADIUS * 0.7, baseY + BODY_HEIGHT * 2 + HEAD_RADIUS * 0.5, HEAD_RADIUS * 0.5);
    root.add(eye);

    const pupil = new Mesh(new SphereGeometry(PUPIL_RADIUS, 8, 6), pupilBlack);
    pupil.name = `parrot_pupil_${i}`;
    pupil.position.set(side * HEAD_RADIUS * 0.78, baseY + BODY_HEIGHT * 2 + HEAD_RADIUS * 0.5, HEAD_RADIUS * 0.68);
    root.add(pupil);
  });

  // ── Wings — layered feather shapes tucked at the sides ─────────────────
  [-1, 1].forEach((side, i) => {
    // Main wing (blue)
    const wing = new Mesh(new SphereGeometry(WING_LENGTH / 2, 8, 6), wingBlue);
    wing.name = `parrot_wing_${i}`;
    wing.scale.set(WING_WIDTH / (WING_LENGTH / 2), 1, 0.5);
    wing.position.set(side * BODY_WIDTH * 0.95, baseY + BODY_HEIGHT * 0.95, -BODY_WIDTH * 0.15);
    wing.rotation.z = side * -0.15;
    wing.castShadow = true;
    root.add(wing);

    // Wing tip (yellow accent)
    const tip = new Mesh(new SphereGeometry(WING_LENGTH * 0.3, 6, 5), wingTipYellow);
    tip.name = `parrot_wing_tip_${i}`;
    tip.scale.set(WING_WIDTH / (WING_LENGTH * 0.3), 0.8, 0.4);
    tip.position.set(side * BODY_WIDTH * 1.05, baseY + BODY_HEIGHT * 0.55, -BODY_WIDTH * 0.2);
    tip.rotation.z = side * -0.2;
    root.add(tip);
  });

  // ── Tail — long flowing feathers angling down behind ───────────────────
  const tailMats = [tailRed, tailBlue, tailGreen, tailYellow, tailRed];
  const tailCount = tailMats.length;
  tailMats.forEach((tailMat, i) => {
    const spread = (i - (tailCount - 1) / 2) * TAIL_WIDTH * 2.2;
    const length = TAIL_LENGTH + (tailCount - 1 - Math.abs(i - (tailCount - 1) / 2)) * 0.04;
    const feather = new Mesh(new CylinderGeometry(TAIL_WIDTH * 0.4, TAIL_WIDTH, length, 6), tailMat);
    feather.name = `parrot_tail_${i}`;
    feather.position.set(spread, baseY + BODY_HEIGHT * 0.4, -BODY_WIDTH * 0.8 - length * 0.25);
    feather.rotation.x = Math.PI * -0.4;
    feather.castShadow = true;
    root.add(feather);
  });

  // ── Feet — two clawed feet gripping the perch ──────────────────────────
  [-1, 1].forEach((side, i) => {
    const footGroup = new Group();
    footGroup.name = `parrot_foot_group_${i}`;
    footGroup.position.set(side * BODY_WIDTH * 0.45, 0, 0);
    root.add(footGroup);

    // Leg stub
    const leg = new Mesh(new CylinderGeometry(TOE_RADIUS * 1.2, TOE_RADIUS * 1.2, FOOT_HEIGHT, 6), footGrey);
    leg.name = `parrot_leg_${i}`;
    leg.position.y = FOOT_HEIGHT / 2;
    footGroup.add(leg);

    // Three forward toes
    for (let t = 0; t < 3; t++) {
      const angle = (t - 1) * 0.4;
      const toe = new Mesh(new CylinderGeometry(TOE_RADIUS * 0.6, TOE_RADIUS, TOE_LENGTH, 4), footGrey);
      toe.name = `parrot_toe_${i}_${t}`;
      toe.position.set(Math.sin(angle) * TOE_LENGTH * 0.3, TOE_RADIUS, Math.cos(angle) * TOE_LENGTH * 0.4 + TOE_LENGTH * 0.3);
      toe.rotation.x = Math.PI * 0.4;
      footGroup.add(toe);
    }

    // One back toe
    const backToe = new Mesh(new CylinderGeometry(TOE_RADIUS * 0.6, TOE_RADIUS, TOE_LENGTH * 0.8, 4), footGrey);
    backToe.name = `parrot_back_toe_${i}`;
    backToe.position.set(0, TOE_RADIUS, -TOE_LENGTH * 0.3);
    backToe.rotation.x = Math.PI * -0.4;
    footGroup.add(backToe);
  });

  return root;
}
