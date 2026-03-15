import { Color, CylinderGeometry, Mesh, SphereGeometry, TorusGeometry, type DirectionalLight, type Scene } from 'three';
import { createGlossyPaintMaterial, createWoodMaterial } from '@app/utils/materialFactory';

/**
 * Creates a stacking ring toy with a wood base, peg, knob, and five graduated coloured rings.
 * @param scene - The Three.js scene to add the stacking rings to
 * @param _keyLight - The directional light (unused)
 */
export function createStackingRings(scene: Scene, _keyLight: DirectionalLight): void {
  const baseMat = createWoodMaterial('hub_pegMat', new Color(0.65, 0.5, 0.32));

  const base = new Mesh(new CylinderGeometry(0.325, 0.325, 0.06, 24), baseMat);
  base.name = 'ringBase';
  base.position.set(-0.5, 0.03, -0.5);
  base.castShadow = true;
  scene.add(base);

  const peg = new Mesh(new CylinderGeometry(0.03, 0.035, 0.4, 12), baseMat);
  peg.name = 'ringPeg';
  peg.position.set(-0.5, 0.26, -0.5);
  peg.castShadow = true;
  scene.add(peg);

  const knob = new Mesh(new SphereGeometry(0.05, 10, 10), createGlossyPaintMaterial('hub_ringKnobMat', new Color(0.9, 0.2, 0.2)));
  knob.name = 'ringKnob';
  knob.position.y = 0.22;
  peg.add(knob);

  const ringColors = [
    new Color(0.88, 0.15, 0.18),
    new Color(1.0, 0.55, 0.08),
    new Color(1.0, 0.85, 0.15),
    new Color(0.25, 0.75, 0.35),
    new Color(0.35, 0.55, 0.9),
  ];
  const ringSizes = [0.54, 0.46, 0.38, 0.3, 0.22];

  for (let i = 0; i < 5; i++) {
    const ring = new Mesh(new TorusGeometry(ringSizes[i] / 2, 0.05, 16, 24), createGlossyPaintMaterial(`hub_ringMat${i}`, ringColors[i]));
    ring.name = `stackRing${i}`;
    ring.position.set(-0.5, 0.08 + i * 0.08, -0.5);
    // Torus defaults to XY plane — rotate to lie flat on the floor
    ring.rotation.x = Math.PI / 2;
    ring.castShadow = true;
    scene.add(ring);

    // Top ring sits slightly askew for a playful look
    if (i === 4) {
      ring.rotation.z = 0.12;
      ring.position.x += 0.02;
    }
  }
}
