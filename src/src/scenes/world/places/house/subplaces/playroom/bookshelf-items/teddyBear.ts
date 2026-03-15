import { CircleGeometry, Color, CylinderGeometry, Group, Mesh, SphereGeometry, type DirectionalLight, type Scene } from 'three';
import { createFeltMaterial, createGlossyPaintMaterial, createPlasticMaterial } from '@app/utils/materialFactory';
import { BOOKSHELF_CENTER_X, BOOKSHELF_Z } from '../layout';

/**
 * Creates a classic teddy bear sitting on top of the bookshelf.
 * Twice the original size with proper proportions.
 * @param scene - The Three.js scene to add the teddy bear to
 * @param _keyLight - The directional light (unused)
 */
export function createTeddyBear(scene: Scene, _keyLight: DirectionalLight): void {
  const brownMat = createFeltMaterial('hub_teddyBrownMat', new Color(0.6, 0.42, 0.25));
  const lightMat = createFeltMaterial('hub_teddyLightMat', new Color(0.82, 0.68, 0.48));
  const eyeMat = createGlossyPaintMaterial('hub_teddyEyeMat', new Color(0.06, 0.05, 0.04));
  const noseMat = createGlossyPaintMaterial('hub_teddyNoseMat', new Color(0.12, 0.08, 0.06));
  const mouthMat = createFeltMaterial('hub_teddyMouthMat', new Color(0.35, 0.22, 0.12));
  const padMat = createFeltMaterial('hub_teddyPadMat', new Color(0.78, 0.62, 0.42));
  const highlightMat = createPlasticMaterial('hub_teddyHighlightMat', new Color(0.95, 0.95, 0.95));

  const root = new Group();
  root.name = 'teddy_root';
  root.position.set(BOOKSHELF_CENTER_X - 0.7, 2.54 + 0.28, BOOKSHELF_Z - 0.08);
  root.rotation.y = Math.PI; // face toward camera
  root.scale.setScalar(2);
  scene.add(root);

  // ── Body — plump oval torso ──
  const bodyGeo = new SphereGeometry(0.12, 12, 12);
  bodyGeo.scale(1, 1.15, 0.9);
  const body = new Mesh(bodyGeo, brownMat);
  body.name = 'teddyBody';
  body.castShadow = true;
  root.add(body);

  // Belly patch
  const belly = new Mesh(new CircleGeometry(0.065, 10), lightMat);
  belly.name = 'teddyBelly';
  belly.position.set(0, -0.01, 0.108);
  body.add(belly);

  // ── Head — round, proportional ──
  const head = new Mesh(new SphereGeometry(0.1, 12, 12), brownMat);
  head.name = 'teddyHead';
  head.position.set(0, 0.2, 0.01);
  head.castShadow = true;
  body.add(head);

  // ── Ears — round with inner pads ──
  [-1, 1].forEach((side, i) => {
    const ear = new Mesh(new SphereGeometry(0.04, 8, 8), brownMat);
    ear.name = `teddyEar${i}`;
    ear.position.set(side * 0.072, 0.075, 0);
    head.add(ear);

    const earInner = new Mesh(new CircleGeometry(0.025, 8), padMat);
    earInner.name = `teddyEarInner${i}`;
    earInner.position.z = 0.038;
    ear.add(earInner);
  });

  // ── Muzzle — lighter rounded snout area ──
  const muzzle = new Mesh(new SphereGeometry(0.05, 10, 10), lightMat);
  muzzle.name = 'teddyMuzzle';
  muzzle.position.set(0, -0.02, 0.085);
  head.add(muzzle);

  // Nose — dark oval
  const noseGeo = new SphereGeometry(0.018, 8, 6);
  noseGeo.scale(1.2, 0.8, 0.7);
  const nose = new Mesh(noseGeo, noseMat);
  nose.name = 'teddyNose';
  nose.position.set(0, 0.018, 0.042);
  muzzle.add(nose);

  // Mouth line — V shape below nose
  [-1, 1].forEach((side) => {
    const line = new Mesh(new CylinderGeometry(0.003, 0.003, 0.025, 4), mouthMat);
    line.name = `teddyMouthLine${side}`;
    line.position.set(side * 0.008, -0.002, 0.04);
    line.rotation.z = side * 0.5;
    line.rotation.x = 0.2;
    muzzle.add(line);
  });

  // ── Eyes — warm bead eyes with highlights ──
  [-1, 1].forEach((side, i) => {
    const eye = new Mesh(new SphereGeometry(0.015, 8, 8), eyeMat);
    eye.name = `teddyEye${i}`;
    eye.position.set(side * 0.04, 0.025, 0.088);
    head.add(eye);

    // Highlight dot
    const hl = new Mesh(new SphereGeometry(0.005, 6, 6), highlightMat);
    hl.name = `teddyEyeHL${i}`;
    hl.position.set(side * 0.004, 0.004, 0.01);
    eye.add(hl);
  });

  // ── Arms — stubby with paw pads ──
  [-1, 1].forEach((side, i) => {
    const arm = new Mesh(new CylinderGeometry(0.03, 0.035, 0.12, 8), brownMat);
    arm.name = `teddyArm${i}`;
    arm.position.set(side * 0.13, 0.03, 0.02);
    arm.rotation.z = side * 0.55;
    body.add(arm);

    // Paw pad — oval
    const paw = new Mesh(new CircleGeometry(0.025, 8), padMat);
    paw.name = `teddyPaw${i}`;
    paw.position.set(0, -0.06, 0.02);
    paw.rotation.x = -0.4;
    arm.add(paw);
  });

  // ── Legs — short and chubby, sticking forward ──
  [-1, 1].forEach((side, i) => {
    const leg = new Mesh(new CylinderGeometry(0.035, 0.04, 0.1, 8), brownMat);
    leg.name = `teddyLeg${i}`;
    leg.position.set(side * 0.065, -0.12, 0.04);
    leg.rotation.x = Math.PI / 2.5;
    body.add(leg);

    // Foot pad — oval
    const foot = new Mesh(new CircleGeometry(0.03, 8), padMat);
    foot.name = `teddyFoot${i}`;
    foot.position.set(0, -0.05, 0.02);
    foot.rotation.x = -0.3;
    leg.add(foot);
  });

  // ── Bow tie — cute ribbon ──
  const bowMat = createFeltMaterial('hub_teddyBowMat', new Color(0.85, 0.2, 0.2));
  [-1, 1].forEach((side) => {
    const wing = new Mesh(new SphereGeometry(0.025, 6, 6), bowMat);
    wing.name = `teddyBow${side}`;
    wing.position.set(side * 0.025, 0.14, 0.1);
    wing.scale.set(1.2, 0.7, 0.5);
    body.add(wing);
  });
  const bowKnot = new Mesh(new SphereGeometry(0.012, 6, 6), bowMat);
  bowKnot.name = 'teddyBowKnot';
  bowKnot.position.set(0, 0.14, 0.105);
  body.add(bowKnot);
}
