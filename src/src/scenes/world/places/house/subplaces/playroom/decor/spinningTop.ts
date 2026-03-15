import { Color, CylinderGeometry, Mesh, SphereGeometry, TorusGeometry, type DirectionalLight, type Scene } from 'three';
import { createGlossyPaintMaterial, createToyMetalMaterial } from '@app/utils/materialFactory';
import gsap from 'gsap';

/**
 * Creates a striped spinning top with a metal tip, knob handle, and wobble animation.
 * @param scene - The Three.js scene to add the top to
 * @param _keyLight - The directional light (unused)
 */
export function createSpinningTop(scene: Scene, _keyLight: DirectionalLight): void {
  const topBody = new Mesh(new CylinderGeometry(0.02, 0.15, 0.2, 16), createGlossyPaintMaterial('hub_spinTopMat', new Color(0.2, 0.6, 0.85)));
  topBody.name = 'spinTop';
  topBody.position.set(3.0, 0.14, -2.0);
  topBody.castShadow = true;
  scene.add(topBody);

  // Stripe bands
  const stripeColors = [new Color(1.0, 0.85, 0.2), new Color(0.9, 0.25, 0.25), new Color(0.3, 0.8, 0.4)];
  for (let si = 0; si < stripeColors.length; si++) {
    const stripe = new Mesh(new TorusGeometry((0.22 - si * 0.05) / 2, 0.01, 16, 16), createGlossyPaintMaterial(`hub_spinStripeMat${si}`, stripeColors[si]));
    stripe.name = `spinStripe${si}`;
    stripe.position.y = -0.02 + si * 0.05;
    topBody.add(stripe);
  }

  // Tip
  const tip = new Mesh(new CylinderGeometry(0.02, 0, 0.08, 8), createToyMetalMaterial('hub_spinTipMat', new Color(0.7, 0.65, 0.5)));
  tip.name = 'spinTip';
  tip.position.y = -0.14;
  topBody.add(tip);

  // Handle knob
  const knob = new Mesh(new SphereGeometry(0.03, 8, 8), createGlossyPaintMaterial('hub_spinKnobMat', new Color(0.85, 0.2, 0.2)));
  knob.name = 'spinKnob';
  knob.position.y = 0.12;
  topBody.add(knob);

  // Wobble animation
  gsap.to(topBody.rotation, {
    z: -0.05,
    duration: 4,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut',
  });
  topBody.rotation.z = 0.05;
}
