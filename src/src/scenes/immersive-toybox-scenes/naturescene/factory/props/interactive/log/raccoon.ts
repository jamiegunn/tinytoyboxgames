/**
 * Builds a raccoon peeking out of the hollow log opening.
 *
 * Added to ROOT (not body) so we work in simple world-relative
 * coordinates instead of fighting the body's rotation.z = PI/2.
 *
 * The hollow opening is at root-local ≈ (0.91, 0, -0.28).
 * rotation.y = PI/2 + 0.3 aligns raccoon local +Z with the
 * hollow's outward normal (matching body.rotation.y = 0.3).
 *
 * Design notes — to be recognisable at the game's viewing distance
 * the raccoon relies on CONTRAST, not detail:
 *   • Light-grey head fur ≠ dark log bark → stands out.
 *   • A single wide DARK mask-band across the face → signature look.
 *   • Bright-white eyes inside the mask → pop.
 *   • Cream muzzle below the mask → cute snout.
 */
import { Mesh, Group, Color, SphereGeometry } from 'three';
import { createFeltMaterial, createGlossyPaintMaterial } from '@app/utils/materialFactory';
import { animateRaccoonIdle } from './raccoon-animation';

/** Head sphere radius — must be < hollow OPENING_R (0.145). */
const HEAD_R = 0.09;

function addTorso(raccoon: Group): void {
  const bodyMat = createFeltMaterial('rcBodyMat', new Color(0.48, 0.43, 0.37));
  const torso = new Mesh(new SphereGeometry(0.08, 10, 8), bodyMat);
  torso.scale.set(0.9, 0.75, 1.3);
  torso.position.set(0, -0.01, -0.03);
  raccoon.add(torso);
}

function addHead(raccoon: Group): Mesh {
  const headMat = createFeltMaterial('rcHeadMat', new Color(0.6, 0.56, 0.5));
  const head = new Mesh(new SphereGeometry(HEAD_R, 14, 12), headMat);
  head.name = 'raccoonHead';
  head.scale.set(1.0, 0.94, 0.94);
  head.position.z = -0.04;
  raccoon.add(head);
  return head;
}

/**
 * The signature bandit mask: a dark patch around EACH eye joined by a thin
 * bridge over the nose (a domino mask), instead of one wide horizontal band —
 * this is what makes it read as a raccoon and not a panda. White eyebrow tufts
 * above the mask give the classic raccoon brow.
 *
 * @param head - The raccoon head mesh.
 */
function addMaskBand(head: Mesh): void {
  const maskMat = createFeltMaterial('rcMaskMat', new Color(0.07, 0.06, 0.05));
  [-1, 1].forEach((side) => {
    const patch = new Mesh(new SphereGeometry(HEAD_R * 0.42, 8, 6), maskMat);
    patch.scale.set(1.05, 0.95, 0.55);
    patch.position.set(side * 0.034, 0.012, HEAD_R * 0.78);
    head.add(patch);
  });
  const bridge = new Mesh(new SphereGeometry(HEAD_R * 0.3, 8, 6), maskMat);
  bridge.scale.set(1.3, 0.42, 0.5);
  bridge.position.set(0, 0.004, HEAD_R * 0.86);
  head.add(bridge);

  // White eyebrow tufts just above the mask.
  const browMat = createFeltMaterial('rcBrowMat', new Color(0.95, 0.93, 0.88));
  [-1, 1].forEach((side) => {
    const brow = new Mesh(new SphereGeometry(HEAD_R * 0.22, 6, 5), browMat);
    brow.scale.set(1.2, 0.5, 0.5);
    brow.position.set(side * 0.032, 0.04, HEAD_R * 0.72);
    head.add(brow);
  });
}

function addEyes(head: Mesh): void {
  const eyeWMat = createGlossyPaintMaterial('rcEyeWMat', new Color(0.95, 0.93, 0.88));
  [-1, 1].forEach((side) => {
    const eye = new Mesh(new SphereGeometry(0.016, 8, 6), eyeWMat);
    eye.position.set(side * 0.034, 0.012, HEAD_R * 0.8);
    head.add(eye);

    const pupilMat = createGlossyPaintMaterial(`rcPupil_${side}`, new Color(0.02, 0.01, 0.01));
    const pupil = new Mesh(new SphereGeometry(0.009, 6, 5), pupilMat);
    pupil.position.z = 0.01;
    eye.add(pupil);

    const shineMat = createGlossyPaintMaterial(`rcShine_${side}`, new Color(1, 1, 1));
    const shine = new Mesh(new SphereGeometry(0.004, 4, 3), shineMat);
    shine.position.set(0.003, 0.003, 0.006);
    pupil.add(shine);
  });
}

function addMuzzle(head: Mesh): void {
  const muzzleMat = createFeltMaterial('rcMuzzleMat', new Color(0.88, 0.84, 0.76));
  const muzzle = new Mesh(new SphereGeometry(0.042, 10, 8), muzzleMat);
  muzzle.scale.set(1.0, 0.6, 0.8);
  muzzle.position.set(0, -0.022, HEAD_R * 0.72);
  head.add(muzzle);

  const noseMat = createGlossyPaintMaterial('rcNoseMat', new Color(0.08, 0.06, 0.06));
  const nose = new Mesh(new SphereGeometry(0.014, 8, 6), noseMat);
  nose.position.set(0, 0.012, 0.03);
  muzzle.add(nose);
}

function addEars(head: Mesh): { left: Mesh; right: Mesh } {
  const earMat = createFeltMaterial('rcEarMat', new Color(0.44, 0.4, 0.35));
  const earInnerMat = createFeltMaterial('rcEarInnerMat', new Color(0.7, 0.6, 0.54));
  const tipMat = createFeltMaterial('rcEarTipMat', new Color(0.12, 0.1, 0.09));
  const ears: Mesh[] = [];
  [-1, 1].forEach((side) => {
    // Rounded raccoon ear (a squashed sphere), not a tall cone.
    const ear = new Mesh(new SphereGeometry(0.028, 8, 7), earMat);
    ear.scale.set(0.85, 1.0, 0.45);
    ear.position.set(side * 0.052, HEAD_R * 0.82, -0.005);
    ear.rotation.z = side * 0.12;
    head.add(ear);

    const inner = new Mesh(new SphereGeometry(0.016, 7, 6), earInnerMat);
    inner.scale.set(0.8, 1.0, 0.5);
    inner.position.set(0, -0.002, 0.007);
    ear.add(inner);

    // Dark ear tip — a raccoon cue.
    const tip = new Mesh(new SphereGeometry(0.012, 6, 5), tipMat);
    tip.scale.set(1.0, 0.7, 0.5);
    tip.position.set(0, 0.02, 0.002);
    ear.add(tip);
    ears.push(ear);
  });
  return { left: ears[0], right: ears[1] };
}

function addPaws(raccoon: Group): void {
  const pawMat = createFeltMaterial('rcPawMat', new Color(0.1, 0.08, 0.07));
  [-1, 1].forEach((side) => {
    const paw = new Mesh(new SphereGeometry(0.024, 8, 6), pawMat);
    paw.position.set(side * 0.055, -0.05, 0.1);
    paw.scale.set(1.0, 0.4, 1.3);
    raccoon.add(paw);

    for (let f = 0; f < 4; f++) {
      const toe = new Mesh(new SphereGeometry(0.005, 4, 3), pawMat);
      toe.position.set((f - 1.5) * 0.007, 0, 0.016);
      paw.add(toe);
    }
  });
}

/**
 * Creates the raccoon group and attaches it to the log root.
 *
 * @param root - The log root group.
 * @returns A cleanup function that kills all raccoon idle animations.
 */
export function addRaccoon(root: Group): () => void {
  const raccoon = new Group();
  raccoon.name = 'raccoon';
  raccoon.position.set(1.01, 0.02, -0.31);
  raccoon.rotation.y = Math.PI / 2 + 0.3;
  root.add(raccoon);

  addTorso(raccoon);
  const head = addHead(raccoon);
  addMaskBand(head);
  addEyes(head);
  addMuzzle(head);
  const ears = addEars(head);
  addPaws(raccoon);
  return animateRaccoonIdle(head, ears);
}
