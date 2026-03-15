import { CircleGeometry, Color, CylinderGeometry, Group, Mesh, SphereGeometry, type DirectionalLight, type Scene } from 'three';
import { createGlossyPaintMaterial, createPlasticMaterial } from '@app/utils/materialFactory';
import gsap from 'gsap';

/**
 * Creates a yellow rubber duck on the floor with a bobbing animation.
 * @param scene - The Three.js scene to add the rubber duck to
 * @param _keyLight - The directional light (unused)
 */
export function createRubberDuck(scene: Scene, _keyLight: DirectionalLight): void {
  const duckMat = createGlossyPaintMaterial('hub_duckMat', new Color(1.0, 0.88, 0.12));

  const root = new Group();
  root.name = 'floorDuck_root';
  root.position.set(1.5, 0, 2.5);
  root.rotation.y = Math.atan2(-1.5, -0.5); // face toward rug centre
  scene.add(root);

  // Body — rounded using geometry scaling
  const bodyGeo = new SphereGeometry(1, 12, 10);
  bodyGeo.scale(0.14, 0.11, 0.12);
  const body = new Mesh(bodyGeo, duckMat);
  body.name = 'duckBody';
  body.position.y = 0.11;
  body.castShadow = true;
  root.add(body);

  // Head — round, sits on top
  const head = new Mesh(new SphereGeometry(0.07, 10, 10), duckMat);
  head.name = 'duckHead';
  head.position.set(0, 0.12, 0.06);
  head.castShadow = true;
  body.add(head);

  // Beak — orange, protruding forward
  const beakGeo = new SphereGeometry(1, 8, 8);
  beakGeo.scale(0.04, 0.015, 0.03);
  const beak = new Mesh(beakGeo, createGlossyPaintMaterial('hub_duckBeakMat', new Color(1.0, 0.58, 0.12)));
  beak.name = 'duckBeak';
  beak.position.set(0, -0.015, 0.065);
  head.add(beak);

  // Eyes
  const eyeMat = createGlossyPaintMaterial('hub_duckEyeMat', new Color(0.06, 0.05, 0.05));
  [-1, 1].forEach((side) => {
    const eye = new Mesh(new CylinderGeometry(0.012, 0.012, 0.008, 10), eyeMat);
    eye.name = `duckEye${side}`;
    eye.position.set(side * 0.04, 0.025, 0.06);
    eye.rotation.x = Math.PI / 2;
    head.add(eye);

    const glint = new Mesh(new SphereGeometry(0.004, 4, 4), createGlossyPaintMaterial(`hub_duckGlintMat${side}`, new Color(1, 1, 1)));
    glint.name = `duckGlint${side}`;
    glint.position.set(0.004, 0.005, 0.003);
    eye.add(glint);
  });

  // Cheek blush
  const blushMat = createPlasticMaterial('hub_duckBlushMat', new Color(1.0, 0.6, 0.55));
  [-1, 1].forEach((side) => {
    const blush = new Mesh(new CircleGeometry(0.018, 10), blushMat);
    blush.name = `duckBlush${side}`;
    blush.position.set(side * 0.05, -0.01, 0.058);
    head.add(blush);
  });

  // Tail — small upward point
  const tail = new Mesh(new CylinderGeometry(0, 0.02, 0.05, 6), duckMat);
  tail.name = 'duckTail';
  tail.position.set(0, 0.06, -0.1);
  tail.rotation.x = -0.4;
  body.add(tail);

  // Wings — small bumps on each side
  [-1, 1].forEach((side) => {
    const wingGeo = new SphereGeometry(1, 8, 6);
    wingGeo.scale(0.03, 0.06, 0.05);
    const wing = new Mesh(wingGeo, duckMat);
    wing.name = `duckWing${side}`;
    wing.position.set(side * 0.1, 0, -0.01);
    body.add(wing);
  });

  // Bobbing animation
  gsap.to(root.position, {
    y: 0.03,
    duration: 200 / 60,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut',
  });
}
