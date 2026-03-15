import { CylinderGeometry, Group, Mesh, SphereGeometry } from 'three';
import { matteFeather, keratin } from './helpers';
import { createScaledSphere } from './geometry';
import { COL_CHEST_BUFF, COL_CROWN, COL_TAIL_DARK, COL_TALON, COL_WING_DARK, COL_WING_TAWNY, LEG_HEIGHT, WING_REST_ANGLE } from './palette';

/**
 * Builds the owl torso - broad chest, compact abdomen, shoulder masses, subtle
 * back slope. The silhouette tapers downward and does not read as an egg
 * or stacked spheres.
 *
 * @param parent - The parent group to attach the body to.
 * @returns The core torso mesh (used as the tappable pick target).
 */
export function buildBody(parent: Group): Mesh {
  const bodyMat = matteFeather('owl_bodyMat', COL_CROWN);
  const chestMat = matteFeather('owl_chestMat', COL_CHEST_BUFF);

  const neck = new Mesh(new CylinderGeometry(0.52 / 2, 0.68 / 2, 0.22, 14), bodyMat);
  neck.name = 'owl_neck';
  parent.add(neck);
  neck.position.set(0, 1.08 + LEG_HEIGHT, 0.02);

  const torso = createScaledSphere('owl_torso', 1.1, 1.2, 0.95, 18, bodyMat);
  parent.add(torso);
  torso.position.set(0, 0.58 + LEG_HEIGHT, 0);

  const chest = createScaledSphere('owl_chest', 0.82, 0.95, 0.36, 16, chestMat);
  parent.add(chest);
  chest.position.set(0, 0.52 + LEG_HEIGHT, 0.32);

  [-1, 1].forEach((side) => {
    const shoulder = createScaledSphere(`owl_shoulder${side > 0 ? 'R' : 'L'}`, 0.32, 0.44, 0.42, 10, bodyMat);
    parent.add(shoulder);
    shoulder.position.set(side * 0.4, 0.92 + LEG_HEIGHT, -0.08);
  });

  const back = createScaledSphere('owl_back', 0.66, 0.4, 0.3, 10, bodyMat);
  parent.add(back);
  back.position.set(0, 0.88 + LEG_HEIGHT, -0.36);

  const abdomen = createScaledSphere('owl_abdomen', 0.62, 0.38, 0.55, 10, chestMat);
  parent.add(abdomen);
  abdomen.position.set(0, 0.18 + LEG_HEIGHT, 0.02);

  const streakMat = matteFeather('owl_streakMat', COL_WING_TAWNY);
  for (let row = 0; row < 5; row += 1) {
    const rowY = 0.82 + LEG_HEIGHT - row * 0.14;
    const rowWidth = 0.3 + row * 0.04;
    const count = 3 + row;

    for (let column = 0; column < count; column += 1) {
      const xPosition = (column - (count - 1) / 2) * (rowWidth / count);
      const streak = createScaledSphere(`owl_streak_${row}_${column}`, 0.06, 0.04, 0.02, 4, streakMat);
      parent.add(streak);
      streak.position.set(xPosition, rowY, 0.46 - row * 0.02);
    }
  }

  return torso;
}

/**
 * Builds a folded wing - covert layer over secondaries, individual primary
 * feather shapes tapering past the tail. Attached high at the shoulder and
 * hugging the body.
 *
 * @param parent - The parent group to attach the wing to.
 * @param side - -1 for left wing, +1 for right wing.
 * @returns The wing anchor group for animation.
 */
export function buildWing(parent: Group, side: number): Group {
  const sideLabel = side > 0 ? 'R' : 'L';
  const covertMat = matteFeather(`owl_covertMat${sideLabel}`, COL_WING_TAWNY);
  const primaryMat = matteFeather(`owl_primaryMat${sideLabel}`, COL_WING_DARK);

  const anchor = new Group();
  anchor.name = `owl_wingAnchor${sideLabel}`;
  parent.add(anchor);
  anchor.position.set(side * 0.5, 0.88 + LEG_HEIGHT, -0.08);
  anchor.rotation.z = side * WING_REST_ANGLE;

  const covert = createScaledSphere(`owl_covert${sideLabel}`, 0.28, 0.6, 0.5, 12, covertMat);
  anchor.add(covert);
  covert.position.set(side * 0.06, -0.02, 0.04);

  for (let row = 0; row < 5; row += 1) {
    const scallop = createScaledSphere(`owl_scallop${sideLabel}_${row}`, 0.24, 0.06, 0.44, 8, row % 2 === 0 ? primaryMat : covertMat);
    anchor.add(scallop);
    scallop.position.set(side * 0.07, 0.16 - row * 0.12, 0.06);
  }

  const secondary = createScaledSphere(`owl_secondary${sideLabel}`, 0.2, 0.76, 0.44, 12, primaryMat);
  anchor.add(secondary);
  secondary.position.set(side * 0.08, -0.18, -0.02);

  for (let featherIndex = 0; featherIndex < 5; featherIndex += 1) {
    const feather = createScaledSphere(`owl_secFeather${sideLabel}_${featherIndex}`, 0.08, 0.14, 0.03, 6, featherIndex % 2 === 0 ? primaryMat : covertMat);
    anchor.add(feather);
    feather.position.set(side * (0.1 + featherIndex * 0.008), -0.06 - featherIndex * 0.12, -0.06);
  }

  for (let primaryIndex = 0; primaryIndex < 6; primaryIndex += 1) {
    const length = 0.48 + primaryIndex * 0.06;
    const width = 0.065 - primaryIndex * 0.004;
    const primary = createScaledSphere(`owl_primary${sideLabel}_${primaryIndex}`, width, length, 0.03, 6, primaryMat);
    anchor.add(primary);
    primary.position.set(side * (0.08 + primaryIndex * 0.018), -0.4 - primaryIndex * 0.05, -0.1 - primaryIndex * 0.025);
    primary.rotation.z = side * primaryIndex * 0.03;
  }

  return anchor;
}

/**
 * Builds a short tail fan - 5 feathers in a compact wedge tucked behind the body.
 *
 * @param parent - The parent group to attach the tail to.
 * @returns The tail anchor group.
 */
export function buildTail(parent: Group): Group {
  const tailMat = matteFeather('owl_tailMat', COL_TAIL_DARK);

  const anchor = new Group();
  anchor.name = 'owl_tailAnchor';
  parent.add(anchor);
  anchor.position.set(0, 0.26 + LEG_HEIGHT, -0.44);
  anchor.rotation.x = 0.22;

  for (let featherIndex = -2; featherIndex <= 2; featherIndex += 1) {
    const length = 0.3 - Math.abs(featherIndex) * 0.03;
    const featherMesh = createScaledSphere(`owl_tailFeather${featherIndex}`, 0.06, length, 0.025, 6, tailMat);
    anchor.add(featherMesh);
    featherMesh.position.set(featherIndex * 0.04, -length * 0.35, 0);
    featherMesh.rotation.z = featherIndex * 0.05;
  }

  return anchor;
}

/**
 * Builds a bird leg - thin feathered shank, ankle joint, three forward toes
 * with softened talons, and one rear toe.
 *
 * @param parent - The parent group to attach the leg to.
 * @param side - -1 for left leg, +1 for right leg.
 * @returns The leg anchor group.
 */
export function buildLeg(parent: Group, side: number): Group {
  const sideLabel = side > 0 ? 'R' : 'L';
  const shankMat = matteFeather(`owl_shankMat${sideLabel}`, COL_CROWN);
  const talonMat = keratin(`owl_talonMat${sideLabel}`, COL_TALON);

  const anchor = new Group();
  anchor.name = `owl_legAnchor${sideLabel}`;
  parent.add(anchor);
  anchor.position.set(side * 0.16, 0.18, 0.06);

  const shank = new Mesh(new CylinderGeometry(0.14 / 2, 0.06 / 2, 0.26, 10), shankMat);
  shank.name = `owl_shank${sideLabel}`;
  anchor.add(shank);
  shank.position.set(0, -0.1, 0);

  const ankle = new Mesh(new SphereGeometry(0.07 / 2, 8, 8), talonMat);
  ankle.name = `owl_ankle${sideLabel}`;
  anchor.add(ankle);
  ankle.position.set(0, -0.22, 0);

  const foot = new Group();
  foot.name = `owl_foot${sideLabel}`;
  anchor.add(foot);
  foot.position.set(0, -0.24, 0.02);

  for (let toeIndex = -1; toeIndex <= 1; toeIndex += 1) {
    const toe = new Mesh(new CylinderGeometry(0.035 / 2, 0.042 / 2, 0.18, 8), talonMat);
    toe.name = `owl_toe${sideLabel}_${toeIndex}`;
    foot.add(toe);
    toe.position.set(toeIndex * 0.055, 0, 0.06);
    toe.rotation.x = -Math.PI / 2.5;
    toe.rotation.y = toeIndex * 0.45;

    const claw = new Mesh(new CylinderGeometry(0.014 / 2, 0.026 / 2, 0.05, 6), talonMat);
    claw.name = `owl_claw${sideLabel}_${toeIndex}`;
    toe.add(claw);
    claw.position.set(0, -0.1, 0.01);
    claw.rotation.x = 0.5;
  }

  const rear = new Mesh(new CylinderGeometry(0.028 / 2, 0.036 / 2, 0.12, 6), talonMat);
  rear.name = `owl_rearToe${sideLabel}`;
  foot.add(rear);
  rear.position.set(0, 0, -0.04);
  rear.rotation.x = Math.PI / 3;

  return anchor;
}
