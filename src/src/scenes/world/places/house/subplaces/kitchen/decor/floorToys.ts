import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry, type Scene } from 'three';
import { createGlossyPaintMaterial, createPlasticMaterial, createWoodMaterial, createFeltMaterial, createToyMetalMaterial } from '@app/utils/materialFactory';
import { getIdleAnimator } from '@app/utils/idle/registry';
import {
  TOY_BALL_RED_X,
  TOY_BALL_RED_Z,
  TOY_BALL_TEAL_X,
  TOY_BALL_TEAL_Z,
  TOY_BLOCKS_X,
  TOY_BLOCKS_Z,
  TOY_DUCK_X,
  TOY_DUCK_Z,
  TOY_FOOD_X,
  TOY_FOOD_Z,
  TOY_PLUSH_X,
  TOY_PLUSH_Z,
  TOY_POT_X,
  TOY_POT_Z,
  TOY_ROLLING_PIN_X,
  TOY_ROLLING_PIN_Z,
} from '../layout';

/**
 * Scatters a handful of toys across the kitchen's bare front floor so it reads
 * as a lived-in play space instead of an empty room. Positions are hand-placed
 * to avoid the breakfast table, the rug, the toybox and the owl's spawn.
 *
 * THE POSITIONS ARE IN `layout.ts` NOW, and the reason is written into the
 * history of this file. They used to be literals at the call site below. When
 * the room was shortened by 25% on 2026-08-02 the depth transform was applied to
 * `layout.ts`, where world positions are supposed to live — so the toybox moved
 * from z -5.7 to -2.175 and these toys did not move at all. Two of them ended up
 * INSIDE it. The docblock that replaced this one said the next rescale would
 * miss them again unless they moved; this is that move, made while the same
 * room's front floor was being dressed and the same trap was one file away.
 *
 * @param scene - The kitchen scene to add the toys to.
 */
export function createKitchenFloorToys(scene: Scene): void {
  addBall(scene, 'kit_ballRed', new Color(0.92, 0.2, 0.2), 0.14, TOY_BALL_RED_X, TOY_BALL_RED_Z, true);
  addBall(scene, 'kit_ballTeal', new Color(0.2, 0.62, 0.68), 0.11, TOY_BALL_TEAL_X, TOY_BALL_TEAL_Z, false);
  addBlocks(scene, TOY_BLOCKS_X, TOY_BLOCKS_Z);
  addDuck(scene, TOY_DUCK_X, TOY_DUCK_Z);
  addToyPot(scene, TOY_POT_X, TOY_POT_Z);
  addPlayFood(scene, TOY_FOOD_X, TOY_FOOD_Z);
  addRollingPin(scene, TOY_ROLLING_PIN_X, TOY_ROLLING_PIN_Z);
  addPlush(scene, TOY_PLUSH_X, TOY_PLUSH_Z);
}

// A glossy bouncy ball with a white star, optionally gently rolling.
function addBall(scene: Scene, name: string, color: Color, r: number, x: number, z: number, roll: boolean): void {
  const ball = new Mesh(new SphereGeometry(r, 16, 14), createGlossyPaintMaterial(`${name}Mat`, color));
  ball.name = name;
  ball.position.set(x, r, z);
  ball.castShadow = true;
  scene.add(ball);
  const star = new Mesh(new CylinderGeometry(r * 0.32, r * 0.32, 0.005, 5), createPlasticMaterial(`${name}StarMat`, new Color(0.98, 0.98, 0.98)));
  star.rotation.x = Math.PI / 2;
  star.position.z = r;
  ball.add(star);
  if (roll) getIdleAnimator(scene).bob(ball, { axis: 'x', amplitude: 0.6, period: 900 / 60 });
}

// A stack of three chunky blocks.
function addBlocks(scene: Scene, x: number, z: number): void {
  const colors = [new Color(0.95, 0.75, 0.2), new Color(0.35, 0.6, 0.85), new Color(0.55, 0.78, 0.4)];
  const s = 0.17;
  colors.forEach((c, i) => {
    const block = new Mesh(new BoxGeometry(s, s, s), createGlossyPaintMaterial(`kit_block${i}Mat`, c));
    block.name = `kit_block${i}`;
    block.position.set(x + (i === 2 ? 0.06 : 0), s / 2 + i * s, z + (i === 2 ? 0.05 : 0));
    block.rotation.y = i * 0.3;
    block.castShadow = true;
    scene.add(block);
  });
}

// A little yellow rubber duck.
function addDuck(scene: Scene, x: number, z: number): void {
  const root = new Group();
  root.name = 'kit_duck';
  root.position.set(x, 0, z);
  root.rotation.y = -0.6;
  scene.add(root);
  const yellow = createGlossyPaintMaterial('kit_duckMat', new Color(0.98, 0.82, 0.16));
  const body = new Mesh(new SphereGeometry(0.13, 14, 12), yellow);
  body.scale.set(1, 0.85, 1.15);
  body.position.y = 0.12;
  body.castShadow = true;
  root.add(body);
  const head = new Mesh(new SphereGeometry(0.08, 12, 10), yellow);
  head.position.set(0, 0.24, 0.09);
  head.castShadow = true;
  root.add(head);
  const beak = new Mesh(new CylinderGeometry(0.02, 0.035, 0.05, 8), createGlossyPaintMaterial('kit_duckBeakMat', new Color(0.95, 0.55, 0.12)));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.235, 0.17);
  root.add(beak);
  [-1, 1].forEach((side) => {
    const eye = new Mesh(new SphereGeometry(0.012, 8, 6), createPlasticMaterial('kit_duckEyeMat', new Color(0.08, 0.07, 0.06)));
    eye.position.set(side * 0.035, 0.27, 0.14);
    root.add(eye);
  });
  getIdleAnimator(scene).bob(root, { axis: 'y', amplitude: 0.02, period: 150 / 60 });
}

// A toy cooking pot with a lid and two handles — kitchen play.
function addToyPot(scene: Scene, x: number, z: number): void {
  const root = new Group();
  root.name = 'kit_pot';
  root.position.set(x, 0, z);
  root.rotation.y = 0.5;
  scene.add(root);
  const steel = createToyMetalMaterial('kit_potMat', new Color(0.62, 0.64, 0.68));
  const body = new Mesh(new CylinderGeometry(0.16, 0.14, 0.18, 20), steel);
  body.position.y = 0.09;
  body.castShadow = true;
  root.add(body);
  const lid = new Mesh(new CylinderGeometry(0.17, 0.17, 0.03, 20), steel);
  lid.position.y = 0.195;
  root.add(lid);
  const knob = new Mesh(new SphereGeometry(0.03, 10, 8), createGlossyPaintMaterial('kit_potKnobMat', new Color(0.85, 0.3, 0.25)));
  knob.position.y = 0.22;
  root.add(knob);
  [-1, 1].forEach((side) => {
    const handle = new Mesh(new TorusGeometry(0.05, 0.014, 8, 12, Math.PI), steel);
    handle.position.set(side * 0.16, 0.11, 0);
    handle.rotation.z = side * Math.PI * 0.5;
    handle.rotation.y = Math.PI / 2;
    root.add(handle);
  });
}

// A couple of pieces of play food (apple + orange).
function addPlayFood(scene: Scene, x: number, z: number): void {
  const apple = new Mesh(new SphereGeometry(0.075, 12, 10), createGlossyPaintMaterial('kit_appleMat', new Color(0.85, 0.2, 0.18)));
  apple.name = 'kit_apple';
  apple.scale.set(1, 0.9, 1);
  apple.position.set(x, 0.07, z);
  apple.castShadow = true;
  scene.add(apple);
  const stem = new Mesh(new CylinderGeometry(0.008, 0.008, 0.04, 5), createWoodMaterial('kit_appleStemMat', new Color(0.4, 0.28, 0.16)));
  stem.position.y = 0.07;
  apple.add(stem);
  const orange = new Mesh(new SphereGeometry(0.07, 12, 10), createPlasticMaterial('kit_orangeMat', new Color(0.95, 0.55, 0.12)));
  orange.name = 'kit_orange';
  orange.position.set(x + 0.17, 0.07, z + 0.05);
  orange.castShadow = true;
  scene.add(orange);
}

// A wooden rolling pin lying on the floor.
function addRollingPin(scene: Scene, x: number, z: number): void {
  const root = new Group();
  root.name = 'kit_rollingPin';
  root.position.set(x, 0.05, z);
  root.rotation.y = 0.4;
  scene.add(root);
  const wood = createWoodMaterial('kit_pinMat', new Color(0.82, 0.66, 0.42));
  const barrel = new Mesh(new CylinderGeometry(0.05, 0.05, 0.34, 14), wood);
  barrel.rotation.z = Math.PI / 2;
  barrel.castShadow = true;
  root.add(barrel);
  [-1, 1].forEach((side) => {
    const handle = new Mesh(new CylinderGeometry(0.022, 0.022, 0.1, 10), wood);
    handle.rotation.z = Math.PI / 2;
    handle.position.x = side * 0.22;
    root.add(handle);
  });
}

// A small soft plush bunny.
function addPlush(scene: Scene, x: number, z: number): void {
  const root = new Group();
  root.name = 'kit_plush';
  root.position.set(x, 0, z);
  root.rotation.y = -1.2;
  scene.add(root);
  const fur = createFeltMaterial('kit_plushMat', new Color(0.86, 0.7, 0.72));
  const body = new Mesh(new SphereGeometry(0.11, 12, 10), fur);
  body.scale.set(1, 1.1, 0.9);
  body.position.y = 0.11;
  body.castShadow = true;
  root.add(body);
  const head = new Mesh(new SphereGeometry(0.08, 12, 10), fur);
  head.position.set(0, 0.26, 0.02);
  head.castShadow = true;
  root.add(head);
  [-1, 1].forEach((side) => {
    const ear = new Mesh(new SphereGeometry(0.03, 8, 7), fur);
    ear.scale.set(0.5, 1.3, 0.4);
    ear.position.set(side * 0.035, 0.35, 0.02);
    ear.rotation.z = side * 0.2;
    root.add(ear);
    const eye = new Mesh(new SphereGeometry(0.012, 8, 6), createPlasticMaterial('kit_plushEyeMat', new Color(0.1, 0.08, 0.08)));
    eye.position.set(side * 0.032, 0.28, 0.09);
    root.add(eye);
  });
  const nose = new Mesh(new SphereGeometry(0.014, 8, 6), createGlossyPaintMaterial('kit_plushNoseMat', new Color(0.8, 0.4, 0.45)));
  nose.position.set(0, 0.25, 0.1);
  root.add(nose);
}
