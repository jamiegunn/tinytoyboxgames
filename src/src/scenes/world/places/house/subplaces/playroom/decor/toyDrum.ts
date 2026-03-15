import { Color, CylinderGeometry, Group, Mesh, SphereGeometry, type DirectionalLight, type Scene } from 'three';
import { createGlossyPaintMaterial, createPlasticMaterial, createWoodMaterial } from '@app/utils/materialFactory';

/**
 * Creates a toy drum with crossed drumsticks on the right side
 * of the blue (animals) toybox.
 * @param scene - The Three.js scene to add the drum to
 * @param _keyLight - The directional light (unused)
 */
export function createToyDrum(scene: Scene, _keyLight: DirectionalLight): void {
  // Green (creative) dresser toybox left side (as seen from front).
  // Dresser at (-2.8, 0.01, 8.25), rot PI, scale 0.75. Top ≈ Y 1.02.
  // Left edge in world ≈ x = -1.45.
  const root = new Group();
  root.name = 'toyDrum_root';
  root.position.set(-1.6, 1.02, 8.25);
  root.rotation.y = 0.4;
  scene.add(root);

  const shellMat = createGlossyPaintMaterial('hub_drumShellMat', new Color(0.92, 0.28, 0.28));
  const headMat = createPlasticMaterial('hub_drumHeadMat', new Color(0.95, 0.92, 0.85));
  const rimMat = createGlossyPaintMaterial('hub_drumRimMat', new Color(0.85, 0.75, 0.2));
  const stripeMat = createGlossyPaintMaterial('hub_drumStripeMat', new Color(0.95, 0.95, 0.92));
  const stickMat = createWoodMaterial('hub_drumStickMat', new Color(0.7, 0.55, 0.35));
  const tipMat = createPlasticMaterial('hub_drumTipMat', new Color(0.92, 0.92, 0.88));

  // Drum shell
  const shell = new Mesh(new CylinderGeometry(0.16, 0.16, 0.14, 16), shellMat);
  shell.name = 'drumShell';
  shell.position.y = 0.07;
  shell.castShadow = true;
  root.add(shell);

  // Decorative stripes around the shell
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const stripe = new Mesh(new CylinderGeometry(0.005, 0.005, 0.12, 4), stripeMat);
    stripe.name = `drumStripe${i}`;
    stripe.position.set(Math.cos(angle) * 0.161, 0, Math.sin(angle) * 0.161);
    shell.add(stripe);
  }

  // Drum head (top)
  const drumTop = new Mesh(new CylinderGeometry(0.16, 0.16, 0.008, 16), headMat);
  drumTop.name = 'drumTop';
  drumTop.position.y = 0.074;
  shell.add(drumTop);

  // Drum bottom
  const drumBottom = new Mesh(new CylinderGeometry(0.16, 0.16, 0.008, 16), headMat);
  drumBottom.name = 'drumBottom';
  drumBottom.position.y = -0.074;
  shell.add(drumBottom);

  // Rims (top and bottom)
  const rimTop = new Mesh(new CylinderGeometry(0.165, 0.165, 0.015, 16), rimMat);
  rimTop.name = 'drumRimTop';
  rimTop.position.y = 0.068;
  shell.add(rimTop);

  const rimBottom = new Mesh(new CylinderGeometry(0.165, 0.165, 0.015, 16), rimMat);
  rimBottom.name = 'drumRimBottom';
  rimBottom.position.y = -0.068;
  shell.add(rimBottom);

  // Drumsticks — crossed on top of the drum
  [-1, 1].forEach((side) => {
    const stick = new Mesh(new CylinderGeometry(0.008, 0.006, 0.24, 6), stickMat);
    stick.name = `drumStick${side}`;
    stick.position.set(side * 0.02, 0.09, 0);
    stick.rotation.z = side * 0.4;
    stick.rotation.x = Math.PI / 2 - 0.1;
    stick.castShadow = true;
    shell.add(stick);

    // Rounded tip
    const tip = new Mesh(new SphereGeometry(0.012, 6, 6), tipMat);
    tip.name = `drumStickTip${side}`;
    tip.position.y = 0.12;
    stick.add(tip);
  });
}
