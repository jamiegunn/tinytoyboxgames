import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, SphereGeometry, type DirectionalLight, type Scene } from 'three';
import { createFeltMaterial, createPlasticMaterial } from '@app/utils/materialFactory';

/**
 * Creates Raggedy Ann and Raggedy Andy dolls sitting on top of
 * the green (creative) dresser toybox, backs near the wall.
 * @param scene - The Three.js scene to add the dolls to
 * @param _keyLight - The directional light (unused)
 */
export function createRaggedyDolls(scene: Scene, _keyLight: DirectionalLight): void {
  // Dresser front edge ≈ Z 7.72. Sit them on the front edge so legs drape over.
  // After hovering fix, dresser top ≈ Y 1.02.
  const topY = 1.02;
  const frontEdgeZ = 7.78;

  createRaggedyAnn(scene, -2.7, topY, frontEdgeZ);
  createRaggedyAndy(scene, -3.6, topY, frontEdgeZ);
}

/**
 * Raggedy Ann — soft red yarn hair, blue dress with white apron, gentle face.
 * @param scene - The Three.js scene to add Ann to
 * @param x - X position
 * @param y - Y position
 * @param z - Z position
 */
function createRaggedyAnn(scene: Scene, x: number, y: number, z: number): void {
  const root = new Group();
  root.name = 'raggedyAnn_root';
  root.position.set(x, y, z);
  root.rotation.y = Math.PI + 0.1;
  root.scale.setScalar(3);
  scene.add(root);

  const skinMat = createFeltMaterial('hub_annSkinMat', new Color(0.96, 0.85, 0.76));
  const dressMat = createFeltMaterial('hub_annDressMat', new Color(0.35, 0.5, 0.82));
  const apronMat = createFeltMaterial('hub_annApronMat', new Color(0.97, 0.96, 0.93));
  const hairMat = createFeltMaterial('hub_annHairMat', new Color(0.82, 0.3, 0.18));
  const eyeMat = createFeltMaterial('hub_annEyeMat', new Color(0.2, 0.15, 0.12));
  const cheekMat = createPlasticMaterial('hub_annCheekMat', new Color(0.95, 0.7, 0.68));
  const noseMat = createFeltMaterial('hub_annNoseMat', new Color(0.85, 0.45, 0.4));
  const mouthMat = createFeltMaterial('hub_annMouthMat', new Color(0.8, 0.4, 0.38));
  const shoeMat = createFeltMaterial('hub_annShoeMat', new Color(0.15, 0.15, 0.15));
  const stockingMat = createFeltMaterial('hub_annStockingMat', new Color(0.95, 0.95, 0.92));

  // Body — soft torso
  const body = new Mesh(new BoxGeometry(0.1, 0.18, 0.06), dressMat);
  body.name = 'annBody';
  body.position.y = 0.09;
  body.castShadow = true;
  root.add(body);

  // Apron
  const apron = new Mesh(new BoxGeometry(0.08, 0.13, 0.005), apronMat);
  apron.name = 'annApron';
  apron.position.set(0, 0.005, 0.033);
  body.add(apron);

  // Head — round and friendly
  const head = new Mesh(new SphereGeometry(0.07, 12, 12), skinMat);
  head.name = 'annHead';
  head.position.y = 0.155;
  head.castShadow = true;
  body.add(head);

  // Yarn hair — soft loops around the head
  const hairAngles = [0.6, 1.0, 1.4, 1.8, 2.2, 2.6, 3.0, 3.4, 3.8, 4.2, 4.6, 5.0, 5.4, 5.8];
  hairAngles.forEach((angle, i) => {
    // Skip the face area
    if (angle > 5.5 || angle < 0.8) return;
    const len = 0.05 + Math.random() * 0.025;
    const strand = new Mesh(new CylinderGeometry(0.007, 0.006, len, 4), hairMat);
    strand.name = `annHair${i}`;
    const r = 0.066;
    strand.position.set(Math.sin(angle) * r, 0.025 - len * 0.25, Math.cos(angle) * r);
    strand.rotation.x = Math.cos(angle) * 0.25;
    strand.rotation.z = Math.sin(angle) * 0.35;
    head.add(strand);
  });

  // Hair top — soft cap of yarn
  for (let i = 0; i < 5; i++) {
    const puff = new Mesh(new SphereGeometry(0.022, 6, 6), hairMat);
    puff.name = `annHairTop${i}`;
    const a = (i / 5) * Math.PI * 2;
    puff.position.set(Math.sin(a) * 0.03, 0.055, Math.cos(a) * 0.025);
    head.add(puff);
  }

  // Pigtails — soft yarn bundles
  [-1, 1].forEach((side) => {
    for (let j = 0; j < 4; j++) {
      const len = 0.08 + j * 0.01;
      const pigtail = new Mesh(new CylinderGeometry(0.007, 0.005, len, 4), hairMat);
      pigtail.name = `annPigtail${side}_${j}`;
      pigtail.position.set(side * (0.058 + j * 0.004), -0.01 - j * 0.004, -0.01);
      pigtail.rotation.z = side * 0.45;
      pigtail.rotation.x = 0.1;
      head.add(pigtail);
    }
  });

  // Eyes — small soft dots, wider apart, warm brown
  [-1, 1].forEach((side) => {
    const eye = new Mesh(new SphereGeometry(0.008, 8, 8), eyeMat);
    eye.name = `annEye${side}`;
    eye.position.set(side * 0.028, 0.012, 0.062);
    head.add(eye);

    // Tiny white highlight
    const highlight = new Mesh(new SphereGeometry(0.003, 6, 6), apronMat);
    highlight.name = `annEyeHighlight${side}`;
    highlight.position.set(side * 0.003, 0.003, 0.004);
    eye.add(highlight);
  });

  // Nose — soft round bump, not a triangle
  const nose = new Mesh(new SphereGeometry(0.01, 8, 8), noseMat);
  nose.name = 'annNose';
  nose.position.set(0, -0.002, 0.066);
  head.add(nose);

  // Cheeks — soft pink, subtle
  [-1, 1].forEach((side) => {
    const cheek = new Mesh(new SphereGeometry(0.013, 8, 8), cheekMat);
    cheek.name = `annCheek${side}`;
    cheek.position.set(side * 0.033, -0.012, 0.055);
    head.add(cheek);
  });

  // Smile — gentle upward curve
  const smile = new Mesh(new BoxGeometry(0.025, 0.003, 0.003), mouthMat);
  smile.name = 'annSmile';
  smile.position.set(0, -0.024, 0.06);
  head.add(smile);

  // Arms — soft floppy
  [-1, 1].forEach((side) => {
    const upperArm = new Mesh(new CylinderGeometry(0.015, 0.013, 0.09, 6), dressMat);
    upperArm.name = `annUpperArm${side}`;
    upperArm.position.set(side * 0.065, 0.04, 0);
    upperArm.rotation.z = side * 0.7;
    body.add(upperArm);

    const lowerArm = new Mesh(new CylinderGeometry(0.013, 0.011, 0.07, 6), skinMat);
    lowerArm.name = `annLowerArm${side}`;
    lowerArm.position.y = -0.075;
    lowerArm.rotation.z = side * 0.2;
    upperArm.add(lowerArm);

    const hand = new Mesh(new SphereGeometry(0.012, 6, 6), skinMat);
    hand.name = `annHand${side}`;
    hand.position.y = -0.04;
    lowerArm.add(hand);
  });

  // Dress hem
  const hem = new Mesh(new BoxGeometry(0.12, 0.04, 0.065), dressMat);
  hem.name = 'annHem';
  hem.position.y = -0.1;
  body.add(hem);

  // Legs — striped stockings, draped over edge, clearly visible
  [-1, 1].forEach((side) => {
    const upperLeg = new Mesh(new CylinderGeometry(0.016, 0.015, 0.08, 6), stockingMat);
    upperLeg.name = `annUpperLeg${side}`;
    upperLeg.position.set(side * 0.035, -0.12, 0.025);
    upperLeg.rotation.x = -1.2;
    upperLeg.rotation.z = side * 0.06;
    body.add(upperLeg);

    const lowerLeg = new Mesh(new CylinderGeometry(0.015, 0.013, 0.08, 6), stockingMat);
    lowerLeg.name = `annLowerLeg${side}`;
    lowerLeg.position.y = -0.075;
    lowerLeg.rotation.x = 0.3;
    upperLeg.add(lowerLeg);

    // Stripe rings
    for (let s = 0; s < 4; s++) {
      const parent = s < 2 ? upperLeg : lowerLeg;
      const yOff = s < 2 ? -0.02 + s * 0.03 : -0.02 + (s - 2) * 0.03;
      const stripe = new Mesh(new CylinderGeometry(0.017, 0.017, 0.006, 6), noseMat);
      stripe.name = `annStripe${side}_${s}`;
      stripe.position.y = yOff;
      parent.add(stripe);
    }

    const shoe = new Mesh(new BoxGeometry(0.026, 0.018, 0.038), shoeMat);
    shoe.name = `annShoe${side}`;
    shoe.position.set(0, -0.045, 0.01);
    lowerLeg.add(shoe);
  });
}

/**
 * Raggedy Andy — red yarn hair, blue cap, blue shirt, gentle face.
 * @param scene - The Three.js scene to add Andy to
 * @param x - X position
 * @param y - Y position
 * @param z - Z position
 */
function createRaggedyAndy(scene: Scene, x: number, y: number, z: number): void {
  const root = new Group();
  root.name = 'raggedyAndy_root';
  root.position.set(x, y, z);
  root.rotation.y = Math.PI - 0.1;
  root.scale.setScalar(3);
  scene.add(root);

  const skinMat = createFeltMaterial('hub_andySkinMat', new Color(0.96, 0.85, 0.76));
  const shirtMat = createFeltMaterial('hub_andyShirtMat', new Color(0.35, 0.55, 0.82));
  const pantsMat = createFeltMaterial('hub_andyPantsMat', new Color(0.3, 0.4, 0.68));
  const hairMat = createFeltMaterial('hub_andyHairMat', new Color(0.82, 0.3, 0.18));
  const capMat = createFeltMaterial('hub_andyCapMat', new Color(0.3, 0.5, 0.78));
  const eyeMat = createFeltMaterial('hub_andyEyeMat', new Color(0.2, 0.15, 0.12));
  const cheekMat = createPlasticMaterial('hub_andyCheekMat', new Color(0.95, 0.7, 0.68));
  const noseMat = createFeltMaterial('hub_andyNoseMat', new Color(0.85, 0.45, 0.4));
  const mouthMat = createFeltMaterial('hub_andyMouthMat', new Color(0.8, 0.4, 0.38));
  const shoeMat = createFeltMaterial('hub_andyShoeMat', new Color(0.35, 0.22, 0.14));
  const whiteMat = createFeltMaterial('hub_andyWhiteMat', new Color(0.97, 0.96, 0.93));

  // Body — soft torso
  const body = new Mesh(new BoxGeometry(0.1, 0.16, 0.06), shirtMat);
  body.name = 'andyBody';
  body.position.y = 0.08;
  body.castShadow = true;
  root.add(body);

  // Head — round and friendly
  const head = new Mesh(new SphereGeometry(0.07, 12, 12), skinMat);
  head.name = 'andyHead';
  head.position.y = 0.145;
  head.castShadow = true;
  body.add(head);

  // Yarn hair — messy tufts poking from under cap
  const tuftAngles = [-2.2, -1.8, -1.4, 1.4, 1.8, 2.2, 2.8, -2.8];
  tuftAngles.forEach((angle, i) => {
    const len = 0.035 + Math.random() * 0.02;
    const strand = new Mesh(new CylinderGeometry(0.007, 0.005, len, 4), hairMat);
    strand.name = `andyHair${i}`;
    const r = 0.064;
    strand.position.set(Math.sin(angle) * r, -0.005, Math.cos(angle) * r);
    strand.rotation.z = Math.sin(angle) * 0.4;
    strand.rotation.x = Math.cos(angle) * 0.2;
    head.add(strand);
  });

  // Cap — soft rounded
  const capBase = new Mesh(new CylinderGeometry(0.068, 0.072, 0.022, 12), capMat);
  capBase.name = 'andyCap';
  capBase.position.set(0, 0.05, 0.005);
  capBase.rotation.x = -0.08;
  head.add(capBase);

  const capDome = new Mesh(new SphereGeometry(0.058, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
  capDome.name = 'andyCapDome';
  capDome.position.y = 0.01;
  capBase.add(capDome);

  const brim = new Mesh(new CylinderGeometry(0.074, 0.074, 0.004, 12), capMat);
  brim.name = 'andyCapBrim';
  brim.position.set(0, -0.01, 0.02);
  capBase.add(brim);

  // Eyes — small soft dots, warm brown
  [-1, 1].forEach((side) => {
    const eye = new Mesh(new SphereGeometry(0.008, 8, 8), eyeMat);
    eye.name = `andyEye${side}`;
    eye.position.set(side * 0.028, 0.012, 0.062);
    head.add(eye);

    const highlight = new Mesh(new SphereGeometry(0.003, 6, 6), whiteMat);
    highlight.name = `andyEyeHighlight${side}`;
    highlight.position.set(side * 0.003, 0.003, 0.004);
    eye.add(highlight);
  });

  // Nose — soft round bump
  const nose = new Mesh(new SphereGeometry(0.01, 8, 8), noseMat);
  nose.name = 'andyNose';
  nose.position.set(0, -0.002, 0.066);
  head.add(nose);

  // Cheeks — soft pink
  [-1, 1].forEach((side) => {
    const cheek = new Mesh(new SphereGeometry(0.013, 8, 8), cheekMat);
    cheek.name = `andyCheek${side}`;
    cheek.position.set(side * 0.033, -0.012, 0.055);
    head.add(cheek);
  });

  // Smile
  const smile = new Mesh(new BoxGeometry(0.025, 0.003, 0.003), mouthMat);
  smile.name = 'andySmile';
  smile.position.set(0, -0.024, 0.06);
  head.add(smile);

  // Arms — soft floppy
  [-1, 1].forEach((side) => {
    const upperArm = new Mesh(new CylinderGeometry(0.015, 0.013, 0.09, 6), shirtMat);
    upperArm.name = `andyUpperArm${side}`;
    upperArm.position.set(side * 0.065, 0.03, 0);
    upperArm.rotation.z = side * 0.6;
    body.add(upperArm);

    const lowerArm = new Mesh(new CylinderGeometry(0.013, 0.011, 0.07, 6), skinMat);
    lowerArm.name = `andyLowerArm${side}`;
    lowerArm.position.y = -0.075;
    lowerArm.rotation.z = side * 0.2;
    upperArm.add(lowerArm);

    const hand = new Mesh(new SphereGeometry(0.012, 6, 6), skinMat);
    hand.name = `andyHand${side}`;
    hand.position.y = -0.04;
    lowerArm.add(hand);
  });

  // Legs — pants, draped over edge with bent knees, clearly visible
  [-1, 1].forEach((side) => {
    const upperLeg = new Mesh(new CylinderGeometry(0.017, 0.016, 0.08, 6), pantsMat);
    upperLeg.name = `andyUpperLeg${side}`;
    upperLeg.position.set(side * 0.035, -0.09, 0.025);
    upperLeg.rotation.x = -1.2;
    upperLeg.rotation.z = side * 0.06;
    body.add(upperLeg);

    const lowerLeg = new Mesh(new CylinderGeometry(0.016, 0.014, 0.08, 6), pantsMat);
    lowerLeg.name = `andyLowerLeg${side}`;
    lowerLeg.position.y = -0.075;
    lowerLeg.rotation.x = 0.3;
    upperLeg.add(lowerLeg);

    const shoe = new Mesh(new BoxGeometry(0.028, 0.02, 0.04), shoeMat);
    shoe.name = `andyShoe${side}`;
    shoe.position.set(0, -0.045, 0.01);
    lowerLeg.add(shoe);
  });
}
