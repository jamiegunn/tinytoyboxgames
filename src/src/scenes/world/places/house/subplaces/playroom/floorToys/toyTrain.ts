import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry, Vector3, type DirectionalLight, type Scene } from 'three';
import { createGlossyPaintMaterial, createPlasticMaterial, createWoodMaterial } from '@app/utils/materialFactory';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import gsap from 'gsap';

/** Track radius — hugs the rug edge (rug radius = 3.8). */
const TRACK_RADIUS = 3.95;
const TRACK_Y = 0.01;
const TIE_COUNT = 48;

/**
 * Creates a toy train on circular tracks around the rug, animated with smoke puffs and horn.
 * @param scene - The Three.js scene to add the toy train to
 * @param _keyLight - The directional light (unused)
 */
export function createToyTrain(scene: Scene, _keyLight: DirectionalLight): void {
  const woodMat = createWoodMaterial('hub_trainWoodMat', new Color(0.65, 0.5, 0.32));
  const redMat = createGlossyPaintMaterial('hub_trainRedMat', new Color(0.88, 0.18, 0.18));
  const blueMat = createGlossyPaintMaterial('hub_trainBlueMat', new Color(0.25, 0.5, 0.88));
  const greenMat = createGlossyPaintMaterial('hub_trainGreenMat', new Color(0.3, 0.72, 0.35));
  const yellowMat = createGlossyPaintMaterial('hub_trainYellowMat', new Color(1.0, 0.85, 0.2));
  const wheelMat = createWoodMaterial('hub_trainWheelMat', new Color(0.45, 0.32, 0.2));
  const railMat = createPlasticMaterial('hub_trainRailMat', new Color(0.08, 0.08, 0.08));
  const tieMat = createWoodMaterial('hub_trainTieMat', new Color(0.4, 0.28, 0.15));

  // ── Circular track ──

  // Two rails — thin torus rings (black)
  const railTube = 0.015;
  [-0.08, 0.08].forEach((offset, ri) => {
    const railGeo = new TorusGeometry(TRACK_RADIUS + offset, railTube, 8, 64);
    railGeo.rotateX(Math.PI / 2);
    const rail = new Mesh(railGeo, railMat);
    rail.name = `trackRail${ri}`;
    rail.position.y = TRACK_Y + railTube;
    scene.add(rail);
  });

  // Cross-ties — short planks arranged radially
  for (let i = 0; i < TIE_COUNT; i++) {
    const angle = (i / TIE_COUNT) * Math.PI * 2;
    const tie = new Mesh(new BoxGeometry(0.22, 0.015, 0.04), tieMat);
    tie.name = `trackTie${i}`;
    tie.position.set(Math.cos(angle) * TRACK_RADIUS, TRACK_Y, Math.sin(angle) * TRACK_RADIUS);
    tie.rotation.y = -angle + Math.PI / 2;
    scene.add(tie);
  }

  // ── Train assembly — all cars in one group that orbits the track ──
  const trainRoot = new Group();
  trainRoot.name = 'trainRoot';
  scene.add(trainRoot);

  // Orbit pivot — rotates around Y axis at origin
  const orbitPivot = new Group();
  orbitPivot.name = 'trainOrbitPivot';
  trainRoot.add(orbitPivot);

  // Train carriage group — positioned at track radius, facing tangent
  const trainGroup = new Group();
  trainGroup.name = 'trainGroup';
  trainGroup.position.set(TRACK_RADIUS, TRACK_Y + 0.04, 0);
  trainGroup.rotation.y = -Math.PI / 2; // face tangent direction (engine leads)
  orbitPivot.add(trainGroup);

  // ── Locomotive ──
  const loco = new Mesh(new BoxGeometry(0.35, 0.18, 0.22), redMat);
  loco.name = 'trainLoco';
  loco.position.set(0, 0.09, 0);
  loco.castShadow = true;
  trainGroup.add(loco);

  // Boiler
  const boiler = new Mesh(new CylinderGeometry(0.08, 0.08, 0.22, 12), redMat);
  boiler.name = 'trainBoiler';
  boiler.position.set(0.12, 0.04, 0);
  boiler.rotation.z = Math.PI / 2;
  loco.add(boiler);

  // Smokestack
  const stack = new Mesh(new CylinderGeometry(0.035, 0.02, 0.12, 10), yellowMat);
  stack.name = 'trainStack';
  stack.position.set(0.15, 0.16, 0);
  loco.add(stack);

  // Cab
  const cab = new Mesh(new BoxGeometry(0.14, 0.16, 0.2), redMat);
  cab.name = 'trainCab';
  cab.position.set(-0.1, 0.15, 0);
  loco.add(cab);

  const roof = new Mesh(new BoxGeometry(0.18, 0.025, 0.24), blueMat);
  roof.name = 'trainRoof';
  roof.position.y = 0.09;
  cab.add(roof);

  // Wheels
  [
    [-0.12, 0.12],
    [-0.12, -0.12],
    [0.1, 0.12],
    [0.1, -0.12],
  ].forEach((wp, wi) => {
    const wheel = new Mesh(new CylinderGeometry(0.04, 0.04, 0.025, 12), wheelMat);
    wheel.name = `trainLocoWheel${wi}`;
    wheel.position.set(wp[0], -0.07, wp[1]);
    wheel.rotation.x = Math.PI / 2;
    loco.add(wheel);
  });

  // ── Cargo car 1 (blue with pegs) ──
  const car2 = new Mesh(new BoxGeometry(0.28, 0.14, 0.2), blueMat);
  car2.name = 'trainCar2';
  car2.position.set(-0.38, -0.02, 0);
  loco.add(car2);

  [0, 1, 2].forEach((ci) => {
    const peg = new Mesh(new CylinderGeometry(0.02, 0.02, 0.08, 8), ci === 0 ? yellowMat : ci === 1 ? greenMat : redMat);
    peg.name = `trainPeg${ci}`;
    peg.position.set(-0.06 + ci * 0.06, 0.1, 0);
    car2.add(peg);
  });

  [
    [-0.08, 0.11],
    [-0.08, -0.11],
    [0.08, 0.11],
    [0.08, -0.11],
  ].forEach((wp, wi) => {
    const wheel = new Mesh(new CylinderGeometry(0.03, 0.03, 0.02, 10), wheelMat);
    wheel.name = `trainCar2Wheel${wi}`;
    wheel.position.set(wp[0], -0.06, wp[1]);
    wheel.rotation.x = Math.PI / 2;
    car2.add(wheel);
  });

  // ── Cargo car 2 (green flatbed) ──
  const car3 = new Mesh(new BoxGeometry(0.24, 0.1, 0.18), greenMat);
  car3.name = 'trainCar3';
  car3.position.set(-0.68, -0.04, 0);
  loco.add(car3);

  const cargo = new Mesh(new BoxGeometry(0.14, 0.1, 0.12), woodMat);
  cargo.name = 'trainCargo';
  cargo.position.y = 0.1;
  car3.add(cargo);

  [
    [-0.06, 0.1],
    [-0.06, -0.1],
    [0.06, 0.1],
    [0.06, -0.1],
  ].forEach((wp, wi) => {
    const wheel = new Mesh(new CylinderGeometry(0.03, 0.03, 0.02, 10), wheelMat);
    wheel.name = `trainCar3Wheel${wi}`;
    wheel.position.set(wp[0], -0.04, wp[1]);
    wheel.rotation.x = Math.PI / 2;
    car3.add(wheel);
  });

  // Connectors
  const connMat = createWoodMaterial('hub_trainConnMat', new Color(0.5, 0.38, 0.22));
  [-0.26, -0.54].forEach((cx, ci) => {
    const conn = new Mesh(new CylinderGeometry(0.0075, 0.0075, 0.08, 4), connMat);
    conn.name = `trainConn${ci}`;
    conn.position.set(cx, -0.02, 0);
    conn.rotation.z = Math.PI / 2;
    loco.add(conn);
  });

  // ── Orbit animation — train goes around the track (clockwise when viewed from above) ──
  gsap.to(orbitPivot.rotation, {
    y: -Math.PI * 2,
    duration: 30,
    repeat: -1,
    ease: 'none',
  });

  // ── Smoke puffs — recycling pool of small spheres ──
  const smokeMat = createPlasticMaterial('hub_trainSmokeMat', new Color(0.9, 0.9, 0.92));
  smokeMat.transparent = true;
  smokeMat.opacity = 0.6;

  const PUFF_COUNT = 6;
  const puffs: Mesh[] = [];
  for (let i = 0; i < PUFF_COUNT; i++) {
    const puff = new Mesh(new SphereGeometry(0.03, 6, 6), smokeMat.clone());
    puff.name = `smokePuff${i}`;
    puff.visible = false;
    scene.add(puff);
    puffs.push(puff);
  }

  // Emit a puff every ~0.8 seconds
  let puffIndex = 0;
  const stackWorldPos = new Vector3();
  const emitPuff = () => {
    const puff = puffs[puffIndex % PUFF_COUNT];
    puffIndex++;

    // Read the smokestack's actual world position from the scene graph
    stack.getWorldPosition(stackWorldPos);

    puff.position.copy(stackWorldPos);
    puff.scale.setScalar(0.8);
    puff.visible = true;
    const mat = puff.material as typeof smokeMat;
    mat.opacity = 0.6;

    gsap.to(puff.position, {
      y: 0.9,
      duration: 1.5,
      ease: 'power1.out',
    });
    gsap.to(puff.scale, {
      x: 2.5,
      y: 2.5,
      z: 2.5,
      duration: 1.5,
      ease: 'power1.out',
    });
    gsap.to(mat, {
      opacity: 0,
      duration: 1.5,
      ease: 'power1.in',
      onComplete: () => {
        puff.visible = false;
      },
    });
  };

  // Start emitting puffs on a repeating timer
  gsap.to(
    {},
    {
      duration: 0.8,
      repeat: -1,
      onRepeat: emitPuff,
      onStart: emitPuff,
    },
  );

  // ── Train horn — plays periodically ──
  const hornInterval = () => {
    triggerSound('sfx_hub_train_horn');
    // Schedule next horn between 12 and 20 seconds
    const nextDelay = 12 + Math.random() * 8;
    gsap.delayedCall(nextDelay, hornInterval);
  };
  // First horn after 6 seconds
  gsap.delayedCall(6, hornInterval);
}
