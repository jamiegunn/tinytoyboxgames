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
import { Mesh, Group, Color, SphereGeometry, ConeGeometry } from 'three';
import { createFeltMaterial, createGlossyPaintMaterial } from '@app/utils/materialFactory';
import { animateRaccoonIdle } from './raccoon-animation';

/** Head sphere radius — must be < hollow OPENING_R (0.145). */
const HEAD_R = 0.09;

function addTorso(raccoon: Group): void {
  const bodyMat = createFeltMaterial('rcBodyMat', new Color(0.45, 0.43, 0.4));
  const torso = new Mesh(new SphereGeometry(0.08, 10, 8), bodyMat);
  torso.scale.set(0.9, 0.75, 1.3);
  torso.position.set(0, -0.01, -0.03);
  raccoon.add(torso);
}

function addHead(raccoon: Group): Mesh {
  const headMat = createFeltMaterial('rcHeadMat', new Color(0.55, 0.53, 0.5));
  const head = new Mesh(new SphereGeometry(HEAD_R, 14, 12), headMat);
  head.name = 'raccoonHead';
  head.scale.set(1.0, 0.92, 0.92);
  head.position.z = -0.04;
  raccoon.add(head);
  return head;
}

function addMaskBand(head: Mesh): void {
  const maskMat = createFeltMaterial('rcMaskMat', new Color(0.04, 0.03, 0.02));
  const maskBand = new Mesh(new SphereGeometry(HEAD_R * 0.55, 10, 6), maskMat);
  maskBand.scale.set(2.2, 0.55, 0.45);
  maskBand.position.set(0, 0.008, HEAD_R * 0.72);
  head.add(maskBand);
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

function addForeheadStripe(head: Mesh): void {
  const stripeMat = createFeltMaterial('rcStripeMat', new Color(0.72, 0.69, 0.64));
  const stripe = new Mesh(new SphereGeometry(0.022, 6, 5), stripeMat);
  stripe.scale.set(0.35, 1.0, 0.3);
  stripe.position.set(0, 0.04, HEAD_R * 0.55);
  head.add(stripe);
}

function addEars(head: Mesh): { left: Mesh; right: Mesh } {
  const earMat = createFeltMaterial('rcEarMat', new Color(0.42, 0.4, 0.37));
  const earInnerMat = createFeltMaterial('rcEarInnerMat', new Color(0.65, 0.58, 0.52));
  const ears: Mesh[] = [];
  [-1, 1].forEach((side) => {
    const ear = new Mesh(new ConeGeometry(0.024, 0.042, 8), earMat);
    ear.position.set(side * 0.05, HEAD_R * 0.78, -0.01);
    ear.rotation.z = side * 0.2;
    head.add(ear);

    const inner = new Mesh(new ConeGeometry(0.014, 0.026, 6), earInnerMat);
    inner.position.set(0, 0.003, 0.005);
    ear.add(inner);
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
  addForeheadStripe(head);
  const ears = addEars(head);
  addPaws(raccoon);
  return animateRaccoonIdle(head, ears);
}
