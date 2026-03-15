import { BoxGeometry, CircleGeometry, Color, CylinderGeometry, Group, Mesh, SphereGeometry, Vector3 } from 'three';
import { createWoodMaterial, createGlossyPaintMaterial, createPlasticMaterial, createPaperMaterial } from '@app/utils/materialFactory';
import type { ToyboxSpec, ToyboxRuntime } from '@app/toyboxes/framework';

/**
 * Creates the Animals toybox — an open box with toys spilling out.
 * @param spec - Toybox configuration and destination metadata
 * @returns The toybox runtime
 */
export function buildAnimalsOpenBoxToybox(spec: ToyboxSpec): ToyboxRuntime {
  const baseColor = new Color(spec.palette.base);
  const accentColor = new Color(spec.palette.accent);
  const root = new Group();
  root.name = `toybox_${spec.id}_root`;
  root.position.y += 0.72;
  root.rotation.y = -0.04;

  const bodyMat = createGlossyPaintMaterial(`toybox_${spec.id}_mat`, baseColor);
  const accentMat = createGlossyPaintMaterial(`toybox_${spec.id}_accentMat`, accentColor);
  const cornerMat = createGlossyPaintMaterial(`toybox_${spec.id}_cornerMat`, baseColor.clone().multiplyScalar(0.82));
  const linerMat = createWoodMaterial(`toybox_${spec.id}_linerMat`, new Color(0.88, 0.73, 0.56));
  const labelMat = createPaperMaterial(`toybox_${spec.id}_labelMat`, new Color(0.95, 0.9, 0.77));
  const tapeMat = createPaperMaterial(`toybox_${spec.id}_tapeMat`, new Color(0.91, 0.84, 0.67));
  const pawMat = createPlasticMaterial(`toybox_${spec.id}_pawMat`, baseColor.clone().multiplyScalar(0.92));

  const castShadow = (...meshes: Mesh[]): void => {
    meshes.forEach((mesh) => {
      mesh.castShadow = true;
    });
  };

  // Outer walls
  const body = new Mesh(new BoxGeometry(1.92, 0.9, 0.08), bodyMat);
  body.name = `toybox_${spec.id}_body`;
  body.position.set(0, -0.03, 0.68);
  castShadow(body);
  root.add(body);

  const backWall = new Mesh(new BoxGeometry(1.92, 0.9, 0.08), bodyMat);
  backWall.name = `toybox_${spec.id}_backWall`;
  backWall.position.set(0, -0.03, -0.68);
  castShadow(backWall);
  root.add(backWall);

  const leftWall = new Mesh(new BoxGeometry(0.08, 0.9, 1.28), bodyMat);
  leftWall.name = `toybox_${spec.id}_leftWall`;
  leftWall.position.set(-0.92, -0.03, 0);
  castShadow(leftWall);
  root.add(leftWall);

  const rightWall = new Mesh(new BoxGeometry(0.08, 0.9, 1.28), bodyMat);
  rightWall.name = `toybox_${spec.id}_rightWall`;
  rightWall.position.set(0.92, -0.03, 0);
  castShadow(rightWall);
  root.add(rightWall);

  const bottom = new Mesh(new BoxGeometry(1.84, 0.12, 1.3), bodyMat);
  bottom.name = `toybox_${spec.id}_bottom`;
  bottom.position.set(0, -0.45, 0);
  castShadow(bottom);
  root.add(bottom);

  // Inner liner
  const innerFloor = new Mesh(new BoxGeometry(1.72, 0.05, 1.18), linerMat);
  innerFloor.name = `toybox_${spec.id}_innerFloor`;
  innerFloor.position.set(0, -0.38, 0);
  root.add(innerFloor);

  const innerFront = new Mesh(new BoxGeometry(1.68, 0.74, 0.02), linerMat);
  innerFront.name = `toybox_${spec.id}_innerFront`;
  innerFront.position.set(0, -0.05, 0.61);
  root.add(innerFront);

  const innerBack = new Mesh(new BoxGeometry(1.68, 0.74, 0.02), linerMat);
  innerBack.name = `toybox_${spec.id}_innerBack`;
  innerBack.position.set(0, -0.05, -0.61);
  root.add(innerBack);

  const innerLeft = new Mesh(new BoxGeometry(0.02, 0.74, 1.16), linerMat);
  innerLeft.name = `toybox_${spec.id}_innerLeft`;
  innerLeft.position.set(-0.83, -0.05, 0);
  root.add(innerLeft);

  const innerRight = new Mesh(new BoxGeometry(0.02, 0.74, 1.16), linerMat);
  innerRight.name = `toybox_${spec.id}_innerRight`;
  innerRight.position.set(0.83, -0.05, 0);
  root.add(innerRight);

  // Rim
  const rimSegments = [
    { name: 'frontRim', size: [1.96, 0.08, 0.08] as const, pos: new Vector3(0, 0.42, 0.68) },
    { name: 'backRim', size: [1.96, 0.08, 0.08] as const, pos: new Vector3(0, 0.42, -0.68) },
    { name: 'leftRim', size: [0.08, 0.08, 1.32] as const, pos: new Vector3(-0.92, 0.42, 0) },
    { name: 'rightRim', size: [0.08, 0.08, 1.32] as const, pos: new Vector3(0.92, 0.42, 0) },
  ];
  rimSegments.forEach((segment) => {
    const rim = new Mesh(new BoxGeometry(...segment.size), accentMat);
    rim.name = `toybox_${spec.id}_${segment.name}`;
    rim.position.copy(segment.pos);
    root.add(rim);
  });

  // Corner posts
  const cornerPositions = [new Vector3(-0.9, -0.03, 0.64), new Vector3(0.9, -0.03, 0.64), new Vector3(-0.9, -0.03, -0.64), new Vector3(0.9, -0.03, -0.64)];
  cornerPositions.forEach((position, index) => {
    const post = new Mesh(new CylinderGeometry(0.055, 0.055, 0.92, 10), cornerMat);
    post.name = `toybox_${spec.id}_corner${index}`;
    post.position.copy(position);
    castShadow(post);
    root.add(post);
  });

  // Label and tape
  const label = new Mesh(new BoxGeometry(1.0, 0.52, 0.03), labelMat);
  label.name = `toybox_${spec.id}_label`;
  label.position.set(-0.15, -0.08, 0.735);
  label.rotation.z = -0.04;
  root.add(label);

  const tapeLeft = new Mesh(new BoxGeometry(0.16, 0.06, 0.01), tapeMat);
  tapeLeft.name = `toybox_${spec.id}_tapeLeft`;
  tapeLeft.position.set(-0.49, 0.11, 0.75);
  tapeLeft.rotation.z = 0.28;
  root.add(tapeLeft);

  const tapeTop = new Mesh(new BoxGeometry(0.18, 0.06, 0.01), tapeMat);
  tapeTop.name = `toybox_${spec.id}_tapeTop`;
  tapeTop.position.set(-0.18, 0.18, 0.75);
  tapeTop.rotation.z = -0.16;
  root.add(tapeTop);

  // Paw print
  const pawPads = [
    { radius: 0.1, pos: new Vector3(-0.08, -0.02, 0.751) },
    { radius: 0.045, pos: new Vector3(-0.19, 0.12, 0.751) },
    { radius: 0.04, pos: new Vector3(-0.09, 0.17, 0.751) },
    { radius: 0.04, pos: new Vector3(0.01, 0.15, 0.751) },
    { radius: 0.045, pos: new Vector3(0.1, 0.08, 0.751) },
  ];
  pawPads.forEach((pad, index) => {
    const disc = new Mesh(new CircleGeometry(pad.radius, 16), pawMat);
    disc.name = `toybox_${spec.id}_paw${index}`;
    disc.position.copy(pad.pos);
    root.add(disc);
  });

  // Flaps (open lid pieces)
  const frontFlapPivot = new Group();
  frontFlapPivot.name = `toybox_${spec.id}_lidFrontPivot`;
  frontFlapPivot.position.set(0, 0.38, 0.64);
  frontFlapPivot.rotation.x = -0.82;
  root.add(frontFlapPivot);

  const frontFlap = new Mesh(new BoxGeometry(1.82, 0.06, 0.58), bodyMat);
  frontFlap.name = `toybox_${spec.id}_lidFront`;
  frontFlap.position.set(0, 0, 0.29);
  castShadow(frontFlap);
  frontFlapPivot.add(frontFlap);

  const backFlapPivot = new Group();
  backFlapPivot.name = `toybox_${spec.id}_lidBackPivot`;
  backFlapPivot.position.set(0, 0.38, -0.64);
  backFlapPivot.rotation.x = 0.68;
  root.add(backFlapPivot);

  const backFlap = new Mesh(new BoxGeometry(1.82, 0.06, 0.56), bodyMat);
  backFlap.name = `toybox_${spec.id}_lidBack`;
  backFlap.position.set(0, 0, -0.28);
  castShadow(backFlap);
  backFlapPivot.add(backFlap);

  const leftFlapPivot = new Group();
  leftFlapPivot.name = `toybox_${spec.id}_lidLeftPivot`;
  leftFlapPivot.position.set(-0.88, 0.38, 0);
  leftFlapPivot.rotation.z = 0.76;
  root.add(leftFlapPivot);

  const leftFlap = new Mesh(new BoxGeometry(0.56, 0.06, 1.18), bodyMat);
  leftFlap.name = `toybox_${spec.id}_lidLeft`;
  leftFlap.position.set(-0.28, 0, 0);
  castShadow(leftFlap);
  leftFlapPivot.add(leftFlap);

  const rightFlapPivot = new Group();
  rightFlapPivot.name = `toybox_${spec.id}_lidRightPivot`;
  rightFlapPivot.position.set(0.88, 0.38, 0);
  rightFlapPivot.rotation.z = -0.76;
  root.add(rightFlapPivot);

  const rightFlap = new Mesh(new BoxGeometry(0.56, 0.06, 1.18), bodyMat);
  rightFlap.name = `toybox_${spec.id}_lidRight`;
  rightFlap.position.set(0.28, 0, 0);
  castShadow(rightFlap);
  rightFlapPivot.add(rightFlap);

  // Contents
  const contents = new Group();
  contents.name = `toybox_${spec.id}_contents`;
  contents.position.set(0, 0.02, 0);
  root.add(contents);

  const contentPickMeshes = [
    ...createRubberDuck(contents),
    ...createToyGiraffe(contents),
    createToyBall(contents),
    ...createToyFrog(contents),
    ...createToyBlocks(contents),
    ...createToyCar(contents),
    ...createToyBunny(backFlapPivot),
  ];

  return {
    root,
    hoverMaterials: [bodyMat, accentMat],
    pickMeshes: [body, label, frontFlap, backFlap, leftFlap, rightFlap, ...contentPickMeshes],
    openAnimations: [
      { object: frontFlapPivot, propertyPath: 'rotation.x', peakValue: -1.18, settleValue: -1.0 },
      { object: backFlapPivot, propertyPath: 'rotation.x', peakValue: 1.02, settleValue: 0.88 },
      { object: leftFlapPivot, propertyPath: 'rotation.z', peakValue: 1.05, settleValue: 0.92 },
      { object: rightFlapPivot, propertyPath: 'rotation.z', peakValue: -1.05, settleValue: -0.92 },
    ],
  };
}

function createRubberDuck(parent: Group): Mesh[] {
  const duck = new Group();
  duck.name = 'toybox_animals_duck_root';
  duck.position.set(-0.52, 0.54, -0.03);
  duck.rotation.y = 0.4;
  parent.add(duck);

  const yellowMat = createGlossyPaintMaterial('toybox_animals_duckYellowMat', new Color(0.98, 0.85, 0.15));
  const orangeMat = createGlossyPaintMaterial('toybox_animals_duckOrangeMat', new Color(0.95, 0.55, 0.1));
  const eyeMat = createPlasticMaterial('toybox_animals_duckEyeMat', new Color(0.08, 0.08, 0.1));
  const whiteMat = createPlasticMaterial('toybox_animals_duckWhiteMat', new Color(0.95, 0.95, 0.95));

  // Round body
  const body = new Mesh(new SphereGeometry(0.18, 14, 14), yellowMat);
  body.name = 'toybox_animals_duck_body';
  body.castShadow = true;
  duck.add(body);

  // Round head
  const head = new Mesh(new SphereGeometry(0.12, 14, 14), yellowMat);
  head.name = 'toybox_animals_duck_head';
  head.position.set(0.16, 0.18, 0);
  head.castShadow = true;
  duck.add(head);

  // Beak — flat wide cylinder
  const beak = new Mesh(new CylinderGeometry(0.04, 0.05, 0.08, 8), orangeMat);
  beak.name = 'toybox_animals_duck_beak';
  beak.position.set(0.28, 0.16, 0);
  beak.rotation.z = Math.PI / 2;
  duck.add(beak);

  // Eyes — small spheres
  [-1, 1].forEach((side) => {
    const eyeWhite = new Mesh(new SphereGeometry(0.025, 8, 8), whiteMat);
    eyeWhite.name = `toybox_animals_duck_eyeW${side}`;
    eyeWhite.position.set(0.24, 0.22, side * 0.07);
    duck.add(eyeWhite);

    const eyePupil = new Mesh(new SphereGeometry(0.014, 8, 8), eyeMat);
    eyePupil.name = `toybox_animals_duck_eyeP${side}`;
    eyePupil.position.set(0.26, 0.22, side * 0.075);
    duck.add(eyePupil);
  });

  // Tail — small pointed bump
  const tail = new Mesh(new CylinderGeometry(0.01, 0.06, 0.08, 6), yellowMat);
  tail.name = 'toybox_animals_duck_tail';
  tail.position.set(-0.18, 0.1, 0);
  tail.rotation.z = -0.6;
  duck.add(tail);

  return [body, head, beak];
}

function createToyGiraffe(parent: Group): Mesh[] {
  const giraffe = new Group();
  giraffe.name = 'toybox_animals_giraffe_root';
  giraffe.position.set(0.48, 0.46, -0.12);
  giraffe.rotation.y = -0.4;
  parent.add(giraffe);

  const yellowMat = createGlossyPaintMaterial('toybox_animals_giraffeYellowMat', new Color(0.95, 0.78, 0.25));
  const spotMat = createGlossyPaintMaterial('toybox_animals_giraffeSpotMat', new Color(0.65, 0.4, 0.12));
  const eyeMat = createPlasticMaterial('toybox_animals_giraffeEyeMat', new Color(0.08, 0.08, 0.1));
  const whiteMat = createPlasticMaterial('toybox_animals_giraffeWhiteMat', new Color(0.95, 0.95, 0.95));
  const hornMat = createPlasticMaterial('toybox_animals_giraffeHornMat', new Color(0.7, 0.55, 0.3));

  // Chunky body
  const body = new Mesh(new BoxGeometry(0.28, 0.18, 0.16), yellowMat);
  body.name = 'toybox_animals_giraffe_body';
  body.castShadow = true;
  giraffe.add(body);

  // Spots on body
  [
    [-0.04, 0.03, 0.082],
    [0.06, -0.02, 0.082],
    [-0.08, -0.04, 0.082],
  ].forEach(([sx, sy, sz], i) => {
    const spot = new Mesh(new SphereGeometry(0.03, 8, 8), spotMat);
    spot.name = `toybox_animals_giraffe_spot${i}`;
    spot.position.set(sx, sy, sz);
    spot.scale.z = 0.2;
    body.add(spot);
  });

  // Long neck — tilted cylinder
  const neck = new Mesh(new CylinderGeometry(0.05, 0.06, 0.35, 10), yellowMat);
  neck.name = 'toybox_animals_giraffe_neck';
  neck.position.set(0.12, 0.24, 0);
  neck.rotation.z = -0.25;
  neck.castShadow = true;
  giraffe.add(neck);

  // Head — box
  const head = new Mesh(new BoxGeometry(0.14, 0.1, 0.1), yellowMat);
  head.name = 'toybox_animals_giraffe_head';
  head.position.set(0.2, 0.42, 0);
  head.castShadow = true;
  giraffe.add(head);

  // Snout
  const snout = new Mesh(new BoxGeometry(0.06, 0.05, 0.08), yellowMat);
  snout.name = 'toybox_animals_giraffe_snout';
  snout.position.set(0.09, -0.02, 0);
  head.add(snout);

  // Horns (ossicones)
  [-1, 1].forEach((side) => {
    const horn = new Mesh(new CylinderGeometry(0.012, 0.015, 0.06, 6), hornMat);
    horn.name = `toybox_animals_giraffe_horn${side}`;
    horn.position.set(-0.02, 0.07, side * 0.03);
    head.add(horn);

    const tip = new Mesh(new SphereGeometry(0.016, 6, 6), spotMat);
    tip.name = `toybox_animals_giraffe_hornTip${side}`;
    tip.position.y = 0.03;
    horn.add(tip);
  });

  // Eyes — spheres on sides of head
  [-1, 1].forEach((side) => {
    const eyeW = new Mesh(new SphereGeometry(0.02, 8, 8), whiteMat);
    eyeW.name = `toybox_animals_giraffe_eyeW${side}`;
    eyeW.position.set(0.04, 0.01, side * 0.052);
    head.add(eyeW);

    const eyeP = new Mesh(new SphereGeometry(0.012, 8, 8), eyeMat);
    eyeP.name = `toybox_animals_giraffe_eyeP${side}`;
    eyeP.position.set(0.05, 0.01, side * 0.055);
    head.add(eyeP);
  });

  // Four stubby legs
  const legPositions: [number, number, number][] = [
    [0.08, -0.16, 0.05],
    [0.08, -0.16, -0.05],
    [-0.08, -0.16, 0.05],
    [-0.08, -0.16, -0.05],
  ];
  legPositions.forEach(([lx, ly, lz], i) => {
    const leg = new Mesh(new CylinderGeometry(0.03, 0.035, 0.18, 8), yellowMat);
    leg.name = `toybox_animals_giraffe_leg${i}`;
    leg.position.set(lx, ly, lz);
    giraffe.add(leg);

    const hoof = new Mesh(new CylinderGeometry(0.035, 0.035, 0.02, 8), spotMat);
    hoof.name = `toybox_animals_giraffe_hoof${i}`;
    hoof.position.y = -0.1;
    leg.add(hoof);
  });

  // Tail
  const tail = new Mesh(new CylinderGeometry(0.008, 0.015, 0.12, 6), yellowMat);
  tail.name = 'toybox_animals_giraffe_tail';
  tail.position.set(-0.16, 0.04, 0);
  tail.rotation.z = 0.5;
  giraffe.add(tail);

  return [body, head, neck];
}

function createToyBall(parent: Group): Mesh {
  // Bright striped ball — red with a white band
  const redMat = createGlossyPaintMaterial('toybox_animals_ballRedMat', new Color(0.92, 0.2, 0.2));
  const ball = new Mesh(new SphereGeometry(0.18, 14, 14), redMat);
  ball.name = 'toybox_animals_ball';
  ball.position.set(-0.34, 0.02, 0.29);
  ball.castShadow = true;
  parent.add(ball);

  // White stripe band around middle
  const whiteMat = createPlasticMaterial('toybox_animals_ballWhiteMat', new Color(0.98, 0.98, 0.98));
  const stripe = new Mesh(new CylinderGeometry(0.185, 0.185, 0.06, 16, 1, true), whiteMat);
  stripe.name = 'toybox_animals_ball_stripe';
  ball.add(stripe);

  // Yellow star on front
  const starMat = createGlossyPaintMaterial('toybox_animals_ballStarMat', new Color(0.98, 0.85, 0.15));
  const star = new Mesh(new SphereGeometry(0.05, 5, 5), starMat);
  star.name = 'toybox_animals_ball_star';
  star.position.set(0, 0.04, 0.17);
  star.scale.z = 0.3;
  ball.add(star);

  return ball;
}

function createToyFrog(parent: Group): Mesh[] {
  const frog = new Group();
  frog.name = 'toybox_animals_frog_root';
  frog.position.set(0.03, 0.16, -0.16);
  frog.rotation.y = 0.3;
  parent.add(frog);

  const greenMat = createGlossyPaintMaterial('toybox_animals_frogGreenMat', new Color(0.3, 0.78, 0.25));
  const bellyMat = createPlasticMaterial('toybox_animals_frogBellyMat', new Color(0.75, 0.92, 0.55));
  const eyeMat = createPlasticMaterial('toybox_animals_frogEyeMat', new Color(0.08, 0.08, 0.1));
  const whiteMat = createPlasticMaterial('toybox_animals_frogWhiteMat', new Color(0.95, 0.95, 0.95));
  const mouthMat = createPlasticMaterial('toybox_animals_frogMouthMat', new Color(0.85, 0.25, 0.3));

  // Squat round body
  const body = new Mesh(new SphereGeometry(0.16, 12, 12), greenMat);
  body.name = 'toybox_animals_frog_body';
  body.castShadow = true;
  frog.add(body);

  // Belly — lighter front
  const belly = new Mesh(new SphereGeometry(0.12, 10, 10), bellyMat);
  belly.name = 'toybox_animals_frog_belly';
  belly.position.set(0.06, -0.04, 0);
  belly.scale.z = 0.5;
  frog.add(belly);

  // Big bulging eyes on top
  [-1, 1].forEach((side) => {
    const eyeBulge = new Mesh(new SphereGeometry(0.06, 10, 10), greenMat);
    eyeBulge.name = `toybox_animals_frog_eyeBulge${side}`;
    eyeBulge.position.set(0.06, 0.14, side * 0.08);
    frog.add(eyeBulge);

    const eyeW = new Mesh(new SphereGeometry(0.04, 8, 8), whiteMat);
    eyeW.name = `toybox_animals_frog_eyeW${side}`;
    eyeW.position.set(0.09, 0.16, side * 0.09);
    frog.add(eyeW);

    const eyeP = new Mesh(new SphereGeometry(0.022, 8, 8), eyeMat);
    eyeP.name = `toybox_animals_frog_eyeP${side}`;
    eyeP.position.set(0.12, 0.16, side * 0.09);
    frog.add(eyeP);
  });

  // Wide mouth line
  const mouth = new Mesh(new BoxGeometry(0.1, 0.01, 0.12), mouthMat);
  mouth.name = 'toybox_animals_frog_mouth';
  mouth.position.set(0.16, 0.0, 0);
  frog.add(mouth);

  // Front legs — bent forward
  [-1, 1].forEach((side) => {
    const upperLeg = new Mesh(new BoxGeometry(0.04, 0.1, 0.04), greenMat);
    upperLeg.name = `toybox_animals_frog_frontLeg${side}`;
    upperLeg.position.set(0.1, -0.14, side * 0.12);
    upperLeg.rotation.z = 0.3;
    frog.add(upperLeg);
  });

  // Back legs — bent out to sides (frog sitting pose)
  [-1, 1].forEach((side) => {
    const thigh = new Mesh(new BoxGeometry(0.05, 0.12, 0.05), greenMat);
    thigh.name = `toybox_animals_frog_thigh${side}`;
    thigh.position.set(-0.06, -0.12, side * 0.14);
    thigh.rotation.z = side * 0.3;
    frog.add(thigh);

    const shin = new Mesh(new BoxGeometry(0.04, 0.1, 0.04), greenMat);
    shin.name = `toybox_animals_frog_shin${side}`;
    shin.position.set(-0.12, -0.14, side * 0.18);
    shin.rotation.z = -side * 0.2;
    frog.add(shin);
  });

  return [body, belly];
}

function createToyBlocks(parent: Group): Mesh[] {
  const blockRoot = new Group();
  blockRoot.name = 'toybox_animals_blocks_root';
  blockRoot.position.set(0.43, -0.02, 0.2);
  blockRoot.rotation.y = -0.25;
  parent.add(blockRoot);

  const yellowMat = createGlossyPaintMaterial('toybox_animals_blockYellowMat', new Color(0.98, 0.84, 0.27));
  const pinkMat = createGlossyPaintMaterial('toybox_animals_blockPinkMat', new Color(0.96, 0.58, 0.7));
  const cyanMat = createGlossyPaintMaterial('toybox_animals_blockCyanMat', new Color(0.42, 0.86, 0.94));

  const leftBlock = new Mesh(new BoxGeometry(0.16, 0.16, 0.16), yellowMat);
  leftBlock.name = 'toybox_animals_block_left';
  leftBlock.position.set(-0.12, 0.08, 0);
  leftBlock.rotation.set(0.1, -0.18, 0.04);
  leftBlock.castShadow = true;
  blockRoot.add(leftBlock);

  const midBlock = new Mesh(new BoxGeometry(0.15, 0.15, 0.15), pinkMat);
  midBlock.name = 'toybox_animals_block_mid';
  midBlock.position.set(0.02, 0.075, 0.04);
  midBlock.rotation.set(-0.06, 0.14, -0.08);
  midBlock.castShadow = true;
  blockRoot.add(midBlock);

  const topBlock = new Mesh(new BoxGeometry(0.13, 0.13, 0.13), cyanMat);
  topBlock.name = 'toybox_animals_block_top';
  topBlock.position.set(-0.02, 0.22, 0.02);
  topBlock.rotation.set(0.12, 0.32, 0.15);
  topBlock.castShadow = true;
  blockRoot.add(topBlock);

  return [leftBlock, midBlock, topBlock];
}

function createToyCar(parent: Group): Mesh[] {
  const carRoot = new Group();
  carRoot.name = 'toybox_animals_car_root';
  carRoot.position.set(0.58, 0.03, -0.35);
  carRoot.rotation.y = -0.52;
  carRoot.rotation.z = -0.04;
  parent.add(carRoot);

  const carBodyMat = createGlossyPaintMaterial('toybox_animals_carBodyMat', new Color(0.98, 0.82, 0.24));
  const trimMat = createGlossyPaintMaterial('toybox_animals_carTrimMat', new Color(0.73, 0.45, 0.85));
  const wheelMat = createPlasticMaterial('toybox_animals_carWheelMat', new Color(0.2, 0.2, 0.24));
  const windowMat = createGlossyPaintMaterial('toybox_animals_carWindowMat', new Color(0.86, 0.93, 1.0));

  const base = new Mesh(new BoxGeometry(0.42, 0.12, 0.22), carBodyMat);
  base.name = 'toybox_animals_car_base';
  base.castShadow = true;
  carRoot.add(base);

  const cabin = new Mesh(new BoxGeometry(0.19, 0.11, 0.18), trimMat);
  cabin.name = 'toybox_animals_car_cabin';
  cabin.position.set(0.04, 0.1, 0);
  cabin.castShadow = true;
  carRoot.add(cabin);

  const windshield = new Mesh(new BoxGeometry(0.11, 0.06, 0.19), windowMat);
  windshield.name = 'toybox_animals_car_window';
  windshield.position.set(0.04, 0.11, 0);
  carRoot.add(windshield);

  const wheelOffsets = [new Vector3(-0.12, -0.07, 0.12), new Vector3(0.12, -0.07, 0.12), new Vector3(-0.12, -0.07, -0.12), new Vector3(0.12, -0.07, -0.12)];
  wheelOffsets.forEach((offset, index) => {
    const wheel = new Mesh(new CylinderGeometry(0.05, 0.05, 0.04, 12), wheelMat);
    wheel.name = `toybox_animals_car_wheel${index}`;
    wheel.position.copy(offset);
    wheel.rotation.z = Math.PI / 2;
    wheel.castShadow = true;
    carRoot.add(wheel);
  });

  return [base, cabin];
}

function createToyBunny(parent: Group): Mesh[] {
  const bunny = new Group();
  bunny.name = 'toybox_animals_bunny_root';
  bunny.position.set(0.1, 0.22, -0.08);
  bunny.rotation.y = -0.2;
  parent.add(bunny);

  const pinkMat = createGlossyPaintMaterial('toybox_animals_bunnyPinkMat', new Color(0.92, 0.72, 0.78));
  const innerEarMat = createPlasticMaterial('toybox_animals_bunnyInnerEarMat', new Color(0.95, 0.6, 0.7));
  const whiteMat = createPlasticMaterial('toybox_animals_bunnyWhiteMat', new Color(0.98, 0.98, 0.98));
  const eyeMat = createPlasticMaterial('toybox_animals_bunnyEyeMat', new Color(0.08, 0.08, 0.1));
  const noseMat = createPlasticMaterial('toybox_animals_bunnyNoseMat', new Color(0.9, 0.5, 0.55));

  // Round body
  const body = new Mesh(new SphereGeometry(0.14, 12, 12), pinkMat);
  body.name = 'toybox_animals_bunny_body';
  body.castShadow = true;
  bunny.add(body);

  // White tummy
  const tummy = new Mesh(new SphereGeometry(0.1, 10, 10), whiteMat);
  tummy.name = 'toybox_animals_bunny_tummy';
  tummy.position.set(0.04, -0.02, 0);
  tummy.scale.z = 0.5;
  bunny.add(tummy);

  // Round head
  const head = new Mesh(new SphereGeometry(0.1, 12, 12), pinkMat);
  head.name = 'toybox_animals_bunny_head';
  head.position.set(0.04, 0.2, 0);
  head.castShadow = true;
  bunny.add(head);

  // Tall ears
  [-1, 1].forEach((side) => {
    const ear = new Mesh(new CylinderGeometry(0.02, 0.03, 0.18, 8), pinkMat);
    ear.name = `toybox_animals_bunny_ear${side}`;
    ear.position.set(0.02, 0.36, side * 0.04);
    ear.rotation.z = side * 0.15;
    bunny.add(ear);

    const innerEar = new Mesh(new CylinderGeometry(0.01, 0.02, 0.14, 8), innerEarMat);
    innerEar.name = `toybox_animals_bunny_innerEar${side}`;
    innerEar.position.set(0.025, 0.36, side * 0.04);
    innerEar.rotation.z = side * 0.15;
    bunny.add(innerEar);
  });

  // Eyes
  [-1, 1].forEach((side) => {
    const eyeW = new Mesh(new SphereGeometry(0.025, 8, 8), whiteMat);
    eyeW.name = `toybox_animals_bunny_eyeW${side}`;
    eyeW.position.set(0.08, 0.22, side * 0.05);
    bunny.add(eyeW);

    const eyeP = new Mesh(new SphereGeometry(0.015, 8, 8), eyeMat);
    eyeP.name = `toybox_animals_bunny_eyeP${side}`;
    eyeP.position.set(0.1, 0.22, side * 0.052);
    bunny.add(eyeP);
  });

  // Nose
  const nose = new Mesh(new SphereGeometry(0.015, 8, 8), noseMat);
  nose.name = 'toybox_animals_bunny_nose';
  nose.position.set(0.13, 0.18, 0);
  bunny.add(nose);

  // Cotton tail
  const tail = new Mesh(new SphereGeometry(0.04, 8, 8), whiteMat);
  tail.name = 'toybox_animals_bunny_tail';
  tail.position.set(-0.15, 0.0, 0);
  bunny.add(tail);

  // Stubby arms
  [-1, 1].forEach((side) => {
    const arm = new Mesh(new CylinderGeometry(0.025, 0.02, 0.1, 8), pinkMat);
    arm.name = `toybox_animals_bunny_arm${side}`;
    arm.position.set(0.08, 0.02, side * 0.1);
    arm.rotation.z = side * 0.4;
    bunny.add(arm);
  });

  return [body, head];
}
