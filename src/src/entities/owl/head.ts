import { Group, Mesh, SphereGeometry, TorusGeometry } from 'three';
import { glossyEye, keratin, matteFeather } from './helpers';
import { createBakedEllipsoid, createScaledSphere } from './geometry';
import { COL_BEAK, COL_CROWN, COL_FACE_SHADOW, COL_FACIAL_DISC, COL_HIGHLIGHT, COL_IRIS, COL_PUPIL, HEAD_Y, LEG_HEIGHT } from './palette';
import type { OwlEyeParts } from './types';

/**
 * Builds the owl head - a broad, flat sphere (wider than tall) with a concave
 * facial disc, subtle brow ridges, cheek feather pads, and small ear tufts.
 * The silhouette reads clearly as a real owl head at thumbnail size.
 *
 * @param parent - The parent group to attach the head to.
 * @returns The head mesh.
 */
export function buildHead(parent: Group): Mesh {
  const crownMat = matteFeather('owl_crownMat', COL_CROWN);
  const discMat = matteFeather('owl_discMat', COL_FACIAL_DISC);
  const shadowMat = matteFeather('owl_shadowMat', COL_FACE_SHADOW);

  const head = createScaledSphere('owl_head', 1.4, 1.1, 1.15, 18, crownMat);
  parent.add(head);
  head.position.set(0, HEAD_Y + LEG_HEIGHT, 0.02);

  const disc = createScaledSphere('owl_disc', 1.1, 0.94, 0.2, 16, discMat);
  head.add(disc);
  disc.position.set(0, -0.04, 0.28);

  const rim = new Mesh(new TorusGeometry(0.96 / 2, 0.025 / 2, 16, 32), shadowMat);
  rim.name = 'owl_discRim';
  head.add(rim);
  rim.position.set(0, -0.04, 0.26);

  [-1, 1].forEach((side) => {
    const brow = createScaledSphere(`owl_brow${side > 0 ? 'R' : 'L'}`, 0.3, 0.05, 0.1, 8, crownMat);
    head.add(brow);
    brow.position.set(side * 0.26, 0.3, 0.36);
    brow.rotation.z = -side * 0.04;
  });

  [-1, 1].forEach((side) => {
    const cheek = createScaledSphere(`owl_cheek${side > 0 ? 'R' : 'L'}`, 0.24, 0.2, 0.12, 8, discMat);
    head.add(cheek);
    cheek.position.set(side * 0.36, -0.14, 0.28);
  });

  [-1, 1].forEach((side) => {
    const sideLabel = side > 0 ? 'R' : 'L';
    const baseX = side * 0.38;
    const baseY = 0.42;
    const baseZ = 0.02;
    const tiltZ = -side * 0.35;

    const tuft = createScaledSphere(`owl_earTuft${sideLabel}`, 0.24, 0.42, 0.1, 8, crownMat);
    head.add(tuft);
    tuft.position.set(baseX, baseY, baseZ);
    tuft.rotation.z = tiltZ;

    const mid = createScaledSphere(`owl_earMid${sideLabel}`, 0.16, 0.26, 0.07, 6, crownMat);
    head.add(mid);
    mid.position.set(baseX + side * 0.04, baseY + 0.14, baseZ);
    mid.rotation.z = tiltZ;

    const tip = createScaledSphere(`owl_earTip${sideLabel}`, 0.1, 0.16, 0.04, 6, discMat);
    head.add(tip);
    tip.position.set(baseX + side * 0.06, baseY + 0.28, baseZ);
    tip.rotation.z = tiltZ;
  });

  return head;
}

/**
 * Builds a single realistic owl eye - eyeball globe recessed in a dark socket,
 * amber iris disc, dark pupil, glossy corneal dome, catch-light highlights,
 * and separate upper/lower lids for organic blink animation.
 *
 * All eye parts use geometry scaling instead of mesh scale so nested child
 * positions are not distorted by parent ellipsoid shapes.
 *
 * @param parent - The parent mesh (head) to attach the eye to.
 * @param side - -1 for left eye, +1 for right eye.
 * @returns Object with the eye group mesh and both lid meshes for animation.
 */
export function buildEye(parent: Mesh, side: number): OwlEyeParts {
  const sideLabel = side > 0 ? 'R' : 'L';
  const xOffset = side * 0.28;
  const yOffset = 0.02;

  const shadowMat = matteFeather(`owl_socketMat${sideLabel}`, COL_FACE_SHADOW);
  const crownMat = matteFeather(`owl_lidMat${sideLabel}`, COL_CROWN);
  const scleraMat = glossyEye(`owl_scleraMat${sideLabel}`, COL_HIGHLIGHT);
  const irisMat = glossyEye(`owl_irisMat${sideLabel}`, COL_IRIS);
  const pupilMat = glossyEye(`owl_pupilMat${sideLabel}`, COL_PUPIL);
  const highlightMat = glossyEye(`owl_highlightMat${sideLabel}`, COL_HIGHLIGHT);

  const socket = createBakedEllipsoid(`owl_socket${sideLabel}`, 0.26, 0.25, 0.07, 14, shadowMat);
  parent.add(socket);
  socket.position.set(xOffset, yOffset, 0.44);

  const globe = createBakedEllipsoid(`owl_globe${sideLabel}`, 0.23, 0.23, 0.13, 16, scleraMat);
  socket.add(globe);
  globe.position.z = 0.02;

  const iris = createBakedEllipsoid(`owl_iris${sideLabel}`, 0.18, 0.18, 0.015, 16, irisMat);
  irisMat.polygonOffset = true;
  irisMat.polygonOffsetFactor = -1;
  irisMat.polygonOffsetUnits = -1;
  globe.add(iris);
  iris.position.set(0, 0.04, 0.12);

  const pupil = createBakedEllipsoid(`owl_pupil${sideLabel}`, 0.09, 0.09, 0.01, 14, pupilMat);
  pupilMat.polygonOffset = true;
  pupilMat.polygonOffsetFactor = -2;
  pupilMat.polygonOffsetUnits = -2;
  iris.add(pupil);
  pupil.position.z = 0.015;

  const corneaMat = glossyEye(`owl_corneaMat${sideLabel}`, COL_HIGHLIGHT, 0.08);
  const corneaDome = createBakedEllipsoid(`owl_cornea${sideLabel}`, 0.24, 0.24, 0.02, 14, corneaMat);
  globe.add(corneaDome);
  corneaDome.position.z = 0.11;
  corneaDome.renderOrder = 1;

  const shine = new Mesh(new SphereGeometry(0.035, 8, 8), highlightMat);
  shine.name = `owl_shine${sideLabel}`;
  corneaDome.add(shine);
  shine.position.set(0.05, 0.055, 0.035);

  const shine2 = new Mesh(new SphereGeometry(0.018, 6, 6), highlightMat);
  shine2.name = `owl_shine2${sideLabel}`;
  corneaDome.add(shine2);
  shine2.position.set(-0.03, -0.03, 0.03);

  const upperLid = createScaledSphere(`owl_upperLid${sideLabel}`, 0.56, 0.3, 0.2, 12, crownMat);
  parent.add(upperLid);
  upperLid.position.set(xOffset, yOffset + 0.26, 0.5);
  upperLid.scale.y = 0;

  const lowerLid = createScaledSphere(`owl_lowerLid${sideLabel}`, 0.48, 0.18, 0.16, 10, crownMat);
  parent.add(lowerLid);
  lowerLid.position.set(xOffset, yOffset - 0.22, 0.5);
  lowerLid.scale.y = 0;

  return { eyeGroup: socket, upperLid, lowerLid };
}

/**
 * Builds a visible hooked beak centered between the eyes - upper mandible with
 * a curved hook tip, lower mandible tucked under. Small and gentle, not aggressive.
 *
 * @param parent - The parent mesh (head) to attach the beak to.
 * @returns The upper mandible mesh.
 */
export function buildBeak(parent: Mesh): Mesh {
  const beakMat = keratin('owl_beakMat', COL_BEAK);

  const upper = createScaledSphere('owl_beakUpper', 0.13, 0.1, 0.16, 12, beakMat);
  parent.add(upper);
  upper.position.set(0, -0.18, 0.58);
  upper.rotation.x = 0.4;

  const hook = createScaledSphere('owl_beakHook', 0.06, 0.05, 0.06, 8, beakMat);
  upper.add(hook);
  hook.position.set(0, -0.05, 0.06);

  const lower = createScaledSphere('owl_beakLower', 0.09, 0.04, 0.07, 8, beakMat);
  parent.add(lower);
  lower.position.set(0, -0.24, 0.55);

  return upper;
}
