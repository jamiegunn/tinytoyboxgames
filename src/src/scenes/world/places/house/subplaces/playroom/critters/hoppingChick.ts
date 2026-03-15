import { CircleGeometry, Color, CylinderGeometry, Mesh, SphereGeometry, type DirectionalLight, type Scene } from 'three';
import { createFeltMaterial, createGlossyPaintMaterial, createPlasticMaterial } from '@app/utils/materialFactory';
import gsap from 'gsap';

/**
 * Creates an animated hopping chick toy.
 * @param scene - The Three.js scene to add the chick to
 * @param _keyLight - The directional light (unused)
 */
export function createHoppingChick(scene: Scene, _keyLight: DirectionalLight): void {
  const chickMat = createFeltMaterial('chickMat', new Color(1.0, 0.88, 0.25));

  const body = new Mesh(new SphereGeometry(0.16, 12, 12), chickMat);
  body.name = 'chick';
  body.position.set(1.5, 0.16, -1.5);
  body.castShadow = true;
  scene.add(body);

  // Head
  const head = new Mesh(new SphereGeometry(0.12, 10, 10), chickMat);
  head.name = 'chickHead';
  head.position.y = 0.2;
  body.add(head);

  // Beak
  const beak = new Mesh(new SphereGeometry(0.5, 6, 6), createFeltMaterial('beakMat', new Color(1.0, 0.55, 0.15)));
  beak.name = 'chickBeak';
  beak.scale.set(0.07, 0.035, 0.06);
  beak.position.set(0, -0.02, 0.12);
  head.add(beak);

  // Button eyes
  const eyeMat = createGlossyPaintMaterial('chickEyeMat', new Color(0.06, 0.05, 0.05));
  [-1, 1].forEach((side) => {
    const eye = new Mesh(new CylinderGeometry(0.0175, 0.0175, 0.012, 10), eyeMat);
    eye.name = `chickEye${side}`;
    eye.position.set(side * 0.065, 0.03, 0.1);
    eye.rotation.x = Math.PI / 2;
    head.add(eye);

    const glint = new Mesh(new SphereGeometry(0.005, 4, 4), createGlossyPaintMaterial(`hub_chickGlintMat${side}`, new Color(1, 1, 1)));
    glint.name = `chickGlint${side}`;
    glint.position.set(0.006, 0.007, 0.003);
    eye.add(glint);
  });

  // Blush cheeks
  const chickBlushMat = createPlasticMaterial('hub_chickBlushMat', new Color(1.0, 0.6, 0.55));
  [-1, 1].forEach((side) => {
    const blush = new Mesh(new CircleGeometry(0.025, 10), chickBlushMat);
    blush.name = `chickBlush${side}`;
    blush.position.set(side * 0.075, -0.02, 0.09);
    head.add(blush);
  });

  // Wings
  [-1, 1].forEach((side) => {
    const wing = new Mesh(new SphereGeometry(0.5, 6, 6), chickMat);
    wing.name = `chickWing${side}`;
    wing.scale.set(0.06, 0.14, 0.1);
    wing.position.set(side * 0.14, 0.02, 0);
    body.add(wing);
  });

  // Feet
  const feetMat = createFeltMaterial('hub_chickFeetMat', new Color(1.0, 0.55, 0.15));
  [-1, 1].forEach((side) => {
    const foot = new Mesh(new SphereGeometry(0.5, 6, 6), feetMat);
    foot.name = `chickFoot${side}`;
    foot.scale.set(0.06, 0.02, 0.08);
    foot.position.set(side * 0.06, -0.15, 0.02);
    body.add(foot);
  });

  // Hop animation
  const hopTimeline = gsap.timeline({ repeat: -1 });
  hopTimeline.to(body.position, { y: 0.42, duration: 10 / 60, ease: 'power2.out' });
  hopTimeline.to(body.position, { y: 0.16, duration: 10 / 60, ease: 'power2.in' });
  hopTimeline.to(body.position, { y: 0.16, duration: 130 / 60 }); // pause
}
